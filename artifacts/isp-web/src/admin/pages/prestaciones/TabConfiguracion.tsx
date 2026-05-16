import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { BookOpen, Palmtree } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiGet, apiPut } from "./helpers";
import type { PrestacionesConfig } from "./types";

export function TabConfiguracion() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["prest-config"],
    queryFn: () => apiGet("/prestaciones/config"),
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

  const saveMut = useMutation({
    mutationFn: (body: PrestacionesConfig) => apiPut("/prestaciones/config", body),
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

  const inputCls = "bg-[#060e1c] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-teal-500/40 transition-colors";
  const selectCls = inputCls + " appearance-none cursor-pointer";

  if (isLoading) return <div className="text-white/40 text-sm p-6">Cargando configuración…</div>;

  return (
    <div className="max-w-xl space-y-6 p-6">
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

      {form && (
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

      {!form && (
        <div className="px-3 py-2 rounded-xl bg-white/3 border border-white/6 text-[10px] text-white/30">
          Configuración guardada · {data?.source === "db" ? "Personalizada" : "Valores por defecto"}
        </div>
      )}
    </div>
  );
}
