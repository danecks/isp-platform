import { useState, useEffect, useCallback } from "react";
import { AdminLayout } from "../layout/AdminLayout";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Landmark, Plus, ChevronLeft, AlertCircle, CheckCircle2, Clock,
  Users, Wallet, CalendarDays, Eye, Loader2, RefreshCcw, BadgeCheck,
} from "lucide-react";
import { getSessionToken } from "@/lib/httpClient";

// ─── API helpers ──────────────────────────────────────────────────────────────

function getSession() {
  return getSessionToken();
}

async function apiFetch(url: string, opts: RequestInit = {}) {
  const res = await fetch(`/api${url}`, {
    ...opts,
    headers: {
      "x-isp-session": getSession(),
      "Content-Type": "application/json",
      ...(opts.headers ?? {}),
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error ?? res.statusText);
  }
  return res.json();
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface PlanillaEspecial {
  id: number;
  tipo: "bono14" | "aguinaldo";
  anio: number;
  periodo_inicio: string;
  periodo_fin: string;
  num_pagos: number;
  estado: "borrador" | "aprobada" | "completada" | "anulada";
  total_colaboradores: number;
  total_bruto: string;
  generado_por: string;
  observaciones: string | null;
  created_at: string;
  pagos_realizados: string;
}

interface PlanillaLinea {
  id: number;
  employee_id: number | null;
  nombre_completo: string;
  puesto: string;
  sede: string;
  cliente: string;
  fecha_ingreso: string;
  fecha_egreso_emp: string | null;
  dias_periodo_total: number;
  dias_laborados: number;
  salario_referencia: string;
  monto_total: string;
  monto_ya_pagado: string;
  estado_laboral?: string;
}

interface PlanillaPago {
  id: number;
  numero_pago: number;
  porcentaje: string;
  fecha_programada: string | null;
  estado: "pendiente" | "pagado";
  total_este_pago: string;
  pagado_por: string | null;
  pagado_at: string | null;
}

interface PreviewLinea {
  employee_id: number;
  nombre_completo: string;
  puesto: string;
  sede: string;
  cliente: string;
  fecha_ingreso: string;
  fecha_egreso_emp: string | null;
  estado_laboral: string;
  dias_periodo_total: number;
  dias_laborados: number;
  salario_referencia: number;
  monto_total: number;
  fuente_dias: "odbc" | "planilla" | "calendario";
}

interface PreviewCuota {
  numero: number;
  porcentaje: number;
  monto: number;
}

interface PreviewResult {
  tipo: "bono14" | "aguinaldo";
  anio: number;
  periodo_inicio: string;
  periodo_fin: string;
  num_pagos: number;
  total_colaboradores: number;
  total_bruto: number;
  cuotas: PreviewCuota[];
  fuente_resumen: Record<string, number>;
  lineas: PreviewLinea[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = new Intl.NumberFormat("es-GT", { style: "currency", currency: "GTQ" });
const fmtNum = (v: string | number) => fmt.format(parseFloat(String(v)));
const fmtDate = (d: string | null | undefined) => {
  if (!d) return "—";
  const s = d.length <= 10 ? d + "T00:00:00Z" : d;
  const dt = new Date(s);
  return isNaN(dt.getTime()) ? "—" : dt.toLocaleDateString("es-GT");
};

const TIPO_LABEL: Record<string, string> = { bono14: "Bono 14", aguinaldo: "Aguinaldo" };
const ESTADO_COLOR: Record<string, string> = {
  borrador:   "bg-gray-500/20 text-gray-300 border-gray-500/30",
  aprobada:   "bg-blue-500/20 text-blue-300 border-blue-500/30",
  completada: "bg-green-500/20 text-green-300 border-green-500/30",
  anulada:    "bg-red-500/20 text-red-300 border-red-500/30",
};
const PAGO_COLOR: Record<string, string> = {
  pendiente: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
  pagado:    "bg-green-500/20 text-green-300 border-green-500/30",
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function PlanillasEspeciales() {
  const [planillas, setPlanillas]           = useState<PlanillaEspecial[]>([]);
  const [loading, setLoading]               = useState(true);
  const [error, setError]                   = useState<string | null>(null);
  const [selectedId, setSelectedId]         = useState<number | null>(null);
  const [detalle, setDetalle]               = useState<{
    planilla: PlanillaEspecial; lineas: PlanillaLinea[]; pagos: PlanillaPago[];
  } | null>(null);
  const [detalleLoading, setDetalleLoading] = useState(false);

  // Modal Generar
  const [showModal, setShowModal]           = useState(false);
  const [genTipo, setGenTipo]               = useState<"bono14" | "aguinaldo">("aguinaldo");
  const [genAnio, setGenAnio]               = useState(new Date().getFullYear());
  const [genNumPagos, setGenNumPagos]       = useState<1 | 2 | 3>(2);
  const [genFechas, setGenFechas]           = useState<string[]>(["", "", ""]);
  const [genObs, setGenObs]                 = useState("");
  const [preview, setPreview]               = useState<PreviewResult | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [saving, setSaving]                 = useState(false);
  const [modalError, setModalError]         = useState<string | null>(null);

  // Modal Confirmar Pago
  const [pagoModal, setPagoModal]           = useState<PlanillaPago | null>(null);
  const [pagoObs, setPagoObs]               = useState("");
  const [pagoSaving, setPagoSaving]         = useState(false);

  // Modal Aprobar
  const [aprobandoId, setAprobandoId]       = useState<number | null>(null);

  const loadPlanillas = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await apiFetch("/nomina/planillas-especiales");
      setPlanillas(data.planillas ?? []);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadPlanillas(); }, [loadPlanillas]);

  const loadDetalle = useCallback(async (id: number) => {
    setDetalleLoading(true);
    try {
      const data = await apiFetch(`/nomina/planillas-especiales/${id}`);
      setDetalle(data);
    } catch (e) {
      setError(String(e));
    } finally {
      setDetalleLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedId != null) loadDetalle(selectedId);
    else setDetalle(null);
  }, [selectedId, loadDetalle]);

  // ─── Preview ──────────────────────────────────────────────────────────────
  async function handlePreview() {
    setPreviewLoading(true);
    setModalError(null);
    try {
      const data = await apiFetch("/nomina/planillas-especiales/preview", {
        method: "POST",
        body: JSON.stringify({ tipo: genTipo, anio: genAnio, num_pagos: genNumPagos }),
      });
      setPreview(data);
    } catch (e) {
      setModalError(String(e));
    } finally {
      setPreviewLoading(false);
    }
  }

  // ─── Generar (save) ───────────────────────────────────────────────────────
  async function handleGenerar() {
    setSaving(true);
    setModalError(null);
    try {
      const fechasFilled = genFechas.slice(0, genNumPagos).map((f) => f || null);
      const { id } = await apiFetch("/nomina/planillas-especiales", {
        method: "POST",
        body: JSON.stringify({
          tipo: genTipo, anio: genAnio, num_pagos: genNumPagos,
          fechas_programadas: fechasFilled,
          observaciones: genObs || null,
        }),
      });
      setShowModal(false);
      setPreview(null);
      await loadPlanillas();
      setSelectedId(id);
    } catch (e) {
      setModalError(String(e));
    } finally {
      setSaving(false);
    }
  }

  // ─── Aprobar ──────────────────────────────────────────────────────────────
  async function handleAprobar(id: number) {
    setAprobandoId(id);
    try {
      await apiFetch(`/nomina/planillas-especiales/${id}/estado`, {
        method: "PATCH",
        body: JSON.stringify({ estado: "aprobada" }),
      });
      await loadPlanillas();
      if (selectedId === id) loadDetalle(id);
    } catch (e) {
      setError(String(e));
    } finally {
      setAprobandoId(null);
    }
  }

  // ─── Registrar Pago ───────────────────────────────────────────────────────
  async function handleRegistrarPago() {
    if (!pagoModal) return;
    setPagoSaving(true);
    try {
      await apiFetch(`/nomina/planillas-especiales/pagos/${pagoModal.id}/pagar`, {
        method: "PATCH",
        body: JSON.stringify({ observaciones: pagoObs || null }),
      });
      setPagoModal(null);
      setPagoObs("");
      await loadPlanillas();
      if (selectedId) loadDetalle(selectedId);
    } catch (e) {
      setError(String(e));
    } finally {
      setPagoSaving(false);
    }
  }

  // ─── Anular ───────────────────────────────────────────────────────────────
  async function handleAnular(id: number) {
    if (!confirm("¿Anular esta planilla especial? Esta acción no se puede deshacer.")) return;
    try {
      await apiFetch(`/nomina/planillas-especiales/${id}`, { method: "DELETE" });
      setSelectedId(null);
      loadPlanillas();
    } catch (e) {
      setError(String(e));
    }
  }

  // ─── Reset modal ──────────────────────────────────────────────────────────
  function openModal() {
    setGenTipo("aguinaldo");
    setGenAnio(new Date().getFullYear());
    setGenNumPagos(2);
    setGenFechas(["", "", ""]);
    setGenObs("");
    setPreview(null);
    setModalError(null);
    setShowModal(true);
  }

  // ─── RENDER: Lista ────────────────────────────────────────────────────────
  if (selectedId == null) {
    return (
      <AdminLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Landmark className="w-6 h-6 text-yellow-400" />
            <div>
              <h1 className="text-xl font-bold text-white">Planillas Especiales</h1>
              <p className="text-sm text-gray-400">Bono 14 y Aguinaldo — pagos fraccionados</p>
            </div>
          </div>
          <Button
            onClick={openModal}
            className="bg-yellow-500 hover:bg-yellow-600 text-black font-semibold gap-2"
          >
            <Plus className="w-4 h-4" /> Generar Planilla
          </Button>
        </div>

        {error && (
          <div className="flex items-center gap-2 text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span className="text-sm">{error}</span>
          </div>
        )}

        {/* Tabla */}
        <div className="rounded-xl border border-white/10 bg-[#0f1623] overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-20 gap-3 text-gray-400">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Cargando planillas...</span>
            </div>
          ) : planillas.length === 0 ? (
            <div className="py-20 text-center text-gray-500">
              <Landmark className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No hay planillas especiales generadas</p>
              <p className="text-xs text-gray-600 mt-1">
                Generá la primera planilla de Bono 14 o Aguinaldo
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-white/10 hover:bg-transparent">
                  <TableHead className="text-gray-400">Tipo</TableHead>
                  <TableHead className="text-gray-400">Año</TableHead>
                  <TableHead className="text-gray-400">Período</TableHead>
                  <TableHead className="text-gray-400 text-right">Colaboradores</TableHead>
                  <TableHead className="text-gray-400 text-right">Total Bruto</TableHead>
                  <TableHead className="text-gray-400 text-center">Pagos</TableHead>
                  <TableHead className="text-gray-400">Estado</TableHead>
                  <TableHead className="text-gray-400">Generado por</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {planillas.map((p) => (
                  <TableRow key={p.id} className="border-white/5 hover:bg-white/5">
                    <TableCell>
                      <span className="font-semibold text-yellow-300">
                        {TIPO_LABEL[p.tipo]}
                      </span>
                    </TableCell>
                    <TableCell className="text-white font-mono">{p.anio}</TableCell>
                    <TableCell className="text-gray-400 text-sm">
                      {fmtDate(p.periodo_inicio)} – {fmtDate(p.periodo_fin)}
                    </TableCell>
                    <TableCell className="text-right text-white">
                      {p.total_colaboradores}
                    </TableCell>
                    <TableCell className="text-right text-white font-semibold">
                      {fmtNum(p.total_bruto)}
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="text-gray-300 text-sm">
                        {p.pagos_realizados}/{p.num_pagos}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={`text-xs border ${ESTADO_COLOR[p.estado] ?? ""}`}
                        variant="outline"
                      >
                        {p.estado}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-gray-400 text-sm">{p.generado_por}</TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-yellow-400 hover:text-yellow-300 gap-1"
                        onClick={() => setSelectedId(p.id)}
                      >
                        <Eye className="w-3.5 h-3.5" /> Ver
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>

        {/* Modal Generar */}
        <Dialog open={showModal} onOpenChange={setShowModal}>
          <DialogContent className="bg-[#0f1623] border border-white/10 text-white max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-yellow-400 flex items-center gap-2">
                <Landmark className="w-5 h-5" />
                Generar Planilla Especial
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-6 py-2">
              {/* Config */}
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

              {/* Fechas programadas */}
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

              {/* Preview resultado */}
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

                  {/* Cuotas */}
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

                  {/* Resumen de fuentes de días */}
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

                  {/* Tabla de empleados */}
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
              <Button variant="ghost" className="text-gray-400" onClick={() => setShowModal(false)}>
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
      </div>
      </AdminLayout>
    );
  }

  // ─── RENDER: Detalle ──────────────────────────────────────────────────────
  return (
    <AdminLayout>
    <div className="p-6 space-y-6">
      {/* Nav */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          className="text-gray-400 hover:text-white gap-2"
          onClick={() => setSelectedId(null)}
        >
          <ChevronLeft className="w-4 h-4" /> Volver
        </Button>
      </div>

      {detalleLoading || !detalle ? (
        <div className="flex items-center justify-center py-20 gap-3 text-gray-400">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span>Cargando detalle...</span>
        </div>
      ) : (
        <>
          {/* Header planilla */}
          <div className="bg-[#0f1623] border border-white/10 rounded-xl p-6">
            <div className="flex items-start justify-between flex-wrap gap-4">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <Landmark className="w-6 h-6 text-yellow-400" />
                  <h1 className="text-xl font-bold text-white">
                    {TIPO_LABEL[detalle.planilla.tipo]} {detalle.planilla.anio}
                  </h1>
                  <Badge
                    className={`text-xs border ${ESTADO_COLOR[detalle.planilla.estado] ?? ""}`}
                    variant="outline"
                  >
                    {detalle.planilla.estado}
                  </Badge>
                </div>
                <p className="text-gray-400 text-sm">
                  Período: {fmtDate(detalle.planilla.periodo_inicio)} – {fmtDate(detalle.planilla.periodo_fin)}
                </p>
                {detalle.planilla.observaciones && (
                  <p className="text-gray-500 text-sm mt-1">{detalle.planilla.observaciones}</p>
                )}
              </div>

              <div className="flex items-center gap-3">
                {detalle.planilla.estado === "borrador" && (
                  <Button
                    onClick={() => handleAprobar(detalle.planilla.id)}
                    disabled={aprobandoId === detalle.planilla.id}
                    className="bg-blue-600 hover:bg-blue-700 gap-2"
                  >
                    {aprobandoId === detalle.planilla.id
                      ? <Loader2 className="w-4 h-4 animate-spin" />
                      : <BadgeCheck className="w-4 h-4" />}
                    Aprobar Planilla
                  </Button>
                )}
                {["borrador", "aprobada"].includes(detalle.planilla.estado) && (
                  <Button
                    variant="ghost"
                    className="text-red-400 hover:text-red-300"
                    onClick={() => handleAnular(detalle.planilla.id)}
                  >
                    Anular
                  </Button>
                )}
              </div>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-3 gap-4 mt-5">
              <div className="bg-white/5 rounded-lg p-4">
                <div className="flex items-center gap-2 text-gray-400 text-sm mb-1">
                  <Users className="w-4 h-4" /> Colaboradores
                </div>
                <p className="text-2xl font-bold text-white">
                  {detalle.planilla.total_colaboradores}
                </p>
              </div>
              <div className="bg-white/5 rounded-lg p-4">
                <div className="flex items-center gap-2 text-gray-400 text-sm mb-1">
                  <Wallet className="w-4 h-4" /> Total Bruto
                </div>
                <p className="text-2xl font-bold text-yellow-300">
                  {fmtNum(detalle.planilla.total_bruto)}
                </p>
              </div>
              <div className="bg-white/5 rounded-lg p-4">
                <div className="flex items-center gap-2 text-gray-400 text-sm mb-1">
                  <CalendarDays className="w-4 h-4" /> Cuotas
                </div>
                <p className="text-2xl font-bold text-white">
                  {detalle.pagos.filter((p) => p.estado === "pagado").length}
                  <span className="text-gray-500 text-lg">/{detalle.planilla.num_pagos}</span>
                </p>
              </div>
            </div>
          </div>

          {/* Pagos / Cuotas */}
          <div className="bg-[#0f1623] border border-white/10 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-white/10">
              <h2 className="text-white font-semibold">Cuotas de Pago</h2>
            </div>
            <Table>
              <TableHeader>
                <TableRow className="border-white/10 hover:bg-transparent">
                  <TableHead className="text-gray-400">Cuota</TableHead>
                  <TableHead className="text-gray-400 text-right">Porcentaje</TableHead>
                  <TableHead className="text-gray-400 text-right">Monto</TableHead>
                  <TableHead className="text-gray-400">Fecha Programada</TableHead>
                  <TableHead className="text-gray-400">Estado</TableHead>
                  <TableHead className="text-gray-400">Pagado por</TableHead>
                  <TableHead className="text-gray-400">Fecha Pago</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {detalle.pagos.map((p) => (
                  <TableRow key={p.id} className="border-white/5 hover:bg-white/5">
                    <TableCell className="text-white font-semibold">
                      Pago {p.numero_pago}
                    </TableCell>
                    <TableCell className="text-right text-gray-300">
                      {parseFloat(p.porcentaje).toFixed(1)}%
                    </TableCell>
                    <TableCell className="text-right text-yellow-300 font-semibold">
                      {fmtNum(p.total_este_pago)}
                    </TableCell>
                    <TableCell className="text-gray-400">
                      {fmtDate(p.fecha_programada)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={`text-xs border ${PAGO_COLOR[p.estado] ?? ""}`}
                        variant="outline"
                      >
                        {p.estado === "pagado"
                          ? <><CheckCircle2 className="w-3 h-3 inline mr-1" />Pagado</>
                          : <><Clock className="w-3 h-3 inline mr-1" />Pendiente</>}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-gray-400 text-sm">{p.pagado_por ?? "—"}</TableCell>
                    <TableCell className="text-gray-400 text-sm">
                      {p.pagado_at ? new Date(p.pagado_at).toLocaleDateString("es-GT") : "—"}
                    </TableCell>
                    <TableCell>
                      {p.estado === "pendiente" &&
                        ["borrador", "aprobada"].includes(detalle.planilla.estado) && (
                          <Button
                            size="sm"
                            onClick={() => { setPagoModal(p); setPagoObs(""); }}
                            className="bg-green-600 hover:bg-green-700 text-white text-xs gap-1"
                          >
                            <CheckCircle2 className="w-3 h-3" /> Registrar Pago
                          </Button>
                        )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Tabla de colaboradores */}
          <div className="bg-[#0f1623] border border-white/10 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
              <h2 className="text-white font-semibold">
                Detalle por Colaborador
              </h2>
              <span className="text-gray-400 text-sm">{detalle.lineas.length} registros</span>
            </div>

            {/* Saldo de cada cuota por empleado */}
            {detalle.pagos.length > 1 && (
              <div className="px-5 py-3 bg-blue-500/5 border-b border-white/10">
                <p className="text-xs text-blue-400">
                  Los montos de cada cuota se calculan como porcentaje del monto total.
                  El saldo restante se aplica en la última cuota para corregir redondeos.
                </p>
              </div>
            )}

            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-white/10 hover:bg-transparent">
                    <TableHead className="text-gray-400">Colaborador</TableHead>
                    <TableHead className="text-gray-400">Sede / Cliente</TableHead>
                    <TableHead className="text-gray-400 text-center">Días Laborados</TableHead>
                    <TableHead className="text-gray-400 text-right">Salario Ref.</TableHead>
                    <TableHead className="text-gray-400 text-right">Monto Total</TableHead>
                    {detalle.pagos.map((pg) => (
                      <TableHead key={pg.id} className="text-gray-400 text-right text-xs">
                        Pago {pg.numero_pago}
                        <br />
                        <span className="text-gray-600">
                          ({parseFloat(pg.porcentaje).toFixed(0)}%)
                        </span>
                      </TableHead>
                    ))}
                    <TableHead className="text-gray-400 text-right">Ya Pagado</TableHead>
                    <TableHead className="text-gray-400 text-right">Saldo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detalle.lineas.map((l) => {
                    const total    = parseFloat(l.monto_total);
                    const yaPagado = parseFloat(l.monto_ya_pagado);
                    const saldo    = Math.max(0, total - yaPagado);
                    return (
                      <TableRow key={l.id} className="border-white/5 hover:bg-white/5">
                        <TableCell>
                          <div className="text-white text-sm">{l.nombre_completo}</div>
                          {l.fecha_egreso_emp && (
                            <div className="text-xs text-yellow-500">
                              Baja: {fmtDate(l.fecha_egreso_emp)}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-gray-400 text-sm">
                          {l.sede || "—"}
                          {l.cliente && <div className="text-xs text-gray-600">{l.cliente}</div>}
                        </TableCell>
                        <TableCell className="text-center text-gray-300 text-sm">
                          {l.dias_laborados}
                          <span className="text-gray-600">/{l.dias_periodo_total}</span>
                        </TableCell>
                        <TableCell className="text-right text-gray-300 text-sm">
                          {fmtNum(l.salario_referencia)}
                        </TableCell>
                        <TableCell className="text-right text-white font-semibold">
                          {fmtNum(l.monto_total)}
                        </TableCell>
                        {detalle.pagos.map((pg) => {
                          const montoEsta = Math.round(total * (parseFloat(pg.porcentaje) / 100) * 100) / 100;
                          return (
                            <TableCell key={pg.id} className="text-right text-sm">
                              <span className={pg.estado === "pagado" ? "text-green-400" : "text-gray-400"}>
                                {fmtNum(montoEsta)}
                              </span>
                            </TableCell>
                          );
                        })}
                        <TableCell className="text-right text-sm">
                          {yaPagado > 0
                            ? <span className="text-green-400">{fmtNum(yaPagado)}</span>
                            : <span className="text-gray-600">—</span>}
                        </TableCell>
                        <TableCell className="text-right font-semibold text-sm">
                          {saldo > 0
                            ? <span className="text-yellow-300">{fmtNum(saldo)}</span>
                            : <span className="text-green-500">Completo</span>}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
        </>
      )}

      {/* Modal Registrar Pago */}
      <Dialog open={!!pagoModal} onOpenChange={(o) => { if (!o) setPagoModal(null); }}>
        <DialogContent className="bg-[#0f1623] border border-white/10 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-green-400 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5" />
              Registrar Pago {pagoModal?.numero_pago}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {pagoModal && (
              <div className="bg-white/5 rounded-lg p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Cuota</span>
                  <span className="text-white">Pago {pagoModal.numero_pago} ({parseFloat(pagoModal.porcentaje).toFixed(1)}%)</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Monto a pagar</span>
                  <span className="text-yellow-300 font-bold text-lg">{fmtNum(pagoModal.total_este_pago)}</span>
                </div>
                {pagoModal.fecha_programada && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Fecha programada</span>
                    <span className="text-white">{fmtDate(pagoModal.fecha_programada)}</span>
                  </div>
                )}
              </div>
            )}
            <div>
              <Label className="text-gray-300 mb-2 block">Observaciones (opcional)</Label>
              <Textarea
                value={pagoObs}
                onChange={(e) => setPagoObs(e.target.value)}
                placeholder="Ej. Pago realizado por transferencia bancaria..."
                className="bg-white/5 border-white/10 text-white resize-none"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" className="text-gray-400" onClick={() => setPagoModal(null)}>
              Cancelar
            </Button>
            <Button
              onClick={handleRegistrarPago}
              disabled={pagoSaving}
              className="bg-green-600 hover:bg-green-700 gap-2"
            >
              {pagoSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              Confirmar Pago
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </AdminLayout>
  );
}
