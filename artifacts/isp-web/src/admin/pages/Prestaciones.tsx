/**
 * Prestaciones.tsx — Módulo de Prestaciones Laborales (Guatemala)
 * Aguinaldo · Bono 14 · Vacaciones · Indemnización · Liquidación Final · Provisiones
 */

import { useState } from "react";
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
  Landmark, Palmtree, Receipt, Settings2, Plus, RefreshCw,
  TrendingUp, Users, CheckCircle2, Clock, ChevronRight,
  Download, Search, FileText, Coins, BookOpen,
  UserX, AlertTriangle, CalendarX, Loader2, Gift,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { AdminLayout } from "@/admin/layout/AdminLayout";
import { useAuth } from "@/contexts/AuthContext";
import VacacionesTab from "@/admin/pages/VacacionesTab";
import { getSessionToken } from "@/lib/httpClient";

// ─── API ──────────────────────────────────────────────────────────────────────

const API = "/api";

function getSession() {
  return getSessionToken();
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

interface LiquidacionItem {
  id: number;
  employee_id: number;
  empleado: string;
  causal_egreso: string;
  fecha_egreso: string;
  total_general: string;
  estado: string;
  created_at: string;
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
  nombreCompleto: string;
  sueldoBase: string;
  fechaIngreso: string;
  estadoLaboral: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number | string | null | undefined) {
  if (n == null || n === "") return "Q0.00";
  const v = parseFloat(String(n));
  if (!isFinite(v)) return "—";
  return `Q${v.toLocaleString("es-GT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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
  confirmada: { label: "Confirmada", cls: "bg-green-500/20 text-green-300 border-green-500/30" },
  activa:     { label: "Activa",     cls: "bg-green-500/20 text-green-300 border-green-500/30" },
  anulada:    { label: "Anulada",    cls: "bg-red-500/20 text-red-300 border-red-500/30" },
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

// ─── Tab: Bono14 / Aguinaldo / Vacaciones histórico ODBC ─────────────────────

interface OdbcEmpleadoRow {
  empl_numero: string;
  nombre_completo: string | null;
  fecha_ingreso: string | null;
  fecha_baja: string | null;
  sueldo_base: string | null;
  total_bono14: string;
  total_aguinaldo: string;
  total_vacaciones: string;
  total_indem: string;
  dias_laborados: string;
  base_bono14_ult: string;
  base_vacas_ult: string;
  periodos_con_data: string;
}

function TabPrestacionesOdbc({ tipo }: { tipo: "bono14" | "aguinaldo" | "vacaciones" }) {
  const [search, setSearch] = useState("");

  const { data, isLoading, isError } = useQuery<{
    ok: boolean;
    resumen: { empleados: string; bono14: string; aguinaldo: string; vacaciones: string; indem: string; filas: string };
    empleados: OdbcEmpleadoRow[];
  }>({
    queryKey: ["prestaciones-resumen-odbc"],
    queryFn: () => apiFetch("/prestaciones/resumen-odbc"),
    staleTime: 60_000,
  });

  const empleados = (data?.empleados ?? []).filter(e =>
    !search ||
    (e.nombre_completo ?? "").toLowerCase().includes(search.toLowerCase()) ||
    e.empl_numero.includes(search)
  );

  const totalArchivo =
    tipo === "bono14"    ? parseFloat(data?.resumen?.bono14 ?? "0") :
    tipo === "aguinaldo" ? parseFloat(data?.resumen?.aguinaldo ?? "0") :
                          parseFloat(data?.resumen?.vacaciones ?? "0");

  const cicloInfo = {
    bono14:    { pagado: "Bono14 2025 (Jul 2024–Jun 2025)", acumulando: "Bono14 2026 (Jul 2025–Jun 2026)",    color: "blue" },
    aguinaldo: { pagado: "Aguinaldo 2025 (Dic 2024–Nov 2025)", acumulando: "Aguinaldo 2026 (Dic 2025–Nov 2026)", color: "purple" },
    vacaciones:{ pagado: "Vacaciones según último pago", acumulando: "Vacaciones acumuladas (May 2025→)",        color: "emerald" },
  }[tipo];

  const getVal = (e: OdbcEmpleadoRow) =>
    tipo === "bono14"    ? parseFloat(e.total_bono14 ?? "0") :
    tipo === "aguinaldo" ? parseFloat(e.total_aguinaldo ?? "0") :
                          parseFloat(e.total_vacaciones ?? "0");

  const colColor = tipo === "bono14" ? "text-blue-300" : tipo === "aguinaldo" ? "text-purple-300" : "text-emerald-300";
  const borderColor = tipo === "bono14" ? "border-blue-500/20 bg-blue-500/5" : tipo === "aguinaldo" ? "border-purple-500/20 bg-purple-500/5" : "border-emerald-500/20 bg-emerald-500/5";

  if (isLoading) return (
    <div className="flex items-center justify-center py-20 text-white/40 text-sm">
      <Loader2 className="w-4 h-4 animate-spin mr-2" /> Cargando datos históricos ODBC…
    </div>
  );

  if (isError || !data?.ok || Number(data?.resumen?.filas ?? 0) === 0) return (
    <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
      <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
        <AlertTriangle className="w-7 h-7 text-amber-400" />
      </div>
      <div>
        <p className="text-sm font-semibold text-white">Sin datos históricos importados</p>
        <p className="text-xs text-white/40 mt-1">
          Importa el archivo <code className="text-amber-300/80">dbo_DetallePrestaciones*.xlsx</code> desde la sección de Importación → Prestaciones ODBC.
        </p>
      </div>
    </div>
  );

  return (
    <div className="space-y-5 px-6 py-5">
      {/* Ciclos */}
      <div className="flex gap-3">
        <div className="flex-1 flex items-center gap-3 bg-emerald-500/5 border border-emerald-500/15 rounded-xl px-4 py-3">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <div>
            <p className="text-[10px] text-white/40">Ciclo cerrado (ya pagado)</p>
            <p className="text-xs font-semibold text-emerald-300">{cicloInfo.pagado}</p>
          </div>
        </div>
        <div className="flex-1 flex items-center gap-3 bg-blue-500/5 border border-blue-500/15 rounded-xl px-4 py-3">
          <Clock className="w-4 h-4 text-blue-400 shrink-0" />
          <div>
            <p className="text-[10px] text-white/40">Ciclo activo (acumulando)</p>
            <p className="text-xs font-semibold text-blue-300">{cicloInfo.acumulando}</p>
          </div>
        </div>
        <div className={`flex items-center gap-3 rounded-xl px-4 py-3 border ${borderColor}`}>
          <Coins className="w-4 h-4 shrink-0 text-white/50" />
          <div>
            <p className="text-[10px] text-white/40">Total acumulado</p>
            <p className={`text-sm font-bold ${colColor}`}>
              Q{totalArchivo.toLocaleString("es-GT", { minimumFractionDigits: 2 })}
            </p>
          </div>
        </div>
      </div>

      {/* Búsqueda */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
        <input
          className="w-full pl-8 pr-3 py-2 text-xs bg-white/3 border border-white/10 rounded-xl text-white placeholder:text-white/25 outline-none focus:border-teal-500/40 transition-colors"
          placeholder="Buscar por nombre o código…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Tabla */}
      <div className="overflow-x-auto rounded-xl border border-white/8">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-white/4 border-b border-white/8 text-white/40">
              <th className="px-3 py-2.5 text-left font-medium">Colaborador</th>
              <th className="px-3 py-2.5 text-left font-medium">Ingreso</th>
              <th className="px-3 py-2.5 text-right font-medium">Salario Base</th>
              <th className="px-3 py-2.5 text-right font-medium">Días Lab.</th>
              <th className="px-3 py-2.5 text-right font-medium">
                {tipo === "bono14" ? "Bono14 acum." : tipo === "aguinaldo" ? "Aguinaldo acum." : "Vacaciones acum."}
              </th>
              <th className="px-3 py-2.5 text-center font-medium">Períodos</th>
              <th className="px-3 py-2.5 text-center font-medium">Estado</th>
            </tr>
          </thead>
          <tbody>
            {empleados.map((e) => {
              const val = getVal(e);
              const activo = !e.fecha_baja;
              return (
                <tr key={e.empl_numero} className="border-b border-white/5 hover:bg-white/3 transition-colors">
                  <td className="px-3 py-2">
                    <p className="font-medium text-white/80 text-[11px]">{e.nombre_completo ?? `#${e.empl_numero}`}</p>
                    <p className="text-[9px] text-white/30 font-mono mt-0.5">#{e.empl_numero}</p>
                  </td>
                  <td className="px-3 py-2 text-white/40 text-[10px]">
                    {e.fecha_ingreso ? new Date(e.fecha_ingreso).toLocaleDateString("es-GT") : "—"}
                  </td>
                  <td className="px-3 py-2 text-right text-white/60 font-mono">
                    {e.sueldo_base ? `Q${parseFloat(e.sueldo_base).toLocaleString("es-GT", { minimumFractionDigits: 2 })}` : "—"}
                  </td>
                  <td className="px-3 py-2 text-right text-white/40">{parseFloat(e.dias_laborados ?? "0").toLocaleString("es-GT")}</td>
                  <td className={`px-3 py-2 text-right font-bold font-mono ${colColor}`}>
                    Q{val.toLocaleString("es-GT", { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-3 py-2 text-center text-white/30">{e.periodos_con_data}</td>
                  <td className="px-3 py-2 text-center">
                    {activo
                      ? <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400">Activo</span>
                      : <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-red-500/15 text-red-400">Inactivo</span>
                    }
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {empleados.length === 0 && (
          <p className="text-center text-xs text-white/30 py-8">Sin resultados para "{search}"</p>
        )}
      </div>

      <p className="text-[10px] text-white/25">
        Mostrando {empleados.length.toLocaleString()} de {(data?.empleados?.length ?? 0).toLocaleString()} colaboradores · Datos: May 2025 – Abr 2026
      </p>
    </div>
  );
}

// ─── Tab: Vacaciones — usa el componente completo de RRHH Eventos ─────────────
// VacacionesTab importado al inicio del archivo

// ─── Tab: Provisiones ─────────────────────────────────────────────────────────

function TabProvisiones() {
  const hoy = new Date().toISOString().slice(0, 10);
  const primerDiaMes = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);

  // Inputs del usuario (cambian mientras escribe/selecciona)
  const [desde, setDesde] = useState(primerDiaMes);
  const [hasta, setHasta] = useState(hoy);

  // Valores confirmados (cambian solo al hacer clic en "Ver Provisiones")
  const [queryDesde, setQueryDesde] = useState<string | null>(null);
  const [queryHasta, setQueryHasta] = useState<string | null>(null);

  const { data: provisionesData, isFetching } = useQuery<{
    rows: Provision[];
    total: number;
    total_por_tipo: Record<string, number>;
    total_general: number;
  }>({
    queryKey: ["prest-provisiones", queryDesde, queryHasta],
    queryFn: () => apiGet(`/prestaciones/provisiones?periodo_desde=${queryDesde}&periodo_hasta=${queryHasta}`),
    enabled: !!queryDesde && !!queryHasta,
  });

  const handleBuscar = () => {
    setQueryDesde(desde);
    setQueryHasta(hasta);
  };

  const TIPO_COLOR: Record<string, string> = {
    aguinaldo: "teal",
    bono14: "blue",
    vacaciones: "green",
    indemnizacion: "orange",
  };

  const inputCls = "bg-[#060e1c] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-teal-500/40 transition-colors";

  const filas = provisionesData?.rows ?? [];
  const totalesPorTipo = provisionesData?.total_por_tipo ?? {};
  const totalGeneral = provisionesData?.total_general ?? 0;

  return (
    <div className="p-6 space-y-6">
      {/* Info banner */}
      <div className="flex items-start gap-3 bg-teal-500/8 border border-teal-500/20 rounded-2xl px-4 py-3">
        <CheckCircle2 className="w-4 h-4 text-teal-400 mt-0.5 shrink-0" />
        <div>
          <p className="text-xs font-semibold text-teal-300">Generación automática</p>
          <p className="text-[11px] text-white/40 mt-0.5">
            Las provisiones se calculan y registran automáticamente cada vez que se cierra una pre-planilla. Aquí puedes consultar el historial por período.
          </p>
        </div>
      </div>

      {/* Filtro de consulta */}
      <div className="bg-white/3 border border-white/8 rounded-2xl p-5">
        <h3 className="text-sm font-semibold text-white/70 mb-4 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-teal-400" /> Consultar Provisiones del Período
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
            variant="ghost"
            onClick={handleBuscar}
            disabled={isFetching}
            className="text-white/70 hover:text-white rounded-xl border border-white/10"
          >
            {isFetching
              ? <><RefreshCw className="w-4 h-4 mr-2 animate-spin" />Cargando…</>
              : <><Search className="w-4 h-4 mr-2" />Ver Provisiones</>}
          </Button>
        </div>
      </div>

      {/* Resumen por tipo (cuando hay datos) */}
      {filas.length > 0 && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {(["aguinaldo", "bono14", "vacaciones", "indemnizacion"] as const).map((tipo) => {
              const color = TIPO_COLOR[tipo] ?? "teal";
              const monto = totalesPorTipo[tipo];
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
          <div className="flex items-center gap-4 px-4 py-3 rounded-xl bg-white/3 border border-white/8">
            <div>
              <span className="text-xs text-white/40">Registros</span>
              <p className="text-lg font-bold text-white">{filas.length}</p>
            </div>
            <Separator orientation="vertical" className="h-8 border-white/10" />
            <div>
              <span className="text-xs text-white/40">Total General</span>
              <p className="text-lg font-bold text-teal-300">{fmt(totalGeneral)}</p>
            </div>
          </div>
        </>
      )}

      {provisionesData && filas.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-white/25 gap-2">
          <TrendingUp className="w-8 h-8" />
          <p className="text-sm">Sin provisiones registradas para este período</p>
          <p className="text-xs text-white/20">Las provisiones se generan al cerrar la pre-planilla</p>
        </div>
      )}

      {/* Detalle tabla */}
      {filas.length > 0 && (
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
              {filas.slice(0, 100).map((p, i) => (
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
                <p><span className="text-white/30">Egreso:</span> {TIPO_EGRESO_LABELS[liq.causal_egreso] ?? liq.causal_egreso} · {fmtDate(liq.fecha_egreso)}</p>
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
            {(liq?.estado === "confirmada" || liq?.estado === "activa") && (
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
  const [filtroEstado, setFiltroEstado] = useState<string>("todas");

  const { data, isLoading } = useQuery<{ rows: LiquidacionItem[]; total: number }>({
    queryKey: ["prestaciones-liqlist"],
    queryFn: () => apiGet("/prestaciones/liquidaciones"),
    staleTime: 30_000,
  });

  const todas = data?.rows ?? [];

  // Estadísticas rápidas — "confirmada" es el estado activo en la BD
  const activas = todas.filter((l) => l.estado === "confirmada" || l.estado === "activa");
  const totalPagado = activas.reduce((s, l) => s + parseFloat(String(l.total_general) || "0"), 0);

  const liqFilt = todas.filter((l) => {
    const matchNombre = !busEmp || (l.empleado ?? "").toLowerCase().includes(busEmp.toLowerCase());
    const matchEstado = filtroEstado === "todas" || l.estado === filtroEstado;
    return matchNombre && matchEstado;
  });

  return (
    <div className="p-6 space-y-6">

      {/* Banner informativo */}
      <div className="flex items-start gap-3 bg-orange-500/8 border border-orange-500/20 rounded-2xl px-4 py-3">
        <UserX className="w-4 h-4 text-orange-400 mt-0.5 shrink-0" />
        <div>
          <p className="text-xs font-semibold text-orange-300">Módulo de Bajas y Liquidaciones</p>
          <p className="text-[11px] text-white/40 mt-0.5">
            Aquí se registra la baja formal de un colaborador. Al confirmar, el sistema calcula su liquidación según la ley guatemalteca, actualiza su estado a <span className="text-white/60">BAJA</span> y guarda el registro para auditoría.
          </p>
        </div>
      </div>

      {/* Tarjetas de resumen */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white/3 border border-white/8 rounded-2xl p-4">
          <p className="text-[11px] text-white/40 uppercase tracking-wide">Total Bajas</p>
          <p className="text-2xl font-bold text-white mt-1">{activas.length}</p>
          <p className="text-[10px] text-white/30 mt-0.5">registros activos</p>
        </div>
        <div className="bg-white/3 border border-white/8 rounded-2xl p-4">
          <p className="text-[11px] text-white/40 uppercase tracking-wide">Total Pagado</p>
          <p className="text-xl font-bold text-orange-300 mt-1">{fmt(totalPagado)}</p>
          <p className="text-[10px] text-white/30 mt-0.5">en liquidaciones activas</p>
        </div>
        <div className="bg-white/3 border border-white/8 rounded-2xl p-4">
          <p className="text-[11px] text-white/40 uppercase tracking-wide">Renuncias</p>
          <p className="text-2xl font-bold text-white mt-1">{activas.filter(l => l.causal_egreso === "renuncia").length}</p>
          <p className="text-[10px] text-white/30 mt-0.5">por renuncia voluntaria</p>
        </div>
        <div className="bg-white/3 border border-white/8 rounded-2xl p-4">
          <p className="text-[11px] text-white/40 uppercase tracking-wide">Despidos</p>
          <p className="text-2xl font-bold text-white mt-1">{activas.filter(l => l.causal_egreso?.includes("despido")).length}</p>
          <p className="text-[10px] text-white/30 mt-0.5">justificados e injustificados</p>
        </div>
      </div>

      {/* Barra de búsqueda y acción */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
            <Input
              className="bg-[#060e1c] border border-white/10 rounded-xl pl-8 pr-3 py-2 text-sm text-white outline-none focus:border-orange-500/40"
              placeholder="Buscar colaborador…"
              value={busEmp}
              onChange={(e) => setBusEmp(e.target.value)}
            />
          </div>
          <select
            value={filtroEstado}
            onChange={(e) => setFiltroEstado(e.target.value)}
            className="bg-[#060e1c] border border-white/10 rounded-xl px-3 py-2 text-sm text-white/70 outline-none focus:border-orange-500/40 appearance-none"
          >
            <option value="todas">Todas</option>
            <option value="confirmada">Confirmadas</option>
            <option value="anulada">Anuladas</option>
          </select>
        </div>
        <Button
          onClick={() => setModalOpen(true)}
          className="bg-orange-600 hover:bg-orange-500 text-white rounded-xl font-semibold"
        >
          <UserX className="w-4 h-4 mr-2" /> Dar de Baja a Empleado
        </Button>
      </div>

      {/* Historial de bajas */}
      <div className="rounded-2xl border border-white/8 overflow-hidden">
        <div className="px-4 py-3 border-b border-white/8 flex items-center gap-2">
          <CalendarX className="w-3.5 h-3.5 text-white/30" />
          <span className="text-xs font-semibold text-white/50 uppercase tracking-wide">Historial de Bajas</span>
          {liqFilt.length > 0 && (
            <Badge className="ml-auto bg-white/5 text-white/40 border-white/10 text-[10px]">{liqFilt.length} registro{liqFilt.length !== 1 ? "s" : ""}</Badge>
          )}
        </div>
        <Table>
          <TableHeader>
            <TableRow className="border-white/8 hover:bg-transparent">
              <TableHead className="text-white/40 text-xs">#</TableHead>
              <TableHead className="text-white/40 text-xs">Colaborador</TableHead>
              <TableHead className="text-white/40 text-xs">Motivo de Egreso</TableHead>
              <TableHead className="text-white/40 text-xs">Fecha de Baja</TableHead>
              <TableHead className="text-white/40 text-xs text-right">Liquidación</TableHead>
              <TableHead className="text-white/40 text-xs">Estado</TableHead>
              <TableHead className="text-white/40 text-xs" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow><TableCell colSpan={7} className="text-center text-white/30 text-xs py-10">Cargando…</TableCell></TableRow>
            )}
            {!isLoading && liqFilt.length === 0 && (
              <TableRow><TableCell colSpan={7} className="text-center text-white/25 text-xs py-14">
                <div className="flex flex-col items-center gap-2">
                  <UserX className="w-7 h-7 text-white/15" />
                  <span className="text-white/30">No hay bajas registradas</span>
                  <button
                    onClick={() => setModalOpen(true)}
                    className="mt-2 text-orange-400 hover:text-orange-300 text-xs underline underline-offset-2 transition-colors"
                  >
                    Registrar primera baja
                  </button>
                </div>
              </TableCell></TableRow>
            )}
            {liqFilt.map((l) => {
              const badge = ESTADO_BADGE[l.estado] ?? { label: l.estado, cls: "bg-white/10 text-white/50" };
              return (
                <TableRow key={l.id} className="border-white/5 hover:bg-white/3 cursor-pointer" onClick={() => setDetalleId(l.id)}>
                  <TableCell className="text-xs text-white/40">{l.id}</TableCell>
                  <TableCell className="text-sm text-white/80 font-medium">{l.empleado}</TableCell>
                  <TableCell className="text-sm text-white/60">{TIPO_EGRESO_LABELS[l.causal_egreso] ?? l.causal_egreso}</TableCell>
                  <TableCell className="text-sm text-white/60">{fmtDate(l.fecha_egreso)}</TableCell>
                  <TableCell className="text-sm font-semibold text-orange-300 text-right">{fmt(l.total_general)}</TableCell>
                  <TableCell>
                    <Badge className={`${badge.cls} text-xs border`}>{badge.label}</Badge>
                  </TableCell>
                  <TableCell>
                    <ChevronRight className="w-4 h-4 text-white/20 group-hover:text-teal-400" />
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
          onDone={() => {
            qc.invalidateQueries({ queryKey: ["prestaciones-liqlist"] });
            qc.invalidateQueries({ queryKey: ["employees-activos"] });
          }}
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
        <Tabs defaultValue="bono14" className="flex flex-col h-full">
          <div className="px-6 pt-4 border-b border-white/8 overflow-x-auto">
            <TabsList className="bg-transparent gap-1 p-0 flex-nowrap">
              {[
                { value: "bono14",      label: "Bono 14",        Icon: Gift,       color: "data-[state=active]:text-blue-300 data-[state=active]:border-blue-500 data-[state=active]:bg-blue-500/10" },
                { value: "aguinaldo",   label: "Aguinaldo",      Icon: Gift,       color: "data-[state=active]:text-purple-300 data-[state=active]:border-purple-500 data-[state=active]:bg-purple-500/10" },
                { value: "vacaciones",  label: "Vacaciones",     Icon: Palmtree,   color: "data-[state=active]:text-teal-300 data-[state=active]:border-teal-500 data-[state=active]:bg-teal-500/10" },
                { value: "provisiones", label: "Provisiones",    Icon: TrendingUp, color: "data-[state=active]:text-teal-300 data-[state=active]:border-teal-500 data-[state=active]:bg-teal-500/10" },
                { value: "liquidaciones",label: "Liquidaciones", Icon: Receipt,    color: "data-[state=active]:text-teal-300 data-[state=active]:border-teal-500 data-[state=active]:bg-teal-500/10" },
                { value: "config",      label: "Configuración",  Icon: Settings2,  color: "data-[state=active]:text-teal-300 data-[state=active]:border-teal-500 data-[state=active]:bg-teal-500/10" },
              ].map(({ value, label, Icon, color }) => (
                <TabsTrigger
                  key={value}
                  value={value}
                  className={`px-4 py-2 text-xs font-medium rounded-t-xl data-[state=active]:border-b-2 text-white/40 hover:text-white/70 transition-all border-b-2 border-transparent whitespace-nowrap ${color}`}
                >
                  <Icon className="w-3.5 h-3.5 mr-1.5" />
                  {label}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          <TabsContent value="bono14" className="mt-0 flex-1">
            <TabPrestacionesOdbc tipo="bono14" />
          </TabsContent>
          <TabsContent value="aguinaldo" className="mt-0 flex-1">
            <TabPrestacionesOdbc tipo="aguinaldo" />
          </TabsContent>
          <TabsContent value="vacaciones" className="mt-0 flex-1 px-6 pt-4">
            <VacacionesTab />
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
