/**
 * generate-template.mjs
 * Regenera ISP_PlantillaMaestra_CargaInicial.xlsx con la hoja MODULOS añadida.
 * Ejecutar desde raíz del workspace:
 *   node artifacts/api-server/scripts/generate-template.mjs
 */

import { createRequire } from "module";
import { writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const require = createRequire(import.meta.url);
const XLSX = require("/home/runner/workspace/node_modules/.pnpm/xlsx@0.18.5/node_modules/xlsx/xlsx.js");

const OUT = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../isp-web/public/ISP_PlantillaMaestra_CargaInicial.xlsx"
);

// ── Helpers ────────────────────────────────────────────────────────────────
function makeSheet(headers, rows, widths) {
  const data = [headers, ...rows];
  const ws = XLSX.utils.aoa_to_sheet(data);
  ws["!cols"] = widths.map((w) => ({ wch: w }));
  return ws;
}

// ── 37 módulos válidos ─────────────────────────────────────────────────────
const MODULOS = [
  ["dashboard",              "Dashboard",                  "General"],
  ["pizarron",               "Pizarrón Operativo",         "Operaciones"],
  ["seguimiento_ssa",        "Seguimiento SSA",            "Operaciones"],
  ["pipeline_ssa",           "Pipeline SSA",               "Operaciones"],
  ["tareas",                 "Tareas",                     "Operaciones"],
  ["incidencias",            "Incidencias",                "Operaciones"],
  ["custodias",              "Custodias",                  "Operaciones"],
  ["cambios_estructurales",  "Cambios Estructurales",      "Operaciones"],
  ["clientes",               "Clientes",                   "Clientes & Comercial"],
  ["comercial",              "Comercial",                  "Clientes & Comercial"],
  ["reportes",               "Reportería",                 "Clientes & Comercial"],
  ["kpi",                    "KPI & Métricas",             "Clientes & Comercial"],
  ["empleados",              "Colaboradores",              "Personal & RRHH"],
  ["reclutamiento",          "Reclutamiento",              "Personal & RRHH"],
  ["anticipos",              "Anticipos",                  "Personal & RRHH"],
  ["eventos_rrhh",           "Eventos RRHH",               "Personal & RRHH"],
  ["alertas_rrhh",           "Alertas RRHH",               "Personal & RRHH"],
  ["nomina",                 "Novedades de Nómina",        "Personal & RRHH"],
  ["pre_planilla",           "Pre-Planilla",               "Personal & RRHH"],
  ["planilla",               "Planilla Final",             "Personal & RRHH"],
  ["turnos",                 "Tipos de Turno",             "Personal & RRHH"],
  ["cambios_salariales",     "Cambios Salariales",         "Personal & RRHH"],
  ["prestaciones",           "Prestaciones Laborales",     "Personal & RRHH"],
  ["solicitudes_vacaciones", "Solicitudes de Vacaciones",  "Personal & RRHH"],
  ["planillas_especiales",   "Bono 14 & Aguinaldo",        "Personal & RRHH"],
  ["libro_salarios",         "Libro de Salarios",          "Personal & RRHH"],
  ["igss_planilla",          "Planilla IGSS",              "Personal & RRHH"],
  ["carnets_qr",             "Carnets QR",                 "Personal & RRHH"],
  ["kiosco_solicitudes",     "Solicitudes Kiosco",         "Personal & RRHH"],
  ["solicitudes_eliminacion","Solicitudes de Eliminación", "Sistema"],
  ["usuarios",               "Usuarios del Sistema",       "Sistema"],
  ["config_whatsapp",        "Configuración WhatsApp",     "Sistema"],
  ["cms",                    "CMS Web",                    "Sistema"],
  ["simulador_wa",           "Simulador WhatsApp",         "Sistema"],
  ["bodega",                 "Inventario General",         "Bodega e Inventario"],
  ["vehiculos",              "Vehículos",                  "Bodega e Inventario"],
  ["armeria",                "Armería",                    "Bodega e Inventario"],
  ["importacion",            "Importar Datos",             "Migración"],
  ["control_qr",             "Control Operativo QR",       "Control Operativo"],
];

// ── INSTRUCCIONES ──────────────────────────────────────────────────────────
const instrRows = [
  ["ISP, S.A. — Plantilla Maestra de Carga Inicial"],
  [],
  ["ORDEN DE CARGA (respeta este orden — hay dependencias entre hojas):"],
  ["1. CLIENTES"],
  ["2. TURNOS"],
  ["3. PUESTOS"],
  ["4. COLABORADORES"],
  ["5. ARMAS"],
  ["6. VEHICULOS"],
  ["7. BODEGA_CATEGORIAS"],
  ["8. BODEGA_ARTICULOS"],
  ["9. ANTICIPOS"],
  ["10. HISTORIAL_PRESTACIONES"],
  ["11. USUARIOS"],
  ["12. ROLES"],
  ["13. MODULOS"],
  ["14. IGSS_PATRONO"],
  [],
  ["FORMATO DE FECHAS: dd/mm/aaaa   Ejemplo: 15/01/2024"],
  [],
  ["COLABORADORES — columnas clave:"],
  ["  puesto_operativo : nombre EXACTO del puesto (igual que en hoja PUESTOS)"],
  ["  tipo_jornada     : completa | parcial | mixta  — IMPORTANTE para cálculo de planilla"],
  ["  dia_descanso     : lunes | martes | miercoles | jueves | viernes | sabado | domingo"],
  ["  horas_contrato   : horas diarias según contrato (ej: 8, 12, 24)"],
  ["  sueldo_base      : salario mensual en quetzales (ej: 3500)"],
  ["  bonificacion_incentivo : bonificación incentivo mensual (ej: 250)"],
  ["  bonificacion_1/2/3 : bonificaciones adicionales en Q — dejar vacío si no aplica"],
  ["  limite_anticipo  : monto máximo de anticipo en Q — dejar vacío para sin límite"],
  ["  forma_pago       : transferencia | cheque | efectivo   (cómo recibe su pago)"],
  ["  tipo_cuenta      : Monetaria | Ahorro   (tipo de cuenta bancaria, puede quedar vacío)"],
  ["  tipo_personal    : guardia | supervisor | jefe_servicio | administrativo_bodega | administrativo_rrhh | gerencia"],
  ["  estado_laboral   : activo | suspendido | baja | licencia"],
  ["  aplica_igss      : si | no   — CRÍTICO: el puesto también debe tener aplica_igss=si"],
  ["  estado_igss      : activo | no_activo | pendiente_regularizacion"],
  [],
  ["PUESTOS — columnas clave:"],
  ["  aplica_igss  : si | no  — CRÍTICO PARA PLANILLA: si es 'no' el empleado NO tendrá IGSS"],
  ["                 aunque el empleado lo tenga activo. AMBOS deben ser 'si'."],
  ["  regimen_igss : IVS | EPS | EPS_IVS | no_aplica  (si aplica_igss=si, usar IVS)"],
  ["  salario_puesto : referencia salarial del puesto (opcional, para reportes y comparativas)"],
  ["  tarifa_puesto  : tarifa de facturación mensual al cliente por este puesto (para comercial)"],
  [],
  ["CLIENTES — columna nueva:"],
  ["  tarifa_base_mensual : monto mensual que paga el cliente en Q (para módulo comercial)"],
  [],
  ["ARMAS — El arma se asigna al PUESTO (puesto_nombre), NO al empleado."],
  ["  El campo custodio_dpi es opcional: solo si quieres registrar quién la tiene HOY."],
  ["  Los agentes que trabajan el puesto son responsables del arma durante su turno."],
  ["  codigo: si se deja vacío, el sistema genera uno automático (PIST-001, ESCO-001...)."],
  [],
  ["TURNOS — columnas: nombre | horas_trabajo | horas_descanso | num_titulares | descripcion"],
  ["  Turno 24x24: horas_trabajo=24, horas_descanso=24, descripcion=\"07:00 a 07:00 del día siguiente\""],
  ["  Turno 12x12: horas_trabajo=12, horas_descanso=12"],
  ["  Turno 8h   : horas_trabajo=8,  horas_descanso=16"],
  [],
  ["MÓDULOS VÁLIDOS (columnas modulos en ROLES / modulo_clave en MODULOS):"],
  ...MODULOS.map(([clave, label, seccion]) => [`  ${clave}  →  ${label}  (${seccion})`]),
];
const wsInstr = XLSX.utils.aoa_to_sheet(instrRows);
wsInstr["!cols"] = [{ wch: 70 }];

// ── Sheets de datos ────────────────────────────────────────────────────────
const wsClientes = makeSheet(
  // tarifa_base_mensual : monto mensual que paga el cliente (para facturación)
  ["nombre","nombre_comercial","nit","sector","fecha_inicio_contrato",
   "tarifa_base_mensual",
   "igss_aplica","igss_codigo_centro","igss_direccion","igss_zona",
   "igss_departamento","igss_municipio","igss_codigo_actividad",
   "igss_contacto","igss_telefono","igss_email","notas"],
  [["Comercializadora Ejemplo","Ejemplo S.A.","1234567-8","Comercio","15/01/2024",
    "15000",
    "si","01","5a Calle 5-50","1","1","1","0851","Juan Pérez","55551234","igss@ejemplo.com",""]],
  [30,25,15,15,20,18,12,20,30,8,15,15,20,20,15,25,30]
);

const wsTurnos = makeSheet(
  ["nombre","horas_trabajo","horas_descanso","num_titulares","descripcion"],
  [
    ["Turno Diurno 8h",   "8",  "16", "2", "Turno diurno 07:00 a 15:00"],
    ["Turno Nocturno 8h", "8",  "16", "2", "Turno nocturno 23:00 a 07:00"],
    ["Turno 12h Diurno",  "12", "12", "2", "Jornada 12 horas diurna 06:00 a 18:00"],
    ["Turno 24x24",       "24", "24", "2", "Jornada 24 horas — 07:00 a 07:00 del día siguiente"],
  ],
  [28,14,16,16,45]
);

const wsPuestos = makeSheet(
  // aplica_igss  : si | no  — CRÍTICO: si es 'no' el empleado no tendrá IGSS aunque él lo tenga activo
  // regimen_igss : IVS | EPS | EPS_IVS | no_aplica  (si aplica_igss=si, usar IVS como mínimo)
  // salario_puesto : referencia salarial del puesto (opcional, para reportes)
  // tarifa_puesto  : tarifa de facturación al cliente por este puesto (opcional)
  ["nombre","cliente_nombre","turno_nombre","ubicacion",
   "aplica_igss","regimen_igss",
   "salario_puesto","tarifa_puesto",
   "descripcion"],
  [["Puesto Central","Comercializadora Ejemplo","Turno Diurno 8h","Zona 10 Recepción",
    "si","IVS",
    "3200","5500",
    "Recepción principal"]],
  [28,30,25,25,12,14,16,16,35]
);

const wsColaboradores = makeSheet(
  // NOMBRES DE COLUMNA EXACTOS — el sistema los lee con estos nombres:
  // tipo_personal  : guardia | supervisor | jefe_servicio | administrativo_bodega | administrativo_rrhh | gerencia
  // estado_laboral : activo | suspendido | baja | licencia
  // tipo_jornada   : completa | parcial | mixta  (IMPORTANTE para cálculo de horas y planilla)
  // dia_descanso   : lunes | martes | miercoles | jueves | viernes | sabado | domingo
  // horas_contrato : número de horas diarias según contrato (ej: 8, 12, 24)
  // forma_pago     : transferencia | cheque | efectivo   (cómo recibe su pago)
  // tipo_cuenta    : Monetaria | Ahorro                  (tipo de cuenta bancaria — puede dejarse vacío)
  // aplica_igss    : si | no   (CRÍTICO: el puesto también debe tener aplica_igss=si)
  // estado_igss    : activo | no_activo | pendiente_regularizacion
  // puesto_operativo: debe coincidir EXACTAMENTE con el nombre en hoja PUESTOS
  // bonificacion_1/2/3 : bonificaciones adicionales en Q (dejar vacío si no aplica)
  // limite_anticipo : monto máximo de anticipo permitido en Q (dejar vacío para sin límite)
  ["dpi","nombre_completo","fecha_nacimiento","genero","estado_civil",
   "igss_numero","nit","telefono","telefono_secundario","correo","sede",
   "fecha_ingreso","tipo_personal","estado_laboral",
   "puesto_operativo",
   "tipo_jornada","dia_descanso","horas_contrato",
   "sueldo_base","bonificacion_incentivo",
   "bonificacion_1","bonificacion_2","bonificacion_3",
   "limite_anticipo",
   "forma_pago","tipo_cuenta",
   "aplica_igss","estado_igss",
   "banco","cuenta_bancaria","notas"],
  [["1234567890101","Juan García López","20/05/1990","masculino","soltero",
    "12345678","9876543-2","55551234","","jgarcia@isp.gt","Guatemala",
    "15/01/2024","guardia","activo",
    "Puesto Central",
    "completa","domingo","8",
    "3500","250",
    "","","",
    "",
    "transferencia","Monetaria",
    "si","activo",
    "Banrural","000-123456-0",""]],
  [16,30,16,12,14,16,12,14,16,25,25,
   16,20,15,
   30,
   14,14,14,
   12,22,
   12,12,12,
   16,
   16,14,
   12,28,
   20,20,30]
);

const wsArmas = makeSheet(
  // puesto_nombre = puesto al que pertenece el arma (los agentes del puesto son responsables)
  // custodio_dpi  = DPI del agente que la tiene en este momento (opcional)
  // codigo        = si se omite, el sistema genera uno automático (ej: PIST-001)
  ["tipo","marca","modelo","calibre","serie","estado","codigo",
   "puesto_nombre",
   "numero_tenencia","fecha_vencimiento_tenencia",
   "numero_portacion","fecha_vencimiento_portacion",
   "custodio_dpi","observaciones"],
  [
    ["pistola","Glock","17","9mm","ABC123456","activo","PIST-001",
     "Puesto Central",
     "TEN-001","31/12/2025",
     "PORT-001","31/12/2025",
     "","Arma asignada a puesto permanente"],
    ["escopeta","Mossberg","500","12","XYZ789012","activo","ESCO-001",
     "Puesto Central",
     "TEN-002","30/06/2026",
     "","",
     "",""],
  ],
  [12,15,15,10,16,12,14,
   28,
   16,24,
   16,24,
   18,35]
);

const wsVehiculos = makeSheet(
  ["placa","marca","modelo","anio","color","tipo","estado",
   "kilometraje","propietario","notas"],
  [["P-123AB","Toyota","Hilux","2022","blanco","camioneta","activo",
    "45000","empresa","Vehículo de rondas"]],
  [14,15,15,8,12,14,12,14,15,30]
);

const wsBodCat = makeSheet(
  ["nombre","descripcion"],
  [["Uniformes","Ropa y equipo personal"]],
  [25,40]
);

const wsBodArt = makeSheet(
  ["nombre","categoria_nombre","codigo","unidad_medida","stock_actual",
   "stock_minimo","precio_unitario","descripcion"],
  [["Camisa negra talla M","Uniformes","UNI-CAM-M","unidad","50","10","85",""]],
  [28,25,18,16,14,14,16,35]
);

const wsAnticipos = makeSheet(
  ["colaborador_dpi","fecha","monto","descripcion","estado"],
  [["1234567890101","01/03/2024","500","Anticipo quincena","pagado"]],
  [18,14,12,35,14]
);

const wsHistPrest = makeSheet(
  ["colaborador_dpi","tipo","anio","monto","dias_efectivos","periodo_completo","notas"],
  [["1234567890101","bono14","2023","3500","365","si","Bono completo año anterior"]],
  [18,14,8,12,16,16,35]
);

const wsUsuarios = makeSheet(
  ["username","nombre","correo","password","rol","estado",
   "telefono","colaborador_dpi",
   "puede_reportar_emergencias","puede_solicitar_anticipos"],
  [["jgarcia","Juan García","jgarcia@isp.gt","Seguro123!","operaciones","activo",
    "55551234","1234567890101","no","si"]],
  [18,28,28,16,14,12,14,18,24,24]
);

const wsRoles = makeSheet(
  ["clave","label","descripcion","color","modulos"],
  [["supervisor_zona","Supervisor de Zona","Supervisa operaciones de zona","#F59E0B",
    "pizarron,incidencias,empleados,reportes"]],
  [22,28,40,12,60]
);

// ── NUEVA: MODULOS ─────────────────────────────────────────────────────────
// Una fila por permiso: rol_clave + modulo_clave
// Sirve para asignar módulos a roles YA EXISTENTES (sistema o personalizados)
const wsModulos = makeSheet(
  ["rol_clave","modulo_clave","accion"],
  [
    ["supervisor_zona","pizarron","agregar"],
    ["supervisor_zona","incidencias","agregar"],
    ["operaciones","custodias","agregar"],
    ["operaciones","pizarron","agregar"],
  ],
  [25, 30, 14]
);

// ── IGSS_PATRONO ───────────────────────────────────────────────────────────
const wsIgss = makeSheet(
  ["numero_patronal","nit_patrono","nombre_comercial",
   "correo_igss","codigo_actividad_principal"],
  [["12345678","1234567-8","ISP S.A.","igss@isp.gt","0851"]],
  [18,16,28,28,24]
);

// ── Workbook ───────────────────────────────────────────────────────────────
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, wsInstr,          "INSTRUCCIONES");
XLSX.utils.book_append_sheet(wb, wsClientes,       "CLIENTES");
XLSX.utils.book_append_sheet(wb, wsTurnos,         "TURNOS");
XLSX.utils.book_append_sheet(wb, wsPuestos,        "PUESTOS");
XLSX.utils.book_append_sheet(wb, wsColaboradores,  "COLABORADORES");
XLSX.utils.book_append_sheet(wb, wsArmas,          "ARMAS");
XLSX.utils.book_append_sheet(wb, wsVehiculos,      "VEHICULOS");
XLSX.utils.book_append_sheet(wb, wsBodCat,         "BODEGA_CATEGORIAS");
XLSX.utils.book_append_sheet(wb, wsBodArt,         "BODEGA_ARTICULOS");
XLSX.utils.book_append_sheet(wb, wsAnticipos,      "ANTICIPOS");
XLSX.utils.book_append_sheet(wb, wsHistPrest,      "HISTORIAL_PRESTACIONES");
XLSX.utils.book_append_sheet(wb, wsUsuarios,       "USUARIOS");
XLSX.utils.book_append_sheet(wb, wsRoles,          "ROLES");
XLSX.utils.book_append_sheet(wb, wsModulos,        "MODULOS");
XLSX.utils.book_append_sheet(wb, wsIgss,           "IGSS_PATRONO");

const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
writeFileSync(OUT, buf);
console.log(`✓ Template generado: ${OUT}`);
console.log(`  Hojas: ${wb.SheetNames.join(", ")}`);
