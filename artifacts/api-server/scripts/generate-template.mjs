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
  ["MÓDULOS VÁLIDOS (columnas modulos en ROLES / modulo_clave en MODULOS):"],
  ...MODULOS.map(([clave, label, seccion]) => [`  ${clave}  →  ${label}  (${seccion})`]),
];
const wsInstr = XLSX.utils.aoa_to_sheet(instrRows);
wsInstr["!cols"] = [{ wch: 70 }];

// ── Sheets de datos ────────────────────────────────────────────────────────
const wsClientes = makeSheet(
  ["nombre","nombre_comercial","nit","sector","fecha_inicio_contrato",
   "igss_aplica","igss_codigo_centro","igss_direccion","igss_zona",
   "igss_departamento","igss_municipio","igss_codigo_actividad",
   "igss_contacto","igss_telefono","igss_email","notas"],
  [["Comercializadora Ejemplo","Ejemplo S.A.","1234567-8","Comercio","15/01/2024",
    "si","01","5a Calle 5-50","1","1","1","0851","Juan Pérez","55551234","igss@ejemplo.com",""]],
  [30,25,15,15,20,12,20,30,8,15,15,20,20,15,25,30]
);

const wsTurnos = makeSheet(
  ["nombre","horas_trabajo","tipo","hora_inicio","hora_fin","descripcion"],
  [["Turno Diurno 8h","8","diurno","07:00","15:00","Turno normal diurno"]],
  [25,14,15,12,12,35]
);

const wsPuestos = makeSheet(
  ["nombre","cliente_nombre","turno_nombre","codigo","ubicacion","descripcion",
   "salario_base","num_guardias_requeridos","activo"],
  [["Puesto Central","Comercializadora Ejemplo","Turno Diurno 8h","P-001",
    "Zona 10","Recepción principal","3500","2","si"]],
  [28,30,25,12,20,30,14,22,8]
);

const wsColaboradores = makeSheet(
  ["dpi","nombre_completo","fecha_nacimiento","genero","estado_civil",
   "numero_igss","nit","telefono","correo","direccion",
   "departamento","municipio","fecha_ingreso","puesto_nombre",
   "turno_nombre","salario","bonificacion","tipo_pago","activo"],
  [["1234567890101","Juan García López","20/05/1990","masculino","soltero",
    "12345678","9876543-2","55551234","jgarcia@isp.gt","5a Avenida 1-23 Zona 1",
    "Guatemala","Guatemala Ciudad","15/01/2024","Puesto Central",
    "Turno Diurno 8h","3500","250","mensual","si"]],
  [16,30,16,12,14,16,12,14,25,35,18,22,16,28,25,10,12,12,8]
);

const wsArmas = makeSheet(
  ["tipo","marca","modelo","serie","calibre","estado","propietario",
   "fecha_registro","notas","asignado_a_dpi"],
  [["pistola","Glock","17","ABC123","9mm","activo","empresa",
    "01/01/2024","","1234567890101"]],
  [15,15,15,20,12,12,18,16,30,18]
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
