import { apiFetch, apiPatch, apiPost, getSessionToken } from "@/lib/httpClient";
import type { EventoRrhh, DatosActa } from "@/lib/pdfRrhh";

export const API = "/api";
export const getSession = () => getSessionToken();

export { apiFetch, apiPatch, apiPost };

export function fmtFecha(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("es-GT", {
      day: "2-digit", month: "short", year: "numeric",
    });
  } catch { return iso; }
}

export function fmtHora(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString("es-GT", { hour: "2-digit", minute: "2-digit" });
  } catch { return ""; }
}

export function fmtDateTime(iso: string): string {
  return `${fmtFecha(iso)} ${fmtHora(iso)}`;
}

export async function construirDatosActa(evento: EventoRrhh): Promise<DatosActa> {
  const hdr = { "x-isp-session": getSession() };
  const [configRes, numRes] = await Promise.all([
    fetch(`${API}/actas/datos-para-pdf/${evento.employee_id}`, { headers: hdr }).then(r => r.ok ? r.json() : null),
    fetch(`${API}/actas/siguiente-numero`, { method: "POST", headers: { ...hdr, "Content-Type": "application/json" } }).then(r => r.ok ? r.json() : { numero: evento.id }),
  ]);

  const cfg = configRes?.config || {};
  const emp = configRes?.empleado || {};
  const puesto = configRes?.puesto || {};
  const historial = (configRes?.eventos_recientes || [])
    .filter((e: { tipo_evento: string }) => ["falta","falta_injustificada","llamada_atencion_1","llamada_atencion_2","acta_administrativa","amonestacion","suspension","suspension_disciplinaria"].includes(e.tipo_evento))
    .slice(0, 10);

  const notas: string[] = [];
  if (evento.notas) notas.push(evento.notas);
  if (evento.observaciones && evento.observaciones !== evento.notas) notas.push(evento.observaciones);

  const tipoTexto = evento.tipo_evento === "falta" || evento.tipo_evento === "falta_injustificada"
    ? "ABANDONO DEL PUESTO DE TRABAJO" : "INCUMPLIMIENTO LABORAL";

  const hechos = evento.observaciones ||
    `El trabajador ${(emp.nombre_completo || evento.employee_nombre).toUpperCase()} no se presentó ` +
    `a sus labores el día ${new Date(evento.fecha).toLocaleDateString("es-GT", { day: "2-digit", month: "long", year: "numeric" })}, ` +
    `en el puesto "${puesto.puesto_nombre || evento.puesto_nombre || "asignado"}" ` +
    `del cliente ${puesto.cliente_nombre || evento.cliente_nombre || "asignado"}, ` +
    `sin dar aviso ni justificación alguna, generando descubierto en la cobertura operativa.`;

  const causalesAuto: string[] = [];
  if (evento.tipo_evento === "falta" || evento.tipo_evento === "falta_injustificada") {
    causalesAuto.push("falta_injustificada");
  } else if (evento.tipo_evento === "abandono_parcial") {
    causalesAuto.push("ausencia_sin_permiso");
  }

  return {
    numero_acta: numRes.numero || evento.id,
    representante_nombre: cfg.representante_nombre || "Representante Legal",
    representante_dpi: cfg.representante_dpi || "",
    direccion_empresa: cfg.direccion_empresa || "14 calle 15-52 zona 1, Barrio Gerona, Ciudad de Guatemala",
    nombre_empresa: cfg.nombre_empresa || "Investigaciones y Seguridad Profesional S.A.",
    empleado_nombre: emp.nombre_completo || evento.employee_nombre,
    empleado_dpi: emp.dpi || evento.employee_dpi || "",
    empleado_fecha_ingreso: emp.fecha_ingreso || "",
    empleado_cargo: emp.cargo || "Agente de Seguridad",
    puesto_nombre: puesto.puesto_nombre || evento.puesto_nombre || "",
    cliente_nombre: puesto.cliente_nombre || evento.cliente_nombre || "",
    fecha_evento: evento.fecha,
    hechos,
    notas_sistema: notas,
    causal: tipoTexto,
    articulo_legal: "Art. 77 inciso f)",
    eventos_historial: historial.map((e: { fecha: string; tipo_evento: string; notas?: string; observaciones?: string }) => ({ fecha: e.fecha, tipo: e.tipo_evento, notas: e.notas || e.observaciones || "" })),
    causales_seleccionadas: causalesAuto,
  };
}
