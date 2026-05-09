/**
 * TabRentabilidad — Pestaña de rentabilidad por cliente.
 *
 * Extraída de `FichaCliente.tsx` (Fase 3) para mantener archivos manejables.
 * Es autocontenida: define sus propios tipos (RentaData / RentaPuesto / etc.)
 * y consulta `GET /clientes/:id/rentabilidad`.
 */
import { useEffect, useState } from "react";
import { Loader2, ChevronDown, ChevronRight, AlertTriangle, CheckCircle, Zap } from "lucide-react";
import { getSessionToken } from "@/lib/httpClient";

const API = "/api";
const getSession = () => getSessionToken();

interface RentaPuesto {
  id: number; nombre: string; sede: string | null; turno: string | null; tipo_servicio: string | null;
  tarifa_bruta: number; iva_factura: number; isr_factura: number; ingreso_neto: number;
  num_titulares: number; costo_sueldos: number; costo_igss_patronal: number;
  costo_prestaciones: number; ahorro_indemnizacion: number; costo_bonificacion: number; costo_he_30d: number;
  he_horas_30d: number; relevos_30d: number; costo_operativo: number; costo_total: number;
  margen: number; margen_pct: number;
}
interface RentaResumen {
  total_tarifa_bruta: number; total_iva: number; total_isr: number;
  total_ingreso_neto: number; total_costo_operativo: number;
  margen_global: number; margen_pct: number; total_puestos: number;
}
interface BajaDetalle { nombre: string; causal: string; fecha: string; total: number; anios: number; indemnizacion?: number; }
interface RentaData {
  puestos: RentaPuesto[];
  resumen: RentaResumen;
  bajas: {
    con_indemnizacion: { total: number; monto_indemnizacion: number; monto_total: number; detalle: BajaDetalle[] };
    sin_indemnizacion: { total: number; monto_total: number; detalle: BajaDetalle[] };
  };
}

const fmtQr = (n: number) => `Q${n.toLocaleString("es-GT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const causalLabel: Record<string, string> = {
  renuncia: "Renuncia", despido_justificado: "Despido justificado",
  despido_injustificado: "Despido injustificado", mutuo_acuerdo: "Mutuo acuerdo",
  finalizacion_contrato: "Fin de contrato",
};

export function TabRentabilidad({ clienteId }: { clienteId: number }) {
  const [data, setData] = useState<RentaData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandido, setExpandido] = useState<number | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch(`${API}/clientes/${clienteId}/rentabilidad`, { headers: { "x-isp-session": getSession() } })
      .then(r => r.ok ? r.json() : null)
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [clienteId]);

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-white/20" /></div>;
  if (!data) return <p className="text-center text-white/30 py-12">No se pudo cargar la rentabilidad</p>;

  const { resumen: r, puestos, bajas } = data;
  const margenColor = r.margen_pct >= 20 ? "text-green-400" : r.margen_pct >= 10 ? "text-yellow-400" : "text-red-400";

  return (
    <div className="p-5 space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Facturación bruta", value: fmtQr(r.total_tarifa_bruta), sub: `${r.total_puestos} puestos`, color: "text-blue-400" },
          { label: "IVA + ISR factura", value: fmtQr(r.total_iva + r.total_isr), sub: `IVA ${fmtQr(r.total_iva)} · ISR ${fmtQr(r.total_isr)}`, color: "text-orange-400" },
          { label: "Ingreso neto", value: fmtQr(r.total_ingreso_neto), sub: "Después de impuestos", color: "text-cyan-400" },
          { label: "Margen operativo", value: `${r.margen_pct}%`, sub: fmtQr(r.margen_global), color: margenColor },
        ].map(c => (
          <div key={c.label} className="bg-[#060e1c] border border-white/5 rounded-xl p-3">
            <p className="text-[10px] text-white/30 uppercase tracking-wide mb-1">{c.label}</p>
            <p className={`text-lg font-bold ${c.color}`}>{c.value}</p>
            <p className="text-[10px] text-white/25 mt-0.5">{c.sub}</p>
          </div>
        ))}
      </div>

      <div className="bg-[#060e1c] border border-white/5 rounded-xl p-4 space-y-2">
        <p className="text-[10px] text-white/30 uppercase tracking-widest font-semibold mb-2">Cascada de ingresos</p>
        {[
          { label: "Facturación bruta (con IVA)", value: r.total_tarifa_bruta, bar: 100, neg: false },
          { label: "(-) IVA 12%", value: -r.total_iva, bar: 0, neg: true },
          { label: "(-) ISR servicios 5%", value: -r.total_isr, bar: 0, neg: true },
          { label: "= Ingreso neto", value: r.total_ingreso_neto, bar: r.total_tarifa_bruta > 0 ? (r.total_ingreso_neto / r.total_tarifa_bruta) * 100 : 0, neg: false },
          { label: "(-) Costo operativo", value: -r.total_costo_operativo, bar: 0, neg: true },
          { label: "= Margen", value: r.margen_global, bar: r.total_tarifa_bruta > 0 ? (r.margen_global / r.total_tarifa_bruta) * 100 : 0, neg: false },
        ].map(row => (
          <div key={row.label} className="flex items-center gap-3">
            <span className={`text-xs w-44 shrink-0 ${row.neg ? "text-red-400/60 pl-4" : "text-white/60"}`}>{row.label}</span>
            <div className="flex-1 h-2 bg-white/3 rounded overflow-hidden">
              {row.bar > 0 && <div className={`h-full rounded ${row.value >= 0 ? "bg-primary/40" : "bg-red-500/40"}`} style={{ width: `${Math.max(0, Math.min(100, row.bar))}%` }} />}
            </div>
            <span className={`text-xs font-mono w-28 text-right ${row.neg ? "text-red-400/70" : "text-white/80"}`}>{fmtQr(Math.abs(row.value))}</span>
          </div>
        ))}
      </div>

      <div>
        <p className="text-[10px] text-white/30 uppercase tracking-widest font-semibold mb-3">Rentabilidad por puesto</p>
        <div className="space-y-1.5">
          {puestos.map(p => {
            const isOpen = expandido === p.id;
            const mc = p.margen_pct >= 20 ? "text-green-400" : p.margen_pct >= 10 ? "text-yellow-400" : "text-red-400";
            return (
              <div key={p.id} className="bg-[#060e1c] border border-white/5 rounded-xl overflow-hidden">
                <button
                  onClick={() => setExpandido(isOpen ? null : p.id)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/3 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white/90 font-medium truncate">{p.nombre}</p>
                    <p className="text-[10px] text-white/30 truncate">{p.sede ?? "—"} · {p.turno ?? "—"} · {p.num_titulares} titular{p.num_titulares !== 1 ? "es" : ""}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`text-sm font-bold ${mc}`}>{p.margen_pct}%</p>
                    <p className="text-[10px] text-white/30">{fmtQr(p.margen)}</p>
                  </div>
                  {isOpen ? <ChevronDown className="w-3.5 h-3.5 text-white/20" /> : <ChevronRight className="w-3.5 h-3.5 text-white/20" />}
                </button>
                {isOpen && (
                  <div className="px-4 pb-4 pt-1 border-t border-white/5 grid sm:grid-cols-2 gap-x-6 gap-y-1.5 text-xs">
                    <div className="col-span-full text-[10px] text-white/20 uppercase tracking-widest font-semibold mb-1">Ingresos</div>
                    <div className="flex justify-between"><span className="text-white/40">Tarifa bruta</span><span className="text-white/70">{fmtQr(p.tarifa_bruta)}</span></div>
                    <div className="flex justify-between"><span className="text-red-400/50">(-) IVA 12%</span><span className="text-red-400/60">{fmtQr(p.iva_factura)}</span></div>
                    <div className="flex justify-between"><span className="text-red-400/50">(-) ISR 5%</span><span className="text-red-400/60">{fmtQr(p.isr_factura)}</span></div>
                    <div className="flex justify-between border-t border-white/5 pt-1"><span className="text-cyan-400/60 font-medium">Ingreso neto</span><span className="text-cyan-400/80 font-medium">{fmtQr(p.ingreso_neto)}</span></div>

                    <div className="col-span-full text-[10px] text-white/20 uppercase tracking-widest font-semibold mt-3 mb-1">Costos operativos</div>
                    <div className="flex justify-between"><span className="text-white/40">Sueldos base</span><span className="text-white/70">{fmtQr(p.costo_sueldos)}</span></div>
                    <div className="flex justify-between"><span className="text-white/40">IGSS patronal (12.67%)</span><span className="text-white/70">{fmtQr(p.costo_igss_patronal)}</span></div>
                    <div className="flex justify-between"><span className="text-white/40">Prestaciones (32.11%)</span><span className="text-white/70">{fmtQr(p.costo_prestaciones)}</span></div>
                    <div className="flex justify-between"><span className="text-white/40">Bonificación incentivo</span><span className="text-white/70">{fmtQr(p.costo_bonificacion)}</span></div>
                    <div className="flex justify-between"><span className="text-white/40">HE últ. 30 días ({p.he_horas_30d}h)</span><span className="text-white/70">{fmtQr(p.costo_he_30d)}</span></div>
                    <div className="flex justify-between border-t border-white/5 pt-1"><span className="text-orange-400/60 font-medium">Costo operativo total</span><span className="text-orange-400/80 font-medium">{fmtQr(p.costo_operativo)}</span></div>
                    <div className="flex justify-between mt-1"><span className="text-green-400/60">Ahorro indemnización (9.72%)</span><span className="text-green-400/80 font-medium">+{fmtQr(p.ahorro_indemnizacion)}</span></div>

                    <div className="col-span-full border-t border-white/5 mt-2 pt-2 flex justify-between">
                      <span className={`font-bold ${mc}`}>Margen neto</span>
                      <span className={`font-bold ${mc}`}>{fmtQr(p.margen)} ({p.margen_pct}%)</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          {puestos.length === 0 && <p className="text-center text-white/20 py-6 text-sm">No hay puestos activos</p>}
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="bg-[#060e1c] border border-red-500/10 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
            <p className="text-xs font-semibold text-red-400">Bajas CON indemnización ({bajas.con_indemnizacion.total})</p>
          </div>
          {bajas.con_indemnizacion.total > 0 ? (
            <>
              <div className="flex justify-between text-xs mb-2 bg-red-500/5 rounded-lg px-3 py-2">
                <span className="text-white/40">Total indemnización</span>
                <span className="text-red-400 font-bold">{fmtQr(bajas.con_indemnizacion.monto_indemnizacion)}</span>
              </div>
              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                {bajas.con_indemnizacion.detalle.map((b, i) => (
                  <div key={i} className="flex items-center justify-between text-[11px] px-2 py-1.5 bg-white/2 rounded-lg">
                    <div className="min-w-0">
                      <p className="text-white/70 truncate">{b.nombre}</p>
                      <p className="text-white/25 text-[10px]">{causalLabel[b.causal] ?? b.causal} · {Number(b.anios).toFixed(1)} años</p>
                    </div>
                    <span className="text-red-400/80 font-mono shrink-0 ml-2">{fmtQr(b.indemnizacion ?? 0)}</span>
                  </div>
                ))}
              </div>
            </>
          ) : <p className="text-white/20 text-xs">Sin bajas con indemnización</p>}
        </div>

        <div className="bg-[#060e1c] border border-green-500/10 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle className="w-3.5 h-3.5 text-green-400" />
            <p className="text-xs font-semibold text-green-400">Bajas SIN indemnización ({bajas.sin_indemnizacion.total})</p>
          </div>
          {bajas.sin_indemnizacion.total > 0 ? (
            <>
              <div className="flex justify-between text-xs mb-2 bg-green-500/5 rounded-lg px-3 py-2">
                <span className="text-white/40">Liquidación total</span>
                <span className="text-green-400 font-bold">{fmtQr(bajas.sin_indemnizacion.monto_total)}</span>
              </div>
              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                {bajas.sin_indemnizacion.detalle.map((b, i) => (
                  <div key={i} className="flex items-center justify-between text-[11px] px-2 py-1.5 bg-white/2 rounded-lg">
                    <div className="min-w-0">
                      <p className="text-white/70 truncate">{b.nombre}</p>
                      <p className="text-white/25 text-[10px]">{causalLabel[b.causal] ?? b.causal} · {Number(b.anios).toFixed(1)} años</p>
                    </div>
                    <span className="text-green-400/60 font-mono shrink-0 ml-2">{fmtQr(b.total)}</span>
                  </div>
                ))}
              </div>
            </>
          ) : <p className="text-white/20 text-xs">Sin bajas registradas</p>}
        </div>
      </div>

      <div className="bg-blue-950/20 border border-blue-500/15 rounded-xl px-4 py-3 flex items-start gap-2.5">
        <Zap className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5" />
        <div className="text-[10px] text-blue-300/70 leading-relaxed">
          <p><strong>Ingreso neto</strong> = Tarifa bruta − IVA (12%) − ISR servicios (5% sobre base). <strong>Margen</strong> = Ingreso neto − costos operativos.</p>
          <p><strong>Costos operativos</strong>: sueldos base + IGSS patronal (12.67%) + prestaciones sin indemnización (aguinaldo, bono14, vacaciones ≈ 32.11%) + bonificación incentivo + horas extra aprobadas (últimos 30 días).</p>
          <p><strong>Política 0 despidos injustificados</strong>: la indemnización (9.72%) no se incluye como costo — se muestra como ahorro. Solo se registra como gasto real si ocurre un despido con indemnización.</p>
          <p><strong>Bajas con indemnización</strong>: despido injustificado, fin de contrato, mutuo acuerdo. <strong>Sin indemnización</strong>: renuncia, despido justificado.</p>
        </div>
      </div>
    </div>
  );
}
