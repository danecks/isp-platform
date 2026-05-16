import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Landmark, Plus, AlertCircle, Eye, Loader2, RefreshCcw,
} from "lucide-react";
import { apiRequest, fmtDate, fmtNum } from "./helpers";
import type { PreviewResult } from "./types";

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: (id: number) => void;
}

export function GenerarPlanillaEspecialModal({ open, onClose, onSuccess }: Props) {
  const [genTipo, setGenTipo] = useState<"bono14" | "aguinaldo">("aguinaldo");
  const [genAnio, setGenAnio] = useState(new Date().getFullYear());
  const [genNumPagos, setGenNumPagos] = useState<1 | 2 | 3>(2);
  const [genFechas, setGenFechas] = useState<string[]>(["", "", ""]);
  const [genObs, setGenObs] = useState("");
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  function reset() {
    setGenTipo("aguinaldo");
    setGenAnio(new Date().getFullYear());
    setGenNumPagos(2);
    setGenFechas(["", "", ""]);
    setGenObs("");
    setPreview(null);
    setModalError(null);
  }

  function handleOpenChange(o: boolean) {
    if (!o) {
      reset();
      onClose();
    }
  }

  async function handlePreview() {
    setPreviewLoading(true);
    setModalError(null);
    try {
      const data = await apiRequest<PreviewResult>("/nomina/planillas-especiales/preview", {
        method: "POST",
        json: { tipo: genTipo, anio: genAnio, num_pagos: genNumPagos },
      });
      setPreview(data);
    } catch (e) {
      setModalError(String(e));
    } finally {
      setPreviewLoading(false);
    }
  }

  async function handleGenerar() {
    setSaving(true);
    setModalError(null);
    try {
      const fechasFilled = genFechas.slice(0, genNumPagos).map((f) => f || null);
      const { id } = await apiRequest<{ id: number }>("/nomina/planillas-especiales", {
        method: "POST",
        json: {
          tipo: genTipo, anio: genAnio, num_pagos: genNumPagos,
          fechas_programadas: fechasFilled,
          observaciones: genObs || null,
        },
      });
      reset();
      onSuccess(id);
    } catch (e) {
      setModalError(String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="bg-[#0f1623] border border-white/10 text-white max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-yellow-400 flex items-center gap-2">
            <Landmark className="w-5 h-5" />
            Generar Planilla Especial
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-2">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-gray-300 mb-2 block">Tipo de Planilla</Label>
              <Select
                value={genTipo}
                onValueChange={(v) => { setGenTipo(v as "bono14" | "aguinaldo"); setPreview(null); }}
              >
                <SelectTrigger className="bg-white/5 border-white/10 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#0f1623] border-white/10">
                  <SelectItem value="aguinaldo" className="text-white hover:bg-white/10">
                    Aguinaldo (Dic 1 – Nov 30)
                  </SelectItem>
                  <SelectItem value="bono14" className="text-white hover:bg-white/10">
                    Bono 14 (Jul 1 – Jun 30)
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-gray-300 mb-2 block">Año de Pago</Label>
              <Input
                type="number"
                value={genAnio}
                min={2020}
                max={2100}
                onChange={(e) => { setGenAnio(parseInt(e.target.value)); setPreview(null); }}
                className="bg-white/5 border-white/10 text-white"
              />
            </div>

            <div>
              <Label className="text-gray-300 mb-2 block">Número de Cuotas</Label>
              <Select
                value={String(genNumPagos)}
                onValueChange={(v) => { setGenNumPagos(parseInt(v) as 1 | 2 | 3); setPreview(null); }}
              >
                <SelectTrigger className="bg-white/5 border-white/10 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#0f1623] border-white/10">
                  <SelectItem value="1" className="text-white hover:bg-white/10">1 pago único</SelectItem>
                  <SelectItem value="2" className="text-white hover:bg-white/10">2 cuotas (50% / 50%)</SelectItem>
                  <SelectItem value="3" className="text-white hover:bg-white/10">3 cuotas (~33% cada una)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-gray-300 mb-2 block">Observaciones (opcional)</Label>
              <Input
                value={genObs}
                onChange={(e) => setGenObs(e.target.value)}
                placeholder="Ej. Aguinaldo primera parte..."
                className="bg-white/5 border-white/10 text-white placeholder:text-gray-600"
              />
            </div>
          </div>

          <div className="space-y-3">
            <Label className="text-gray-300 block">Fechas Programadas de Pago (opcionales)</Label>
            <div className="grid grid-cols-3 gap-3">
              {Array.from({ length: genNumPagos }).map((_, i) => (
                <div key={i}>
                  <Label className="text-gray-500 text-xs mb-1 block">
                    Cuota {i + 1}
                    {genTipo === "aguinaldo" && i === 0 && genNumPagos === 2 && " (15 dic)"}
                    {genTipo === "aguinaldo" && i === 1 && genNumPagos === 2 && " (15 ene)"}
                  </Label>
                  <Input
                    type="date"
                    value={genFechas[i]}
                    onChange={(e) => {
                      const f = [...genFechas];
                      f[i] = e.target.value;
                      setGenFechas(f);
                    }}
                    className="bg-white/5 border-white/10 text-white"
                  />
                </div>
              ))}
            </div>
          </div>

          {preview && (
            <div className="space-y-4">
              <Separator className="bg-white/10" />
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-white/5 rounded-lg p-3">
                  <p className="text-xs text-gray-400">Período</p>
                  <p className="text-sm text-white font-semibold mt-1">
                    {fmtDate(preview.periodo_inicio)} – {fmtDate(preview.periodo_fin)}
                  </p>
                </div>
                <div className="bg-white/5 rounded-lg p-3">
                  <p className="text-xs text-gray-400">Colaboradores</p>
                  <p className="text-xl text-white font-bold mt-1">{preview.total_colaboradores}</p>
                </div>
                <div className="bg-white/5 rounded-lg p-3">
                  <p className="text-xs text-gray-400">Total Bruto</p>
                  <p className="text-xl text-yellow-300 font-bold mt-1">
                    {fmtNum(preview.total_bruto)}
                  </p>
                </div>
              </div>

              <div className="flex gap-2 flex-wrap">
                {preview.cuotas.map((c) => (
                  <div
                    key={c.numero}
                    className="bg-blue-500/10 border border-blue-500/20 rounded-lg px-4 py-2 text-center"
                  >
                    <p className="text-xs text-blue-400">Cuota {c.numero} ({c.porcentaje}%)</p>
                    <p className="text-white font-semibold">{fmtNum(c.monto)}</p>
                  </div>
                ))}
              </div>

              {preview.fuente_resumen && (
                <div className="flex gap-2 flex-wrap">
                  {preview.fuente_resumen.odbc != null && (
                    <div className="flex items-center gap-1.5 bg-teal-500/10 border border-teal-500/20 rounded-lg px-3 py-1.5">
                      <span className="w-2 h-2 rounded-full bg-teal-400 shrink-0" />
                      <span className="text-xs text-teal-300">
                        <span className="font-semibold">{preview.fuente_resumen.odbc}</span> colaboradores — días reales (ODBC)
                      </span>
                    </div>
                  )}
                  {preview.fuente_resumen.planilla != null && (
                    <div className="flex items-center gap-1.5 bg-blue-500/10 border border-blue-500/20 rounded-lg px-3 py-1.5">
                      <span className="w-2 h-2 rounded-full bg-blue-400 shrink-0" />
                      <span className="text-xs text-blue-300">
                        <span className="font-semibold">{preview.fuente_resumen.planilla}</span> colaboradores — días reales (Sistema ISP)
                      </span>
                    </div>
                  )}
                  {preview.fuente_resumen.calendario != null && (
                    <div className="flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-1.5">
                      <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
                      <span className="text-xs text-amber-300">
                        <span className="font-semibold">{preview.fuente_resumen.calendario}</span> colaboradores — estimado por calendario
                      </span>
                    </div>
                  )}
                </div>
              )}

              <div className="max-h-60 overflow-y-auto rounded-lg border border-white/10">
                <Table>
                  <TableHeader>
                    <TableRow className="border-white/10 hover:bg-transparent">
                      <TableHead className="text-gray-400 text-xs">Colaborador</TableHead>
                      <TableHead className="text-gray-400 text-xs">Sede</TableHead>
                      <TableHead className="text-gray-400 text-xs text-right">Días</TableHead>
                      <TableHead className="text-gray-400 text-xs text-right">Salario Ref.</TableHead>
                      <TableHead className="text-gray-400 text-xs text-right">Monto</TableHead>
                      <TableHead className="text-gray-400 text-xs text-center">Fuente</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.lineas.map((l) => (
                      <TableRow key={l.employee_id} className="border-white/5 hover:bg-white/5">
                        <TableCell className="text-white text-xs">
                          <div>{l.nombre_completo}</div>
                          {l.fecha_egreso_emp && (
                            <div className="text-yellow-500 text-xs">Baja: {fmtDate(l.fecha_egreso_emp)}</div>
                          )}
                        </TableCell>
                        <TableCell className="text-gray-400 text-xs">{l.sede || "—"}</TableCell>
                        <TableCell className="text-right text-gray-300 text-xs">
                          {l.dias_laborados}/{l.dias_periodo_total}
                        </TableCell>
                        <TableCell className="text-right text-gray-300 text-xs">
                          {fmtNum(l.salario_referencia)}
                        </TableCell>
                        <TableCell className="text-right text-yellow-300 text-xs font-semibold">
                          {fmtNum(l.monto_total)}
                        </TableCell>
                        <TableCell className="text-center">
                          <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                            l.fuente_dias === "odbc"      ? "bg-teal-500/20 text-teal-300" :
                            l.fuente_dias === "planilla"  ? "bg-blue-500/20 text-blue-300" :
                                                            "bg-amber-500/20 text-amber-300"
                          }`}>
                            {l.fuente_dias === "odbc" ? "ODBC" : l.fuente_dias === "planilla" ? "ISP" : "Cal."}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          {modalError && (
            <div className="flex items-center gap-2 text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span className="text-sm">{modalError}</span>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 flex-wrap">
          <Button variant="ghost" className="text-gray-400" onClick={() => handleOpenChange(false)}>
            Cancelar
          </Button>
          {!preview ? (
            <Button
              onClick={handlePreview}
              disabled={previewLoading}
              className="bg-blue-600 hover:bg-blue-700 gap-2"
            >
              {previewLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}
              Previsualizar
            </Button>
          ) : (
            <>
              <Button
                variant="ghost"
                className="text-gray-400"
                onClick={() => { setPreview(null); setModalError(null); }}
              >
                <RefreshCcw className="w-4 h-4 mr-1" /> Recalcular
              </Button>
              <Button
                onClick={handleGenerar}
                disabled={saving}
                className="bg-yellow-500 hover:bg-yellow-600 text-black font-semibold gap-2"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Generar Planilla
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
