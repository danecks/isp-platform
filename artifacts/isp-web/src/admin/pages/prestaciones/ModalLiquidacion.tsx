import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { AlertTriangle, UserX } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiGet, apiPost, fmt, fmtDate, TIPO_EGRESO_LABELS } from "./helpers";
import type { Employee, SimulacionLiquidacion } from "./types";

export function ModalLiquidacion({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const { toast } = useToast();
  const [step, setStep] = useState<"form" | "preview">("form");
  const [empId, setEmpId] = useState("");
  const [busEmp, setBusEmp] = useState("");
  const [tipoEgreso, setTipoEgreso] = useState("renuncia");
  const [fechaEgreso, setFechaEgreso] = useState(new Date().toISOString().slice(0, 10));
  const [ultimoDia, setUltimoDia] = useState<number | "">(15);
  const [promedioSeis, setPromedioSeis] = useState<number | "">("");
  const [vacacionesPendientes, setVacacionesPendientes] = useState<number | "">("");
  const [sim, setSim] = useState<SimulacionLiquidacion | null>(null);
  const [loading, setLoading] = useState(false);

  const { data: empleados = [] } = useQuery<Employee[]>({
    queryKey: ["employees-activos"],
    queryFn: () => apiGet("/employees?estado_laboral=activo"),
    staleTime: 60_000,
  });

  const filtEmp = (empleados as Employee[]).filter(
    (e) => !busEmp || (e.nombreCompleto ?? "").toLowerCase().includes(busEmp.toLowerCase())
  );

  async function handleSimular() {
    if (!empId) return;
    setLoading(true);
    try {
      const r = await apiPost("/prestaciones/simular-liquidacion", {
        employee_id: Number(empId),
        tipo_egreso: tipoEgreso,
        fecha_egreso: fechaEgreso,
        ultimo_dia_laborado: ultimoDia !== "" ? Number(ultimoDia) : undefined,
        promedio_ultimos_seis_meses: promedioSeis !== "" ? Number(promedioSeis) : undefined,
        vacaciones_dias_pendientes: vacacionesPendientes !== "" ? Number(vacacionesPendientes) : undefined,
      });
      // La API devuelve { simulacion, employee_id, nombre_completo, liquidacion: { rubros, totalGeneral, ... } }
      setSim({
        employee_id: r.employee_id,
        empleado_nombre: r.nombre_completo,
        tipo_egreso: tipoEgreso,
        fecha_egreso: fechaEgreso,
        rubros: r.liquidacion?.rubros ?? [],
        totalGeneral: r.liquidacion?.totalGeneral ?? 0,
        simulacion: r.simulacion ?? true,
      });
      setStep("preview");
    } catch (e: Error | unknown) {
      toast({ title: "Error al simular", description: (e as Error).message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirmar() {
    if (!empId) return;
    setLoading(true);
    try {
      await apiPost("/prestaciones/liquidaciones", {
        employee_id: Number(empId),
        tipo_egreso: tipoEgreso,
        fecha_egreso: fechaEgreso,
        ultimo_dia_laborado: ultimoDia !== "" ? Number(ultimoDia) : undefined,
        promedio_ultimos_seis_meses: promedioSeis !== "" ? Number(promedioSeis) : undefined,
        vacaciones_dias_pendientes: vacacionesPendientes !== "" ? Number(vacacionesPendientes) : undefined,
        observaciones: undefined,
      });
      toast({ title: "Liquidación registrada exitosamente" });
      onDone();
      onClose();
    } catch (e: Error | unknown) {
      const msg = (e as Error).message;
      if (msg.includes("409") || msg.toLowerCase().includes("ya existe") || msg.toLowerCase().includes("duplicate")) {
        toast({ title: "Ya existe una liquidación activa para este empleado", variant: "destructive" });
      } else {
        toast({ title: "Error al registrar", description: msg, variant: "destructive" });
      }
    } finally {
      setLoading(false);
    }
  }

  const inputCls = "w-full bg-[#060e1c] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-teal-500/40 transition-colors";

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="bg-[#07111f] border border-teal-500/20 text-white rounded-2xl max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm font-bold">
            <UserX className="w-4 h-4 text-orange-400" />
            {step === "form" ? "Dar de Baja a Empleado" : "Confirmar Liquidación Final"}
          </DialogTitle>
        </DialogHeader>

        {step === "form" && (
          <div className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label className="text-xs text-white/50">Buscar Empleado</Label>
              <Input className={inputCls} placeholder="Nombre del empleado…" value={busEmp} onChange={(e) => setBusEmp(e.target.value)} />
              {busEmp && (
                <div className="max-h-36 overflow-y-auto rounded-xl border border-white/10 bg-[#060e1c]">
                  {filtEmp.slice(0, 8).map((e) => (
                    <button key={e.id} type="button"
                      onClick={() => { setEmpId(String(e.id)); setBusEmp(e.nombreCompleto); }}
                      className={`w-full text-left px-3 py-2 text-xs hover:bg-orange-500/10 transition-colors ${String(e.id) === empId ? "bg-orange-500/20 text-orange-300" : "text-white/70"}`}
                    >{e.nombreCompleto}</button>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-white/50">Tipo de Egreso</Label>
              <select className={inputCls + " appearance-none"} value={tipoEgreso} onChange={(e) => setTipoEgreso(e.target.value)}>
                {Object.entries(TIPO_EGRESO_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-white/50">Fecha de Egreso</Label>
                <Input type="date" className={inputCls} value={fechaEgreso} onChange={(e) => setFechaEgreso(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-white/50">Último Día del Mes Laborado</Label>
                <Input type="number" min={1} max={31} className={inputCls} value={ultimoDia} onChange={(e) => setUltimoDia(e.target.value === "" ? "" : parseInt(e.target.value))} placeholder="15" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-white/50">Promedio 6 meses (opcional)</Label>
                <Input type="number" step="0.01" className={inputCls} value={promedioSeis} onChange={(e) => setPromedioSeis(e.target.value === "" ? "" : parseFloat(e.target.value))} placeholder="Automático" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-white/50">Días Vacaciones Pendientes</Label>
                <Input type="number" step="0.5" className={inputCls} value={vacacionesPendientes} onChange={(e) => setVacacionesPendientes(e.target.value === "" ? "" : parseFloat(e.target.value))} placeholder="0" />
              </div>
            </div>

            <DialogFooter className="gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={onClose} className="text-white/50 hover:text-white rounded-xl">Cancelar</Button>
              <Button onClick={handleSimular} disabled={loading || !empId} className="bg-orange-600 hover:bg-orange-500 text-white rounded-xl">
                {loading ? "Calculando…" : "Calcular Liquidación →"}
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === "preview" && sim && (
          <div className="space-y-4 mt-2">
            {/* Advertencia de baja */}
            <div className="flex items-start gap-2.5 bg-orange-500/10 border border-orange-500/25 rounded-xl px-3 py-2.5">
              <AlertTriangle className="w-4 h-4 text-orange-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-orange-300">Acción irreversible</p>
                <p className="text-[11px] text-orange-200/60 mt-0.5">
                  Al confirmar, <span className="font-semibold text-orange-200">{sim.empleado_nombre}</span> quedará marcado como <span className="font-semibold text-orange-200">BAJA</span> en el sistema y se registrará su liquidación final.
                </p>
              </div>
            </div>

            <div className="bg-white/3 rounded-xl p-3 text-xs text-white/50 space-y-0.5">
              <p><span className="text-white/30">Empleado:</span> {sim.empleado_nombre}</p>
              <p><span className="text-white/30">Motivo:</span> {TIPO_EGRESO_LABELS[sim.tipo_egreso] ?? sim.tipo_egreso}</p>
              <p><span className="text-white/30">Fecha de baja:</span> {fmtDate(sim.fecha_egreso)}</p>
            </div>

            <div className="space-y-2">
              {sim.rubros.map((r) => (
                <div key={r.rubro} className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-white/3 border border-white/6">
                  <span className="text-sm text-white/70">{r.descripcion}</span>
                  <span className="text-sm font-semibold text-white">{fmt(r.monto)}</span>
                </div>
              ))}
              <div className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-orange-500/10 border border-orange-500/20">
                <span className="text-sm font-bold text-orange-300">TOTAL LIQUIDACIÓN</span>
                <span className="text-lg font-bold text-orange-300">{fmt(sim.totalGeneral)}</span>
              </div>
            </div>

            <DialogFooter className="gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={() => setStep("form")} className="text-white/50 hover:text-white rounded-xl">← Atrás</Button>
              <Button onClick={handleConfirmar} disabled={loading} className="bg-orange-600 hover:bg-orange-500 text-white rounded-xl font-semibold">
                {loading ? "Procesando…" : "Confirmar Baja y Liquidar"}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
