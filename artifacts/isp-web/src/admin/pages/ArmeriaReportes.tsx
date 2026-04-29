import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Calendar, Download, Loader2, Shield, ArrowRightLeft,
  Target, RefreshCw, Package, FileText, Search,
} from "lucide-react";

const API = "/api";
const getSession = () => sessionStorage.getItem("isp_admin_session_v2") || "";

async function apiFetch<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { "x-isp-session": getSession() } });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw e; }
  return res.json();
}

// Fecha en formato YYYY-MM-DD según la zona horaria de Guatemala (UTC-6, sin DST).
const _gtFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Guatemala",
  year: "numeric", month: "2-digit", day: "2-digit",
});
function hoy() { return _gtFmt.format(new Date()); }
function haceXDias(d: number) {
  const n = new Date(); n.setUTCDate(n.getUTCDate() - d);
  return _gtFmt.format(n);
}
function fmtFecha(s: string | null) {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("es-GT", { day: "2-digit", month: "short", year: "numeric" });
}
function fmtDatetime(s: string | null) {
  if (!s) return "—";
  return new Date(s).toLocaleString("es-GT", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

const TIPO_LABELS: Record<string, string> = {
  pistola: "Pistola", revolver: "Revólver", escopeta: "Escopeta", rifle: "Rifle", otro: "Otro",
};
const ORIGEN_LABELS: Record<string, string> = {
  turno_normal:       "Turno normal",
  relevo:             "Relevo",
  relevo_ausencia:    "Relevo ausencia",
  cobertura_parcial:  "Cob. parcial",
  cobertura_supervisor: "Cob. supervisor",
  cobertura_jefe:     "Cob. jefe",
  manual:             "Manual",
  automatico_turno:   "Auto turno",
  sincronizacion:     "Sincronización",
};

// ─── Helper: descargar CSV en el navegador ─────────────────────────────────
function descargarCSV(filename: string, columnas: { key: string; label: string }[], filas: any[]) {
  const head = columnas.map(c => `"${c.label}"`).join(",");
  const body = filas.map(r =>
    columnas.map(c => {
      const val = r[c.key];
      if (val === null || val === undefined) return "";
      const s = String(val).replace(/"/g, '""');
      return `"${s}"`;
    }).join(",")
  ).join("\n");
  const csv = "\uFEFF" + head + "\n" + body; // BOM para Excel
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ─── Sub-tab: Custodia diaria ─────────────────────────────────────────────
interface RegCustodia {
  id: number; arma_codigo: string; serie: string | null; tipo: string;
  marca: string | null; modelo: string | null; calibre: string | null;
  numero_tenencia: string | null;
  empleado_nombre: string | null; empleado_dpi: string | null;
  puesto_nombre: string | null; cliente_nombre: string | null;
  fecha_inicio: string; fecha_fin: string | null; tipo_origen: string;
}
function SubCustodia() {
  const [fecha, setFecha] = useState(hoy());
  const [search, setSearch] = useState("");
  const { data, isLoading, refetch } = useQuery<{ fecha: string; total: number; registros: RegCustodia[] }>({
    queryKey: ["arm-rep-custodia", fecha],
    queryFn: () => apiFetch(`${API}/armeria/reportes/custodia-diaria?fecha=${fecha}`),
  });
  const filtered = (data?.registros ?? []).filter(r =>
    !search
    || (r.arma_codigo ?? "").toLowerCase().includes(search.toLowerCase())
    || (r.serie ?? "").toLowerCase().includes(search.toLowerCase())
    || (r.empleado_nombre ?? "").toLowerCase().includes(search.toLowerCase())
    || (r.cliente_nombre ?? "").toLowerCase().includes(search.toLowerCase())
    || (r.puesto_nombre ?? "").toLowerCase().includes(search.toLowerCase())
  );
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3 p-3 bg-gray-800/40 border border-gray-700/50 rounded-lg">
        <div>
          <label className="block text-xs text-gray-400 mb-1">Fecha</label>
          <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} max={hoy()}
            className="bg-gray-900/60 border border-gray-700 rounded px-2 py-1.5 text-sm text-white" />
        </div>
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Filtrar arma, agente, puesto..."
            className="w-full bg-gray-900/60 border border-gray-700 rounded pl-9 pr-3 py-1.5 text-sm text-white placeholder-gray-500" />
        </div>
        <button onClick={() => refetch()} className="bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-600/40 rounded px-3 py-1.5 text-sm flex items-center gap-1.5">
          <RefreshCw className="w-3.5 h-3.5" /> Refrescar
        </button>
        <button disabled={filtered.length === 0}
          onClick={() => descargarCSV(`custodia-diaria-${fecha}.csv`, [
            { key: "arma_codigo", label: "Código" },
            { key: "tipo", label: "Tipo" },
            { key: "marca", label: "Marca" },
            { key: "modelo", label: "Modelo" },
            { key: "calibre", label: "Calibre" },
            { key: "serie", label: "Serie" },
            { key: "numero_tenencia", label: "Tenencia" },
            { key: "empleado_nombre", label: "Custodio" },
            { key: "empleado_dpi", label: "DPI" },
            { key: "cliente_nombre", label: "Cliente" },
            { key: "puesto_nombre", label: "Puesto" },
            { key: "fecha_inicio", label: "Desde" },
            { key: "fecha_fin", label: "Hasta" },
            { key: "tipo_origen", label: "Origen" },
          ], filtered)}
          className="bg-emerald-600/20 hover:bg-emerald-600/30 disabled:opacity-40 disabled:cursor-not-allowed text-emerald-300 border border-emerald-600/40 rounded px-3 py-1.5 text-sm flex items-center gap-1.5">
          <Download className="w-3.5 h-3.5" /> Exportar CSV
        </button>
        <span className="ml-auto text-xs text-gray-400">
          {data ? `${filtered.length} de ${data.total} registros` : ""}
        </span>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-blue-400" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <Shield className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>Sin custodias activas en {fmtFecha(fecha)}.</p>
        </div>
      ) : (
        <div className="border border-gray-700/50 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-800/60 text-xs uppercase text-gray-400">
              <tr>
                <th className="px-3 py-2 text-left">Arma</th>
                <th className="px-3 py-2 text-left">Custodio</th>
                <th className="px-3 py-2 text-left">Cliente · Puesto</th>
                <th className="px-3 py-2 text-left">Desde</th>
                <th className="px-3 py-2 text-left">Hasta</th>
                <th className="px-3 py-2 text-left">Origen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700/40">
              {filtered.map(r => (
                <tr key={r.id} className="hover:bg-gray-800/30">
                  <td className="px-3 py-2">
                    <div className="text-white font-mono text-xs">{r.arma_codigo}</div>
                    <div className="text-gray-500 text-[11px]">{TIPO_LABELS[r.tipo] ?? r.tipo} {r.calibre ?? ""} {r.serie ? `· ${r.serie}` : ""}</div>
                  </td>
                  <td className="px-3 py-2">
                    <div className="text-gray-200">{r.empleado_nombre ?? "—"}</div>
                    {r.empleado_dpi && <div className="text-gray-500 text-[11px]">DPI {r.empleado_dpi}</div>}
                  </td>
                  <td className="px-3 py-2">
                    <div className="text-gray-200">{r.cliente_nombre ?? "—"}</div>
                    <div className="text-gray-500 text-[11px]">{r.puesto_nombre ?? "—"}</div>
                  </td>
                  <td className="px-3 py-2 text-gray-300 text-xs">{fmtDatetime(r.fecha_inicio)}</td>
                  <td className="px-3 py-2 text-xs">
                    {r.fecha_fin
                      ? <span className="text-gray-300">{fmtDatetime(r.fecha_fin)}</span>
                      : <span className="text-teal-400 bg-teal-400/10 border border-teal-400/20 px-2 py-0.5 rounded-full">Vigente</span>}
                  </td>
                  <td className="px-3 py-2 text-blue-300 text-xs">{ORIGEN_LABELS[r.tipo_origen] ?? r.tipo_origen}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Sub-tab: Movimientos ──────────────────────────────────────────────────
interface RegMov {
  evento_id: number; evento: string; fecha_evento: string;
  arma_id: number; arma_codigo: string; serie: string | null; tipo: string;
  marca: string | null; modelo: string | null;
  empleado_nombre: string | null;
  puesto_nombre: string | null; cliente_nombre: string | null;
  tipo_origen: string; registrado_por: string | null;
}
function SubMovimientos() {
  const [desde, setDesde] = useState(haceXDias(7));
  const [hasta, setHasta] = useState(hoy());
  const { data, isLoading, refetch } = useQuery<{ desde: string; hasta: string; total: number; registros: RegMov[] }>({
    queryKey: ["arm-rep-mov", desde, hasta],
    queryFn: () => apiFetch(`${API}/armeria/reportes/movimientos?desde=${desde}&hasta=${hasta}`),
  });
  const filas = data?.registros ?? [];
  const altas   = filas.filter(f => f.evento === "alta_custodia").length;
  const cierres = filas.filter(f => f.evento === "cierre_custodia").length;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3 p-3 bg-gray-800/40 border border-gray-700/50 rounded-lg">
        <div>
          <label className="block text-xs text-gray-400 mb-1">Desde</label>
          <input type="date" value={desde} onChange={e => setDesde(e.target.value)} max={hasta}
            className="bg-gray-900/60 border border-gray-700 rounded px-2 py-1.5 text-sm text-white" />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Hasta</label>
          <input type="date" value={hasta} onChange={e => setHasta(e.target.value)} min={desde} max={hoy()}
            className="bg-gray-900/60 border border-gray-700 rounded px-2 py-1.5 text-sm text-white" />
        </div>
        <button onClick={() => refetch()} className="bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-600/40 rounded px-3 py-1.5 text-sm flex items-center gap-1.5">
          <RefreshCw className="w-3.5 h-3.5" /> Refrescar
        </button>
        <button disabled={filas.length === 0}
          onClick={() => descargarCSV(`movimientos-armas-${desde}_a_${hasta}.csv`, [
            { key: "fecha_evento", label: "Fecha" },
            { key: "evento", label: "Evento" },
            { key: "arma_codigo", label: "Código" },
            { key: "tipo", label: "Tipo" },
            { key: "serie", label: "Serie" },
            { key: "empleado_nombre", label: "Agente" },
            { key: "cliente_nombre", label: "Cliente" },
            { key: "puesto_nombre", label: "Puesto" },
            { key: "tipo_origen", label: "Origen" },
            { key: "registrado_por", label: "Registrado por" },
          ], filas)}
          className="bg-emerald-600/20 hover:bg-emerald-600/30 disabled:opacity-40 disabled:cursor-not-allowed text-emerald-300 border border-emerald-600/40 rounded px-3 py-1.5 text-sm flex items-center gap-1.5">
          <Download className="w-3.5 h-3.5" /> Exportar CSV
        </button>
        <div className="ml-auto flex items-center gap-3 text-xs">
          <span className="text-emerald-300">{altas} altas</span>
          <span className="text-amber-300">{cierres} cierres</span>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-blue-400" /></div>
      ) : filas.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <ArrowRightLeft className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>Sin movimientos en el rango {fmtFecha(desde)} → {fmtFecha(hasta)}.</p>
        </div>
      ) : (
        <div className="border border-gray-700/50 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-800/60 text-xs uppercase text-gray-400">
              <tr>
                <th className="px-3 py-2 text-left">Fecha</th>
                <th className="px-3 py-2 text-left">Evento</th>
                <th className="px-3 py-2 text-left">Arma</th>
                <th className="px-3 py-2 text-left">Agente</th>
                <th className="px-3 py-2 text-left">Cliente · Puesto</th>
                <th className="px-3 py-2 text-left">Origen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700/40">
              {filas.map((r, i) => (
                <tr key={`${r.evento}-${r.evento_id}-${i}`} className="hover:bg-gray-800/30">
                  <td className="px-3 py-2 text-gray-300 text-xs whitespace-nowrap">{fmtDatetime(r.fecha_evento)}</td>
                  <td className="px-3 py-2">
                    {r.evento === "alta_custodia"
                      ? <span className="text-emerald-300 bg-emerald-400/10 border border-emerald-400/20 px-2 py-0.5 rounded-full text-xs">Alta</span>
                      : <span className="text-amber-300 bg-amber-400/10 border border-amber-400/20 px-2 py-0.5 rounded-full text-xs">Cierre</span>}
                  </td>
                  <td className="px-3 py-2">
                    <div className="text-white font-mono text-xs">{r.arma_codigo}</div>
                    <div className="text-gray-500 text-[11px]">{TIPO_LABELS[r.tipo] ?? r.tipo} {r.serie ? `· ${r.serie}` : ""}</div>
                  </td>
                  <td className="px-3 py-2 text-gray-200">{r.empleado_nombre ?? "—"}</td>
                  <td className="px-3 py-2">
                    <div className="text-gray-200 text-xs">{r.cliente_nombre ?? "—"}</div>
                    <div className="text-gray-500 text-[11px]">{r.puesto_nombre ?? "—"}</div>
                  </td>
                  <td className="px-3 py-2 text-blue-300 text-xs">{ORIGEN_LABELS[r.tipo_origen] ?? r.tipo_origen}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Sub-tab: Munición ─────────────────────────────────────────────────────
interface RegMunicion {
  id: number; descripcion: string; cantidad_asignada: number; activo: boolean;
  created_at: string; updated_at: string;
  puesto_nombre: string | null; cliente_nombre: string | null;
}
function SubMunicion() {
  const [desde, setDesde] = useState(haceXDias(30));
  const [hasta, setHasta] = useState(hoy());
  const { data, isLoading, refetch } = useQuery<{ desde: string; hasta: string; total: number; registros: RegMunicion[] }>({
    queryKey: ["arm-rep-municion", desde, hasta],
    queryFn: () => apiFetch(`${API}/armeria/reportes/municion?desde=${desde}&hasta=${hasta}`),
  });
  const filas = data?.registros ?? [];
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3 p-3 bg-gray-800/40 border border-gray-700/50 rounded-lg">
        <div>
          <label className="block text-xs text-gray-400 mb-1">Desde</label>
          <input type="date" value={desde} onChange={e => setDesde(e.target.value)} max={hasta}
            className="bg-gray-900/60 border border-gray-700 rounded px-2 py-1.5 text-sm text-white" />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Hasta</label>
          <input type="date" value={hasta} onChange={e => setHasta(e.target.value)} min={desde} max={hoy()}
            className="bg-gray-900/60 border border-gray-700 rounded px-2 py-1.5 text-sm text-white" />
        </div>
        <button onClick={() => refetch()} className="bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-600/40 rounded px-3 py-1.5 text-sm flex items-center gap-1.5">
          <RefreshCw className="w-3.5 h-3.5" /> Refrescar
        </button>
        <button disabled={filas.length === 0}
          onClick={() => descargarCSV(`municion-${desde}_a_${hasta}.csv`, [
            { key: "updated_at", label: "Última actualización" },
            { key: "descripcion", label: "Descripción" },
            { key: "cantidad_asignada", label: "Cantidad" },
            { key: "cliente_nombre", label: "Cliente" },
            { key: "puesto_nombre", label: "Puesto" },
            { key: "activo", label: "Activo" },
          ], filas)}
          className="bg-emerald-600/20 hover:bg-emerald-600/30 disabled:opacity-40 disabled:cursor-not-allowed text-emerald-300 border border-emerald-600/40 rounded px-3 py-1.5 text-sm flex items-center gap-1.5">
          <Download className="w-3.5 h-3.5" /> Exportar CSV
        </button>
        <span className="ml-auto text-xs text-gray-400">{filas.length} registro(s)</span>
      </div>
      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-blue-400" /></div>
      ) : filas.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <Target className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>Sin asignaciones de munición creadas o modificadas en el rango.</p>
        </div>
      ) : (
        <div className="border border-gray-700/50 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-800/60 text-xs uppercase text-gray-400">
              <tr>
                <th className="px-3 py-2 text-left">Última actualización</th>
                <th className="px-3 py-2 text-left">Descripción</th>
                <th className="px-3 py-2 text-right">Cantidad</th>
                <th className="px-3 py-2 text-left">Cliente · Puesto</th>
                <th className="px-3 py-2 text-left">Activo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700/40">
              {filas.map(r => (
                <tr key={r.id} className="hover:bg-gray-800/30">
                  <td className="px-3 py-2 text-gray-300 text-xs whitespace-nowrap">{fmtDatetime(r.updated_at)}</td>
                  <td className="px-3 py-2 text-gray-200">{r.descripcion}</td>
                  <td className="px-3 py-2 text-right font-mono text-amber-300">{r.cantidad_asignada}</td>
                  <td className="px-3 py-2">
                    <div className="text-gray-200 text-xs">{r.cliente_nombre ?? "—"}</div>
                    <div className="text-gray-500 text-[11px]">{r.puesto_nombre ?? "—"}</div>
                  </td>
                  <td className="px-3 py-2">
                    {r.activo
                      ? <span className="text-emerald-300 bg-emerald-400/10 border border-emerald-400/20 px-2 py-0.5 rounded-full text-xs">Sí</span>
                      : <span className="text-gray-400 bg-gray-700/40 border border-gray-600/40 px-2 py-0.5 rounded-full text-xs">No</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Sub-tab: Sincronizaciones ─────────────────────────────────────────────
interface RegSync {
  id: number; fecha: string; tipo_activo: string;
  activo_codigo: string; activo_id: number;
  custodio_anterior_nombre: string | null;
  custodio_nuevo_nombre: string | null;
  origen: string; usuario: string | null; creado_en: string;
}
function SubSincronizaciones() {
  const [desde, setDesde] = useState(haceXDias(30));
  const [hasta, setHasta] = useState(hoy());
  const { data, isLoading, refetch } = useQuery<{ desde: string; hasta: string; total: number; registros: RegSync[] }>({
    queryKey: ["arm-rep-sync", desde, hasta],
    queryFn: () => apiFetch(`${API}/armeria/reportes/sincronizaciones?desde=${desde}&hasta=${hasta}`),
  });
  const filas = data?.registros ?? [];
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3 p-3 bg-gray-800/40 border border-gray-700/50 rounded-lg">
        <div>
          <label className="block text-xs text-gray-400 mb-1">Desde</label>
          <input type="date" value={desde} onChange={e => setDesde(e.target.value)} max={hasta}
            className="bg-gray-900/60 border border-gray-700 rounded px-2 py-1.5 text-sm text-white" />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Hasta</label>
          <input type="date" value={hasta} onChange={e => setHasta(e.target.value)} min={desde} max={hoy()}
            className="bg-gray-900/60 border border-gray-700 rounded px-2 py-1.5 text-sm text-white" />
        </div>
        <button onClick={() => refetch()} className="bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-600/40 rounded px-3 py-1.5 text-sm flex items-center gap-1.5">
          <RefreshCw className="w-3.5 h-3.5" /> Refrescar
        </button>
        <button disabled={filas.length === 0}
          onClick={() => descargarCSV(`sincronizaciones-${desde}_a_${hasta}.csv`, [
            { key: "creado_en", label: "Fecha sync" },
            { key: "fecha", label: "Día efectivo" },
            { key: "activo_codigo", label: "Arma" },
            { key: "custodio_anterior_nombre", label: "Custodio anterior" },
            { key: "custodio_nuevo_nombre", label: "Custodio nuevo" },
            { key: "origen", label: "Origen" },
            { key: "usuario", label: "Usuario" },
          ], filas)}
          className="bg-emerald-600/20 hover:bg-emerald-600/30 disabled:opacity-40 disabled:cursor-not-allowed text-emerald-300 border border-emerald-600/40 rounded px-3 py-1.5 text-sm flex items-center gap-1.5">
          <Download className="w-3.5 h-3.5" /> Exportar CSV
        </button>
        <span className="ml-auto text-xs text-gray-400">{filas.length} sincronización(es)</span>
      </div>
      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-blue-400" /></div>
      ) : filas.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <RefreshCw className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>Sin sincronizaciones registradas en el rango.</p>
        </div>
      ) : (
        <div className="border border-gray-700/50 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-800/60 text-xs uppercase text-gray-400">
              <tr>
                <th className="px-3 py-2 text-left">Sync</th>
                <th className="px-3 py-2 text-left">Día</th>
                <th className="px-3 py-2 text-left">Arma</th>
                <th className="px-3 py-2 text-left">Anterior → Nuevo</th>
                <th className="px-3 py-2 text-left">Origen</th>
                <th className="px-3 py-2 text-left">Usuario</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700/40">
              {filas.map(r => (
                <tr key={r.id} className="hover:bg-gray-800/30">
                  <td className="px-3 py-2 text-gray-300 text-xs whitespace-nowrap">{fmtDatetime(r.creado_en)}</td>
                  <td className="px-3 py-2 text-gray-300 text-xs">{fmtFecha(r.fecha)}</td>
                  <td className="px-3 py-2 text-white font-mono text-xs">{r.activo_codigo}</td>
                  <td className="px-3 py-2 text-xs">
                    <span className="text-gray-400">{r.custodio_anterior_nombre ?? "— sin custodio —"}</span>
                    <span className="text-gray-600 mx-1">→</span>
                    <span className="text-emerald-300">{r.custodio_nuevo_nombre ?? "— sin custodio —"}</span>
                  </td>
                  <td className="px-3 py-2 text-blue-300 text-xs">{r.origen}</td>
                  <td className="px-3 py-2 text-gray-300 text-xs">{r.usuario ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Sub-tab: Inventario en fecha pasada ───────────────────────────────────
interface RegInventario {
  id: number; codigo: string; serie: string | null; tipo: string;
  marca: string | null; modelo: string | null; calibre: string | null;
  estado: string; activo: boolean;
  custodio_id: number | null; custodio_nombre: string | null;
  puesto_nombre: string | null; cliente_nombre: string | null;
  numero_tenencia: string | null;
}
function SubInventario() {
  const [fecha, setFecha] = useState(hoy());
  const [search, setSearch] = useState("");
  const { data, isLoading, refetch } = useQuery<{
    fecha: string;
    totales: { total: number; asignadas: number; sin_custodio: number; en_mantenimiento: number; baja: number };
    registros: RegInventario[];
  }>({
    queryKey: ["arm-rep-inv", fecha],
    queryFn: () => apiFetch(`${API}/armeria/reportes/inventario?fecha=${fecha}`),
  });
  const filas = (data?.registros ?? []).filter(r =>
    !search
    || (r.codigo ?? "").toLowerCase().includes(search.toLowerCase())
    || (r.serie ?? "").toLowerCase().includes(search.toLowerCase())
    || (r.custodio_nombre ?? "").toLowerCase().includes(search.toLowerCase())
    || (r.cliente_nombre ?? "").toLowerCase().includes(search.toLowerCase())
  );
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3 p-3 bg-gray-800/40 border border-gray-700/50 rounded-lg">
        <div>
          <label className="block text-xs text-gray-400 mb-1">Fecha del inventario</label>
          <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} max={hoy()}
            className="bg-gray-900/60 border border-gray-700 rounded px-2 py-1.5 text-sm text-white" />
        </div>
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Filtrar arma, custodio, cliente..."
            className="w-full bg-gray-900/60 border border-gray-700 rounded pl-9 pr-3 py-1.5 text-sm text-white placeholder-gray-500" />
        </div>
        <button onClick={() => refetch()} className="bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-600/40 rounded px-3 py-1.5 text-sm flex items-center gap-1.5">
          <RefreshCw className="w-3.5 h-3.5" /> Refrescar
        </button>
        <button disabled={filas.length === 0}
          onClick={() => descargarCSV(`inventario-${fecha}.csv`, [
            { key: "codigo", label: "Código" },
            { key: "tipo", label: "Tipo" },
            { key: "marca", label: "Marca" },
            { key: "modelo", label: "Modelo" },
            { key: "calibre", label: "Calibre" },
            { key: "serie", label: "Serie" },
            { key: "numero_tenencia", label: "Tenencia" },
            { key: "estado", label: "Estado" },
            { key: "custodio_nombre", label: "Custodio" },
            { key: "cliente_nombre", label: "Cliente" },
            { key: "puesto_nombre", label: "Puesto" },
          ], filas)}
          className="bg-emerald-600/20 hover:bg-emerald-600/30 disabled:opacity-40 disabled:cursor-not-allowed text-emerald-300 border border-emerald-600/40 rounded px-3 py-1.5 text-sm flex items-center gap-1.5">
          <Download className="w-3.5 h-3.5" /> Exportar CSV
        </button>
      </div>

      {data && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          <div className="bg-gray-800/40 border border-gray-700/50 rounded-lg p-3">
            <div className="text-[11px] text-gray-400 uppercase">Total</div>
            <div className="text-2xl font-bold text-white">{data.totales.total}</div>
          </div>
          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-3">
            <div className="text-[11px] text-emerald-300 uppercase">Asignadas</div>
            <div className="text-2xl font-bold text-emerald-300">{data.totales.asignadas}</div>
          </div>
          <div className="bg-gray-700/30 border border-gray-600/40 rounded-lg p-3">
            <div className="text-[11px] text-gray-300 uppercase">Sin custodio</div>
            <div className="text-2xl font-bold text-gray-200">{data.totales.sin_custodio}</div>
          </div>
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3">
            <div className="text-[11px] text-yellow-300 uppercase">Mantenim.</div>
            <div className="text-2xl font-bold text-yellow-300">{data.totales.en_mantenimiento}</div>
          </div>
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
            <div className="text-[11px] text-red-300 uppercase">Baja</div>
            <div className="text-2xl font-bold text-red-300">{data.totales.baja}</div>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-blue-400" /></div>
      ) : filas.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <Package className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>Sin armas registradas al {fmtFecha(fecha)}.</p>
        </div>
      ) : (
        <div className="border border-gray-700/50 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-800/60 text-xs uppercase text-gray-400">
              <tr>
                <th className="px-3 py-2 text-left">Arma</th>
                <th className="px-3 py-2 text-left">Estado</th>
                <th className="px-3 py-2 text-left">Custodio</th>
                <th className="px-3 py-2 text-left">Cliente · Puesto</th>
                <th className="px-3 py-2 text-left">Tenencia</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700/40">
              {filas.map(r => (
                <tr key={r.id} className="hover:bg-gray-800/30">
                  <td className="px-3 py-2">
                    <div className="text-white font-mono text-xs">{r.codigo}</div>
                    <div className="text-gray-500 text-[11px]">{TIPO_LABELS[r.tipo] ?? r.tipo} {r.calibre ?? ""} {r.serie ? `· ${r.serie}` : ""}</div>
                  </td>
                  <td className="px-3 py-2 text-xs">
                    <span className={
                      r.estado === "activo" ? "text-teal-300 bg-teal-400/10 border border-teal-400/20 px-2 py-0.5 rounded-full" :
                      r.estado === "en_mantenimiento" ? "text-yellow-300 bg-yellow-400/10 border border-yellow-400/20 px-2 py-0.5 rounded-full" :
                      "text-red-300 bg-red-400/10 border border-red-400/20 px-2 py-0.5 rounded-full"
                    }>{r.estado}</span>
                  </td>
                  <td className="px-3 py-2 text-gray-200">{r.custodio_nombre ?? <span className="text-gray-500 italic">— sin custodio —</span>}</td>
                  <td className="px-3 py-2">
                    <div className="text-gray-200 text-xs">{r.cliente_nombre ?? "—"}</div>
                    <div className="text-gray-500 text-[11px]">{r.puesto_nombre ?? "—"}</div>
                  </td>
                  <td className="px-3 py-2 text-gray-400 text-xs font-mono">{r.numero_tenencia ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Componente principal: TabReportes ────────────────────────────────────
export function TabReportes() {
  const [sub, setSub] = useState<"custodia" | "movimientos" | "municion" | "sync" | "inventario">("custodia");
  const subs = [
    { id: "custodia",    label: "Custodia diaria",  icon: Shield,         desc: "Quién tuvo cada arma en una fecha" },
    { id: "movimientos", label: "Movimientos",      icon: ArrowRightLeft, desc: "Altas y cierres en un rango" },
    { id: "municion",    label: "Munición",         icon: Target,         desc: "Asignaciones por fecha" },
    { id: "sync",        label: "Sincronizaciones", icon: RefreshCw,      desc: "Cambios automáticos por sync" },
    { id: "inventario",  label: "Inventario",       icon: Package,        desc: "Estado del armamento en una fecha" },
  ] as const;

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 p-3 bg-blue-500/5 border border-blue-500/20 rounded-lg">
        <FileText className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
        <div className="text-xs text-gray-300">
          <p className="font-medium text-blue-300">Reportes de Armamento por fecha</p>
          <p className="text-gray-400 mt-0.5">Cada reporte se puede descargar en CSV (Excel). Las fechas usan el horario de Guatemala.</p>
        </div>
      </div>

      <div className="flex gap-1.5 flex-wrap">
        {subs.map(s => {
          const Icon = s.icon;
          const active = sub === s.id;
          return (
            <button key={s.id} onClick={() => setSub(s.id as any)}
              title={s.desc}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors border ${
                active
                  ? "bg-blue-500/20 text-blue-200 border-blue-500/40"
                  : "bg-gray-800/40 text-gray-400 border-gray-700/40 hover:bg-gray-800/60 hover:text-gray-200"
              }`}>
              <Icon className="w-3.5 h-3.5" />
              {s.label}
            </button>
          );
        })}
      </div>

      {sub === "custodia"    && <SubCustodia />}
      {sub === "movimientos" && <SubMovimientos />}
      {sub === "municion"    && <SubMunicion />}
      {sub === "sync"        && <SubSincronizaciones />}
      {sub === "inventario"  && <SubInventario />}
    </div>
  );
}
