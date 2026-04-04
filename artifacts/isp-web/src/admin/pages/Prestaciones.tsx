/**
 * Prestaciones.tsx — Módulo de Prestaciones Laborales (Guatemala)
 * Aguinaldo · Bono 14 · Vacaciones · Indemnización · Liquidación Final · Provisiones
 */

import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import {
  Landmark, Palmtree, Receipt, Calculator, Settings2, Plus, RefreshCw,
  TrendingUp, Users, AlertCircle, CheckCircle2, Clock, ChevronRight,
  Download, Search, FileText, Coins, BookOpen,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { AdminLayout } from "@/admin/layout/AdminLayout";
import { useAuth } from "@/contexts/AuthContext";

// ─── API ──────────────────────────────────────────────────────────────────────

const API = "http://localhost:8080/api";

function getSession() {
  return sessionStorage.getItem("isp_admin_session_v2") || "";
}

async function apiFetch(url: string, opts: RequestInit = {}) {
  const res = await fetch(`${API}${url}`, {
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

function apiGet(url: string) {
  return apiFetch(url);
}

function apiPost(url: string, body: unknown) {
  return apiFetch(url, { method: "POST", body: JSON.stringify(body) });
}

function apiPut(url: string, body: unknown) {
  return apiFetch(url, { method: "PUT", body: JSON.stringify(body) });
}

function apiPatch(url: string, body?: unknown) {
  return apiFetch(url, { method: "PATCH", body: body ? JSON.stringify(body) : undefined });
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface PrestacionesConfig {
  aguinaldoBase: "salario_actual" | "promedio_periodo";
  bono14Base: "promedio_periodo" | "salario_actual";
  vacacionesDiasPrimerAnio: number;
  vacacionesDiasQuinquenio: number;
  vacacionesDiasElegibilidad: number;
  indemnizacionSoloLegal: boolean;
  redondeoDecimales: number;
}

interface VacacionesSaldo {
  employee_id: number;
  dias_ganados: number;
  dias_gozados: number;
  dias_disponibles: number;
  fecha_ultima_actualizacion: string | null;
}

interface Provision {
  periodo_desde: string;
  periodo_hasta: string;
  tipo: string;
  employee_id: number;
  empleado_nombre: string;
  sede: string | null;
  monto_provision: string;
  dias_periodo: number;
  salario_referencia: string;
}

interface ProvisionResumen {
  tipo: string;
  total: string;
  count: number;
}

interface LiquidacionItem {
  id: number;
  employee_id: number;
  empleado_nombre: string;
  tipo_egreso: string;
  fecha_egreso: string;
  total_general: string;
  estado: string;
  generado_at: string;
}

interface RubroLiquidacion {
  rubro: string;
  descripcion: string;
  monto: number;
}

interface SimulacionLiquidacion {
  employee_id: number;
  empleado_nombre: string;
  tipo_egreso: string;
  fecha_egreso: string;
  rubros: RubroLiquidacion[];
  totalGeneral: number;
  simulacion: boolean;
}

interface Employee {
  id: number;
  nombre_completo: string;
  sueldo_base: string;
  fecha_ingreso: string;
  estado_laboral: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number | string) {
  return `Q${parseFloat(String(n)).toLocaleString("es-GT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(d: string) {
  if (!d) return "—";
  return new Date(d + (d.includes("T") ? "" : "T00:00:00")).toLocaleDateString("es-GT");
}

const TIPO_EGRESO_LABELS: Record<string, string> = {
  renuncia: "Renuncia",
  despido_justificado: "Despido Justificado",
  despido_injustificado: "Despido Injustificado",
  mutuo_acuerdo: "Mutuo Acuerdo",
  finalizacion_contrato: "Finalización de Contrato",
};

const ESTADO_BADGE: Record<string, { label: string; cls: string }> = {
  activa: { label: "Activa", cls: "bg-green-500/20 text-green-300 border-green-500/30" },
  anulada: { label: "Anulada", cls: "bg-red-500/20 text-red-300 border-red-500/30" },
};

// ─── Tab: Configuración ───────────────────────────────────────────────────────

function TabConfiguracion() {
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

// ─── Tab: Vacaciones ──────────────────────────────────────────────────────────

function ModalVacMovimiento({
  onClose,
  onDone,
}: {
  onClose: () => void;
  onDone: () => void;
}) {
  const { toast } = useToast();
  const [empId, setEmpId] = useState("");
  const [busEmp, setBusEmp] = useState("");
  const [tipo, setTipo] = useState<"ganadas" | "gozadas">("ganadas");
  const [dias, setDias] = useState("");
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
  const [obs, setObs] = useState("");
  const [loading, setLoading] = useState(false);

  const { data: empleados = [] } = useQuery<Employee[]>({
    queryKey: ["employees-activos"],
    queryFn: () => apiGet("/employees?estado_laboral=activo"),
    staleTime: 60_000,
  });

  const filtrados = (empleados as Employee[]).filter(
    (e) => !busEmp || e.nombre_completo.toLowerCase().includes(busEmp.toLowerCase())
  );

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    if (!empId || !dias || !fecha) return;
    setLoading(true);
    try {
      await apiPost("/prestaciones/vacaciones/movimiento", {
        employee_id: Number(empId),
        tipo,
        dias: parseFloat(dias),
        fecha,
        observaciones: obs.trim() || undefined,
      });
      toast({ title: "Movimiento registrado" });
      onDone();
      onClose();
    } catch (e: Error | unknown) {
      toast({ title: "Error", description: (e as Error).message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  const inputCls = "w-full bg-[#060e1c] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-teal-500/40 transition-colors";

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="bg-[#07111f] border border-teal-500/20 text-white rounded-2xl max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm font-bold">
            <Palmtree className="w-4 h-4 text-teal-400" /> Registrar Movimiento de Vacaciones
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <Label className="text-xs text-white/50">Buscar Empleado</Label>
            <Input
              className={inputCls}
              placeholder="Nombre del empleado…"
              value={busEmp}
              onChange={(e) => setBusEmp(e.target.value)}
            />
            {busEmp && (
              <div className="max-h-40 overflow-y-auto rounded-xl border border-white/10 bg-[#060e1c]">
                {filtrados.slice(0, 10).map((e) => (
                  <button
                    key={e.id}
                    type="button"
                    onClick={() => { setEmpId(String(e.id)); setBusEmp(e.nombre_completo); }}
                    className={`w-full text-left px-3 py-2 text-xs hover:bg-teal-500/10 transition-colors ${String(e.id) === empId ? "bg-teal-500/20 text-teal-300" : "text-white/70"}`}
                  >
                    {e.nombre_completo}
                  </button>
                ))}
                {filtrados.length === 0 && <p className="text-xs text-white/30 px-3 py-2">Sin resultados</p>}
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-white/50">Tipo de Movimiento</Label>
            <div className="grid grid-cols-2 gap-2">
              {(["ganadas", "gozadas"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTipo(t)}
                  className={`py-2 px-3 rounded-xl text-sm font-medium border transition-all ${tipo === t ? "border-teal-500/50 bg-teal-500/20 text-teal-300" : "border-white/10 bg-white/3 text-white/50 hover:border-white/20"}`}
                >
                  {t === "ganadas" ? "Días Ganados" : "Días Gozados"}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-white/50">Días</Label>
              <Input type="number" step="0.5" min="0.5" className={inputCls} value={dias} onChange={(e) => setDias(e.target.value)} placeholder="15" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-white/50">Fecha</Label>
              <Input type="date" className={inputCls} value={fecha} onChange={(e) => setFecha(e.target.value)} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-white/50">Observaciones (opcional)</Label>
            <Input className={inputCls} placeholder="Período vacacional…" value={obs} onChange={(e) => setObs(e.target.value)} />
          </div>

          <DialogFooter className="gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={onClose} className="text-white/50 hover:text-white rounded-xl">Cancelar</Button>
            <Button type="submit" disabled={loading || !empId || !dias} className="bg-teal-600 hover:bg-teal-500 text-white rounded-xl">
              {loading ? "Guardando…" : "Registrar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function TabVacaciones() {
  const qc = useQueryClient();
  const [busEmp, setBusEmp] = useState("");
  const [empIdSel, setEmpIdSel] = useState<number | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const { data: empleados = [] } = useQuery<Employee[]>({
    queryKey: ["employees-activos"],
    queryFn: () => apiGet("/employees?estado_laboral=activo"),
    staleTime: 60_000,
  });

  const { data: saldo, isLoading: saldoLoading } = useQuery<VacacionesSaldo>({
    queryKey: ["vac-saldo", empIdSel],
    queryFn: () => apiGet(`/prestaciones/vacaciones/saldo/${empIdSel}`),
    enabled: !!empIdSel,
  });

  const { data: movs } = useQuery<{ movimientos: Array<{ id: number; tipo: string; dias: number; fecha: string; observaciones: string | null }> }>({
    queryKey: ["prest-movs", empIdSel],
    queryFn: () => apiGet(`/prestaciones/movimientos/${empIdSel}`),
    enabled: !!empIdSel,
  });

  const filtEmp = (empleados as Employee[]).filter(
    (e) => !busEmp || e.nombre_completo.toLowerCase().includes(busEmp.toLowerCase())
  );

  return (
    <div className="flex gap-6 p-6">
      {/* Left: employee list */}
      <div className="w-72 shrink-0 space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
          <Input
            className="bg-[#060e1c] border border-white/10 rounded-xl pl-8 pr-3 py-2 text-sm text-white outline-none focus:border-teal-500/40"
            placeholder="Buscar empleado…"
            value={busEmp}
            onChange={(e) => setBusEmp(e.target.value)}
          />
        </div>
        <div className="space-y-1 max-h-[520px] overflow-y-auto pr-1">
          {filtEmp.slice(0, 50).map((e) => (
            <button
              key={e.id}
              onClick={() => setEmpIdSel(e.id)}
              className={`w-full text-left px-3 py-2.5 rounded-xl text-xs transition-all ${empIdSel === e.id ? "bg-teal-500/20 text-teal-300 border border-teal-500/30" : "bg-white/3 text-white/60 hover:bg-white/6 border border-transparent"}`}
            >
              <div className="font-medium truncate">{e.nombre_completo}</div>
              <div className="text-white/30 mt-0.5">{fmt(e.sueldo_base ?? 0)} / mes</div>
            </button>
          ))}
        </div>
      </div>

      {/* Right: detail */}
      <div className="flex-1 min-w-0">
        {!empIdSel && (
          <div className="flex flex-col items-center justify-center h-64 text-white/25 gap-2">
            <Palmtree className="w-8 h-8" />
            <p className="text-sm">Selecciona un empleado para ver su saldo de vacaciones</p>
          </div>
        )}

        {empIdSel && (
          <>
            {/* Saldo cards */}
            <div className="grid grid-cols-3 gap-3 mb-6">
              {[
                { label: "Días Ganados", val: saldo?.dias_ganados ?? 0, color: "teal" },
                { label: "Días Gozados", val: saldo?.dias_gozados ?? 0, color: "blue" },
                { label: "Disponibles", val: saldo?.dias_disponibles ?? 0, color: "green" },
              ].map(({ label, val, color }) => (
                <div key={label} className={`bg-${color}-500/10 border border-${color}-500/20 rounded-2xl p-4`}>
                  <p className="text-xs text-white/40">{label}</p>
                  <p className={`text-2xl font-bold text-${color}-300 mt-1`}>
                    {saldoLoading ? "…" : parseFloat(String(val)).toFixed(1)}
                  </p>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-semibold text-white/40 uppercase tracking-wider">Movimientos</h4>
              <Button
                size="sm"
                onClick={() => setModalOpen(true)}
                className="bg-teal-600/20 hover:bg-teal-600/30 text-teal-300 border border-teal-500/30 rounded-xl text-xs"
              >
                <Plus className="w-3.5 h-3.5 mr-1" /> Registrar
              </Button>
            </div>

            <div className="rounded-2xl border border-white/8 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="border-white/8 hover:bg-transparent">
                    <TableHead className="text-white/40 text-xs">Tipo</TableHead>
                    <TableHead className="text-white/40 text-xs">Días</TableHead>
                    <TableHead className="text-white/40 text-xs">Fecha</TableHead>
                    <TableHead className="text-white/40 text-xs">Obs.</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(movs?.movimientos ?? []).filter((m) => m.tipo === "ganadas" || m.tipo === "gozadas").map((m) => (
                    <TableRow key={m.id} className="border-white/5 hover:bg-white/3">
                      <TableCell>
                        <Badge className={m.tipo === "ganadas" ? "bg-teal-500/20 text-teal-300 border-teal-500/30" : "bg-blue-500/20 text-blue-300 border-blue-500/30"}>
                          {m.tipo}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-white/80">{parseFloat(String(m.dias)).toFixed(1)}</TableCell>
                      <TableCell className="text-sm text-white/60">{fmtDate(m.fecha)}</TableCell>
                      <TableCell className="text-xs text-white/40">{m.observaciones ?? "—"}</TableCell>
                    </TableRow>
                  ))}
                  {(movs?.movimientos ?? []).filter((m) => m.tipo === "ganadas" || m.tipo === "gozadas").length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-white/30 text-xs py-8">Sin movimientos registrados</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </div>

      {modalOpen && (
        <ModalVacMovimiento
          onClose={() => setModalOpen(false)}
          onDone={() => {
            qc.invalidateQueries({ queryKey: ["vac-saldo", empIdSel] });
            qc.invalidateQueries({ queryKey: ["prest-movs", empIdSel] });
          }}
        />
      )}
    </div>
  );
}

// ─── Tab: Provisiones ─────────────────────────────────────────────────────────

function TabProvisiones() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [desde, setDesde] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
  });
  const [hasta, setHasta] = useState(() => new Date().toISOString().slice(0, 10));
  const [resultado, setResultado] = useState<null | {
    empleados_procesados: number;
    provisiones_generadas: number;
    total_por_tipo: Record<string, number>;
    total_general: number;
    errores: string[];
  }>(null);
  const [loading, setLoading] = useState(false);

  const { data: provisionesData, refetch } = useQuery<{ provisiones: Provision[] }>({
    queryKey: ["prest-provisiones", desde, hasta],
    queryFn: () => apiGet(`/prestaciones/provisiones?periodo_desde=${desde}&periodo_hasta=${hasta}`),
    enabled: false,
  });

  const { data: resumenData } = useQuery<{ resumen: ProvisionResumen[] }>({
    queryKey: ["prest-provisiones-resumen", desde, hasta],
    queryFn: () =>
      apiGet(`/prestaciones/provisiones?periodo_desde=${desde}&periodo_hasta=${hasta}&agrupar_por=tipo`),
    enabled: false,
  });

  async function handleProvisionar() {
    setLoading(true);
    try {
      const r = await apiPost("/prestaciones/provisionar", {
        periodo_desde: desde,
        periodo_hasta: hasta,
        tipos: ["aguinaldo", "bono14", "vacaciones", "indemnizacion"],
      });
      setResultado(r);
      qc.invalidateQueries({ queryKey: ["prest-provisiones"] });
      toast({ title: `Provisión completada: ${r.empleados_procesados} empleados procesados` });
    } catch (e: Error | unknown) {
      toast({ title: "Error al provisionar", description: (e as Error).message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  const TIPO_COLOR: Record<string, string> = {
    aguinaldo: "teal",
    bono14: "blue",
    vacaciones: "green",
    indemnizacion: "orange",
  };

  const inputCls = "bg-[#060e1c] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-teal-500/40 transition-colors";

  return (
    <div className="p-6 space-y-6">
      {/* Controls */}
      <div className="bg-white/3 border border-white/8 rounded-2xl p-5">
        <h3 className="text-sm font-semibold text-white/70 mb-4 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-teal-400" /> Calcular Provisiones del Período
        </h3>
        <div className="flex flex-wrap items-end gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs text-white/50">Desde</Label>
            <Input type="date" className={inputCls} value={desde} onChange={(e) => setDesde(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-white/50">Hasta</Label>
            <Input type="date" className={inputCls} value={hasta} onChange={(e) => setHasta(e.target.value)} />
          </div>
          <Button
            onClick={handleProvisionar}
            disabled={loading}
            className="bg-teal-600 hover:bg-teal-500 text-white rounded-xl"
          >
            {loading ? (
              <><RefreshCw className="w-4 h-4 mr-2 animate-spin" />Calculando…</>
            ) : (
              <><Calculator className="w-4 h-4 mr-2" />Provisionar</>
            )}
          </Button>
          <Button
            variant="ghost"
            onClick={() => refetch()}
            className="text-white/50 hover:text-white rounded-xl border border-white/10"
          >
            <Search className="w-4 h-4 mr-2" /> Ver Provisiones
          </Button>
        </div>
        <p className="text-[10px] text-white/25 mt-3">
          La provisión es idempotente — re-ejecutar el mismo período actualiza los montos sin duplicar registros.
        </p>
      </div>

      {/* Resultado */}
      {resultado && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {(["aguinaldo", "bono14", "vacaciones", "indemnizacion"] as const).map((tipo) => {
            const color = TIPO_COLOR[tipo] ?? "teal";
            const monto = resultado.total_por_tipo?.[tipo];
            return (
              <div key={tipo} className={`bg-${color}-500/10 border border-${color}-500/20 rounded-2xl p-4`}>
                <p className="text-xs text-white/40 capitalize">{tipo === "indemnizacion" ? "Indemnización" : tipo.charAt(0).toUpperCase() + tipo.slice(1)}</p>
                <p className={`text-xl font-bold text-${color}-300 mt-1`}>
                  {monto != null ? fmt(monto) : "—"}
                </p>
              </div>
            );
          })}
        </div>
      )}

      {resultado && (
        <div className="flex items-center gap-4 px-4 py-3 rounded-xl bg-white/3 border border-white/8">
          <div>
            <span className="text-xs text-white/40">Empleados procesados</span>
            <p className="text-lg font-bold text-white">{resultado.empleados_procesados}</p>
          </div>
          <Separator orientation="vertical" className="h-8 border-white/10" />
          <div>
            <span className="text-xs text-white/40">Registros generados</span>
            <p className="text-lg font-bold text-white">{resultado.provisiones_generadas}</p>
          </div>
          <Separator orientation="vertical" className="h-8 border-white/10" />
          <div>
            <span className="text-xs text-white/40">Total General</span>
            <p className="text-lg font-bold text-teal-300">{resultado.total_general != null ? fmt(resultado.total_general) : "—"}</p>
          </div>
          {resultado.errores?.length > 0 && (
            <>
              <Separator orientation="vertical" className="h-8 border-white/10" />
              <div className="text-xs text-red-400 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" /> {resultado.errores.length} errores
              </div>
            </>
          )}
        </div>
      )}

      {/* Detalle tabla */}
      {provisionesData?.provisiones && provisionesData.provisiones.length > 0 && (
        <div className="rounded-2xl border border-white/8 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="border-white/8 hover:bg-transparent">
                <TableHead className="text-white/40 text-xs">Empleado</TableHead>
                <TableHead className="text-white/40 text-xs">Tipo</TableHead>
                <TableHead className="text-white/40 text-xs">Días</TableHead>
                <TableHead className="text-white/40 text-xs">Salario Ref.</TableHead>
                <TableHead className="text-white/40 text-xs text-right">Provisión</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {provisionesData.provisiones.slice(0, 100).map((p, i) => (
                <TableRow key={i} className="border-white/5 hover:bg-white/3">
                  <TableCell className="text-sm text-white/80">{p.empleado_nombre}</TableCell>
                  <TableCell>
                    <Badge className={`bg-${TIPO_COLOR[p.tipo] ?? "teal"}-500/20 text-${TIPO_COLOR[p.tipo] ?? "teal"}-300 border-${TIPO_COLOR[p.tipo] ?? "teal"}-500/30 capitalize`}>
                      {p.tipo}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-white/60">{p.dias_periodo}</TableCell>
                  <TableCell className="text-sm text-white/60">{fmt(p.salario_referencia)}</TableCell>
                  <TableCell className="text-sm font-semibold text-white text-right">{fmt(p.monto_provision)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

// ─── Tab: Liquidaciones ───────────────────────────────────────────────────────

function ModalLiquidacion({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
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
    (e) => !busEmp || e.nombre_completo.toLowerCase().includes(busEmp.toLowerCase())
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
      setSim(r);
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
            <Receipt className="w-4 h-4 text-teal-400" />
            {step === "form" ? "Nueva Liquidación Final" : "Vista Previa de Liquidación"}
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
                      onClick={() => { setEmpId(String(e.id)); setBusEmp(e.nombre_completo); }}
                      className={`w-full text-left px-3 py-2 text-xs hover:bg-teal-500/10 transition-colors ${String(e.id) === empId ? "bg-teal-500/20 text-teal-300" : "text-white/70"}`}
                    >{e.nombre_completo}</button>
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
              <Button onClick={handleSimular} disabled={loading || !empId} className="bg-teal-600 hover:bg-teal-500 text-white rounded-xl">
                {loading ? "Calculando…" : "Simular"}
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === "preview" && sim && (
          <div className="space-y-4 mt-2">
            <div className="bg-white/3 rounded-xl p-3 text-xs text-white/50 space-y-0.5">
              <p><span className="text-white/30">Empleado:</span> {sim.empleado_nombre}</p>
              <p><span className="text-white/30">Egreso:</span> {TIPO_EGRESO_LABELS[sim.tipo_egreso] ?? sim.tipo_egreso} · {fmtDate(sim.fecha_egreso)}</p>
            </div>
            <div className="space-y-2">
              {sim.rubros.map((r) => (
                <div key={r.rubro} className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-white/3 border border-white/6">
                  <span className="text-sm text-white/70">{r.descripcion}</span>
                  <span className="text-sm font-semibold text-white">{fmt(r.monto)}</span>
                </div>
              ))}
              <div className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-teal-500/10 border border-teal-500/20">
                <span className="text-sm font-bold text-teal-300">TOTAL GENERAL</span>
                <span className="text-lg font-bold text-teal-300">{fmt(sim.totalGeneral)}</span>
              </div>
            </div>
            <DialogFooter className="gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={() => setStep("form")} className="text-white/50 hover:text-white rounded-xl">Atrás</Button>
              <Button onClick={handleConfirmar} disabled={loading} className="bg-teal-600 hover:bg-teal-500 text-white rounded-xl">
                {loading ? "Registrando…" : "Confirmar y Registrar"}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ModalDetalleLiquidacion({ liqId, onClose }: { liqId: number; onClose: () => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["liq-detalle", liqId],
    queryFn: () => apiGet(`/prestaciones/liquidaciones/${liqId}`),
  });

  const anularMut = useMutation({
    mutationFn: () => apiPatch(`/prestaciones/liquidaciones/${liqId}/anular`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["prestaciones-liqlist"] });
      qc.invalidateQueries({ queryKey: ["liq-detalle", liqId] });
      toast({ title: "Liquidación anulada" });
      onClose();
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const liq = data?.liquidacion;
  const detalle: RubroLiquidacion[] = data?.detalle ?? [];

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="bg-[#07111f] border border-teal-500/20 text-white rounded-2xl max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm font-bold">
            <FileText className="w-4 h-4 text-teal-400" /> Detalle de Liquidación #{liqId}
          </DialogTitle>
        </DialogHeader>
        {isLoading ? (
          <div className="text-white/40 text-sm py-6 text-center">Cargando…</div>
        ) : (
          <div className="space-y-4 mt-2">
            {liq && (
              <div className="bg-white/3 rounded-xl p-3 text-xs text-white/50 space-y-0.5">
                <p><span className="text-white/30">Empleado:</span> {liq.empleado_nombre}</p>
                <p><span className="text-white/30">Egreso:</span> {TIPO_EGRESO_LABELS[liq.tipo_egreso] ?? liq.tipo_egreso} · {fmtDate(liq.fecha_egreso)}</p>
                <p><span className="text-white/30">Estado:</span> {liq.estado}</p>
              </div>
            )}
            <div className="space-y-2">
              {detalle.map((r) => (
                <div key={r.rubro} className="flex items-center justify-between px-3 py-2 rounded-xl bg-white/3 border border-white/6">
                  <span className="text-sm text-white/70">{r.descripcion}</span>
                  <span className="text-sm font-semibold text-white">{fmt(r.monto)}</span>
                </div>
              ))}
              {liq && (
                <div className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-teal-500/10 border border-teal-500/20">
                  <span className="text-sm font-bold text-teal-300">TOTAL GENERAL</span>
                  <span className="text-lg font-bold text-teal-300">{fmt(liq.total_general)}</span>
                </div>
              )}
            </div>
            {liq?.estado === "activa" && (
              <DialogFooter className="gap-2 pt-2">
                <Button type="button" variant="ghost" onClick={onClose} className="text-white/50 hover:text-white rounded-xl">Cerrar</Button>
                <Button
                  onClick={() => anularMut.mutate()}
                  disabled={anularMut.isPending}
                  variant="destructive"
                  className="rounded-xl"
                >
                  {anularMut.isPending ? "Anulando…" : "Anular Liquidación"}
                </Button>
              </DialogFooter>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function TabLiquidaciones() {
  const qc = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [detalleId, setDetalleId] = useState<number | null>(null);
  const [busEmp, setBusEmp] = useState("");

  const { data, isLoading } = useQuery<{ liquidaciones: LiquidacionItem[] }>({
    queryKey: ["prestaciones-liqlist"],
    queryFn: () => apiGet("/prestaciones/liquidaciones"),
    staleTime: 30_000,
  });

  const liqFilt = (data?.liquidaciones ?? []).filter(
    (l) => !busEmp || l.empleado_nombre.toLowerCase().includes(busEmp.toLowerCase())
  );

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="relative w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
          <Input
            className="bg-[#060e1c] border border-white/10 rounded-xl pl-8 pr-3 py-2 text-sm text-white outline-none focus:border-teal-500/40"
            placeholder="Buscar empleado…"
            value={busEmp}
            onChange={(e) => setBusEmp(e.target.value)}
          />
        </div>
        <Button
          onClick={() => setModalOpen(true)}
          className="bg-teal-600 hover:bg-teal-500 text-white rounded-xl"
        >
          <Plus className="w-4 h-4 mr-2" /> Nueva Liquidación
        </Button>
      </div>

      <div className="rounded-2xl border border-white/8 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-white/8 hover:bg-transparent">
              <TableHead className="text-white/40 text-xs">#</TableHead>
              <TableHead className="text-white/40 text-xs">Empleado</TableHead>
              <TableHead className="text-white/40 text-xs">Tipo Egreso</TableHead>
              <TableHead className="text-white/40 text-xs">Fecha Egreso</TableHead>
              <TableHead className="text-white/40 text-xs text-right">Total</TableHead>
              <TableHead className="text-white/40 text-xs">Estado</TableHead>
              <TableHead className="text-white/40 text-xs" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow><TableCell colSpan={7} className="text-center text-white/30 text-xs py-10">Cargando…</TableCell></TableRow>
            )}
            {!isLoading && liqFilt.length === 0 && (
              <TableRow><TableCell colSpan={7} className="text-center text-white/25 text-xs py-12">
                <div className="flex flex-col items-center gap-2">
                  <Receipt className="w-6 h-6" />
                  <span>No hay liquidaciones registradas</span>
                </div>
              </TableCell></TableRow>
            )}
            {liqFilt.map((l) => {
              const badge = ESTADO_BADGE[l.estado] ?? { label: l.estado, cls: "bg-white/10 text-white/50" };
              return (
                <TableRow key={l.id} className="border-white/5 hover:bg-white/3">
                  <TableCell className="text-xs text-white/40">{l.id}</TableCell>
                  <TableCell className="text-sm text-white/80 font-medium">{l.empleado_nombre}</TableCell>
                  <TableCell className="text-sm text-white/60">{TIPO_EGRESO_LABELS[l.tipo_egreso] ?? l.tipo_egreso}</TableCell>
                  <TableCell className="text-sm text-white/60">{fmtDate(l.fecha_egreso)}</TableCell>
                  <TableCell className="text-sm font-semibold text-white text-right">{fmt(l.total_general)}</TableCell>
                  <TableCell>
                    <Badge className={`${badge.cls} text-xs border`}>{badge.label}</Badge>
                  </TableCell>
                  <TableCell>
                    <button onClick={() => setDetalleId(l.id)} className="text-white/30 hover:text-teal-400 transition-colors">
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {modalOpen && (
        <ModalLiquidacion
          onClose={() => setModalOpen(false)}
          onDone={() => qc.invalidateQueries({ queryKey: ["prestaciones-liqlist"] })}
        />
      )}
      {detalleId !== null && (
        <ModalDetalleLiquidacion liqId={detalleId} onClose={() => setDetalleId(null)} />
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function Prestaciones() {
  const { currentUser } = useAuth();

  return (
    <AdminLayout>
      <div className="min-h-screen bg-[#050d1a] text-white">
        {/* Header */}
        <div className="border-b border-white/8 bg-[#060e1c]/80 backdrop-blur-sm px-6 py-5 flex items-center gap-4">
          <div className="w-10 h-10 rounded-2xl bg-teal-500/15 border border-teal-500/25 flex items-center justify-center">
            <Landmark className="w-5 h-5 text-teal-400" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white">Prestaciones Laborales</h1>
            <p className="text-xs text-white/40 mt-0.5">
              Aguinaldo · Bono 14 · Vacaciones · Indemnización · Liquidación — Ley Guatemala
            </p>
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="vacaciones" className="flex flex-col h-full">
          <div className="px-6 pt-4 border-b border-white/8">
            <TabsList className="bg-transparent gap-1 p-0">
              {[
                { value: "vacaciones", label: "Vacaciones", Icon: Palmtree },
                { value: "provisiones", label: "Provisiones", Icon: TrendingUp },
                { value: "liquidaciones", label: "Liquidaciones", Icon: Receipt },
                { value: "config", label: "Configuración", Icon: Settings2 },
              ].map(({ value, label, Icon }) => (
                <TabsTrigger
                  key={value}
                  value={value}
                  className="px-4 py-2 text-xs font-medium rounded-t-xl data-[state=active]:bg-teal-500/15 data-[state=active]:text-teal-300 data-[state=active]:border-b-2 data-[state=active]:border-teal-500 text-white/40 hover:text-white/70 transition-all border-b-2 border-transparent"
                >
                  <Icon className="w-3.5 h-3.5 mr-1.5" />
                  {label}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          <TabsContent value="vacaciones" className="mt-0 flex-1">
            <TabVacaciones />
          </TabsContent>
          <TabsContent value="provisiones" className="mt-0 flex-1">
            <TabProvisiones />
          </TabsContent>
          <TabsContent value="liquidaciones" className="mt-0 flex-1">
            <TabLiquidaciones />
          </TabsContent>
          <TabsContent value="config" className="mt-0 flex-1">
            <TabConfiguracion />
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}
