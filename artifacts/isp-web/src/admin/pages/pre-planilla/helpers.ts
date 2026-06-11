import { Clock, CheckCircle2, AlertCircle, ShieldCheck } from "lucide-react";
import { apiRequest, getSessionToken } from "@/lib/httpClient";
import type { ColaboradorPre } from "./types";

export const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
export const getSession = () => getSessionToken();

export { apiRequest };

export function getPeriodPresets() {
  const hoy = new Date();
  const y = hoy.getFullYear();
  const m = hoy.getMonth();
  const d = hoy.getDate();
  const fin = (y2: number, m2: number) => new Date(y2, m2 + 1, 0).getDate();
  const fmt = (y2: number, m2: number, d2: number) =>
    `${y2}-${String(m2 + 1).padStart(2, "0")}-${String(d2).padStart(2, "0")}`;

  let qDesde: string, qHasta: string;
  if (d <= 15) { qDesde = fmt(y, m, 1); qHasta = fmt(y, m, 15); }
  else { qDesde = fmt(y, m, 16); qHasta = fmt(y, m, fin(y, m)); }

  let qpDesde: string, qpHasta: string;
  if (d <= 15) {
    const pm = m === 0 ? 11 : m - 1; const py = m === 0 ? y - 1 : y;
    qpDesde = fmt(py, pm, 16); qpHasta = fmt(py, pm, fin(py, pm));
  } else { qpDesde = fmt(y, m, 1); qpHasta = fmt(y, m, 15); }

  const maDesde = fmt(y, m, 1); const maHasta = fmt(y, m, fin(y, m));
  const pm = m === 0 ? 11 : m - 1; const py = m === 0 ? y - 1 : y;
  const mpDesde = fmt(py, pm, 1); const mpHasta = fmt(py, pm, fin(py, pm));

  return { qDesde, qHasta, qpDesde, qpHasta, maDesde, maHasta, mpDesde, mpHasta };
}

export function fmtFecha(iso: string) {
  const clean = typeof iso === "string" ? iso.slice(0, 10) : "";
  if (!clean || clean.length < 10) return "—";
  return new Date(clean + "T12:00:00").toLocaleDateString("es-GT", {
    weekday: "short", day: "2-digit", month: "short",
  });
}

export function fmtQ(n: number | string | null) {
  if (n === null || n === undefined || n === "") return "—";
  const num = parseFloat(String(n));
  if (isNaN(num)) return "—";
  return `Q${num.toLocaleString("es-GT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function calcularISRQuincenal(sueldoBaseMensual: number, aplicaIgss: boolean = true): number {
  const brutaAnual = sueldoBaseMensual * 12;
  const igssAnual = aplicaIgss ? brutaAnual * 0.0483 : 0;
  const rentaImponible = brutaAnual - igssAnual - 48000;
  if (rentaImponible <= 0) return 0;
  let isrAnual = 0;
  if (rentaImponible <= 300000) {
    isrAnual = rentaImponible * 0.05;
  } else {
    isrAnual = 300000 * 0.05 + (rentaImponible - 300000) * 0.07;
  }
  return Math.round((isrAnual / 24) * 100) / 100;
}

export function calcularTotalEstimado(col: ColaboradorPre, periodoTotalDias: number | null) {
  const sb = parseFloat(String(col.sueldo_base ?? "0"));
  if (!sb || !periodoTotalDias) return null;
  const sueldoDia = sb / 30;
  const sueldoPeriodo = sueldoDia * periodoTotalDias;
  const diasDescuento = Number(col.total_dias_descuento ?? 0);
  const suspensiones = Number(col.suspensiones);
  const diasDesc = (diasDescuento > 0 ? diasDescuento : Number(col.faltas)) + suspensiones;
  const descFaltas = sueldoDia * diasDesc;
  const horasDia = col.horas_contrato ? col.horas_contrato / 6 : 8;
  const valorHora = sueldoDia / horasDia;
  const he = parseFloat(String(col.horas_extra ?? "0"));
  // valor_he viene del backend (tarifa fija por turno: 12h→Q150, 24h→Q300).
  // Si no llegara, cae a la fórmula legal 1.5x para no romper la vista.
  const valorHE = col.valor_he != null ? Number(col.valor_he) : valorHora * 1.5 * he;
  const anticipo = Number(col.anticipos_monto);
  const cuotaUniforme = Number(col.cuota_uniforme_monto ?? 0);
  const barracaMonto = Number(col.barraca_monto ?? 0);
  const primaSeguroMensual = Number(col.seguro_prima_mensual ?? 0);
  const frec = String(col.frecuencia_pago ?? "quincenal");
  const seguroMonto = primaSeguroMensual > 0
    ? (frec === "quincenal" ? Math.round((primaSeguroMensual / 2) * 100) / 100 : primaSeguroMensual)
    : 0;
  const igssLaboral = col.aplica_igss ? Math.round((sueldoPeriodo - descFaltas) * 0.0483 * 100) / 100 : 0;
  const isrQuincenal = calcularISRQuincenal(sb, col.aplica_igss);

  const safeNum = (v: unknown, def = 0) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : def;
  };
  const bonIncentivoBase = Math.max(safeNum(col.bon_incentivo_base, 250), 0);
  const bon1Base = Math.max(safeNum(col.bon_1_base, 0), 0);
  const bon2Base = Math.max(safeNum(col.bon_2_base, 0), 0);
  const bon3Base = Math.max(safeNum(col.bon_3_base, 0), 0);
  const r2 = (n: number) => Math.round(n * 100) / 100;

  const diasPermisoGoce = safeNum(col.dias_permiso_con_goce, 0);
  const diasTrabReal = Math.max(safeNum(col.dias_trabajados, 0) + diasPermisoGoce, 0);
  const bonIncentivoReal = r2((bonIncentivoBase / 30) * diasTrabReal);
  const bon1Real = r2((bon1Base / 30) * diasTrabReal);
  const bon2Real = r2((bon2Base / 30) * diasTrabReal);
  const bon3Real = r2((bon3Base / 30) * diasTrabReal);
  const totalBonifReal = bonIncentivoReal + bon1Real + bon2Real + bon3Real;

  const diasNoDevengan = diasDesc + safeNum(col.dias_vacaciones, 0) + safeNum(col.dias_incapacidad, 0);
  const diasTrabProy = Math.max(periodoTotalDias - diasNoDevengan, 0);
  const bonIncentivoProy = r2((bonIncentivoBase / 30) * diasTrabProy);
  const bon1Proy = r2((bon1Base / 30) * diasTrabProy);
  const bon2Proy = r2((bon2Base / 30) * diasTrabProy);
  const bon3Proy = r2((bon3Base / 30) * diasTrabProy);
  const totalBonifProy = bonIncentivoProy + bon1Proy + bon2Proy + bon3Proy;

  const amonestaciones = Number(col.amonestaciones_monto ?? 0);
  const pagoFeriados = Math.max(safeNum(col.pago_feriados, 0), 0);

  const total = sueldoPeriodo + totalBonifProy + valorHE + pagoFeriados
              - descFaltas - anticipo - cuotaUniforme - barracaMonto - seguroMonto
              - amonestaciones - igssLaboral - isrQuincenal;

  const diasCerrados = Number(col.dias_cerrados ?? 0);
  const sueldoReal = sueldoDia * diasCerrados;
  const igssLaboralReal = col.aplica_igss ? Math.round((sueldoReal - descFaltas) * 0.0483 * 100) / 100 : 0;
  const totalReal = sueldoReal + totalBonifReal + valorHE + pagoFeriados
                  - descFaltas - anticipo - cuotaUniforme - barracaMonto - seguroMonto
                  - amonestaciones - igssLaboralReal - isrQuincenal;

  return {
    sueldoPeriodo, descFaltas, valorHE, anticipo, cuotaUniforme, barracaMonto, seguroMonto,
    igssLaboral, igssLaboralReal, isrQuincenal, total, diasDesc, diasCerrados, sueldoReal, totalReal,
    bonIncentivoReal, bon1Real, bon2Real, bon3Real, totalBonifReal, diasTrabReal,
    bonIncentivoProy, bon1Proy, bon2Proy, bon3Proy, totalBonifProy, diasTrabProy,
    amonestaciones, pagoFeriados,
  };
}

export const REVISION_CFG = {
  pendiente:     { label: "Pendiente",    cls: "text-amber-400 bg-amber-400/10 border-amber-400/25",  icon: Clock },
  revisada:      { label: "Revisada",     cls: "text-green-400 bg-green-400/10 border-green-400/25",  icon: CheckCircle2 },
  observada:     { label: "Observada",    cls: "text-rose-400 bg-rose-400/10 border-rose-400/25",     icon: AlertCircle },
  aprobado_rrhh: { label: "Aprobado",    cls: "text-primary bg-primary/10 border-primary/30",        icon: ShieldCheck },
};
