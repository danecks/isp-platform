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

const getSession = () => getSessionToken();

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
