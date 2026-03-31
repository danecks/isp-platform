/**
 * Planilla.tsx — Planilla Final de Nómina
 *
 * Vista multi-hoja similar a Excel para revisar, aprobar y exportar
 * la planilla generada desde el snapshot de un período cerrado.
 *
 * FLUJO:
 *   Pre-Planilla cerrada → Generar planilla (BORRADOR) → Revisada → Aprobada → Pagada
 *
 * LIMITACIONES ACTUALES:
 *   - No incluye IGSS ni séptimo
 *   - No incluye bonificación incentivo automática
 *   - No se edita directamente: para corregir, se regresa a pre-planilla
 */

import { useState, useEffect, useCallback } from "react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  FileSpreadsheet, Download, Plus, ChevronLeft, AlertCircle,
  CheckCircle2, Clock, ArrowRight, Wallet, Users,
  CalendarDays, TrendingUp, Info, Lock, Undo2, Link,
} from "lucide-react";

// ─── API helpers ──────────────────────────────────────────────────────────────

const API = "http://localhost:8080/api";

function getSession() {
  return sessionStorage.getItem("isp_admin_session_v2") || "";
}

async function apiFetch(url: string, opts: RequestInit = {}) {
  const res = await fetch(`${API}${url}`, {
    ...opts,
    headers: { "x-isp-session": getSession(), "Content-Type": "application/json", ...(opts.headers ?? {}) },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error ?? res.statusText);
  }
  return res.json();
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface PlanillaResumen {
  id: number;
  periodo_desde: string;
  periodo_hasta: string;
  estado: string;
  generado_por: string;
  fecha_generacion: string;
  total_colaboradores: number;
  total_bruto: string;
  total_anticipos: string;
  total_neto: string;
  total_sueldo_periodo: string;
  total_desc_faltas: string;
  total_valor_he: string;
  cerrado_por: string;
  cerrado_at: string;
}

interface PlanillaLinea {
  id: number;
  employee_id: number | null;
  nombre_completo: string;
  dpi: string | null;
  puesto: string | null;
  sede: string | null;
  cliente: string | null;
  tipo_jornada: string | null;
  horas_contrato: number | null;
  sueldo_base: string;
  periodo_dias: number;
  dias_trabajados: number;
  faltas: number;
  suspensiones: number;
  horas_trabajadas: string;
  horas_extra: string;
  sueldo_periodo: string;
  desc_faltas: string;
  valor_he: string;
  total_bruto: string;
  anticipos: string;
  total_neto: string;
  igss_trabajador: string | null;
  igss_patronal: string | null;
  otros_descuentos: string | null;
  otros_descuentos_detalle: string | null;
  anticipo_ids: number[] | null;
  novedad_ids: number[] | null;
  segmento_ids: number[] | null;
  aplica_igss: boolean;
  motivo_exclusion_igss: string | null;
  revision_estado: string | null;
  observaciones_rrhh: string | null;
}

interface PlanillaDetalle extends PlanillaResumen {
  lineas: PlanillaLinea[];
}

// ─── Estado badge ─────────────────────────────────────────────────────────────

const ESTADO_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  borrador:  { label: "Borrador",  color: "bg-zinc-700 text-zinc-100", icon: <Clock className="h-3 w-3" /> },
  revisada:  { label: "Revisada",  color: "bg-blue-800 text-blue-100", icon: <CheckCircle2 className="h-3 w-3" /> },
  aprobada:  { label: "Aprobada",  color: "bg-amber-700 text-amber-100", icon: <CheckCircle2 className="h-3 w-3" /> },
  pagada:    { label: "Pagada",    color: "bg-green-800 text-green-100", icon: <Wallet className="h-3 w-3" /> },
};

function EstadoBadge({ estado }: { estado: string }) {
  const cfg = ESTADO_CONFIG[estado] ?? { label: estado, color: "bg-zinc-700", icon: null };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${cfg.color}`}>
      {cfg.icon}{cfg.label}
    </span>
  );
}

// ─── Número formateado ────────────────────────────────────────────────────────

function fmtQ(v: string | number | null | undefined) {
  const n = parseFloat(String(v ?? 0));
  return `Q ${n.toLocaleString("es-GT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtFecha(s: string | null | undefined) {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("es-GT", { year: "numeric", month: "short", day: "numeric" });
}

// ─── Modal: Generar Planilla ──────────────────────────────────────────────────

function GenerarPlanillaModal({
  open, onClose, onSuccess, sesionUsuario,
}: { open: boolean; onClose: () => void; onSuccess: (id: number) => void; sesionUsuario: string }) {
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [obs, setObs] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerar() {
    if (!desde || !hasta) { setError("Debe ingresar el período completo."); return; }
    if (desde >= hasta)   { setError("La fecha de inicio debe ser anterior al fin."); return; }
    setError(null);
    setLoading(true);
    try {
      const res = await apiFetch("/nomina/planilla", {
        method: "POST",
        body: JSON.stringify({ desde, hasta, generadoPor: sesionUsuario, observaciones: obs || null }),
      });
      onSuccess(res.id);
      onClose();
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-[#0d1b2a] border-[#1e3a5f] text-white max-w-md">
        <DialogHeader>
          <DialogTitle className="text-amber-400">Generar Planilla Final</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="bg-blue-950 border border-blue-800 rounded p-3 text-sm text-blue-200 flex gap-2">
            <Info className="h-4 w-4 mt-0.5 shrink-0" />
            <div>
              La planilla se genera a partir del snapshot del período cerrado en Pre-Planilla.
              Solo puede existir <strong>una planilla por período</strong>.
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-[#8bacc8] mb-1 block">Período desde *</Label>
              <Input type="date" value={desde} onChange={e => setDesde(e.target.value)}
                className="bg-[#0a1628] border-[#1e3a5f] text-white" />
            </div>
            <div>
              <Label className="text-xs text-[#8bacc8] mb-1 block">Período hasta *</Label>
              <Input type="date" value={hasta} onChange={e => setHasta(e.target.value)}
                className="bg-[#0a1628] border-[#1e3a5f] text-white" />
            </div>
          </div>

          <div>
            <Label className="text-xs text-[#8bacc8] mb-1 block">Observaciones (opcional)</Label>
            <Textarea value={obs} onChange={e => setObs(e.target.value)} rows={2}
              placeholder="Ej. Período quincenal enero 2025"
              className="bg-[#0a1628] border-[#1e3a5f] text-white resize-none" />
          </div>

          {error && (
            <div className="bg-red-900/40 border border-red-700 rounded p-3 text-sm text-red-200 flex gap-2">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              {error}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={onClose} className="text-[#8bacc8]">Cancelar</Button>
          <Button onClick={handleGenerar} disabled={loading}
            className="bg-amber-600 hover:bg-amber-500 text-white">
            {loading ? "Generando…" : "Generar planilla"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Modal: Cambiar Estado ────────────────────────────────────────────────────

const SIGUIENTE_ESTADO: Record<string, string> = {
  borrador: "revisada",
  revisada: "aprobada",
  aprobada: "pagada",
};

const ACCION_LABEL: Record<string, string> = {
  revisada: "Marcar como Revisada",
  aprobada: "Aprobar Planilla",
  pagada:   "Marcar como Pagada",
};

function CambiarEstadoModal({
  open, planilla, onClose, onSuccess, sesionUsuario,
}: {
  open: boolean;
  planilla: PlanillaDetalle | null;
  onClose: () => void;
  onSuccess: () => void;
  sesionUsuario: string;
}) {
  const [obs, setObs] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const siguienteEstado = planilla ? SIGUIENTE_ESTADO[planilla.estado] : null;

  async function handleCambiar() {
    if (!planilla || !siguienteEstado) return;
    setError(null);
    setLoading(true);
    try {
      await apiFetch(`/nomina/planilla/${planilla.id}/estado`, {
        method: "PATCH",
        body: JSON.stringify({ estado: siguienteEstado, aprobadoPor: sesionUsuario, observaciones: obs || null }),
      });
      onSuccess();
      onClose();
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  if (!planilla || !siguienteEstado) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-[#0d1b2a] border-[#1e3a5f] text-white max-w-md">
        <DialogHeader>
          <DialogTitle className="text-amber-400">{ACCION_LABEL[siguienteEstado]}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="flex items-center gap-3 text-sm">
            <EstadoBadge estado={planilla.estado} />
            <ArrowRight className="h-4 w-4 text-zinc-500" />
            <EstadoBadge estado={siguienteEstado} />
          </div>
          <div>
            <Label className="text-xs text-[#8bacc8] mb-1 block">Observaciones (opcional)</Label>
            <Textarea value={obs} onChange={e => setObs(e.target.value)} rows={2}
              placeholder="Comentario para el registro de auditoría"
              className="bg-[#0a1628] border-[#1e3a5f] text-white resize-none" />
          </div>
          {error && (
            <div className="bg-red-900/40 border border-red-700 rounded p-3 text-sm text-red-200 flex gap-2">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              {error}
            </div>
          )}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={onClose} className="text-[#8bacc8]">Cancelar</Button>
          <Button onClick={handleCambiar} disabled={loading}
            className="bg-amber-600 hover:bg-amber-500 text-white">
            {loading ? "Procesando…" : ACCION_LABEL[siguienteEstado]}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Modal: Revertir Planilla ─────────────────────────────────────────────────

function RevertirPlanillaModal({
  open, planilla, onClose, onSuccess, sesionUsuario,
}: {
  open: boolean;
  planilla: PlanillaDetalle | null;
  onClose: () => void;
  onSuccess: () => void;
  sesionUsuario: string;
}) {
  const [motivo, setMotivo] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const PALABRA = "REVERTIR";

  async function handleRevertir() {
    if (!planilla) return;
    if (confirmar !== PALABRA) { setError(`Escribe ${PALABRA} para confirmar.`); return; }
    if (!motivo.trim()) { setError("El motivo es obligatorio."); return; }
    setError(null);
    setLoading(true);
    try {
      await apiFetch(`/nomina/planilla/${planilla.id}`, {
        method: "DELETE",
        body: JSON.stringify({ anuladoPor: sesionUsuario, motivo }),
      });
      onSuccess();
      onClose();
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  if (!planilla) return null;

  // Contar anticipos vinculados en todas las líneas
  const totalAnticiposVinculados = planilla.lineas.reduce((acc, l) => {
    const ids = Array.isArray(l.anticipo_ids) ? l.anticipo_ids : [];
    return acc + ids.length;
  }, 0);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-[#0d1b2a] border-red-800 text-white max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-red-400 flex items-center gap-2">
            <Undo2 className="h-5 w-5" />
            Revertir Planilla
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="bg-red-950/50 border border-red-800 rounded p-4 space-y-2 text-sm">
            <p className="text-red-200 font-medium">Esta acción realizará lo siguiente:</p>
            <ul className="text-red-300 space-y-1 list-disc list-inside">
              <li>La planilla quedará marcada como anulada</li>
              <li>Se eliminarán las {planilla.total_colaboradores} líneas calculadas</li>
              {totalAnticiposVinculados > 0 && (
                <li>
                  Se desvinculan <strong>{totalAnticiposVinculados} anticipo(s)</strong> — vuelven a estado <em>aprobada</em>
                </li>
              )}
              <li>La pre-planilla del período queda abierta para corrección</li>
              <li>Después podrás volver a cerrar y generar una nueva planilla</li>
            </ul>
          </div>

          {planilla.estado === "aprobada" && (
            <div className="bg-amber-950/40 border border-amber-700 rounded p-3 text-amber-300 text-sm flex gap-2">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              Esta planilla ya fue aprobada. Asegúrate de que ningún pago haya sido procesado.
            </div>
          )}

          <div>
            <Label className="text-xs text-[#8bacc8] mb-1 block">Motivo de la reversión *</Label>
            <Textarea value={motivo} onChange={e => setMotivo(e.target.value)} rows={3}
              placeholder="Ej. Error en el sueldo base del agente X, se corrige y se re-genera."
              className="bg-[#0a1628] border-[#1e3a5f] text-white resize-none" />
          </div>

          <div>
            <Label className="text-xs text-[#8bacc8] mb-1 block">
              Escribe <strong className="text-red-400">{PALABRA}</strong> para confirmar
            </Label>
            <Input value={confirmar} onChange={e => setConfirmar(e.target.value.toUpperCase())}
              placeholder={PALABRA}
              className="bg-[#0a1628] border-[#1e3a5f] text-white font-mono" />
          </div>

          {error && (
            <div className="bg-red-900/40 border border-red-700 rounded p-3 text-sm text-red-200 flex gap-2">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              {error}
            </div>
          )}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={onClose} className="text-[#8bacc8]">Cancelar</Button>
          <Button onClick={handleRevertir} disabled={loading || confirmar !== PALABRA}
            className="bg-red-700 hover:bg-red-600 text-white gap-2">
            <Undo2 className="h-4 w-4" />
            {loading ? "Revirtiendo…" : "Revertir planilla"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, icon }: { label: string; value: string; sub?: string; icon: React.ReactNode }) {
  return (
    <div className="bg-[#0d1b2a] border border-[#1e3a5f] rounded-lg p-4 flex items-start gap-3">
      <div className="mt-0.5 text-amber-500">{icon}</div>
      <div>
        <div className="text-xs text-[#8bacc8]">{label}</div>
        <div className="text-lg font-bold text-white">{value}</div>
        {sub && <div className="text-xs text-[#8bacc8]">{sub}</div>}
      </div>
    </div>
  );
}

// ─── Tabla: Planilla General ──────────────────────────────────────────────────

function TabPlanillaGeneral({ lineas }: { lineas: PlanillaLinea[] }) {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="border-[#1e3a5f] hover:bg-transparent">
            <TableHead className="text-[#8bacc8] text-xs">ID</TableHead>
            <TableHead className="text-[#8bacc8] text-xs">Colaborador</TableHead>
            <TableHead className="text-[#8bacc8] text-xs">Puesto</TableHead>
            <TableHead className="text-[#8bacc8] text-xs">Sede / Cliente</TableHead>
            <TableHead className="text-[#8bacc8] text-xs text-right">Sueldo Base</TableHead>
            <TableHead className="text-[#8bacc8] text-xs text-center">Días</TableHead>
            <TableHead className="text-[#8bacc8] text-xs text-center">Faltas</TableHead>
            <TableHead className="text-[#8bacc8] text-xs text-right">Sueldo Período</TableHead>
            <TableHead className="text-[#8bacc8] text-xs text-right">Desc. Faltas</TableHead>
            <TableHead className="text-[#8bacc8] text-xs text-right">Valor HE</TableHead>
            <TableHead className="text-[#8bacc8] text-xs text-right">Total Bruto</TableHead>
            <TableHead className="text-[#8bacc8] text-xs text-right">Anticipos</TableHead>
            <TableHead className="text-[#8bacc8] text-xs text-right font-bold">Total Neto</TableHead>
            <TableHead className="text-[#8bacc8] text-xs">Rev.</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {lineas.map((l) => (
            <TableRow key={l.id} className="border-[#1e3a5f] hover:bg-[#1e3a5f]/20">
              <TableCell className="text-xs text-[#8bacc8] font-mono">
                {l.employee_id ? `EMP-${String(l.employee_id).padStart(4, "0")}` : "—"}
              </TableCell>
              <TableCell>
                <div className="text-sm font-medium text-white">{l.nombre_completo}</div>
                <div className="text-xs text-[#8bacc8]">{l.dpi ?? "—"}</div>
              </TableCell>
              <TableCell className="text-xs text-[#8bacc8]">{l.puesto ?? "—"}</TableCell>
              <TableCell>
                <div className="text-xs text-[#8bacc8]">{l.sede ?? "—"}</div>
                <div className="text-xs text-[#8bacc8]/70">{l.cliente ?? "—"}</div>
              </TableCell>
              <TableCell className="text-right text-sm text-white">{fmtQ(l.sueldo_base)}</TableCell>
              <TableCell className="text-center text-sm text-white">{l.periodo_dias}</TableCell>
              <TableCell className="text-center">
                {l.faltas > 0 || l.suspensiones > 0 ? (
                  <span className="text-red-400 text-sm font-medium">
                    {l.faltas}{l.suspensiones > 0 ? `+${l.suspensiones}S` : ""}
                  </span>
                ) : (
                  <span className="text-green-500 text-sm">0</span>
                )}
              </TableCell>
              <TableCell className="text-right text-sm text-white">{fmtQ(l.sueldo_periodo)}</TableCell>
              <TableCell className="text-right text-sm text-red-400">{parseFloat(l.desc_faltas) > 0 ? fmtQ(l.desc_faltas) : "—"}</TableCell>
              <TableCell className="text-right text-sm text-amber-400">{parseFloat(l.valor_he) > 0 ? fmtQ(l.valor_he) : "—"}</TableCell>
              <TableCell className="text-right text-sm text-white">{fmtQ(l.total_bruto)}</TableCell>
              <TableCell className="text-right text-sm text-orange-400">{parseFloat(l.anticipos) > 0 ? fmtQ(l.anticipos) : "—"}</TableCell>
              <TableCell className="text-right text-sm font-bold text-green-400">{fmtQ(l.total_neto)}</TableCell>
              <TableCell>
                {l.revision_estado && (
                  <span className={`text-xs px-1.5 py-0.5 rounded ${
                    l.revision_estado === "aprobado_rrhh" ? "bg-amber-800 text-amber-200" :
                    l.revision_estado === "revisada"      ? "bg-green-900 text-green-200" :
                    l.revision_estado === "observada"     ? "bg-red-900 text-red-200" :
                    "bg-zinc-700 text-zinc-300"
                  }`}>{l.revision_estado}</span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// ─── Tabla: Horas Extra ───────────────────────────────────────────────────────

function TabHorasExtra({ lineas }: { lineas: PlanillaLinea[] }) {
  const conHE = lineas.filter(l => parseFloat(l.horas_extra) > 0);
  if (!conHE.length) {
    return (
      <div className="text-center py-12 text-[#8bacc8]">
        <Clock className="h-10 w-10 mx-auto mb-3 opacity-40" />
        <p>No hay horas extra en este período</p>
      </div>
    );
  }
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="border-[#1e3a5f] hover:bg-transparent">
            <TableHead className="text-[#8bacc8] text-xs">Colaborador</TableHead>
            <TableHead className="text-[#8bacc8] text-xs">Puesto</TableHead>
            <TableHead className="text-[#8bacc8] text-xs text-right">Sueldo Base</TableHead>
            <TableHead className="text-[#8bacc8] text-xs text-center">Hrs/Semana</TableHead>
            <TableHead className="text-[#8bacc8] text-xs text-right">H. Trabajadas</TableHead>
            <TableHead className="text-[#8bacc8] text-xs text-right">H. Extra</TableHead>
            <TableHead className="text-[#8bacc8] text-xs text-right">Tarifa HE (×1.5)</TableHead>
            <TableHead className="text-[#8bacc8] text-xs text-right font-bold">Valor HE</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {conHE.map((l) => {
            const sb = parseFloat(l.sueldo_base);
            const hc = parseFloat(String(l.horas_contrato ?? 48));
            const horasDia = hc > 0 ? hc / 6 : 8;
            const sueldoDia = sb / 30;
            const tarifaHE = (sueldoDia / horasDia) * 1.5;
            return (
              <TableRow key={l.id} className="border-[#1e3a5f] hover:bg-[#1e3a5f]/20">
                <TableCell>
                  <div className="text-sm font-medium text-white">{l.nombre_completo}</div>
                </TableCell>
                <TableCell className="text-xs text-[#8bacc8]">{l.puesto ?? "—"}</TableCell>
                <TableCell className="text-right text-sm text-white">{fmtQ(l.sueldo_base)}</TableCell>
                <TableCell className="text-center text-sm text-[#8bacc8]">{l.horas_contrato ?? "—"}</TableCell>
                <TableCell className="text-right text-sm text-[#8bacc8]">{parseFloat(l.horas_trabajadas).toFixed(2)}</TableCell>
                <TableCell className="text-right text-sm font-medium text-amber-400">{parseFloat(l.horas_extra).toFixed(2)}</TableCell>
                <TableCell className="text-right text-sm text-[#8bacc8]">{fmtQ(tarifaHE)}/h</TableCell>
                <TableCell className="text-right text-sm font-bold text-amber-400">{fmtQ(l.valor_he)}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

// ─── Tabla: Faltas / Descuentos ───────────────────────────────────────────────

function TabFaltas({ lineas }: { lineas: PlanillaLinea[] }) {
  const conFaltas = lineas.filter(l => l.faltas > 0 || l.suspensiones > 0 || parseFloat(l.desc_faltas) > 0);
  if (!conFaltas.length) {
    return (
      <div className="text-center py-12 text-[#8bacc8]">
        <CheckCircle2 className="h-10 w-10 mx-auto mb-3 opacity-40 text-green-500" />
        <p>Sin faltas ni descuentos en este período</p>
      </div>
    );
  }
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="border-[#1e3a5f] hover:bg-transparent">
            <TableHead className="text-[#8bacc8] text-xs">Colaborador</TableHead>
            <TableHead className="text-[#8bacc8] text-xs">Puesto / Sede</TableHead>
            <TableHead className="text-[#8bacc8] text-xs text-right">Sueldo Base</TableHead>
            <TableHead className="text-[#8bacc8] text-xs text-center">Faltas</TableHead>
            <TableHead className="text-[#8bacc8] text-xs text-center">Suspensiones</TableHead>
            <TableHead className="text-[#8bacc8] text-xs text-right">Sueldo/Día</TableHead>
            <TableHead className="text-[#8bacc8] text-xs text-right font-bold">Desc. Total</TableHead>
            <TableHead className="text-[#8bacc8] text-xs">Observaciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {conFaltas.map((l) => {
            const sueldoDia = parseFloat(l.sueldo_base) / 30;
            return (
              <TableRow key={l.id} className="border-[#1e3a5f] hover:bg-[#1e3a5f]/20">
                <TableCell>
                  <div className="text-sm font-medium text-white">{l.nombre_completo}</div>
                  <div className="text-xs text-[#8bacc8]">{l.dpi ?? "—"}</div>
                </TableCell>
                <TableCell>
                  <div className="text-xs text-[#8bacc8]">{l.puesto ?? "—"}</div>
                  <div className="text-xs text-[#8bacc8]/70">{l.sede ?? "—"}</div>
                </TableCell>
                <TableCell className="text-right text-sm text-white">{fmtQ(l.sueldo_base)}</TableCell>
                <TableCell className="text-center">
                  <span className={`text-sm font-medium ${l.faltas > 0 ? "text-red-400" : "text-[#8bacc8]"}`}>
                    {l.faltas}
                  </span>
                </TableCell>
                <TableCell className="text-center">
                  <span className={`text-sm font-medium ${l.suspensiones > 0 ? "text-orange-400" : "text-[#8bacc8]"}`}>
                    {l.suspensiones}
                  </span>
                </TableCell>
                <TableCell className="text-right text-sm text-[#8bacc8]">{fmtQ(sueldoDia)}</TableCell>
                <TableCell className="text-right text-sm font-bold text-red-400">{fmtQ(l.desc_faltas)}</TableCell>
                <TableCell className="text-xs text-[#8bacc8]">{l.observaciones_rrhh ?? "—"}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

// ─── Tabla: Anticipos ─────────────────────────────────────────────────────────

function TabAnticipos({ lineas }: { lineas: PlanillaLinea[] }) {
  const conAnticipo = lineas.filter(l => parseFloat(l.anticipos) > 0);
  if (!conAnticipo.length) {
    return (
      <div className="text-center py-12 text-[#8bacc8]">
        <Wallet className="h-10 w-10 mx-auto mb-3 opacity-40" />
        <p>No hay anticipos registrados en este período</p>
      </div>
    );
  }

  const totalVinculados = conAnticipo.reduce((acc, l) => acc + (l.anticipo_ids?.length ?? 0), 0);

  return (
    <div className="space-y-0">
      {totalVinculados > 0 && (
        <div className="bg-green-950/30 border-b border-green-800/40 p-3 flex gap-2 text-xs text-green-300">
          <Link className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span>
            <strong>{totalVinculados} anticipo(s)</strong> vinculados a esta planilla y marcados como <em>descontados</em>.
            No pueden editarse mientras la planilla esté activa. Si necesitas corregir, revierte la planilla.
          </span>
        </div>
      )}
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-[#1e3a5f] hover:bg-transparent">
              <TableHead className="text-[#8bacc8] text-xs">Colaborador</TableHead>
              <TableHead className="text-[#8bacc8] text-xs">Puesto</TableHead>
              <TableHead className="text-[#8bacc8] text-xs text-right">Total Bruto</TableHead>
              <TableHead className="text-[#8bacc8] text-xs text-right font-bold">Anticipo</TableHead>
              <TableHead className="text-[#8bacc8] text-xs text-right">Total Neto</TableHead>
              <TableHead className="text-[#8bacc8] text-xs text-center">Anticipos Vinculados</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {conAnticipo.map((l) => {
              const ids = l.anticipo_ids ?? [];
              return (
                <TableRow key={l.id} className="border-[#1e3a5f] hover:bg-[#1e3a5f]/20">
                  <TableCell>
                    <div className="text-sm font-medium text-white">{l.nombre_completo}</div>
                    <div className="text-xs text-[#8bacc8]">{l.dpi ?? "—"}</div>
                  </TableCell>
                  <TableCell className="text-xs text-[#8bacc8]">{l.puesto ?? "—"}</TableCell>
                  <TableCell className="text-right text-sm text-white">{fmtQ(l.total_bruto)}</TableCell>
                  <TableCell className="text-right text-sm font-bold text-orange-400">{fmtQ(l.anticipos)}</TableCell>
                  <TableCell className="text-right text-sm font-bold text-green-400">{fmtQ(l.total_neto)}</TableCell>
                  <TableCell className="text-center">
                    {ids.length > 0 ? (
                      <span className="inline-flex items-center gap-1 text-xs bg-green-900/40 text-green-300 border border-green-800 px-2 py-0.5 rounded">
                        <Link className="h-3 w-3" />
                        {ids.length} vinculado{ids.length !== 1 ? "s" : ""}
                      </span>
                    ) : (
                      <span className="text-xs text-[#8bacc8]">Sin vínculo</span>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

// ─── Vista: Lista de planillas ────────────────────────────────────────────────

function ListaPlanillas({
  planillas, onSelect, onNueva, loading,
}: {
  planillas: PlanillaResumen[];
  onSelect: (p: PlanillaResumen) => void;
  onNueva: () => void;
  loading: boolean;
}) {
  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Planilla Final de Nómina</h1>
          <p className="text-[#8bacc8] text-sm mt-1">
            Planillas generadas desde períodos cerrados de pre-planilla
          </p>
        </div>
        <Button onClick={onNueva} className="bg-amber-600 hover:bg-amber-500 text-white gap-2">
          <Plus className="h-4 w-4" />
          Generar planilla
        </Button>
      </div>

      {/* Nota informativa */}
      <div className="bg-[#0d1b2a] border border-[#1e3a5f] rounded-lg p-4 flex gap-3 text-sm text-[#8bacc8]">
        <Lock className="h-4 w-4 mt-0.5 shrink-0 text-amber-500" />
        <div>
          <strong className="text-white">Ciclo completo:</strong> Operación diaria → Novedades de nómina → Pre-Planilla (cierre) → <strong className="text-amber-400">Planilla Final</strong>.
          La planilla se genera automáticamente desde el snapshot del período cerrado. No se edita directamente.
          Si hay un error, se regresa a la pre-planilla, se corrige y se cierra nuevamente.
        </div>
      </div>

      {/* Lista */}
      {loading ? (
        <div className="text-center py-12 text-[#8bacc8]">Cargando planillas…</div>
      ) : !planillas.length ? (
        <div className="text-center py-16 text-[#8bacc8]">
          <FileSpreadsheet className="h-14 w-14 mx-auto mb-4 opacity-30" />
          <p className="text-lg">No hay planillas generadas todavía</p>
          <p className="text-sm mt-2">Cierra un período en Pre-Planilla y luego genera la planilla aquí.</p>
          <Button onClick={onNueva} className="mt-6 bg-amber-600 hover:bg-amber-500 text-white gap-2">
            <Plus className="h-4 w-4" />
            Generar planilla
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {planillas.map((p) => (
            <button
              key={p.id}
              onClick={() => onSelect(p)}
              className="w-full text-left bg-[#0d1b2a] border border-[#1e3a5f] rounded-lg p-4 hover:border-amber-600/50 hover:bg-[#1e3a5f]/30 transition-all"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <span className="text-white font-semibold">
                      {fmtFecha(p.periodo_desde)} — {fmtFecha(p.periodo_hasta)}
                    </span>
                    <EstadoBadge estado={p.estado} />
                  </div>
                  <div className="text-xs text-[#8bacc8] mt-1">
                    Generada por <strong>{p.generado_por}</strong> el {fmtFecha(p.fecha_generacion)}
                    &nbsp;·&nbsp; {p.total_colaboradores} colaboradores
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-lg font-bold text-green-400">{fmtQ(p.total_neto)}</div>
                  <div className="text-xs text-[#8bacc8]">neto a pagar</div>
                </div>
              </div>
              <Separator className="my-3 bg-[#1e3a5f]" />
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-[#8bacc8]">Sueldo período: </span>
                  <span className="text-white">{fmtQ(p.total_sueldo_periodo)}</span>
                </div>
                <div>
                  <span className="text-[#8bacc8]">Desc. faltas: </span>
                  <span className="text-red-400">{fmtQ(p.total_desc_faltas)}</span>
                </div>
                <div>
                  <span className="text-[#8bacc8]">Anticipos: </span>
                  <span className="text-orange-400">{fmtQ(p.total_anticipos)}</span>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Vista: Detalle de planilla ───────────────────────────────────────────────

function DetallePlanilla({
  planilla, onBack, onCambiarEstado, onRevertir, onRefresh,
}: {
  planilla: PlanillaDetalle;
  onBack: () => void;
  onCambiarEstado: () => void;
  onRevertir: () => void;
  onRefresh: () => void;
}) {
  function handleExportCSV() {
    window.open(`${API}/nomina/planilla/${planilla.id}/export`, "_blank");
  }

  const siguienteEstado = SIGUIENTE_ESTADO[planilla.estado];
  const puedeRevertir = planilla.estado !== "pagada";

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" onClick={onBack} size="sm" className="text-[#8bacc8] hover:text-white gap-1">
            <ChevronLeft className="h-4 w-4" />
            Volver
          </Button>
          <Separator orientation="vertical" className="h-6 bg-[#1e3a5f]" />
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold text-white">
                {fmtFecha(planilla.periodo_desde)} — {fmtFecha(planilla.periodo_hasta)}
              </h2>
              <EstadoBadge estado={planilla.estado} />
            </div>
            <div className="text-xs text-[#8bacc8] mt-0.5">
              Generada por <strong>{planilla.generado_por}</strong> · {planilla.total_colaboradores} colaboradores
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button onClick={handleExportCSV} variant="outline"
            className="border-[#1e3a5f] text-[#8bacc8] hover:text-white gap-2">
            <Download className="h-4 w-4" />
            Exportar CSV
          </Button>
          {puedeRevertir && (
            <Button onClick={onRevertir} variant="outline"
              className="border-red-800 text-red-400 hover:text-red-300 hover:border-red-700 gap-2">
              <Undo2 className="h-4 w-4" />
              Revertir
            </Button>
          )}
          {siguienteEstado && (
            <Button onClick={onCambiarEstado} className="bg-amber-600 hover:bg-amber-500 text-white gap-2">
              <ArrowRight className="h-4 w-4" />
              {ACCION_LABEL[siguienteEstado]}
            </Button>
          )}
          {planilla.estado === "pagada" && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-900/50 border border-green-700 rounded text-green-300 text-sm">
              <CheckCircle2 className="h-4 w-4" /> Planilla pagada
            </span>
          )}
        </div>
      </div>

      {/* Nota: solo lectura */}
      <div className="bg-amber-950/30 border border-amber-700/50 rounded p-3 flex gap-2 text-xs text-amber-300">
        <Lock className="h-3.5 w-3.5 mt-0.5 shrink-0" />
        Esta planilla es de solo lectura. Si necesitas corregir datos, ve a Pre-Planilla,
        corrige y cierra el período nuevamente. Luego podrás generar una nueva planilla.
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Colaboradores" value={String(planilla.total_colaboradores)} icon={<Users className="h-5 w-5" />} />
        <KpiCard label="Sueldo Período" value={fmtQ(planilla.total_sueldo_periodo)} icon={<CalendarDays className="h-5 w-5" />} />
        <KpiCard label="Total Bruto" value={fmtQ(planilla.total_bruto)}
          sub={`HE: ${fmtQ(planilla.total_valor_he)} | Desc: ${fmtQ(planilla.total_desc_faltas)}`}
          icon={<TrendingUp className="h-5 w-5" />} />
        <KpiCard label="Total Neto a Pagar" value={fmtQ(planilla.total_neto)}
          sub={`Anticipos descontados: ${fmtQ(planilla.total_anticipos)}`}
          icon={<Wallet className="h-5 w-5" />} />
      </div>

      {/* Limitaciones */}
      <div className="bg-blue-950/30 border border-blue-800/50 rounded p-3 flex gap-2 text-xs text-blue-300">
        <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
        <span>
          <strong>Límites actuales:</strong> Esta planilla no incluye IGSS, bonificación incentivo ni séptimo.
          Estos componentes se agregarán en versiones futuras. El cálculo incluye: sueldo proporcional al período,
          descuento por faltas/suspensiones, valor de horas extra (×1.5) y deducción de anticipos.
        </span>
      </div>

      {/* Tabs multi-hoja */}
      <Tabs defaultValue="general" className="space-y-4">
        <TabsList className="bg-[#0a1628] border border-[#1e3a5f]">
          <TabsTrigger value="general" className="data-[state=active]:bg-amber-700 data-[state=active]:text-white text-[#8bacc8]">
            <FileSpreadsheet className="h-4 w-4 mr-1.5" />
            Planilla General
          </TabsTrigger>
          <TabsTrigger value="he" className="data-[state=active]:bg-amber-700 data-[state=active]:text-white text-[#8bacc8]">
            Horas Extra
            {planilla.lineas.filter(l => parseFloat(l.horas_extra) > 0).length > 0 && (
              <Badge className="ml-1.5 bg-amber-900 text-amber-300 text-xs">
                {planilla.lineas.filter(l => parseFloat(l.horas_extra) > 0).length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="faltas" className="data-[state=active]:bg-amber-700 data-[state=active]:text-white text-[#8bacc8]">
            Faltas / Desc.
            {planilla.lineas.filter(l => l.faltas > 0 || l.suspensiones > 0).length > 0 && (
              <Badge className="ml-1.5 bg-red-900 text-red-300 text-xs">
                {planilla.lineas.filter(l => l.faltas > 0 || l.suspensiones > 0).length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="anticipos" className="data-[state=active]:bg-amber-700 data-[state=active]:text-white text-[#8bacc8]">
            Anticipos
            {planilla.lineas.filter(l => parseFloat(l.anticipos) > 0).length > 0 && (
              <Badge className="ml-1.5 bg-orange-900 text-orange-300 text-xs">
                {planilla.lineas.filter(l => parseFloat(l.anticipos) > 0).length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="igss" className="data-[state=active]:bg-amber-700 data-[state=active]:text-white text-[#8bacc8]">
            IGSS
            {planilla.lineas.filter(l => l.aplica_igss).length > 0 && (
              <Badge className="ml-1.5 bg-emerald-900 text-emerald-300 text-xs">
                {planilla.lineas.filter(l => l.aplica_igss).length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="bg-[#0d1b2a] border border-[#1e3a5f] rounded-lg overflow-hidden">
          <TabPlanillaGeneral lineas={planilla.lineas} />
          {!planilla.lineas.length && (
            <div className="text-center py-8 text-[#8bacc8]">Sin líneas en esta planilla</div>
          )}
        </TabsContent>

        <TabsContent value="he" className="bg-[#0d1b2a] border border-[#1e3a5f] rounded-lg overflow-hidden">
          <TabHorasExtra lineas={planilla.lineas} />
        </TabsContent>

        <TabsContent value="faltas" className="bg-[#0d1b2a] border border-[#1e3a5f] rounded-lg overflow-hidden">
          <TabFaltas lineas={planilla.lineas} />
        </TabsContent>

        <TabsContent value="anticipos" className="bg-[#0d1b2a] border border-[#1e3a5f] rounded-lg overflow-hidden">
          <TabAnticipos lineas={planilla.lineas} />
        </TabsContent>

        <TabsContent value="igss" className="bg-[#0d1b2a] border border-[#1e3a5f] rounded-lg overflow-hidden">
          <TabIGSS lineas={planilla.lineas} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Tabla: IGSS ─────────────────────────────────────────────────────────────

function TabIGSS({ lineas }: { lineas: PlanillaLinea[] }) {
  const conIgss    = lineas.filter(l => l.aplica_igss);
  const sinIgss    = lineas.filter(l => !l.aplica_igss);

  const getMotivoCfg = (motivo: string | null) => {
    if (!motivo) return null;
    if (motivo.includes("IGSS activado") || motivo.includes("no activo"))
      return "text-white/40 bg-white/5 border-white/10";
    if (motivo.includes("regularización"))
      return "text-amber-400 bg-amber-500/10 border-amber-500/20";
    if (motivo.includes("tarifa"))
      return "text-blue-400 bg-blue-500/10 border-blue-500/20";
    return "text-white/40 bg-white/5 border-white/10";
  };

  return (
    <div className="space-y-0">
      {/* Banner resumen */}
      <div className="bg-blue-950/30 border-b border-blue-800/40 p-3 flex gap-2 text-xs text-blue-300">
        <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
        <span>
          <strong>{conIgss.length}</strong> colaborador(es) con IGSS activo · <strong>{sinIgss.length}</strong> excluidos.
          Los cálculos de IGSS (4.83% laboral + 12.67% patronal) se habilitarán en una versión futura.
          Esta vista es solo de clasificación y trazabilidad.
        </span>
      </div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-[#1e3a5f] hover:bg-transparent">
              <TableHead className="text-[#8bacc8] text-xs">Colaborador</TableHead>
              <TableHead className="text-[#8bacc8] text-xs">Puesto / Cliente</TableHead>
              <TableHead className="text-[#8bacc8] text-xs text-center">¿Aplica IGSS?</TableHead>
              <TableHead className="text-[#8bacc8] text-xs">Motivo / Estado</TableHead>
              <TableHead className="text-[#8bacc8] text-xs text-right">Total Bruto</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lineas.map((l) => (
              <TableRow key={l.id} className="border-[#1e3a5f] hover:bg-[#1e3a5f]/20">
                <TableCell>
                  <div className="text-sm font-medium text-white">{l.nombre_completo}</div>
                  <div className="text-xs text-[#8bacc8]">{l.dpi ?? "—"}</div>
                </TableCell>
                <TableCell>
                  <div className="text-xs text-[#8bacc8]">{l.puesto ?? "—"}</div>
                  <div className="text-xs text-white/30">{l.cliente ?? "—"}</div>
                </TableCell>
                <TableCell className="text-center">
                  {l.aplica_igss ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      Aplica
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-white/5 text-white/40 border border-white/10">
                      <span className="w-1.5 h-1.5 rounded-full bg-white/30" />
                      No aplica
                    </span>
                  )}
                </TableCell>
                <TableCell>
                  {l.motivo_exclusion_igss ? (
                    <span className={`inline-block px-2 py-0.5 rounded text-[10px] border ${getMotivoCfg(l.motivo_exclusion_igss) ?? ""}`}>
                      {l.motivo_exclusion_igss}
                    </span>
                  ) : (
                    <span className="text-xs text-emerald-400/60">Elegible para cálculo</span>
                  )}
                </TableCell>
                <TableCell className="text-right text-sm text-white">{fmtQ(l.total_bruto)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function AdminPlanilla() {
  const [planillas, setPlanillas] = useState<PlanillaResumen[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<PlanillaDetalle | null>(null);
  const [showGenerar, setShowGenerar] = useState(false);
  const [showEstado, setShowEstado] = useState(false);
  const [showRevertir, setShowRevertir] = useState(false);
  const [sesionUsuario, setSesionUsuario] = useState("admin");

  // Leer usuario de la sesión
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("isp_admin_session_v2") || "";
      if (raw) {
        const decoded = JSON.parse(atob(raw.split(".")[1] ?? "") || "{}");
        if (decoded.username) setSesionUsuario(decoded.username);
      }
    } catch {
      // no bloqueante
    }
  }, []);

  const cargarPlanillas = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch("/nomina/planillas");
      setPlanillas(data);
    } catch {
      setPlanillas([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const cargarDetalle = useCallback(async (id: number) => {
    try {
      const data = await apiFetch(`/nomina/planilla/${id}`);
      setSelected(data);
    } catch {
      setSelected(null);
    }
  }, []);

  useEffect(() => { cargarPlanillas(); }, [cargarPlanillas]);

  async function handleSelect(p: PlanillaResumen) {
    await cargarDetalle(p.id);
  }

  function handleBack() {
    setSelected(null);
    cargarPlanillas();
  }

  async function handleNuevaGenerada(id: number) {
    await cargarPlanillas();
    await cargarDetalle(id);
  }

  async function handleRefreshDetalle() {
    if (selected) await cargarDetalle(selected.id);
  }

  return (
    <div className="min-h-screen bg-[#061120] p-6">
      <div className="max-w-7xl mx-auto">
        {selected ? (
          <DetallePlanilla
            planilla={selected}
            onBack={handleBack}
            onCambiarEstado={() => setShowEstado(true)}
            onRevertir={() => setShowRevertir(true)}
            onRefresh={handleRefreshDetalle}
          />
        ) : (
          <ListaPlanillas
            planillas={planillas}
            loading={loading}
            onSelect={handleSelect}
            onNueva={() => setShowGenerar(true)}
          />
        )}
      </div>

      <GenerarPlanillaModal
        open={showGenerar}
        onClose={() => setShowGenerar(false)}
        onSuccess={handleNuevaGenerada}
        sesionUsuario={sesionUsuario}
      />

      <CambiarEstadoModal
        open={showEstado}
        planilla={selected}
        onClose={() => setShowEstado(false)}
        onSuccess={handleRefreshDetalle}
        sesionUsuario={sesionUsuario}
      />

      <RevertirPlanillaModal
        open={showRevertir}
        planilla={selected}
        onClose={() => setShowRevertir(false)}
        onSuccess={handleBack}
        sesionUsuario={sesionUsuario}
      />
    </div>
  );
}
