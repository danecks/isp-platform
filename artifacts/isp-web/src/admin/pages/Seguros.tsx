/**
 * Seguros.tsx — Módulo de Seguros (vida) para empleados activos
 *
 * - Configuración de prima mensual (con historial de cambios)
 * - Reporte mensual de empleados activos al cierre del mes (mes vencido)
 * - Descarga CSV listo para enviar a la aseguradora
 */

import { useEffect, useMemo, useState } from "react";
import { AdminLayout } from "@/admin/layout/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  ShieldCheck, Download, Pencil, AlertCircle, Loader2, History, Users, Wallet,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, downloadFile } from "@/lib/httpClient";

function fmtQ(v: string | number | null | undefined) {
  const n = Number(v ?? 0);
  return `Q ${n.toLocaleString("es-GT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtFecha(s: string | null | undefined) {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("es-GT", { day: "2-digit", month: "short", year: "numeric" });
}

interface SegurosConfig {
  id: number;
  prima_mensual: string;
  vigente_desde: string;
  notas: string | null;
  created_at: string;
  created_by: string | null;
}

interface ReporteEmpleado {
  id: number;
  nombre: string;
  dpi: string | null;
  sexo: string | null;
  fechaNacimiento: string | null;
  fechaIngreso: string | null;
  puesto: string | null;
  sueldoBase: string | null;
}

interface SinDatos {
  id: number;
  nombre: string;
  faltan: string[];
}

interface Reporte {
  mes: string;
  mesNombre: string;
  fechaCorte: string;
  primaMensual: number;
  primaVigenteDesde: string | null;
  totalEmpleados: number;
  totalPrima: number;
  empleados: ReporteEmpleado[];
  empleadosSinDatos: SinDatos[];
}

// Mes anterior por defecto (mes vencido)
function mesAnteriorISO(): string {
  const d = new Date();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() - 1);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export default function AdminSeguros() {
  const { toast } = useToast();
  const [config, setConfig] = useState<SegurosConfig | null>(null);
  const [mes, setMes] = useState<string>(mesAnteriorISO());
  const [reporte, setReporte] = useState<Reporte | null>(null);
  const [loadingReporte, setLoadingReporte] = useState(false);
  const [errorReporte, setErrorReporte] = useState<string | null>(null);
  const [modalEditar, setModalEditar] = useState(false);
  const [modalHistorial, setModalHistorial] = useState(false);

  async function cargarConfig() {
    try {
      const cfg = await apiRequest<SegurosConfig>("/seguros/config");
      setConfig(cfg);
    } catch (e) {
      toast({ title: "Error", description: (e as Error).message, variant: "destructive" });
    }
  }

  async function cargarReporte() {
    setLoadingReporte(true);
    setErrorReporte(null);
    try {
      const r = await apiRequest<Reporte>(`/seguros/reporte?mes=${mes}`);
      setReporte(r);
    } catch (e) {
      setErrorReporte((e as Error).message);
      setReporte(null);
    } finally {
      setLoadingReporte(false);
    }
  }

  useEffect(() => { cargarConfig(); }, []);
  useEffect(() => { cargarReporte(); }, [mes]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleDescargarCSV() {
    try {
      await downloadFile(`/seguros/reporte/csv?mes=${mes}`, `seguros_${mes}.csv`);
    } catch (e) {
      toast({ title: "Error", description: (e as Error).message, variant: "destructive" });
    }
  }

  const primaActual = Number(config?.prima_mensual ?? 0);

  return (
    <AdminLayout title="Seguros">
      <div className="px-4 sm:px-6 py-6 max-w-7xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
              <ShieldCheck className="h-5 w-5 text-emerald-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Seguros</h1>
              <p className="text-sm text-[#8bacc8]">
                Reporte mensual a la aseguradora — empleados activos al cierre del mes
              </p>
            </div>
          </div>
          <Button variant="outline" onClick={() => setModalHistorial(true)}
            className="border-[#1e3a5f] text-[#8bacc8] hover:text-white gap-2">
            <History className="h-4 w-4" /> Historial de prima
          </Button>
        </div>

        {/* Card: prima vigente */}
        <div className="bg-[#0d1b2a] border border-[#1e3a5f] rounded-lg p-5">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <div className="text-[11px] uppercase tracking-widest text-[#8bacc8] font-semibold mb-1">
                Prima mensual vigente (por empleado)
              </div>
              <div className="text-3xl font-bold text-white">
                {fmtQ(primaActual)}
              </div>
              <div className="text-xs text-[#8bacc8] mt-1">
                Vigente desde {fmtFecha(config?.vigente_desde)}
                {config?.notas && <span className="text-white/40"> · {config.notas}</span>}
              </div>
            </div>
            <Button onClick={() => setModalEditar(true)}
              className="bg-emerald-600 hover:bg-emerald-500 text-white gap-2">
              <Pencil className="h-4 w-4" /> Editar prima
            </Button>
          </div>
          {primaActual === 0 && (
            <div className="mt-3 px-3 py-2 bg-amber-950/30 border border-amber-800/50 rounded text-xs text-amber-300 flex items-center gap-2">
              <AlertCircle className="h-3.5 w-3.5" />
              No hay prima configurada. Establecé el monto mensual antes de procesar planillas.
            </div>
          )}
        </div>

        {/* Selector de mes + KPIs */}
        <div className="bg-[#0d1b2a] border border-[#1e3a5f] rounded-lg p-5 space-y-4">
          <div className="flex items-end gap-3 flex-wrap">
            <div>
              <Label className="text-xs text-[#8bacc8] mb-1">Mes a reportar (mes vencido)</Label>
              <Input type="month" value={mes} onChange={(e) => setMes(e.target.value)}
                className="bg-[#07111f] border-[#1e3a5f] text-white w-44" />
            </div>
            <Button onClick={handleDescargarCSV}
              disabled={!reporte || reporte.totalEmpleados === 0}
              className="bg-emerald-600 hover:bg-emerald-500 text-white gap-2">
              <Download className="h-4 w-4" /> Descargar CSV
            </Button>
          </div>

          {loadingReporte && (
            <div className="py-10 text-center text-[#8bacc8] text-sm flex items-center justify-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Cargando reporte...
            </div>
          )}

          {errorReporte && (
            <div className="py-3 px-4 bg-red-950/40 border border-red-800 rounded text-red-300 text-sm flex items-start gap-2">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" /> {errorReporte}
            </div>
          )}

          {reporte && !loadingReporte && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Kpi label="Mes reportado" value={reporte.mesNombre.toUpperCase()}
                  sub={`Corte: ${fmtFecha(reporte.fechaCorte)}`}
                  icon={<ShieldCheck className="h-4 w-4 text-emerald-400" />} />
                <Kpi label="Empleados asegurados" value={String(reporte.totalEmpleados)}
                  sub="Activos al último día del mes"
                  icon={<Users className="h-4 w-4 text-blue-400" />} />
                <Kpi label="Prima total del mes" value={fmtQ(reporte.totalPrima)}
                  sub={`${reporte.totalEmpleados} × ${fmtQ(reporte.primaMensual)}`}
                  icon={<Wallet className="h-4 w-4 text-amber-400" />} />
              </div>

              {reporte.empleadosSinDatos.length > 0 && (
                <div className="bg-amber-950/20 border border-amber-800/50 rounded-md p-3">
                  <div className="text-xs font-semibold text-amber-300 mb-2 flex items-center gap-1.5">
                    <AlertCircle className="h-3.5 w-3.5" />
                    {reporte.empleadosSinDatos.length} empleado(s) con datos incompletos
                  </div>
                  <div className="text-[11px] text-amber-200/80 space-y-0.5 max-h-32 overflow-y-auto">
                    {reporte.empleadosSinDatos.map((e) => (
                      <div key={e.id}>
                        • <strong>{e.nombre}</strong> — falta: {e.faltan.join(", ")}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Tabla preview */}
              <div className="border border-[#1e3a5f] rounded-md overflow-hidden">
                <div className="overflow-x-auto max-h-[60vh]">
                  <table className="w-full text-sm">
                    <thead className="bg-[#07111f] sticky top-0">
                      <tr className="text-[10px] uppercase tracking-wider text-[#8bacc8]">
                        <th className="px-3 py-2 text-left">No.</th>
                        <th className="px-3 py-2 text-left">Nombre completo</th>
                        <th className="px-3 py-2 text-left">DPI</th>
                        <th className="px-3 py-2 text-left">Sexo</th>
                        <th className="px-3 py-2 text-left">F. Nacimiento</th>
                        <th className="px-3 py-2 text-left">F. Ingreso</th>
                        <th className="px-3 py-2 text-left">Puesto</th>
                        <th className="px-3 py-2 text-right">Salario</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reporte.empleados.length === 0 && (
                        <tr><td colSpan={8} className="py-8 text-center text-[#8bacc8] text-sm">
                          No hay empleados activos al cierre de {reporte.mesNombre}
                        </td></tr>
                      )}
                      {reporte.empleados.map((e, idx) => (
                        <tr key={e.id} className="border-t border-[#1e3a5f] text-white/90 hover:bg-white/[0.02]">
                          <td className="px-3 py-2 text-[#8bacc8]">{idx + 1}</td>
                          <td className="px-3 py-2 font-medium">{e.nombre}</td>
                          <td className="px-3 py-2 font-mono text-xs">{e.dpi || <span className="text-amber-400">—</span>}</td>
                          <td className="px-3 py-2">{e.sexo || <span className="text-amber-400">—</span>}</td>
                          <td className="px-3 py-2 text-xs">{e.fechaNacimiento ? fmtFecha(e.fechaNacimiento) : <span className="text-amber-400">—</span>}</td>
                          <td className="px-3 py-2 text-xs">{fmtFecha(e.fechaIngreso)}</td>
                          <td className="px-3 py-2 text-xs">{e.puesto || "—"}</td>
                          <td className="px-3 py-2 text-right font-mono text-xs">{fmtQ(e.sueldoBase)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {modalEditar && (
        <ModalEditarPrima
          actual={config}
          onClose={() => setModalEditar(false)}
          onGuardado={() => { setModalEditar(false); cargarConfig(); cargarReporte(); }}
        />
      )}

      {modalHistorial && (
        <ModalHistorial onClose={() => setModalHistorial(false)} />
      )}
    </AdminLayout>
  );
}

function Kpi({ label, value, sub, icon }: { label: string; value: string; sub?: string; icon: React.ReactNode }) {
  return (
    <div className="bg-[#07111f] border border-[#1e3a5f] rounded-md p-3">
      <div className="flex items-center justify-between mb-1">
        <div className="text-[10px] uppercase tracking-widest text-[#8bacc8] font-semibold">{label}</div>
        {icon}
      </div>
      <div className="text-xl font-bold text-white">{value}</div>
      {sub && <div className="text-[11px] text-[#8bacc8] mt-0.5">{sub}</div>}
    </div>
  );
}

// ─── Modal: editar prima ────────────────────────────────────────────────────

function ModalEditarPrima({
  actual, onClose, onGuardado,
}: { actual: SegurosConfig | null; onClose: () => void; onGuardado: () => void }) {
  const { toast } = useToast();
  const hoy = new Date().toISOString().slice(0, 10);
  const [prima, setPrima] = useState<string>(actual?.prima_mensual ?? "0.00");
  const [vigenteDesde, setVigenteDesde] = useState<string>(hoy);
  const [notas, setNotas] = useState<string>("");
  const [guardando, setGuardando] = useState(false);

  async function handleGuardar() {
    setGuardando(true);
    try {
      await apiRequest("/seguros/config", {
        method: "POST",
        json: {
          prima_mensual: Number(prima),
          vigente_desde: vigenteDesde,
          notas: notas.trim() || null,
        },
      });
      toast({ title: "Prima actualizada", description: `Nueva prima Q${Number(prima).toFixed(2)} desde ${vigenteDesde}` });
      onGuardado();
    } catch (e) {
      toast({ title: "Error", description: (e as Error).message, variant: "destructive" });
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bg-[#0d1b2a] border-[#1e3a5f] text-white">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="h-4 w-4 text-emerald-400" />
            Editar prima de seguro de vida
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <Label className="text-xs text-[#8bacc8]">Prima mensual por empleado (Q)</Label>
            <Input type="number" step="0.01" min="0" value={prima} onChange={(e) => setPrima(e.target.value)}
              className="bg-[#07111f] border-[#1e3a5f] text-white text-lg font-mono" />
          </div>

          <div>
            <Label className="text-xs text-[#8bacc8]">Vigente desde</Label>
            <Input type="date" value={vigenteDesde} onChange={(e) => setVigenteDesde(e.target.value)}
              className="bg-[#07111f] border-[#1e3a5f] text-white" />
            <p className="text-[11px] text-[#8bacc8] mt-1">
              Esta prima se aplicará a todos los reportes con fecha de corte mayor o igual a la fecha indicada.
            </p>
          </div>

          <div>
            <Label className="text-xs text-[#8bacc8]">Notas (opcional)</Label>
            <Textarea value={notas} onChange={(e) => setNotas(e.target.value)} rows={2}
              placeholder="Ej: ajuste anual aseguradora 2026"
              className="bg-[#07111f] border-[#1e3a5f] text-white text-sm" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}
            className="border-[#1e3a5f] text-[#8bacc8] hover:text-white">
            Cancelar
          </Button>
          <Button onClick={handleGuardar} disabled={guardando}
            className="bg-emerald-600 hover:bg-emerald-500 text-white gap-2">
            {guardando && <Loader2 className="h-4 w-4 animate-spin" />}
            Guardar prima
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Modal: historial de primas ─────────────────────────────────────────────

function ModalHistorial({ onClose }: { onClose: () => void }) {
  const [rows, setRows] = useState<SegurosConfig[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiRequest<SegurosConfig[]>("/seguros/config/historial")
      .then(setRows)
      .catch((e: Error) => setError(e.message));
  }, []);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bg-[#0d1b2a] border-[#1e3a5f] text-white max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-4 w-4 text-emerald-400" />
            Historial de primas de seguro de vida
          </DialogTitle>
        </DialogHeader>

        <div className="max-h-[60vh] overflow-y-auto">
          {!rows && !error && <div className="py-8 text-center text-[#8bacc8] text-sm">Cargando...</div>}
          {error && <div className="py-3 px-4 bg-red-950/40 border border-red-800 rounded text-red-300 text-sm">{error}</div>}
          {rows && rows.length === 0 && (
            <div className="py-6 text-center text-[#8bacc8] text-sm">Sin historial.</div>
          )}
          {rows && rows.length > 0 && (
            <table className="w-full text-sm">
              <thead className="bg-[#07111f] sticky top-0">
                <tr className="text-[10px] uppercase tracking-wider text-[#8bacc8]">
                  <th className="px-3 py-2 text-left">Vigente desde</th>
                  <th className="px-3 py-2 text-right">Prima mensual</th>
                  <th className="px-3 py-2 text-left">Notas</th>
                  <th className="px-3 py-2 text-left">Modificado por</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, idx) => (
                  <tr key={r.id} className="border-t border-[#1e3a5f] text-white/90">
                    <td className="px-3 py-2">
                      {fmtFecha(r.vigente_desde)}
                      {idx === 0 && <span className="ml-2 text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">Vigente</span>}
                    </td>
                    <td className="px-3 py-2 text-right font-mono">{fmtQ(r.prima_mensual)}</td>
                    <td className="px-3 py-2 text-xs text-[#8bacc8]">{r.notas || "—"}</td>
                    <td className="px-3 py-2 text-xs text-[#8bacc8]">{r.created_by || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}
            className="border-[#1e3a5f] text-[#8bacc8] hover:text-white">
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
