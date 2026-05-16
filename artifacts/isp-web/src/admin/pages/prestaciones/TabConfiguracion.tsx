import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { BookOpen, Palmtree, Eye, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiGet, apiPost, apiPut, fmt, TIPO_EGRESO_LABELS } from "./helpers";
import type {
  Employee,
  ImpactoConfigResponse,
  PrestacionesConfig,
  PrestacionesConfigResponse,
  RubroLiquidacion,
  SimularLiquidacionResponse,
} from "./types";

interface PreviewSim {
  rubros: RubroLiquidacion[];
  totalGeneral: number;
  empleadoNombre: string;
}

type ImpactoConfig = ImpactoConfigResponse;

export function TabConfiguracion() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery<PrestacionesConfigResponse>({
    queryKey: ["prest-config"],
    queryFn: () => apiGet<PrestacionesConfigResponse>("/prestaciones/config"),
  });

  const cfg: PrestacionesConfig = data?.config ?? {
    aguinaldoBase: "salario_actual",
    bono14Base: "promedio_periodo",
    vacacionesDiasPrimerAnio: 15,
    vacacionesDiasQuinquenio: 20,
    vacacionesDiasElegibilidad: 150,
    indemnizacionSoloLegal: true,
    redondeoDecimales: 2,
  };

  const [form, setForm] = useState<PrestacionesConfig | null>(null);
  const current = form ?? cfg;

  // ── Vista previa: empleado y simulación ──────────────────────────────────
  const [previewEmpId, setPreviewEmpId] = useState<string>("");
  const [previewBusqueda, setPreviewBusqueda] = useState("");
  const [previewTipoEgreso, setPreviewTipoEgreso] = useState("renuncia");
  const [previewFecha, setPreviewFecha] = useState(new Date().toISOString().slice(0, 10));
  const [previewSaved, setPreviewSaved] = useState<PreviewSim | null>(null);
  const [previewLive, setPreviewLive] = useState<PreviewSim | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const { data: empleados = [] } = useQuery<Employee[]>({
    queryKey: ["employees-activos"],
    queryFn: () => apiGet<Employee[]>("/employees?estado_laboral=activo"),
    staleTime: 60_000,
  });

  const { data: impacto } = useQuery<ImpactoConfig>({
    queryKey: ["prest-config-impacto"],
    queryFn: () => apiGet<ImpactoConfig>("/prestaciones/config/impacto"),
    staleTime: 30_000,
  });

  const filtEmp = (empleados as Employee[]).filter(
    (e) => !previewBusqueda || (e.nombreCompleto ?? "").toLowerCase().includes(previewBusqueda.toLowerCase()),
  );

  const previewEmpleado = (empleados as Employee[]).find((e) => String(e.id) === previewEmpId) ?? null;

  const formChanged = form !== null;

  const baseChanged = useMemo(() => {
    if (!form) return false;
    return (
      form.aguinaldoBase !== cfg.aguinaldoBase ||
      form.bono14Base !== cfg.bono14Base ||
      form.indemnizacionSoloLegal !== cfg.indemnizacionSoloLegal ||
      form.vacacionesDiasPrimerAnio !== cfg.vacacionesDiasPrimerAnio ||
      form.vacacionesDiasQuinquenio !== cfg.vacacionesDiasQuinquenio ||
      form.vacacionesDiasElegibilidad !== cfg.vacacionesDiasElegibilidad
    );
  }, [form, cfg]);

  const saveMut = useMutation({
    mutationFn: (body: PrestacionesConfig) =>
      apiPut<PrestacionesConfigResponse>("/prestaciones/config", {
        aguinaldo_base: body.aguinaldoBase,
        bono14_base: body.bono14Base,
        vacaciones_dias_primer_anio: body.vacacionesDiasPrimerAnio,
        vacaciones_dias_quinquenio: body.vacacionesDiasQuinquenio,
        vacaciones_dias_elegibilidad: body.vacacionesDiasElegibilidad,
        indemnizacion_solo_legal: body.indemnizacionSoloLegal,
        redondeo_decimales: body.redondeoDecimales,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["prest-config"] });
      setForm(null);
      toast({ title: "Configuración guardada" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  function set<K extends keyof PrestacionesConfig>(k: K, v: PrestacionesConfig[K]) {
    setForm((prev) => ({ ...(prev ?? cfg), [k]: v }));
  }

  // Recalcular preview cuando cambia el empleado, tipo egreso, fecha o config
  useEffect(() => {
    if (!previewEmpId) {
      setPreviewSaved(null);
      setPreviewLive(null);
      setPreviewError(null);
      return;
    }
    let cancelled = false;
    const t = setTimeout(async () => {
      setPreviewLoading(true);
      setPreviewError(null);
      try {
        const baseBody = {
          employee_id: Number(previewEmpId),
          tipo_egreso: previewTipoEgreso,
          fecha_egreso: previewFecha,
        };
        const requests: Promise<SimularLiquidacionResponse>[] = [
          apiPost<SimularLiquidacionResponse>("/prestaciones/simular-liquidacion", baseBody),
        ];
        if (formChanged) {
          requests.push(
            apiPost<SimularLiquidacionResponse>("/prestaciones/simular-liquidacion", {
              ...baseBody,
              config_override: current,
            }),
          );
        }
        const results = await Promise.all(requests);
        if (cancelled) return;
        const savedRes = results[0];
        setPreviewSaved({
          rubros: savedRes.liquidacion?.rubros ?? [],
          totalGeneral: savedRes.liquidacion?.totalGeneral ?? 0,
          empleadoNombre: savedRes.nombre_completo,
        });
        if (formChanged && results[1]) {
          const liveRes = results[1];
          setPreviewLive({
            rubros: liveRes.liquidacion?.rubros ?? [],
            totalGeneral: liveRes.liquidacion?.totalGeneral ?? 0,
            empleadoNombre: liveRes.nombre_completo,
          });
        } else {
          setPreviewLive(null);
        }
      } catch (e: unknown) {
        if (!cancelled) {
          setPreviewError((e as Error).message);
          setPreviewLive(null);
          setPreviewSaved(null);
        }
      } finally {
        if (!cancelled) setPreviewLoading(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [previewEmpId, previewTipoEgreso, previewFecha, current, formChanged]);

  const inputCls = "bg-[#060e1c] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-teal-500/40 transition-colors";
  const selectCls = inputCls + " appearance-none cursor-pointer";

  if (isLoading) return <div className="text-white/40 text-sm p-6">Cargando configuración…</div>;

  // Para comparación visual: rubros relevantes del live frente al guardado
  const rubrosLive = previewLive?.rubros ?? [];
  const rubrosSaved = previewSaved?.rubros ?? [];
  const mapSaved = new Map(rubrosSaved.map((r) => [r.rubro, r.monto]));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 p-6">
      {/* ── Columna izquierda: formulario ───────────────────────────────── */}
      <div className="space-y-6">
        <div className="bg-teal-500/5 border border-teal-500/20 rounded-2xl p-5 space-y-5">
          <h3 className="text-sm font-semibold text-teal-300 flex items-center gap-2">
            <BookOpen className="w-4 h-4" /> Bases de Cálculo
          </h3>

          <div className="space-y-1.5">
            <Label className="text-xs text-white/50">Base Aguinaldo</Label>
            <select
              className={selectCls}
              value={current.aguinaldoBase}
              onChange={(e) => set("aguinaldoBase", e.target.value as PrestacionesConfig["aguinaldoBase"])}
            >
              <option value="salario_actual">Salario Actual</option>
              <option value="promedio_periodo">Promedio del Período</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-white/50">Base Bono 14</Label>
            <select
              className={selectCls}
              value={current.bono14Base}
              onChange={(e) => set("bono14Base", e.target.value as PrestacionesConfig["bono14Base"])}
            >
              <option value="promedio_periodo">Promedio del Período (Ley)</option>
              <option value="salario_actual">Salario Actual</option>
            </select>
          </div>

          <Separator className="border-white/10" />

          <h3 className="text-sm font-semibold text-teal-300 flex items-center gap-2">
            <Palmtree className="w-4 h-4" /> Vacaciones
          </h3>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-white/50">Días / Año (Primer Quinquenio)</Label>
              <Input
                type="number"
                className={inputCls}
                value={current.vacacionesDiasPrimerAnio}
                onChange={(e) => set("vacacionesDiasPrimerAnio", parseInt(e.target.value))}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-white/50">Días / Año (Quinquenio+)</Label>
              <Input
                type="number"
                className={inputCls}
                value={current.vacacionesDiasQuinquenio}
                onChange={(e) => set("vacacionesDiasQuinquenio", parseInt(e.target.value))}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-white/50">Días mínimos laborados para elegibilidad</Label>
            <Input
              type="number"
              className={inputCls}
              value={current.vacacionesDiasElegibilidad}
              onChange={(e) => set("vacacionesDiasElegibilidad", parseInt(e.target.value))}
            />
          </div>

          <Separator className="border-white/10" />

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-white/80">Indemnización solo por Ley</p>
              <p className="text-xs text-white/40 mt-0.5">Solo aplica en despido injustificado (Art. 82 CT)</p>
            </div>
            <button
              type="button"
              onClick={() => set("indemnizacionSoloLegal", !current.indemnizacionSoloLegal)}
              className={`w-12 h-6 rounded-full transition-all relative ${current.indemnizacionSoloLegal ? "bg-teal-500" : "bg-white/10"}`}
            >
              <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${current.indemnizacionSoloLegal ? "left-6" : "left-0.5"}`} />
            </button>
          </div>
        </div>

        {formChanged && baseChanged && (impacto?.liquidacionesConfirmadas ?? 0) > 0 && (
          <div className="flex items-start gap-2.5 bg-amber-500/10 border border-amber-500/30 rounded-2xl px-4 py-3">
            <AlertTriangle className="w-4 h-4 text-amber-300 shrink-0 mt-0.5" />
            <div className="text-xs">
              <p className="font-semibold text-amber-200">
                Hay {impacto?.liquidacionesConfirmadas} liquidación(es) ya pagada(s)
              </p>
              <p className="text-amber-200/70 mt-0.5">
                El cambio aplicará solo a futuras liquidaciones. Las liquidaciones ya
                confirmadas no se recalculan
                {impacto?.ultimaFecha ? ` (última: ${impacto.ultimaFecha})` : ""}.
              </p>
            </div>
          </div>
        )}

        {formChanged && (
          <div className="flex gap-3">
            <Button
              onClick={() => saveMut.mutate(current)}
              disabled={saveMut.isPending}
              className="bg-teal-600 hover:bg-teal-500 text-white rounded-xl"
            >
              {saveMut.isPending ? "Guardando…" : "Guardar Configuración"}
            </Button>
            <Button
              variant="ghost"
              onClick={() => setForm(null)}
              className="text-white/50 hover:text-white rounded-xl"
            >
              Cancelar
            </Button>
          </div>
        )}

        {!formChanged && (
          <div className="px-3 py-2 rounded-xl bg-white/3 border border-white/6 text-[10px] text-white/30">
            Configuración guardada · {data?.source === "db" ? "Personalizada" : "Valores por defecto"}
          </div>
        )}
      </div>

      {/* ── Columna derecha: vista previa ──────────────────────────────── */}
      <div className="space-y-4">
        <div className="bg-[#070f1d] border border-white/10 rounded-2xl p-5 space-y-4">
          <h3 className="text-sm font-semibold text-white/80 flex items-center gap-2">
            <Eye className="w-4 h-4 text-teal-300" /> Vista previa con un empleado
          </h3>
          <p className="text-[11px] text-white/40 -mt-2">
            Selecciona un colaborador para ver cómo cambian sus prestaciones con la
            configuración actual antes de guardarla.
          </p>

          <div className="space-y-1.5">
            <Label className="text-xs text-white/50">Buscar Empleado</Label>
            <Input
              className={inputCls}
              placeholder="Nombre del empleado…"
              value={previewBusqueda}
              onChange={(e) => setPreviewBusqueda(e.target.value)}
            />
            {previewBusqueda && !previewEmpleado && (
              <div className="max-h-36 overflow-y-auto rounded-xl border border-white/10 bg-[#060e1c]">
                {filtEmp.slice(0, 8).map((e) => (
                  <button
                    key={e.id}
                    type="button"
                    onClick={() => {
                      setPreviewEmpId(String(e.id));
                      setPreviewBusqueda(e.nombreCompleto);
                    }}
                    className={`w-full text-left px-3 py-2 text-xs hover:bg-teal-500/10 transition-colors ${
                      String(e.id) === previewEmpId ? "bg-teal-500/20 text-teal-300" : "text-white/70"
                    }`}
                  >
                    {e.nombreCompleto}
                  </button>
                ))}
                {filtEmp.length === 0 && (
                  <div className="px-3 py-2 text-xs text-white/30">Sin coincidencias</div>
                )}
              </div>
            )}
            {previewEmpleado && (
              <button
                type="button"
                onClick={() => {
                  setPreviewEmpId("");
                  setPreviewBusqueda("");
                }}
                className="text-[11px] text-white/40 hover:text-white/70 underline"
              >
                Cambiar empleado
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-white/50">Tipo Egreso</Label>
              <select
                className={selectCls}
                value={previewTipoEgreso}
                onChange={(e) => setPreviewTipoEgreso(e.target.value)}
              >
                {Object.entries(TIPO_EGRESO_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-white/50">Fecha Egreso</Label>
              <Input
                type="date"
                className={inputCls}
                value={previewFecha}
                onChange={(e) => setPreviewFecha(e.target.value)}
              />
            </div>
          </div>

          {!previewEmpId && (
            <div className="text-[11px] text-white/30 px-3 py-6 text-center bg-white/3 rounded-xl border border-dashed border-white/10">
              Elige un colaborador para ver el cálculo
            </div>
          )}

          {previewEmpId && previewError && (
            <div className="text-xs text-red-300 bg-red-500/10 border border-red-500/30 rounded-xl px-3 py-2">
              {previewError}
            </div>
          )}

          {previewEmpId && previewLoading && !previewSaved && (
            <div className="text-xs text-white/40 px-3 py-4">Calculando…</div>
          )}

          {previewEmpId && previewSaved && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[11px] text-white/40 px-1">
                <span>Rubro</span>
                {formChanged ? (
                  <span className="flex gap-6">
                    <span className="w-20 text-right">Guardado</span>
                    <span className="w-20 text-right text-teal-300">Con cambio</span>
                  </span>
                ) : (
                  <span>Monto</span>
                )}
              </div>
              {(formChanged ? rubrosLive : rubrosSaved).map((r) => {
                const savedMonto = mapSaved.get(r.rubro) ?? 0;
                const diff = formChanged ? r.monto - savedMonto : 0;
                return (
                  <div
                    key={r.rubro}
                    className="flex items-center justify-between px-3 py-2 rounded-xl bg-white/3 border border-white/6"
                  >
                    <span className="text-xs text-white/70">{r.descripcion}</span>
                    {formChanged ? (
                      <span className="flex gap-6 items-center">
                        <span className="w-20 text-right text-xs text-white/50">{fmt(savedMonto)}</span>
                        <span
                          className={`w-20 text-right text-xs font-semibold ${
                            diff > 0
                              ? "text-emerald-300"
                              : diff < 0
                                ? "text-red-300"
                                : "text-white"
                          }`}
                        >
                          {fmt(r.monto)}
                        </span>
                      </span>
                    ) : (
                      <span className="text-xs font-semibold text-white">{fmt(r.monto)}</span>
                    )}
                  </div>
                );
              })}

              <div className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-teal-500/10 border border-teal-500/20 mt-2">
                <span className="text-xs font-bold text-teal-300">TOTAL</span>
                {formChanged ? (
                  <span className="flex gap-6 items-center">
                    <span className="w-20 text-right text-xs text-white/50">
                      {fmt(previewSaved.totalGeneral)}
                    </span>
                    <span
                      className={`w-20 text-right text-sm font-bold ${
                        (previewLive?.totalGeneral ?? 0) > previewSaved.totalGeneral
                          ? "text-emerald-300"
                          : (previewLive?.totalGeneral ?? 0) < previewSaved.totalGeneral
                            ? "text-red-300"
                            : "text-teal-300"
                      }`}
                    >
                      {fmt(previewLive?.totalGeneral ?? previewSaved.totalGeneral)}
                    </span>
                  </span>
                ) : (
                  <span className="text-sm font-bold text-teal-300">{fmt(previewSaved.totalGeneral)}</span>
                )}
              </div>

              {formChanged && previewLive && (
                <p className="text-[10px] text-white/40 px-1">
                  Diferencia neta:{" "}
                  <span
                    className={
                      previewLive.totalGeneral - previewSaved.totalGeneral > 0
                        ? "text-emerald-300"
                        : previewLive.totalGeneral - previewSaved.totalGeneral < 0
                          ? "text-red-300"
                          : "text-white/60"
                    }
                  >
                    {fmt(previewLive.totalGeneral - previewSaved.totalGeneral)}
                  </span>
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
