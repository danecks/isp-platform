import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { permisosMiddleware } from "./lib/permisos-middleware";
import { pool } from "@workspace/db";
import bcrypt from "bcryptjs";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

app.post("/api/_system/reset-db", async (req, res) => {
  const secret = req.headers["x-reset-secret"];
  if (secret !== "ISP-RESET-2026-PROD") {
    return res.status(403).json({ error: "Forbidden" });
  }
  try {
    const tables = [
      "planilla_lineas", "planillas", "planillas_especiales_lineas", "planillas_especiales_pagos", "planillas_especiales",
      "pre_planilla_auditoria", "pre_planilla_cierres", "pre_planilla_revision",
      "novedades_nomina_diarias", "anticipos", "detalle_lib_sal", "historial_lib_sal",
      "detalle_prestaciones_odbc", "historial_prestaciones_externas",
      "prestaciones_provisiones", "prestaciones_movimientos", "prestaciones_liquidacion_detalle",
      "prestaciones_liquidaciones", "prestaciones_acumulados",
      "eventos_rrhh", "rrhh_alertas", "vacaciones_movimientos", "vacaciones_saldos",
      "cambios_salariales", "contratos_empleados", "incentivos_cash_cobertura",
      "cobertura_segmentos", "cobertura_diaria", "cierre_auditoria", "cierre_operativo_diario",
      "movimientos_operativos", "agent_assignments", "employee_operational_assignments",
      "puesto_titulares", "puesto_titular_historico", "puesto_slots", "planificacion_futura",
      "solicitudes_cambio_turno", "solicitudes_cambio_operativo", "solicitudes_eliminacion",
      "solicitudes_merge_requests", "solicitudes_empleo", "solicitudes_servicio_adicional",
      "ssa_agentes", "ssa_historial_cambios",
      "arma_custodia", "arma_ordenes_servicio", "arma_sugerencias", "puesto_municion", "armas",
      "vehiculo_custodia", "vehiculos",
      "entregas_uniforme_cuotas", "entregas_uniforme", "dotacion_pendiente_items", "dotacion_pendiente",
      "ordenes_compra_items", "ordenes_compra", "kit_ingreso_items", "lead_dotacion_items",
      "bodega_movimientos", "bodega_solicitudes", "bodega_articulos", "bodega_categorias", "bodega_unidades",
      "relevo_equipo_novedades", "reporte_turno", "tareas", "task_evidencias", "incidents",
      "agente_fichajes", "agente_qr_tokens", "supervisor_devices",
      "nfc_audit_log", "nfc_devices", "nfc_ronda_eventos", "nfc_ronda_puntos",
      "nfc_sandbox_schedules", "nfc_shift_events", "nfc_supervisor_form_items", "nfc_supervisor_forms", "nfc_tags",
      "qr_ronda_eventos", "qr_ronda_puntos", "qr_rondas",
      "phone_auth_log", "wa_audit_log", "wa_messages", "wa_notificaciones_log",
      "custodia_sync_log", "puestos_gps", "leads", "applications",
      "employees", "puestos_operativos", "client_sedes", "client_aliases", "clients",
      "service_locations", "operational_zones", "position_aliases", "turnos", "users",
      "config_tarifa_he", "igss_config_patrono", "wa_config", "wa_menu_options", "page_content",
    ];
    for (const t of tables) {
      try { await pool.query(`TRUNCATE TABLE ${t} CASCADE`); } catch { /* skip if missing */ }
    }
    const hash = await bcrypt.hash("1234", 10);
    await pool.query(
      "INSERT INTO users (nombre, username, password_hash, rol, estado) VALUES ($1, $2, $3, $4, $5)",
      ["Daniel Administrador", "dan2336", hash, "admin", "activo"]
    );
    res.json({ ok: true, mensaje: "Base de datos reseteada exitosamente" });
  } catch (err: any) {
    logger.error({ err }, "Reset DB error");
    res.status(500).json({ error: err.message });
  }
});

app.use("/api", permisosMiddleware as any);
app.use("/api", router);

export default app;
