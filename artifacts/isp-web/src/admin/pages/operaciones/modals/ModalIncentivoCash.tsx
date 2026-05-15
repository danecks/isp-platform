import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getSession } from "../utils";

export function ModalIncentivoCash({
  data, autorizadoPor, apiBase, onClose,
}: {
  data: {
    agenteId: number; agenteName: string;
    puestoId: number | null; puestoName: string;
    clienteId: number | null; clienteNombre: string | null;
    sedeId: number | null; fecha: string;
    costoHE?: number | null; jornada?: string;
  };
  autorizadoPor: string;
  apiBase: string;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [modo, setModo] = useState<"elegir" | "efectivo">("elegir");
  const [tarifaLocal, setTarifaLocal] = useState<{ tarifa: number; horas_turno: number } | null>(null);
  const [monto, setMonto] = useState("");
  const [pagadoPor, setPagadoPor] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`${apiBase}/nomina/tarifas-he`).then(r => r.json()).then((rows: any[]) => {
      const jClave = (data.jornada ?? "12h") === "24h" ? "24h" : "12h";
      const found = rows.find((r: any) => r.jornada === jClave) ?? rows[0];
      if (found) {
        const t = { tarifa: parseFloat(found.tarifa), horas_turno: parseInt(found.horas_turno) };
        setTarifaLocal(t);
        setMonto(t.tarifa.toFixed(2));
      }
    }).catch(() => {});
  }, [apiBase, data.jornada]);

  function elegirPlanilla() {
    toast({
      title: "HE se procesarán en planilla",
      description: `Las horas extra de ${data.agenteName} pasarán por aprobación RRHH antes de incluirse en nómina.`,
    });
    onClose();
  }

  async function registrarEfectivo() {
    const montoNum = Number(monto);
    if (!monto || isNaN(montoNum) || montoNum <= 0) {
      toast({ title: "Monto inválido", description: "Ingresa un monto mayor a 0", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      await fetch(`${apiBase}/incentivos`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-isp-session": getSession() },
        body: JSON.stringify({
          employeeId: data.agenteId,
          employeeNombre: data.agenteName,
          fecha: data.fecha,
          clienteId: data.clienteId,
          clienteNombre: data.clienteNombre,
          sedeId: data.sedeId,
          puestoId: data.puestoId,
          puestoNombre: data.puestoName,
          tipo: "he_efectivo",
          monto: montoNum,
          motivo: `Pago HE en efectivo — ${data.puestoName}`,
          autorizadoPor,
          pagadoPor: pagadoPor || autorizadoPor,
          metodoPago: "efectivo",
          estado: "pagado",
          observaciones: observaciones || undefined,
        }),
      }).then(async (r) => {
        if (r.status === 409) {
          const body = await r.json().catch(() => ({}));
          throw new Error(body.error ?? "Ya registrado");
        }
        if (!r.ok) throw new Error("Error al guardar");
        return r.json();
      });

      toast({
        title: "HE pagadas en efectivo",
        description: `Q${montoNum.toFixed(2)} → ${data.agenteName}. No se incluirá en planilla.`,
      });
      qc.invalidateQueries({ queryKey: ["operaciones-tablero"] });
      onClose();
    } catch (err: any) {
      const msg = err?.message?.includes("Ya existe") ? err.message : "No se pudo registrar el pago en efectivo";
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  const costoPorHora = tarifaLocal ? tarifaLocal.tarifa / tarifaLocal.horas_turno : null;

  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/75 backdrop-blur-sm">
      <div className="bg-[#07111f] border border-amber-600/30 rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 bg-amber-900/20 border-b border-amber-700/20">
          <div>
            <h3 className="text-sm font-bold text-amber-300">Pago de Horas Extra</h3>
            <p className="text-[11px] text-white/40 mt-0.5">{data.agenteName} · {data.puestoName} · {data.fecha}</p>
          </div>
          <button onClick={onClose} className="text-white/30 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {tarifaLocal && (
          <div className="mx-5 mt-4 px-3 py-2 rounded-lg bg-white/5 border border-white/10">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-white/40 uppercase tracking-widest">Tarifa {data.jornada ?? "12h"}</span>
              <span className="text-xs text-white/70">Q{costoPorHora?.toFixed(2)}/hora</span>
            </div>
            <div className="text-lg font-bold text-amber-300 mt-1">Q{tarifaLocal.tarifa.toFixed(2)} / turno</div>
          </div>
        )}

        <div className="p-5 space-y-4">
          {modo === "elegir" ? (
            <>
              <p className="text-xs text-white/50">¿Cómo se pagarán las horas extra de esta cobertura?</p>

              <button
                onClick={elegirPlanilla}
                className="w-full text-left px-4 py-3 rounded-xl border border-blue-500/30 bg-blue-500/8 hover:bg-blue-500/15 transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center shrink-0">
                    <span className="text-blue-400 text-sm font-bold">P</span>
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-blue-300 group-hover:text-blue-200">En Planilla</div>
                    <div className="text-[11px] text-white/40 mt-0.5">Pasa por aprobación RRHH y se incluye en la próxima nómina</div>
                  </div>
                </div>
              </button>

              <button
                onClick={() => setModo("efectivo")}
                className="w-full text-left px-4 py-3 rounded-xl border border-emerald-500/30 bg-emerald-500/8 hover:bg-emerald-500/15 transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center shrink-0">
                    <span className="text-emerald-400 text-sm font-bold">$</span>
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-emerald-300 group-hover:text-emerald-200">En Efectivo</div>
                    <div className="text-[11px] text-white/40 mt-0.5">Pago inmediato en campo. No se repite en planilla.</div>
                  </div>
                </div>
              </button>

              <button
                onClick={onClose}
                className="w-full py-2 rounded-lg text-xs text-white/30 hover:text-white/50 transition-colors"
              >
                Decidir después
              </button>
            </>
          ) : (
            <>
              <button onClick={() => setModo("elegir")} className="text-[11px] text-white/30 hover:text-white/50 transition-colors flex items-center gap-1">
                ← Cambiar modo de pago
              </button>

              <div>
                <label className="block text-[10px] text-white/40 uppercase tracking-widest mb-1.5">Monto a pagar (Q)</label>
                <input
                  type="number"
                  min="1"
                  step="0.50"
                  value={monto}
                  onChange={(e) => setMonto(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 focus:outline-none focus:border-emerald-500/50"
                />
                <p className="text-[10px] text-white/25 mt-1">Pre-llenado con la tarifa configurada. Ajustable si aplica.</p>
              </div>

              <div>
                <label className="block text-[10px] text-white/40 uppercase tracking-widest mb-1.5">Pagado por</label>
                <input
                  type="text"
                  placeholder="Nombre de quien entrega el efectivo…"
                  value={pagadoPor}
                  onChange={(e) => setPagadoPor(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 focus:outline-none focus:border-emerald-500/50"
                />
              </div>

              <div>
                <label className="block text-[10px] text-white/40 uppercase tracking-widest mb-1.5">Observaciones (opcional)</label>
                <input
                  type="text"
                  placeholder="Nota adicional…"
                  value={observaciones}
                  onChange={(e) => setObservaciones(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 focus:outline-none focus:border-emerald-500/50"
                />
              </div>

              <div className="px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
                <p className="text-[11px] text-amber-300">Este pago se registra como efectivo y NO aparecerá en la próxima planilla. Se excluye automáticamente de nómina.</p>
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => setModo("elegir")}
                  className="flex-1 py-2 rounded-lg text-xs font-medium text-white/40 bg-white/5 border border-white/10 hover:bg-white/8 transition-all"
                >
                  Cancelar
                </button>
                <button
                  onClick={registrarEfectivo}
                  disabled={saving || !monto}
                  className="flex-1 py-2 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-40 transition-all"
                >
                  {saving ? "Registrando…" : `Pagar Q${Number(monto || 0).toFixed(2)} en Efectivo`}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

// ─── Modal: Asignar guardia a tarjeta SSA desde el Pizarrón ──────────────────

