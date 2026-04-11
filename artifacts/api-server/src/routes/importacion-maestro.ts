/**
 * importacion-maestro.ts
 *
 * Carga masiva desde la Plantilla Maestra Excel (.xlsx)
 * Procesa 16 hojas en orden de dependencias:
 *   1. clientes → 2. turnos → 3. sedes → 4. puestos → 5. colaboradores
 *   6. zonas → 7. armas → 8. vehiculos → 9. bodega_categorias → 10. bodega_articulos
 *   11. anticipos → 12. historial_prestaciones → 13. usuarios → 14. roles
 *   15. modulos → 16. igss_patrono
 *
 * El frontend parsea el Excel y envía:
 *   POST /api/importacion/maestro
 *   { sheets: { clientes: Row[], turnos: Row[], ... }, preview: boolean }
 */

import { Router } from "express";
import { pool } from "@workspace/db";
import bcrypt from "bcryptjs";

export const importacionMaestroRouter = Router();

function trim(v: any): string {
  return String(v ?? "").trim();
}

function parseBool(v: any): boolean {
  return ["si", "sí", "yes", "true", "1", "s"].includes(String(v ?? "").trim().toLowerCase());
}

function parseDate(v: any): string | null {
  // 1. Objeto Date nativo de Excel (más confiable — verificar primero)
  if (v instanceof Date && !isNaN(v.getTime())) return v.toISOString().slice(0, 10);
  // 2. Número serial de Excel (días desde 1900)
  const n = Number(v);
  if (!isNaN(n) && n > 1000 && typeof v === "number") {
    const ms = Date.UTC(1899, 11, 30) + n * 86400000;
    return new Date(ms).toISOString().slice(0, 10);
  }
  const s = trim(v);
  if (!s) return null;
  // 3. ISO: yyyy-mm-dd
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  // 4. dd/mm/aaaa o d/m/aaaa (formato guatemalteco — 1 o 2 dígitos día/mes)
  const dmatch = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dmatch) {
    const d = dmatch[1].padStart(2, "0");
    const m = dmatch[2].padStart(2, "0");
    const y = dmatch[3];
    // Si el día > 12, es inequívocamente DD/MM
    // Si el mes > 12, es inequívocamente MM/DD (formato americano) → convertir
    if (parseInt(m) > 12) {
      // Formato americano M/D/YYYY: el segundo número es el día
      return `${y}-${d}-${m}`;
    }
    // Asumir DD/MM/YYYY (formato guatemalteco)
    return `${y}-${m}-${d}`;
  }
  return null;
}

function parseNum(v: any, def: number | null = null): number | null {
  const n = parseFloat(String(v ?? "").replace(/,/g, ""));
  return isNaN(n) ? def : n;
}

type SheetResult = {
  hoja: string;
  total: number;
  exitosos: number;
  errores: number;
  omitidos: number;
  detalle: { fila: number; estado: "ok" | "error" | "omitido"; mensaje?: string }[];
};

function emptyResult(hoja: string): SheetResult {
  return { hoja, total: 0, exitosos: 0, errores: 0, omitidos: 0, detalle: [] };
}

// ─── Auth ────────────────────────────────────────────────────────────────────
function requireAdmin(req: any, res: any): boolean {
  try {
    const session = JSON.parse(req.headers["x-isp-session"] as string);
    if (!["admin"].includes(session.rol)) {
      res.status(403).json({ error: "Solo administradores pueden importar datos" });
      return false;
    }
    return true;
  } catch {
    res.status(401).json({ error: "Sesión inválida" });
    return false;
  }
}

// ─── POST /api/importacion/maestro ───────────────────────────────────────────
importacionMaestroRouter.post("/importacion/maestro", async (req: any, res: any) => {
  if (!requireAdmin(req, res)) return;

  const { sheets, preview = false } = req.body as {
    sheets: Record<string, Record<string, any>[]>;
    preview: boolean;
  };

  if (!sheets || typeof sheets !== "object") {
    return res.status(400).json({ error: "Se requiere el objeto sheets con las hojas del Excel" });
  }

  const resultados: SheetResult[] = [];

  // Caches en memoria para resolución de referencias cruzadas
  const clienteIdByNombre: Record<string, number> = {};
  const turnoIdByNombre: Record<string, number> = {};
  const sedeIdByNombre: Record<string, number> = {};
  const zonaIdByNombre: Record<string, number> = {};
  const empleadoIdByDpi: Record<string, number> = {};
  const empleadoIdByNombre: Record<string, number> = {};
  const puestoIdByNombre: Record<string, number> = {};
  // zona_nombre pendiente de asignar a puestos: puestoId -> zona_nombre_lower
  const puestoZonaPending: Record<number, string> = {};

  // Pre-cargar datos existentes en la BD
  try {
    const { rows: clis } = await pool.query(`SELECT id, LOWER(nombre) AS n FROM clients`);
    clis.forEach((r: any) => { clienteIdByNombre[r.n] = r.id; });

    const { rows: turns } = await pool.query(`SELECT id, LOWER(nombre) AS n FROM turnos`);
    turns.forEach((r: any) => { turnoIdByNombre[r.n] = r.id; });

    const { rows: sedes } = await pool.query(`SELECT id, LOWER(nombre) AS n FROM client_sedes WHERE activo = TRUE`);
    sedes.forEach((r: any) => { sedeIdByNombre[r.n] = r.id; });

    const { rows: zonas } = await pool.query(`SELECT id, LOWER(nombre) AS n FROM operational_zones`);
    zonas.forEach((r: any) => { zonaIdByNombre[r.n] = r.id; });

    const { rows: emps } = await pool.query(`SELECT id, dpi, LOWER(nombre_completo) AS n FROM employees WHERE dpi IS NOT NULL`);
    emps.forEach((r: any) => {
      if (r.dpi) empleadoIdByDpi[r.dpi] = r.id;
      empleadoIdByNombre[r.n] = r.id;
    });

    const { rows: puestos } = await pool.query(`SELECT id, LOWER(nombre) AS n FROM puestos_operativos`);
    puestos.forEach((r: any) => { puestoIdByNombre[r.n] = r.id; });
  } catch {
    // No bloqueante — los caches quedarán vacíos
  }

  // ── 1. CLIENTES ─────────────────────────────────────────────────────────────
  const clienteRows = sheets["CLIENTES"] ?? sheets["clientes"] ?? [];
  const rClientes = emptyResult("Clientes");
  rClientes.total = clienteRows.length;

  for (let i = 0; i < clienteRows.length; i++) {
    const row = clienteRows[i];
    const fila = i + 2;
    const nombre = trim(row["nombre"]);
    if (!nombre) {
      rClientes.detalle.push({ fila, estado: "error", mensaje: "nombre es obligatorio" });
      rClientes.errores++; continue;
    }
    const key = nombre.toLowerCase();
    if (clienteIdByNombre[key]) {
      rClientes.detalle.push({ fila, estado: "omitido", mensaje: `"${nombre}" ya existe` });
      rClientes.omitidos++; continue;
    }
    if (preview) {
      rClientes.detalle.push({ fila, estado: "ok" });
      rClientes.exitosos++; continue;
    }
    try {
      const { rows: ins } = await pool.query(
        `INSERT INTO clients
           (nombre, nombre_comercial, nit, sector, estado,
            fecha_inicio_contrato, tarifa_base_mensual,
            igss_aplica, igss_codigo_centro, igss_direccion, igss_zona,
            igss_departamento, igss_municipio, igss_codigo_actividad,
            igss_contacto, igss_telefono, igss_email, notas)
         VALUES ($1,$2,$3,$4,'activo',$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
         RETURNING id`,
        [
          nombre,
          trim(row["nombre_comercial"]) || nombre,
          trim(row["nit"]) || null,
          trim(row["sector"]) || null,
          parseDate(row["fecha_inicio_contrato"]),
          parseNum(row["tarifa_base_mensual"]),
          parseBool(row["igss_aplica"]),
          trim(row["igss_codigo_centro"]) || null,
          trim(row["igss_direccion"]) || null,
          trim(row["igss_zona"]) || null,
          parseNum(row["igss_departamento"]),
          parseNum(row["igss_municipio"]),
          trim(row["igss_codigo_actividad"]) || null,
          trim(row["igss_contacto"]) || null,
          trim(row["igss_telefono"]) || null,
          trim(row["igss_email"]) || null,
          trim(row["notas"]) || null,
        ]
      );
      clienteIdByNombre[key] = ins[0].id;
      rClientes.detalle.push({ fila, estado: "ok" });
      rClientes.exitosos++;
    } catch (e: any) {
      rClientes.detalle.push({ fila, estado: "error", mensaje: e.message });
      rClientes.errores++;
    }
  }
  resultados.push(rClientes);

  // ── 2. TURNOS ───────────────────────────────────────────────────────────────
  const turnoRows = sheets["TURNOS"] ?? sheets["turnos"] ?? [];
  const rTurnos = emptyResult("Turnos");
  rTurnos.total = turnoRows.length;

  for (let i = 0; i < turnoRows.length; i++) {
    const row = turnoRows[i];
    const fila = i + 2;
    const nombre = trim(row["nombre"]);
    const horasTrabajo = parseNum(row["horas_trabajo"]);
    if (!nombre || horasTrabajo == null) {
      rTurnos.detalle.push({ fila, estado: "error", mensaje: "nombre y horas_trabajo son obligatorios" });
      rTurnos.errores++; continue;
    }
    const key = nombre.toLowerCase();
    if (turnoIdByNombre[key]) {
      rTurnos.detalle.push({ fila, estado: "omitido", mensaje: `"${nombre}" ya existe` });
      rTurnos.omitidos++; continue;
    }
    if (preview) {
      rTurnos.detalle.push({ fila, estado: "ok" });
      rTurnos.exitosos++; continue;
    }
    try {
      const { rows: ins } = await pool.query(
        `INSERT INTO turnos (nombre, descripcion, horas_trabajo, horas_descanso, num_titulares)
         VALUES ($1,$2,$3,$4,$5) RETURNING id`,
        [
          nombre,
          trim(row["descripcion"]) || null,
          horasTrabajo,
          parseNum(row["horas_descanso"]) ?? 0,
          parseNum(row["num_titulares"]) ?? 2,
        ]
      );
      turnoIdByNombre[key] = ins[0].id;
      rTurnos.detalle.push({ fila, estado: "ok" });
      rTurnos.exitosos++;
    } catch (e: any) {
      rTurnos.detalle.push({ fila, estado: "error", mensaje: e.message });
      rTurnos.errores++;
    }
  }
  resultados.push(rTurnos);

  // ── 3. SEDES DE CLIENTES ────────────────────────────────────────────────────
  const sedeRows = sheets["SEDES"] ?? sheets["sedes"] ?? [];
  const rSedes = emptyResult("Sedes de Clientes");
  rSedes.total = sedeRows.length;

  for (let i = 0; i < sedeRows.length; i++) {
    const row = sedeRows[i];
    const fila = i + 2;
    const nombre = trim(row["nombre"]);
    const clienteNombre = trim(row["cliente_nombre"]);
    if (!nombre || !clienteNombre) {
      rSedes.detalle.push({ fila, estado: "error", mensaje: "nombre y cliente_nombre son obligatorios" });
      rSedes.errores++; continue;
    }
    const key = nombre.toLowerCase();
    if (sedeIdByNombre[key]) {
      rSedes.detalle.push({ fila, estado: "omitido", mensaje: `"${nombre}" ya existe` });
      rSedes.omitidos++; continue;
    }
    if (preview) {
      rSedes.detalle.push({ fila, estado: "ok" });
      rSedes.exitosos++; continue;
    }
    try {
      const clienteId = clienteIdByNombre[clienteNombre.toLowerCase()] ?? null;
      const { rows: ins } = await pool.query(
        `INSERT INTO client_sedes (client_id, nombre, direccion, ciudad, contacto, telefono, notas)
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
        [
          clienteId,
          nombre,
          trim(row["direccion"]) || null,
          trim(row["ciudad"]) || null,
          trim(row["contacto"]) || null,
          trim(row["telefono"]) || null,
          trim(row["notas"]) || null,
        ]
      );
      sedeIdByNombre[key] = ins[0].id;
      rSedes.detalle.push({ fila, estado: "ok" });
      rSedes.exitosos++;
    } catch (e: any) {
      rSedes.detalle.push({ fila, estado: "error", mensaje: e.message });
      rSedes.errores++;
    }
  }
  resultados.push(rSedes);

  // ── 4. PUESTOS OPERATIVOS ──────────────────────────────────────────────────
  const puestoRows = sheets["PUESTOS"] ?? sheets["puestos"] ?? [];
  const rPuestos = emptyResult("Puestos Operativos");
  rPuestos.total = puestoRows.length;

  for (let i = 0; i < puestoRows.length; i++) {
    const row = puestoRows[i];
    const fila = i + 2;
    const nombre = trim(row["nombre"]);
    const clienteNombre = trim(row["cliente_nombre"]);
    if (!nombre || !clienteNombre) {
      rPuestos.detalle.push({ fila, estado: "error", mensaje: "nombre y cliente_nombre son obligatorios" });
      rPuestos.errores++; continue;
    }
    const clienteId = clienteIdByNombre[clienteNombre.toLowerCase()] ?? null;
    const key = nombre.toLowerCase();
    if (puestoIdByNombre[key]) {
      rPuestos.detalle.push({ fila, estado: "omitido", mensaje: `"${nombre}" ya existe` });
      rPuestos.omitidos++; continue;
    }
    if (preview) {
      rPuestos.detalle.push({ fila, estado: "ok" });
      rPuestos.exitosos++; continue;
    }
    try {
      const tipoRaw = trim(row["tipo"]).toLowerCase();
      const tiposValidos = ["vigilancia", "puerta", "bodega", "ruta", "planta", "perimetral"];
      const tipo = tiposValidos.includes(tipoRaw) ? tipoRaw : "vigilancia";
      const turnoNombre = trim(row["turno_nombre"]);
      const turnoId = turnoNombre ? (turnoIdByNombre[turnoNombre.toLowerCase()] ?? null) : null;

      const apIgssPuesto = parseBool(row["aplica_igss"]);
      const rawRegimenPuesto = trim(row["regimen_igss"]).toUpperCase();
      const regimenMap: Record<string, string> = {
        "IVS": "IVS", "EPS": "EPS", "EPS_IVS": "EPS_IVS", "NO_APLICA": "no_aplica",
      };
      const regimenPuesto = regimenMap[rawRegimenPuesto] ?? (apIgssPuesto ? "IVS" : "no_aplica");

      const sedeName = trim(row["sede_nombre"]).toLowerCase();
      const sedeId = sedeName ? (sedeIdByNombre[sedeName] ?? null) : null;
      const fechaInicioCiclo = parseDate(row["fecha_inicio_ciclo"]);
      const horaEntrada = trim(row["hora_entrada"]) || "07:00";

      const { rows: ins } = await pool.query(
        `INSERT INTO puestos_operativos
           (nombre, cliente_id, cliente_nombre, ubicacion, tipo, tipo_turno_id,
            aplica_igss, regimen_igss, salario_puesto, tarifa_puesto,
            sede_id, fecha_inicio_ciclo, hora_entrada, estado, activo, orden)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'activo',TRUE,0) RETURNING id`,
        [
          nombre,
          clienteId,
          clienteNombre,
          trim(row["ubicacion"]) || null,
          tipo,
          turnoId,
          apIgssPuesto,
          regimenPuesto,
          parseNum(row["salario_puesto"]),
          parseNum(row["tarifa_puesto"]),
          sedeId,
          fechaInicioCiclo,
          horaEntrada,
        ]
      );
      puestoIdByNombre[key] = ins[0].id;

      // Guardar zona_nombre para asignar después de que ZONAS sea procesado
      const zonaNombreRow = trim(row["zona_nombre"]).toLowerCase();
      if (zonaNombreRow) puestoZonaPending[ins[0].id] = zonaNombreRow;

      rPuestos.detalle.push({ fila, estado: "ok" });
      rPuestos.exitosos++;
    } catch (e: any) {
      rPuestos.detalle.push({ fila, estado: "error", mensaje: e.message });
      rPuestos.errores++;
    }
  }
  resultados.push(rPuestos);

  // ── 4. COLABORADORES ───────────────────────────────────────────────────────
  const colabRows = sheets["COLABORADORES"] ?? sheets["colaboradores"] ?? [];
  const rColab = emptyResult("Colaboradores");
  rColab.total = colabRows.length;

  const TIPOS_PERSONAL = ["guardia", "supervisor", "jefe_servicio", "administrativo_bodega", "administrativo_rrhh", "gerencia"];
  const ESTADOS_LABORALES = ["activo", "suspendido", "baja", "licencia"];

  for (let i = 0; i < colabRows.length; i++) {
    const row = colabRows[i];
    const fila = i + 2;
    const nombre = trim(row["nombre_completo"]);
    const dpi = trim(row["dpi"]);
    if (!nombre) {
      rColab.detalle.push({ fila, estado: "error", mensaje: "nombre_completo es obligatorio" });
      rColab.errores++; continue;
    }
    if (dpi && empleadoIdByDpi[dpi]) {
      rColab.detalle.push({ fila, estado: "omitido", mensaje: `DPI ${dpi} ya existe` });
      rColab.omitidos++; continue;
    }
    if (preview) {
      rColab.detalle.push({ fila, estado: "ok" });
      rColab.exitosos++; continue;
    }
    try {
      const rawTipo = trim(row["tipo_personal"]).toLowerCase();
      const tipoPersonal = TIPOS_PERSONAL.includes(rawTipo) ? rawTipo : "guardia";
      const rawEstado = trim(row["estado_laboral"]).toLowerCase();
      const estadoLaboral = ESTADOS_LABORALES.includes(rawEstado) ? rawEstado : "activo";
      const clienteNombre = trim(row["cliente_nombre"]);
      const clienteId = clienteNombre ? (clienteIdByNombre[clienteNombre.toLowerCase()] ?? null) : null;
      const apIgss = parseBool(row["aplica_igss"]);
      const rawEstIgss = trim(row["estado_igss"]).toLowerCase();
      const estadoIgss = ["activo", "no_activo", "pendiente_regularizacion"].includes(rawEstIgss)
        ? rawEstIgss : (apIgss ? "activo" : "no_activo");
      const rawJornada = trim(row["tipo_jornada"]).toLowerCase();
      const tipoJornada = ["completa", "parcial", "mixta"].includes(rawJornada) ? rawJornada : "completa";

      const { rows: ins } = await pool.query(
        `INSERT INTO employees (
           nombre_completo, dpi, fecha_ingreso, tipo_personal, estado_laboral,
           telefono, telefono_secundario, correo, sede, nit,
           sueldo_base, tipo_jornada, dia_descanso, horas_contrato,
           bonificacion_incentivo, bonificacion_1, bonificacion_2, bonificacion_3,
           limite_anticipo, aplica_igss_general, estado_igss, igss_numero,
           banco, cuenta_bancaria, forma_pago, tipo_cuenta,
           cliente_id, notas,
           source_system, sync_status
         ) VALUES (
           $1,$2,$3,$4,$5,
           $6,$7,$8,$9,$10,
           $11,$12,$13,$14,
           $15,$16,$17,$18,
           $19,$20,$21,$22,
           $23,$24,$25,$26,
           $27,$28,
           'importacion_maestra','manual'
         ) RETURNING id`,
        [
          nombre,
          dpi || null,
          parseDate(row["fecha_ingreso"]),
          tipoPersonal,
          estadoLaboral,
          trim(row["telefono"]) || null,
          trim(row["telefono_secundario"]) || null,
          trim(row["correo"]) || null,
          trim(row["sede"]) || null,
          trim(row["nit"]) || null,
          parseNum(row["sueldo_base"]),
          tipoJornada,
          trim(row["dia_descanso"]) || null,
          parseNum(row["horas_contrato"]),
          parseNum(row["bonificacion_incentivo"]) ?? 250,
          parseNum(row["bonificacion_1"]),
          parseNum(row["bonificacion_2"]),
          parseNum(row["bonificacion_3"]),
          parseNum(row["limite_anticipo"]),
          apIgss,
          estadoIgss,
          trim(row["igss_numero"]) || null,
          trim(row["banco"]) || null,
          trim(row["cuenta_bancaria"]) || null,
          trim(row["forma_pago"]).toLowerCase() || null,
          trim(row["tipo_cuenta"]) || null,
          clienteId,
          trim(row["notas"]) || null,
        ]
      );
      const empId = ins[0].id;
      if (dpi) empleadoIdByDpi[dpi] = empId;
      empleadoIdByNombre[nombre.toLowerCase()] = empId;

      // Asignar puesto titular si se indicó
      const puestoNombre = trim(row["puesto_operativo"]);
      if (puestoNombre) {
        const pId = puestoIdByNombre[puestoNombre.toLowerCase()] ?? null;
        const ordenTitular = parseInt(trim(row["orden_titular"]) || "1") || 1;
        if (pId && !preview) {
          // Solo el orden=1 actualiza titular_employee_id en puestos_operativos
          if (ordenTitular === 1) {
            await pool.query(
              `UPDATE puestos_operativos SET titular_employee_id = $1, titular_nombre = $2,
               estado = 'cubierto' WHERE id = $3`,
              [empId, nombre, pId]
            ).catch(() => {});
          }
          await pool.query(
            `INSERT INTO puesto_titulares (puesto_id, employee_id, orden, activo)
             VALUES ($1, $2, $3, true) ON CONFLICT (puesto_id, employee_id)
             DO UPDATE SET orden = $3, activo = true`,
            [pId, empId, ordenTitular]
          ).catch(() => {});
        }
      }

      rColab.detalle.push({ fila, estado: "ok" });
      rColab.exitosos++;
    } catch (e: any) {
      rColab.detalle.push({ fila, estado: "error", mensaje: e.message });
      rColab.errores++;
    }
  }
  resultados.push(rColab);

  // ── POST-COLABORADORES: Auto-generar puesto_slots ──────────────────────────
  // Una vez que todos los titulares están asignados, crear los slots de trabajo/descanso
  // basándose en el tipo de turno de cada puesto. Sólo crea slots si el puesto no los tiene.
  if (!preview) {
    try {
      // Puestos con titulares y turno asignado que aún no tienen slots
      const { rows: puestosParaSlots } = await pool.query(`
        SELECT DISTINCT
          po.id AS puesto_id,
          po.fecha_inicio_ciclo,
          po.hora_entrada,
          t.horas_trabajo,
          t.horas_descanso
        FROM puesto_titulares pt
        JOIN puestos_operativos po ON po.id = pt.puesto_id AND po.activo = TRUE
        LEFT JOIN turnos t ON t.id = po.tipo_turno_id
        WHERE pt.activo = TRUE
          AND NOT EXISTS (
            SELECT 1 FROM puesto_slots ps WHERE ps.puesto_id = po.id AND ps.activo = TRUE
          )
      `);

      for (const p of puestosParaSlots) {
        const horasTrabajo = p.horas_trabajo ?? 24;
        const horasDescanso = p.horas_descanso ?? 24;
        const esAlternante = horasTrabajo === horasDescanso;
        const horaEntrada = p.hora_entrada ?? "07:00";

        // Obtener titulares ordenados
        const { rows: titulares } = await pool.query(
          `SELECT employee_id, orden FROM puesto_titulares
           WHERE puesto_id = $1 AND activo = TRUE ORDER BY orden`,
          [p.puesto_id]
        );

        for (const titular of titulares) {
          let diasTrabajo: number[];
          if (esAlternante && horasTrabajo >= 12) {
            // Patrón alternante: titular impar trabaja días 1,3,5... ; par trabaja 2,4,6...
            diasTrabajo = titular.orden % 2 === 1
              ? [1, 3, 5, 7, 9, 11, 13]
              : [2, 4, 6, 8, 10, 12, 14];
          } else {
            // Patrón diario (8h, etc.): trabaja todos los días del ciclo
            diasTrabajo = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];
          }

          await pool.query(
            `INSERT INTO puesto_slots
               (puesto_id, slot_numero, horas_turno, hora_entrada, dias_trabajo,
                longitud_ciclo, fecha_inicio_ciclo, empleado_id, activo)
             VALUES ($1,$2,$3,$4,$5,14,$6,$7,true)
             ON CONFLICT DO NOTHING`,
            [
              p.puesto_id,
              titular.orden,
              horasTrabajo,
              horaEntrada,
              diasTrabajo,
              p.fecha_inicio_ciclo,
              titular.employee_id,
            ]
          ).catch(() => {});
        }
      }
    } catch {
      // No bloqueante — el usuario puede configurar slots manualmente en el pizarrón
    }
  }

  // ── 6. ZONAS OPERATIVAS ─────────────────────────────────────────────────────
  // ZONAS va después de COLABORADORES para que el supervisor_dpi ya exista en la BD.
  // Tras crear cada zona, actualiza los puestos que tienen esa zona en puestoZonaPending.
  const zonaRows = sheets["ZONAS"] ?? sheets["zonas"] ?? [];
  const rZonas = emptyResult("Zonas Operativas");
  rZonas.total = zonaRows.length;

  for (let i = 0; i < zonaRows.length; i++) {
    const row = zonaRows[i];
    const fila = i + 2;
    const nombre = trim(row["nombre"]);
    if (!nombre) {
      rZonas.detalle.push({ fila, estado: "error", mensaje: "nombre es obligatorio" });
      rZonas.errores++; continue;
    }
    const key = nombre.toLowerCase();
    if (zonaIdByNombre[key]) {
      // Ya existe — igual resolvemos los puestos pendientes
      const zonaId = zonaIdByNombre[key];
      for (const [pid, zn] of Object.entries(puestoZonaPending)) {
        if (zn === key) {
          await pool.query(`UPDATE puestos_operativos SET zona_operativa_id=$1 WHERE id=$2`, [zonaId, parseInt(pid)]);
        }
      }
      rZonas.detalle.push({ fila, estado: "omitido", mensaje: `"${nombre}" ya existe` });
      rZonas.omitidos++; continue;
    }
    if (preview) {
      rZonas.detalle.push({ fila, estado: "ok" });
      rZonas.exitosos++; continue;
    }
    try {
      const supervisorDpi = trim(row["supervisor_dpi"]);
      const supervisorEmpId = supervisorDpi ? (empleadoIdByDpi[supervisorDpi] ?? null) : null;

      const { rows: ins } = await pool.query(
        `INSERT INTO operational_zones (nombre, descripcion, supervisor_employee_id)
         VALUES ($1,$2,$3) RETURNING id`,
        [
          nombre,
          trim(row["descripcion"]) || null,
          supervisorEmpId,
        ]
      );
      const newZonaId = ins[0].id;
      zonaIdByNombre[key] = newZonaId;

      // Asignar zona a puestos pendientes
      for (const [pid, zn] of Object.entries(puestoZonaPending)) {
        if (zn === key) {
          await pool.query(`UPDATE puestos_operativos SET zona_operativa_id=$1 WHERE id=$2`, [newZonaId, parseInt(pid)]);
        }
      }

      rZonas.detalle.push({ fila, estado: "ok" });
      rZonas.exitosos++;
    } catch (e: any) {
      rZonas.detalle.push({ fila, estado: "error", mensaje: e.message });
      rZonas.errores++;
    }
  }
  resultados.push(rZonas);

  // ── 7. ARMERÍA ─────────────────────────────────────────────────────────────
  const armaRows = sheets["ARMAS"] ?? sheets["armas"] ?? sheets["ARMERIA"] ?? sheets["armeria"] ?? sheets["ARMERÍA"] ?? [];
  const rArmas = emptyResult("Armería");
  rArmas.total = armaRows.length;
  const TIPOS_ARMA = ["pistola", "revolver", "escopeta", "fusil", "subametralladora", "otro"];
  let autoArmaIdx = 0;
  if (!preview) {
    const { rows: cnt } = await pool.query(`SELECT COUNT(*)::int AS n FROM armas`).catch(() => [{ n: 0 }]);
    autoArmaIdx = (cnt as any)?.[0]?.n ?? 0;
  }

  for (let i = 0; i < armaRows.length; i++) {
    const row = armaRows[i];
    const fila = i + 2;
    const rawTipo = trim(row["tipo"]).toLowerCase();
    const tipo = TIPOS_ARMA.includes(rawTipo) ? rawTipo : "pistola";
    let codigo = trim(row["codigo"]).toUpperCase();
    if (!codigo) {
      autoArmaIdx++;
      codigo = `${tipo.slice(0, 4).toUpperCase()}-${String(autoArmaIdx).padStart(3, "0")}`;
    }
    if (preview) {
      rArmas.detalle.push({ fila, estado: "ok" });
      rArmas.exitosos++; continue;
    }
    try {
      const { rows: ins } = await pool.query(
        `INSERT INTO armas
           (codigo, tipo, marca, modelo, calibre, serie, estado, activo,
            numero_tenencia, fecha_vencimiento_tenencia,
            numero_portacion, fecha_vencimiento_portacion, observaciones)
         VALUES ($1,$2,$3,$4,$5,$6,$7,TRUE,$8,$9,$10,$11,$12)
         ON CONFLICT (codigo) DO NOTHING RETURNING id`,
        [
          codigo, tipo,
          trim(row["marca"]) || null,
          trim(row["modelo"]) || null,
          trim(row["calibre"]) || null,
          trim(row["serie"]) || null,
          trim(row["estado"]) || "activo",
          trim(row["numero_tenencia"]) || null,
          parseDate(row["fecha_vencimiento_tenencia"]),
          trim(row["numero_portacion"]) || null,
          parseDate(row["fecha_vencimiento_portacion"]),
          trim(row["observaciones"]) || null,
        ]
      );
      if (!ins.length) {
        rArmas.detalle.push({ fila, estado: "omitido", mensaje: `Código "${codigo}" ya existe` });
        rArmas.omitidos++; continue;
      }
      const armaId = ins[0].id;
      // Asignar custodio si se indicó
      const custodioNombre = trim(row["custodio_nombre"]);
      const custodioDpi = trim(row["custodio_dpi"]);
      const empId = custodioDpi
        ? (empleadoIdByDpi[custodioDpi] ?? null)
        : (custodioNombre ? (empleadoIdByNombre[custodioNombre.toLowerCase()] ?? null) : null);
      if (empId) {
        await pool.query(
          `INSERT INTO arma_custodia (arma_id, employee_id, fecha_inicio)
           VALUES ($1, $2, NOW()) ON CONFLICT DO NOTHING`,
          [armaId, empId]
        ).catch(() => {});
      }
      // Asignar puesto
      const pNombre = trim(row["puesto_nombre"]);
      if (pNombre) {
        const pId = puestoIdByNombre[pNombre.toLowerCase()] ?? null;
        if (pId) {
          await pool.query(`UPDATE armas SET puesto_id = $1 WHERE id = $2`, [pId, armaId]).catch(() => {});
        }
      }
      rArmas.detalle.push({ fila, estado: "ok" });
      rArmas.exitosos++;
    } catch (e: any) {
      rArmas.detalle.push({ fila, estado: "error", mensaje: e.message });
      rArmas.errores++;
    }
  }
  resultados.push(rArmas);

  // ── 6. VEHÍCULOS ───────────────────────────────────────────────────────────
  const vehiculoRows = sheets["VEHICULOS"] ?? sheets["vehiculos"] ?? sheets["VEHÍCULOS"] ?? [];
  const rVehiculos = emptyResult("Vehículos");
  rVehiculos.total = vehiculoRows.length;

  for (let i = 0; i < vehiculoRows.length; i++) {
    const row = vehiculoRows[i];
    const fila = i + 2;
    const placa = trim(row["placa"]).toUpperCase();
    if (!placa) {
      rVehiculos.detalle.push({ fila, estado: "error", mensaje: "placa es obligatoria" });
      rVehiculos.errores++; continue;
    }
    if (preview) {
      rVehiculos.detalle.push({ fila, estado: "ok" });
      rVehiculos.exitosos++; continue;
    }
    try {
      const { rows: ins } = await pool.query(
        `INSERT INTO vehiculos (placa, tipo, marca, modelo, color, anio, estado, activo, observaciones)
         VALUES ($1,$2,$3,$4,$5,$6,$7,TRUE,$8)
         ON CONFLICT (placa) DO NOTHING RETURNING id`,
        [
          placa,
          trim(row["tipo"]) || "pickup",
          trim(row["marca"]) || null,
          trim(row["modelo"]) || null,
          trim(row["color"]) || null,
          parseNum(row["anio"]),
          trim(row["estado"]) || "activo",
          trim(row["observaciones"]) || null,
        ]
      );
      if (!ins.length) {
        rVehiculos.detalle.push({ fila, estado: "omitido", mensaje: `Placa "${placa}" ya existe` });
        rVehiculos.omitidos++; continue;
      }
      const vId = ins[0].id;
      const custodioNombre = trim(row["custodio_nombre"]);
      const custodioDpi = trim(row["custodio_dpi"]);
      const empId = custodioDpi
        ? (empleadoIdByDpi[custodioDpi] ?? null)
        : (custodioNombre ? (empleadoIdByNombre[custodioNombre.toLowerCase()] ?? null) : null);
      if (empId) {
        await pool.query(
          `INSERT INTO vehiculo_custodia (vehiculo_id, employee_id, fecha_inicio)
           VALUES ($1, $2, NOW()) ON CONFLICT DO NOTHING`,
          [vId, empId]
        ).catch(() => {});
      }
      rVehiculos.detalle.push({ fila, estado: "ok" });
      rVehiculos.exitosos++;
    } catch (e: any) {
      rVehiculos.detalle.push({ fila, estado: "error", mensaje: e.message });
      rVehiculos.errores++;
    }
  }
  resultados.push(rVehiculos);

  // ── 7. BODEGA CATEGORÍAS ───────────────────────────────────────────────────
  const catRows = sheets["BODEGA_CATEGORIAS"] ?? sheets["bodega_categorias"] ?? sheets["BODEGA CATEGORIAS"] ?? [];
  const rCats = emptyResult("Bodega — Categorías");
  rCats.total = catRows.length;
  const catCache: Record<string, number> = {};
  const { rows: catsExist } = await pool.query(`SELECT id, LOWER(nombre) AS n FROM bodega_categorias`).catch(() => ({ rows: [] }));
  (catsExist as any[]).forEach((r) => { catCache[r.n] = r.id; });

  for (let i = 0; i < catRows.length; i++) {
    const row = catRows[i];
    const fila = i + 2;
    const nombre = trim(row["nombre"]);
    if (!nombre) { rCats.detalle.push({ fila, estado: "error", mensaje: "nombre es obligatorio" }); rCats.errores++; continue; }
    if (catCache[nombre.toLowerCase()]) {
      rCats.detalle.push({ fila, estado: "omitido", mensaje: `"${nombre}" ya existe` });
      rCats.omitidos++; continue;
    }
    if (preview) { rCats.detalle.push({ fila, estado: "ok" }); rCats.exitosos++; continue; }
    try {
      const { rows: ins } = await pool.query(
        `INSERT INTO bodega_categorias (nombre, descripcion) VALUES ($1,$2) RETURNING id`,
        [nombre, trim(row["descripcion"]) || null]
      );
      catCache[nombre.toLowerCase()] = ins[0].id;
      rCats.detalle.push({ fila, estado: "ok" }); rCats.exitosos++;
    } catch (e: any) { rCats.detalle.push({ fila, estado: "error", mensaje: e.message }); rCats.errores++; }
  }
  resultados.push(rCats);

  // ── 8. BODEGA ARTÍCULOS ────────────────────────────────────────────────────
  const artRows = sheets["BODEGA_ARTICULOS"] ?? sheets["bodega_articulos"] ?? sheets["BODEGA ARTICULOS"] ?? [];
  const rArts = emptyResult("Bodega — Artículos");
  rArts.total = artRows.length;

  for (let i = 0; i < artRows.length; i++) {
    const row = artRows[i];
    const fila = i + 2;
    const nombre = trim(row["nombre"]);
    const catNombre = trim(row["categoria"]);
    if (!nombre) { rArts.detalle.push({ fila, estado: "error", mensaje: "nombre es obligatorio" }); rArts.errores++; continue; }
    if (preview) { rArts.detalle.push({ fila, estado: "ok" }); rArts.exitosos++; continue; }
    try {
      let categoriaId: number | null = null;
      if (catNombre) {
        const key = catNombre.toLowerCase();
        if (catCache[key]) {
          categoriaId = catCache[key];
        } else {
          const { rows: nc } = await pool.query(
            `INSERT INTO bodega_categorias (nombre) VALUES ($1) ON CONFLICT (nombre) DO UPDATE SET nombre = EXCLUDED.nombre RETURNING id`,
            [catNombre]
          );
          categoriaId = nc[0].id;
          catCache[key] = categoriaId;
        }
      }
      let prefijo = trim(row["codigo_prefijo"]).toUpperCase().slice(0, 6);
      if (!prefijo) prefijo = nombre.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6) || "ITEM";
      const rawRastreo = trim(row["tipo_rastreo"]).toLowerCase();
      const tipoRastreo = ["seriado", "lote", "sin_rastreo"].includes(rawRastreo) ? rawRastreo : "seriado";
      const rawAsig = trim(row["tipo_asignacion"]).toLowerCase();
      const tipoAsig = ["colaborador", "puesto", "ambos"].includes(rawAsig) ? rawAsig : "colaborador";

      const { rows: dup } = await pool.query(`SELECT id FROM bodega_articulos WHERE nombre = $1 LIMIT 1`, [nombre]);
      if (dup.length) {
        rArts.detalle.push({ fila, estado: "omitido", mensaje: `"${nombre}" ya existe` });
        rArts.omitidos++; continue;
      }
      await pool.query(
        `INSERT INTO bodega_articulos (nombre, descripcion, codigo_prefijo, tipo_rastreo, tipo_asignacion, categoria_id, activo)
         VALUES ($1,$2,$3,$4,$5,$6,TRUE)`,
        [nombre, trim(row["descripcion"]) || null, prefijo, tipoRastreo, tipoAsig, categoriaId]
      );
      rArts.detalle.push({ fila, estado: "ok" }); rArts.exitosos++;
    } catch (e: any) { rArts.detalle.push({ fila, estado: "error", mensaje: e.message }); rArts.errores++; }
  }
  resultados.push(rArts);

  // ── 9. ANTICIPOS PENDIENTES ────────────────────────────────────────────────
  const anticipoRows = sheets["ANTICIPOS"] ?? sheets["anticipos"] ?? [];
  const rAnt = emptyResult("Anticipos Pendientes");
  rAnt.total = anticipoRows.length;

  for (let i = 0; i < anticipoRows.length; i++) {
    const row = anticipoRows[i];
    const fila = i + 2;
    const dpi = trim(row["colaborador_dpi"]);
    const nombre = trim(row["colaborador_nombre"]);
    const cantidad = parseNum(row["cantidad"]);
    if (!cantidad || cantidad <= 0) {
      rAnt.detalle.push({ fila, estado: "error", mensaje: "cantidad es obligatoria y debe ser > 0" });
      rAnt.errores++; continue;
    }
    const empId = dpi ? (empleadoIdByDpi[dpi] ?? null) : (nombre ? (empleadoIdByNombre[nombre.toLowerCase()] ?? null) : null);
    if (!empId && !preview) {
      rAnt.detalle.push({ fila, estado: "error", mensaje: `Colaborador no encontrado (DPI: ${dpi || "—"}, Nombre: ${nombre || "—"})` });
      rAnt.errores++; continue;
    }
    if (preview) { rAnt.detalle.push({ fila, estado: "ok" }); rAnt.exitosos++; continue; }
    try {
      const numCuotas = parseNum(row["num_cuotas"]) ?? 1;
      const montoCobro = cantidad * 1.1;
      await pool.query(
        `INSERT INTO anticipos
           (employee_id, nombre, dpi, cantidad, monto_cobro, num_cuotas, cuota_monto,
            origen, estado, observaciones)
         VALUES ($1,$2,$3,$4,$5,$6,$7,'importacion_maestra','pendiente',$8)`,
        [
          empId, nombre || `Colaborador ${dpi}`, dpi || null,
          cantidad, montoCobro, numCuotas, montoCobro / numCuotas,
          trim(row["observaciones"]) || null,
        ]
      );
      rAnt.detalle.push({ fila, estado: "ok" }); rAnt.exitosos++;
    } catch (e: any) { rAnt.detalle.push({ fila, estado: "error", mensaje: e.message }); rAnt.errores++; }
  }
  resultados.push(rAnt);

  // ── 10. HISTORIAL PRESTACIONES ─────────────────────────────────────────────
  const prestRows = sheets["HISTORIAL_PRESTACIONES"] ?? sheets["historial_prestaciones"] ?? sheets["HISTORIAL PRESTACIONES"] ?? [];
  const rPrest = emptyResult("Historial Prestaciones");
  rPrest.total = prestRows.length;

  for (let i = 0; i < prestRows.length; i++) {
    const row = prestRows[i];
    const fila = i + 2;
    const dpi = trim(row["colaborador_dpi"]);
    const nombre = trim(row["colaborador_nombre"]);
    const tipo = trim(row["tipo"]).toLowerCase();
    const anio = parseNum(row["anio"]);
    if (!["bono14", "aguinaldo", "vacaciones"].includes(tipo) || !anio) {
      rPrest.detalle.push({ fila, estado: "error", mensaje: "tipo (bono14/aguinaldo/vacaciones) y anio son obligatorios" });
      rPrest.errores++; continue;
    }
    const empId = dpi ? (empleadoIdByDpi[dpi] ?? null) : (nombre ? (empleadoIdByNombre[nombre.toLowerCase()] ?? null) : null);
    if (!empId && !preview) {
      rPrest.detalle.push({ fila, estado: "error", mensaje: `Colaborador no encontrado (DPI: ${dpi || "—"})` });
      rPrest.errores++; continue;
    }
    if (preview) { rPrest.detalle.push({ fila, estado: "ok" }); rPrest.exitosos++; continue; }
    try {
      const dias = parseNum(row["dias"]);
      const periodoCompleto = parseBool(row["periodo_completo"]);
      await pool.query(
        `INSERT INTO historial_prestaciones_externas
           (employee_id, tipo, anio, monto, dias, periodo_completo, notas)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         ON CONFLICT (employee_id, tipo, anio) DO NOTHING`,
        [
          empId, tipo, anio,
          parseNum(row["monto"]),
          dias,
          dias ? false : periodoCompleto,
          trim(row["notas"]) || null,
        ]
      );
      rPrest.detalle.push({ fila, estado: "ok" }); rPrest.exitosos++;
    } catch (e: any) { rPrest.detalle.push({ fila, estado: "error", mensaje: e.message }); rPrest.errores++; }
  }
  resultados.push(rPrest);

  // ── 11. USUARIOS ───────────────────────────────────────────────────────────
  const usuarioRows = sheets["USUARIOS"] ?? sheets["usuarios"] ?? [];
  const rUsuarios = emptyResult("Usuarios del Sistema");
  rUsuarios.total = usuarioRows.length;
  const ROLES_VALIDOS = ["admin", "operaciones", "rrhh", "supervisor", "guardia", "comercial", "cliente", "gerencia"];

  for (let i = 0; i < usuarioRows.length; i++) {
    const row = usuarioRows[i];
    const fila = i + 2;
    const username = trim(row["username"]);
    const nombre = trim(row["nombre"]);
    const password = trim(row["password"]);
    const rawRol = trim(row["rol"]).toLowerCase();
    const rol = ROLES_VALIDOS.includes(rawRol) ? rawRol : "operaciones";
    if (!username || !nombre || !password) {
      rUsuarios.detalle.push({ fila, estado: "error", mensaje: "username, nombre y password son obligatorios" });
      rUsuarios.errores++; continue;
    }
    if (preview) { rUsuarios.detalle.push({ fila, estado: "ok" }); rUsuarios.exitosos++; continue; }
    try {
      const { rows: dup } = await pool.query(`SELECT id FROM users WHERE username = $1 LIMIT 1`, [username]);
      if (dup.length) {
        rUsuarios.detalle.push({ fila, estado: "omitido", mensaje: `Username "${username}" ya existe` });
        rUsuarios.omitidos++; continue;
      }
      const dpiColab = trim(row["colaborador_dpi"]);
      const empId = dpiColab ? (empleadoIdByDpi[dpiColab] ?? null) : null;
      const hash = await bcrypt.hash(password, 10);
      await pool.query(
        `INSERT INTO users (nombre, username, correo, password_hash, rol, estado, telefono, employee_id,
           can_report_emergency, can_request_advance)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [
          nombre, username,
          trim(row["correo"]) || null,
          hash, rol,
          trim(row["estado"]) || "activo",
          trim(row["telefono"]) || null,
          empId,
          parseBool(row["puede_reportar_emergencias"]) || null,
          parseBool(row["puede_solicitar_anticipos"]) || null,
        ]
      );
      rUsuarios.detalle.push({ fila, estado: "ok" }); rUsuarios.exitosos++;
    } catch (e: any) { rUsuarios.detalle.push({ fila, estado: "error", mensaje: e.message }); rUsuarios.errores++; }
  }
  resultados.push(rUsuarios);

  // ── 12. ROLES DEL SISTEMA ─────────────────────────────────────────────────
  const rolesRows = sheets["ROLES"] ?? sheets["roles"] ?? [];
  const rRoles = emptyResult("Roles del Sistema");
  rRoles.total = rolesRows.length;

  const MODULOS_VALIDOS = new Set([
    "dashboard","pizarron","seguimiento_ssa","pipeline_ssa","tareas","incidencias",
    "custodias","cambios_estructurales","clientes","comercial","reportes","kpi",
    "empleados","reclutamiento","anticipos","eventos_rrhh","alertas_rrhh","nomina",
    "pre_planilla","planilla","turnos","cambios_salariales","prestaciones",
    "solicitudes_vacaciones","planillas_especiales","libro_salarios","igss_planilla",
    "carnets_qr","kiosco_solicitudes","solicitudes_eliminacion","usuarios",
    "config_whatsapp","cms","simulador_wa","bodega","vehiculos","armeria",
    "importacion","control_qr",
  ]);

  for (let i = 0; i < rolesRows.length; i++) {
    const row = rolesRows[i];
    const fila = i + 2;
    const clave = trim(row["clave"]).toLowerCase().replace(/[^a-z0-9_]/g, "_");
    const label = trim(row["label"]);
    if (!clave || !label) {
      rRoles.detalle.push({ fila, estado: "error", mensaje: "clave y label son obligatorios" });
      rRoles.errores++; continue;
    }
    if (preview) { rRoles.detalle.push({ fila, estado: "ok" }); rRoles.exitosos++; continue; }
    try {
      const { rows: dup } = await pool.query(`SELECT clave FROM system_roles WHERE clave = $1`, [clave]);
      if (dup.length) {
        rRoles.detalle.push({ fila, estado: "omitido", mensaje: `Rol "${clave}" ya existe` });
        rRoles.omitidos++; continue;
      }
      const color = trim(row["color"]) || "#6366F1";
      await pool.query(
        `INSERT INTO system_roles (clave, label, descripcion, color, es_sistema, activo)
         VALUES ($1,$2,$3,$4,FALSE,TRUE)`,
        [clave, label, trim(row["descripcion"]) || null, color]
      );
      // Asignar módulos indicados en la columna "modulos" (separados por coma)
      const modStr = trim(row["modulos"]);
      if (modStr) {
        const mods = modStr.split(",").map((m: string) => m.trim().toLowerCase()).filter((m: string) => MODULOS_VALIDOS.has(m));
        for (const mod of mods) {
          await pool.query(
            `INSERT INTO rol_permisos (rol_clave, modulo_clave) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
            [clave, mod]
          ).catch(() => {});
        }
      }
      rRoles.detalle.push({ fila, estado: "ok" }); rRoles.exitosos++;
    } catch (e: any) { rRoles.detalle.push({ fila, estado: "error", mensaje: e.message }); rRoles.errores++; }
  }
  resultados.push(rRoles);

  // ── 13. MODULOS (asignación rol → módulo para roles existentes) ────────────
  const modulosRows = sheets["MODULOS"] ?? sheets["modulos"] ?? [];
  const rModulos = emptyResult("Permisos de Módulos");
  rModulos.total = modulosRows.length;

  // Precarga roles existentes en BD para validar
  const rolesEnBd = new Set<string>();
  if (!preview) {
    try {
      const { rows: rbRows } = await pool.query(`SELECT clave FROM system_roles`);
      rbRows.forEach((r: any) => rolesEnBd.add(r.clave));
    } catch { /* no bloqueante */ }
  }

  for (let i = 0; i < modulosRows.length; i++) {
    const row = modulosRows[i];
    const fila = i + 2;
    const rolClave   = trim(row["rol_clave"]).toLowerCase();
    const modClave   = trim(row["modulo_clave"]).toLowerCase();
    // accion: "agregar" (default) o "quitar"
    const accion = trim(row["accion"]).toLowerCase() || "agregar";

    if (!rolClave || !modClave) {
      rModulos.detalle.push({ fila, estado: "error", mensaje: "rol_clave y modulo_clave son obligatorios" });
      rModulos.errores++; continue;
    }
    if (!MODULOS_VALIDOS.has(modClave)) {
      rModulos.detalle.push({ fila, estado: "error", mensaje: `módulo "${modClave}" no es válido` });
      rModulos.errores++; continue;
    }
    if (preview) { rModulos.detalle.push({ fila, estado: "ok" }); rModulos.exitosos++; continue; }

    // Verificar que el rol existe (en BD o recién creado en esta misma carga)
    const rolExisteEnBd = rolesEnBd.has(rolClave);
    // También puede ser un rol creado en la hoja ROLES de esta misma carga
    const rolRecienCreado = rolesRows.some((r: any) =>
      trim(r["clave"]).toLowerCase() === rolClave
    );
    if (!rolExisteEnBd && !rolRecienCreado) {
      rModulos.detalle.push({ fila, estado: "error", mensaje: `rol "${rolClave}" no existe en el sistema` });
      rModulos.errores++; continue;
    }

    try {
      if (accion === "quitar") {
        await pool.query(
          `DELETE FROM rol_permisos WHERE rol_clave = $1 AND modulo_clave = $2`,
          [rolClave, modClave]
        );
      } else {
        await pool.query(
          `INSERT INTO rol_permisos (rol_clave, modulo_clave) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
          [rolClave, modClave]
        );
      }
      rModulos.detalle.push({ fila, estado: "ok", mensaje: `${accion}: ${rolClave} → ${modClave}` });
      rModulos.exitosos++;
    } catch (e: any) {
      rModulos.detalle.push({ fila, estado: "error", mensaje: e.message });
      rModulos.errores++;
    }
  }
  resultados.push(rModulos);

  // ── 14. IGSS PATRONO ───────────────────────────────────────────────────────
  const igssRows = sheets["IGSS_PATRONO"] ?? sheets["igss_patrono"] ?? sheets["IGSS PATRONO"] ?? [];
  const rIgss = emptyResult("IGSS — Patrono");
  rIgss.total = igssRows.length;

  if (igssRows.length > 0 && !preview) {
    const row = igssRows[0];
    try {
      await pool.query(
        `INSERT INTO igss_config_patrono
           (numero_patronal, nit_patrono, nombre_comercial, correo_igss, codigo_actividad_principal)
         VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (id) DO UPDATE SET
           numero_patronal            = EXCLUDED.numero_patronal,
           nit_patrono                = EXCLUDED.nit_patrono,
           nombre_comercial           = EXCLUDED.nombre_comercial,
           correo_igss                = EXCLUDED.correo_igss,
           codigo_actividad_principal = EXCLUDED.codigo_actividad_principal,
           updated_at                 = NOW()`,
        [
          trim(row["numero_patronal"]) || null,
          trim(row["nit_patrono"]) || null,
          trim(row["nombre_comercial"]) || null,
          trim(row["correo_igss"]) || null,
          trim(row["codigo_actividad_principal"]) || null,
        ]
      );
      rIgss.detalle.push({ fila: 2, estado: "ok" });
      rIgss.exitosos++;
    } catch (e: any) {
      rIgss.detalle.push({ fila: 2, estado: "error", mensaje: e.message });
      rIgss.errores++;
    }
  } else if (igssRows.length > 0 && preview) {
    rIgss.detalle.push({ fila: 2, estado: "ok" });
    rIgss.exitosos++;
  }
  resultados.push(rIgss);

  // ── Resumen ─────────────────────────────────────────────────────────────────
  const totalExitosos = resultados.reduce((a, r) => a + r.exitosos, 0);
  const totalErrores   = resultados.reduce((a, r) => a + r.errores, 0);
  const totalOmitidos  = resultados.reduce((a, r) => a + r.omitidos, 0);
  const totalRegistros = resultados.reduce((a, r) => a + r.total, 0);

  res.json({
    preview,
    total: totalRegistros,
    exitosos: totalExitosos,
    errores: totalErrores,
    omitidos: totalOmitidos,
    hojas: resultados,
  });
});
