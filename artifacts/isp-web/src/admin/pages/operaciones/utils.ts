import type React from "react";
import { UserPlus, ArrowLeftRight, UserMinus } from "lucide-react";
import { getSessionToken } from "@/lib/httpClient";

export function fechaHoyStr() {
  const d = new Date();
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}-${mm}-${d.getFullYear()}`;
}

export function iniciales(n: string | null | undefined) {
  if (!n) return "?";
  return n.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");
}

export function fmtHora(iso: string) {
  return new Date(iso).toLocaleString("es-GT", {
    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
  });
}

export const API_BASE = "/api";

export const getSession = () => getSessionToken();

export async function apiPost(url: string, body: object) {
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-isp-session": getSession() },
    body: JSON.stringify(body),
  });
  const data = await r.json();
  if (!r.ok) throw { status: r.status, ...data };
  return data;
}

export async function apiDelete(url: string) {
  const r = await fetch(url, { method: "DELETE" });
  if (!r.ok) throw new Error("Error al eliminar");
  return r.json();
}

export const AVATAR_COLORS = [
  "bg-blue-600", "bg-purple-600", "bg-teal-600", "bg-orange-600",
  "bg-rose-600", "bg-emerald-600", "bg-indigo-600", "bg-amber-600",
];

export function avatarColor(nombre: string | null | undefined) {
  if (!nombre) return AVATAR_COLORS[0];
  const sum = nombre.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return AVATAR_COLORS[sum % AVATAR_COLORS.length];
}

export const TURNO_COLORS: Record<string, string> = {
  "día":   "text-yellow-400 bg-yellow-400/10 border-yellow-400/20",
  "noche": "text-blue-400 bg-blue-400/10 border-blue-400/20",
  "24h":   "text-purple-400 bg-purple-400/10 border-purple-400/20",
  "mixto": "text-teal-400 bg-teal-400/10 border-teal-400/20",
};

export const TIPO_MOV: Record<string, { label: string; icon: React.ComponentType<{ className?: string }>; color: string }> = {
  asignacion:  { label: "Asignación",  icon: UserPlus,       color: "text-green-400" },
  sustitucion: { label: "Sustitución", icon: ArrowLeftRight, color: "text-yellow-400" },
  liberacion:  { label: "Liberación",  icon: UserMinus,      color: "text-red-400" },
};

const MESES_ABR_ES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

// Devuelve la fecha "hoy" en hora local de Guatemala (UTC-6, sin DST) en formato YYYY-MM-DD.
function hoyGuatemalaISO(): string {
  const now = new Date();
  const gt = new Date(now.getTime() - 6 * 60 * 60 * 1000);
  return gt.toISOString().slice(0, 10);
}

// Anotación (tooltip) con nombre completo, fecha de alta y teléfono de una persona.
// Se usa al pasar el mouse en los slots del pizarrón y en las tarjetas del pool.
export function tooltipPersona(
  nombre?: string | null,
  fechaIngreso?: string | null,
  telefono?: string | null,
): string {
  const lineas: string[] = [nombre?.trim() || "Sin nombre"];
  let alta = "Sin fecha de alta";
  if (fechaIngreso) {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(fechaIngreso));
    if (m) alta = `Alta: ${m[3]}/${m[2]}/${m[1]}`;
  }
  lineas.push(alta);
  lineas.push(telefono?.trim() ? `Tel: ${telefono.trim()}` : "Sin teléfono");
  return lineas.join("\n");
}

// Etiqueta para empleados con fecha de ingreso futura (no asignables aún).
export function etiquetaInicioFuturo(fechaIngresoISO?: string | null): string | null {
  if (!fechaIngresoISO) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(fechaIngresoISO);
  if (!m) return null;
  const fechaIng = `${m[1]}-${m[2]}-${m[3]}`;
  if (fechaIng <= hoyGuatemalaISO()) return null;
  const dd = m[3];
  const mm = MESES_ABR_ES[Number(m[2]) - 1] ?? "";
  return `Inicia ${dd}-${mm}`;
}

export function parseHM(s: string): number {
  const [h, m] = s.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

export function fmt2(n: number) {
  return String(Math.floor(n)).padStart(2, "0");
}

export function minToHM(min: number): string {
  const m = ((min % 1440) + 1440) % 1440;
  return `${fmt2(m / 60)}:${fmt2(m % 60)}`;
}

// ─── Helpers de turno/timeline ────────────────────────────────────────────────

export function turnoBounds(
  turno: string,
  horaEntrada?: string | null,
  horaSalida?: string | null,
): { inicioMin: number; finMin: number; totalMin: number } {
  if (horaEntrada && horaSalida) {
    const i = parseHM(horaEntrada);
    let f = parseHM(horaSalida);
    if (f <= i) f += 1440;
    return { inicioMin: i, finMin: f, totalMin: f - i };
  }
  const esNoche = (turno ?? "").toLowerCase() === "noche";
  return esNoche
    ? { inicioMin: 18 * 60, finMin: 30 * 60, totalMin: 12 * 60 }
    : { inicioMin: 6 * 60, finMin: 18 * 60, totalMin: 12 * 60 };
}

// Devuelve el lunes más cercano hacia atrás (o la fecha actual si ya es lunes).
// Garantiza que D1=Lun, D2=Mar, ... D7=Dom en el ciclo.
export function lastMondayDate(fromDate?: string | null): string {
  const dateStr = fromDate ? String(fromDate).slice(0, 10) : null;
  const d = dateStr ? new Date(dateStr + "T12:00:00") : new Date();
  const day = d.getDay();
  const diff = day === 0 ? 6 : day - 1;
  d.setDate(d.getDate() - diff);
  return d.toISOString().slice(0, 10);
}

export const DIAS_SEM_OP = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

// Construye las "semanas" del ciclo según longitud_ciclo (7/14/21/28).
export function semanasCiclo(longitudCiclo: number): Array<Array<{ n: number; label: string }>> {
  const lc = [7, 14, 21, 28].includes(longitudCiclo) ? longitudCiclo : 14;
  const total = lc;
  const dias = Array.from({ length: total }, (_, i) => ({ n: i + 1, label: DIAS_SEM_OP[i % 7] }));
  const numSem = Math.ceil(total / 7);
  return Array.from({ length: numSem }, (_, si) => dias.slice(si * 7, (si + 1) * 7));
}

// Hora de entrada efectiva para una semana del ciclo (0-indexed).
export function horaSemanaSlot(
  slot: { hora_entrada_por_semana: string[] | null; hora_entrada: string },
  semanaIdx: number,
): string {
  const hps = slot.hora_entrada_por_semana;
  if (Array.isArray(hps) && hps[semanaIdx]) return hps[semanaIdx];
  return slot.hora_entrada || "07:00";
}

// TURNOS-05: hora de entrada efectiva para un día puntual del ciclo (1..longitud_ciclo).
// Prioridad: hora_entrada_por_dia[d] > hora_entrada_por_semana[semana(d)] > hora_entrada.
// El helper centraliza la regla para que todos los consumidores (modal, reporte, etc.)
// la apliquen igual y respeten las excepciones por día puntuales.
export function horaDelDiaSlot(
  slot: {
    hora_entrada_por_dia?: Record<string, string> | null;
    hora_entrada_por_semana: string[] | null;
    hora_entrada: string;
  },
  diaCiclo: number,
): string {
  const hpd = slot.hora_entrada_por_dia;
  if (hpd && typeof hpd === "object") {
    const v = hpd[String(diaCiclo)];
    if (typeof v === "string" && /^\d{2}:\d{2}$/.test(v)) return v;
  }
  const semIdx = Math.max(0, Math.floor((diaCiclo - 1) / 7));
  return horaSemanaSlot(slot, semIdx);
}

// Devuelve YYYY-MM-DD en zona horaria de Guatemala (America/Guatemala, UTC-6).
export function toISODate(d: Date): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Guatemala",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(d);
}
