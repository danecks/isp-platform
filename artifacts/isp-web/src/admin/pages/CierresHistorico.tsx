import { useState } from "react";
import { createPortal } from "react-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Lock, Unlock, Calendar, ChevronLeft, Loader2,
  CheckCircle2, AlertCircle, Clock, User, FileText,
  RotateCcw, X, Shield, Layout, KeyRound,
} from "lucide-react";
import { AdminLayout } from "../layout/AdminLayout";
import { useAuth } from "@/contexts/AuthContext";
import { useLocation } from "wouter";

const API_BASE = "/api";

interface CierreListItem {
  id: number;
  fecha_iso: string;
  fecha_str: string;
  estado: "cerrado" | "abierto";
  cerrado_por: string;
  cerrado_en_str: string;
  reabierto_por: string | null;
  reabierto_en_str: string | null;
  motivo_reapertura: string | null;
  comentario: string | null;
  total_puestos: number | null;
  cubiertos: number | null;
  descubiertos: number | null;
  ausencias: number | null;
}

interface AuditoriaEntry {
  id: number;
  accion: string;
  user_nombre: string;
  detalle: string;
  fecha_str: string;
  fecha_accion: string;
}

interface CierreDetalle {
  cierre: CierreListItem & {
    resumen_json: any;
    fecha_str: string;
    cerrado_en_str: string;
    reabierto_en_str: string | null;
  };
  auditoria: AuditoriaEntry[];
}

// ─── Modal detalle de cierre ──────────────────────────────────────────────────

function ModalDetalle({
  fechaISO,
  onClose,
}: {
  fechaISO: string;
  onClose: () => void;
}) {
  const { data, isLoading, error } = useQuery<CierreDetalle>({
    queryKey: ["cierre-detalle", fechaISO],
    queryFn: () =>
      fetch(`${API_BASE}/operaciones/cierres/${fechaISO}`).then((r) => r.json()),
  });

  const cierre = data?.cierre;
  const auditoria = data?.auditoria ?? [];
  const resumen = cierre?.resumen_json ?? {};

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-[#07111f] border border-white/10 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/8 bg-[#0a1525] shrink-0">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-bold text-white">Detalle del cierre</h3>
            {cierre && (
              <span className="text-xs text-primary/80 bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-full font-mono">
                {cierre.fecha_str}
              </span>
            )}
          </div>
          <button onClick={onClose} className="text-white/30 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-5 space-y-5">
          {isLoading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-primary mr-2" />
              <span className="text-sm text-white/40">Cargando…</span>
            </div>
          )}

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-xs text-red-400">
              Error al cargar el detalle del cierre.
            </div>
          )}

          {cierre && (
            <>
              {/* Estado del cierre */}
              <div className="flex items-center gap-3">
                <div className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border
                  ${cierre.estado === 'cerrado'
                    ? "bg-amber-500/15 border-amber-500/30 text-amber-300"
                    : "bg-green-500/15 border-green-500/30 text-green-300"}`}>
                  {cierre.estado === 'cerrado'
                    ? <><Lock className="w-3 h-3" /> Cerrado</>
                    : <><Unlock className="w-3 h-3" /> Reabierto</>}
                </div>
                <span className="text-xs text-white/30 font-mono">{cierre.fecha_str}</span>
                <span className="text-[10px] text-white/20">Solo lectura</span>
              </div>

              {/* Resumen del día (snapshot) */}
              {resumen.totalPuestos != null && (
                <div>
                  <p className="text-[10px] text-white/30 uppercase tracking-widest mb-2 font-semibold">
                    Resumen del día (snapshot al cierre)
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { label: "Puestos",    value: resumen.totalPuestos,        color: "text-white" },
                      { label: "Titular",    value: resumen.cubiertosPorTitular, color: "text-green-400" },
                      { label: "Relevo",     value: resumen.cubiertosPorRelevo,  color: "text-yellow-400" },
                      { label: "Descubierto",value: resumen.descubiertos,        color: resumen.descubiertos > 0 ? "text-red-400" : "text-white/30" },
                      { label: "Ausencias",  value: resumen.ausencias,           color: resumen.ausencias > 0 ? "text-orange-400" : "text-white/30" },
                      { label: "Horas extra",value: resumen.horasExtra ?? 0,     color: "text-blue-400" },
                    ].map(({ label, value, color }) => (
                      <div key={label} className="bg-[#0c1929] border border-white/6 rounded-xl p-2 text-center">
                        <p className={`text-lg font-bold leading-none ${color}`}>{value ?? "-"}</p>
                        <p className="text-[9px] text-white/30 mt-1 leading-tight">{label}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Info de cierre */}
              <div className="bg-[#0c1929] border border-white/8 rounded-xl p-3 space-y-2 text-xs">
                <p className="text-[10px] text-white/30 uppercase tracking-widest font-semibold mb-1">
                  Cierre
                </p>
                <div className="flex items-start gap-2 text-white/50">
                  <User className="w-3.5 h-3.5 mt-0.5 shrink-0 text-white/20" />
                  <span>Cerrado por <span className="text-white/80">{cierre.cerrado_por}</span></span>
                  <span className="text-white/20 ml-auto font-mono">{cierre.cerrado_en_str}</span>
                </div>
                {cierre.comentario && (
                  <div className="flex items-start gap-2 text-white/40">
                    <FileText className="w-3.5 h-3.5 mt-0.5 shrink-0 text-white/20" />
                    <span>{cierre.comentario}</span>
                  </div>
                )}
              </div>

              {/* Info de reapertura */}
              {cierre.reabierto_por && (
                <div className="bg-red-500/8 border border-red-500/15 rounded-xl p-3 space-y-2 text-xs">
                  <p className="text-[10px] text-red-400/60 uppercase tracking-widest font-semibold mb-1">
                    Reapertura
                  </p>
                  <div className="flex items-start gap-2 text-white/50">
                    <Unlock className="w-3.5 h-3.5 mt-0.5 shrink-0 text-red-400/60" />
                    <span>Reabierto por <span className="text-white/80">{cierre.reabierto_por}</span></span>
                    <span className="text-white/20 ml-auto font-mono">{cierre.reabierto_en_str}</span>
                  </div>
                  {cierre.motivo_reapertura && (
                    <div className="flex items-start gap-2 text-white/40">
                      <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0 text-red-400/60" />
                      <span>{cierre.motivo_reapertura}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Auditoría */}
              {auditoria.length > 0 && (
                <div>
                  <p className="text-[10px] text-white/30 uppercase tracking-widest mb-2 font-semibold">
                    Bitácora de auditoría
                  </p>
                  <div className="space-y-1.5">
                    {auditoria.map((a) => (
                      <div
                        key={a.id}
                        className={`flex items-start gap-2.5 rounded-xl px-3 py-2.5 text-xs border
                          ${a.accion === 'cerrar'
                            ? "bg-amber-500/8 border-amber-500/15"
                            : "bg-red-500/8 border-red-500/15"}`}
                      >
                        <div className={`mt-0.5 shrink-0 ${a.accion === 'cerrar' ? "text-amber-400" : "text-red-400"}`}>
                          {a.accion === 'cerrar'
                            ? <Lock className="w-3 h-3" />
                            : <Unlock className="w-3 h-3" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <span className={`font-semibold uppercase text-[10px] tracking-wide
                              ${a.accion === 'cerrar' ? "text-amber-400/80" : "text-red-400/80"}`}>
                              {a.accion}
                            </span>
                            <span className="text-white/40">{a.user_nombre}</span>
                          </div>
                          <p className="text-white/30 text-[10px] leading-relaxed">{a.detalle}</p>
                        </div>
                        <span className="text-white/20 font-mono text-[10px] shrink-0 mt-0.5">{a.fecha_str}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Snapshot de puestos */}
              {resumen.snapshotPuestos?.length > 0 && (
                <details className="group">
                  <summary className="cursor-pointer text-[10px] text-white/30 uppercase tracking-widest font-semibold hover:text-white/50 transition-colors select-none">
                    Snapshot de puestos ({resumen.snapshotPuestos.length}) ▸
                  </summary>
                  <div className="mt-2 space-y-1">
                    {resumen.snapshotPuestos.map((p: any) => (
                      <div key={p.id} className="flex items-center gap-2 text-[11px] bg-[#0c1929] rounded-lg px-2.5 py-1.5 border border-white/5">
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${p.estado === 'cubierto' ? "bg-green-400" : "bg-red-400"}`} />
                        <span className="text-white/60 flex-1 truncate">{p.nombre}</span>
                        <span className="text-white/30 text-[10px] truncate max-w-[100px]">{p.cliente_nombre}</span>
                        {p.agente_nombre && (
                          <span className="text-white/40 text-[10px] truncate max-w-[100px]">{p.agente_nombre}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </>
          )}
        </div>

        <div className="shrink-0 px-5 py-3 border-t border-white/8">
          <button
            onClick={onClose}
            className="w-full py-2 rounded-xl border border-white/10 text-sm text-white/50 hover:text-white transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ─── Modal reapertura de día (solo admin) ────────────────────────────────────

function ModalReabrirHistorico({
  cierre,
  currentUser,
  onClose,
  onSuccess,
}: {
  cierre: CierreListItem;
  currentUser: any;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const confirmacionEsperada = `REABRIR ${cierre.fecha_str}`;
  const [confirmacion, setConfirmacion] = useState("");
  const [motivo, setMotivo] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const valido = confirmacion === confirmacionEsperada && motivo.trim().length >= 5;

  async function handleReabrir() {
    if (!valido) return;
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`${API_BASE}/operaciones/reabrir`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-isp-session": sessionStorage.getItem("isp_admin_session_v2") ?? "",
        },
        body: JSON.stringify({
          confirmacion,
          motivo,
          usuario: currentUser?.nombre ?? currentUser?.username ?? "admin",
          usuarioId: currentUser?.id,
          rol: currentUser?.rol,
          fecha: cierre.fecha_iso,
        }),
      });
      const data = await r.json();
      if (!r.ok) { setError(data.error ?? "Error al reabrir"); return; }
      onSuccess();
      onClose();
    } catch {
      setError("Error de conexión al servidor.");
    } finally {
      setLoading(false);
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-[#07111f] border border-amber-500/30 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/8 bg-amber-500/5">
          <div className="flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-bold text-white">Reabrir día operativo</h3>
            <span className="text-xs text-amber-400/80 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full font-mono">
              {cierre.fecha_str}
            </span>
          </div>
          <button onClick={onClose} className="text-white/30 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">

          {/* Advertencia */}
          <div className="flex gap-3 bg-amber-500/8 border border-amber-500/20 rounded-xl px-3 py-3">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-300/80 leading-relaxed">
              Reabrir este día permitirá editar su información en el pizarrón.
              Esta acción queda registrada en la auditoría y solo puede ser realizada por administradores.
            </div>
          </div>

          {/* Motivo */}
          <div>
            <label className="block text-xs text-white/40 mb-1.5 font-medium">
              Motivo de la reapertura <span className="text-red-400">*</span>
            </label>
            <textarea
              rows={2}
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Describe el motivo de reabrir este día (mínimo 5 caracteres)"
              className="w-full bg-[#0c1929] border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-white/20 focus:outline-none focus:border-amber-500/50 resize-none"
            />
          </div>

          {/* Confirmación */}
          <div>
            <label className="block text-xs text-white/40 mb-1.5 font-medium">
              Para confirmar, escribe exactamente:
            </label>
            <div className="bg-black/30 border border-white/8 rounded-lg px-3 py-1.5 mb-2 font-mono text-sm text-amber-300/80 tracking-wide select-all">
              {confirmacionEsperada}
            </div>
            <input
              type="text"
              value={confirmacion}
              onChange={(e) => setConfirmacion(e.target.value)}
              placeholder={confirmacionEsperada}
              className="w-full bg-[#0c1929] border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-white/20 focus:outline-none focus:border-amber-500/50 font-mono"
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              {error}
            </div>
          )}

          {/* Acciones */}
          <div className="flex gap-2 pt-1">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-white/10 text-sm text-white/50 hover:text-white transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleReabrir}
              disabled={!valido || loading}
              className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-30 disabled:cursor-not-allowed text-black text-sm font-bold transition-colors flex items-center justify-center gap-2"
            >
              {loading
                ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Reabriendo…</>
                : <><Unlock className="w-3.5 h-3.5" /> Reabrir día</>}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function CierresHistorico() {
  const [, setLocation] = useLocation();
  const [detalleFecha, setDetalleFecha] = useState<string | null>(null);
  const [reabrirCierre, setReabrirCierre] = useState<CierreListItem | null>(null);
  const { currentUser } = useAuth();
  const qc = useQueryClient();
  const esAdmin = currentUser?.rol === "admin";

  const { data: cierres = [], isLoading, error } = useQuery<CierreListItem[]>({
    queryKey: ["operaciones-cierres-historial"],
    queryFn: () =>
      fetch(`${API_BASE}/operaciones/cierres`).then((r) => r.json()),
  });

  return (
    <AdminLayout title="Historial de cierres operativos">
      <div className="p-6 space-y-4 max-w-5xl mx-auto">

        {/* Encabezado */}
        <div className="flex items-center gap-3 mb-2">
          <button
            onClick={() => setLocation("/admin/operaciones")}
            className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white transition-colors"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            Volver al pizarrón
          </button>
          <span className="text-white/15">·</span>
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-primary" />
            <h1 className="text-base font-bold text-white">Historial de cierres</h1>
          </div>
        </div>

        <p className="text-xs text-white/30">
          Registro auditado de todos los cierres operativos diarios.
          {esAdmin
            ? " Los administradores pueden reabrir un día cerrado para hacer correcciones."
            : " Solo lectura — los cierres solo pueden reabrirse por un administrador."}
        </p>

        {/* Tabla */}
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-5 h-5 animate-spin text-primary mr-2" />
            <span className="text-sm text-white/40">Cargando historial…</span>
          </div>
        ) : error ? (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-sm text-red-400">
            Error al cargar el historial de cierres.
          </div>
        ) : cierres.length === 0 ? (
          <div className="bg-[#0a1525] border border-white/8 rounded-xl p-8 text-center">
            <Lock className="w-8 h-8 text-white/15 mx-auto mb-3" />
            <p className="text-sm text-white/30">No hay cierres registrados aún.</p>
            <p className="text-xs text-white/20 mt-1">
              El primer cierre del pizarrón operativo aparecerá aquí.
            </p>
          </div>
        ) : (
          <div className="bg-[#07111f] border border-white/8 rounded-2xl overflow-hidden">
            {/* Header de tabla */}
            <div className="grid grid-cols-[130px_90px_1fr_1fr_80px_80px_80px_80px_120px] gap-0 border-b border-white/8 px-4 py-2.5">
              {["Fecha", "Estado", "Cerrado por", "Hora cierre", "Puestos", "Cubiertos", "Descub.", "Ausencias", ""].map((h) => (
                <span key={h} className="text-[10px] text-white/25 uppercase tracking-widest font-semibold">{h}</span>
              ))}
            </div>

            {/* Filas */}
            {cierres.map((c) => (
              <div
                key={c.id}
                className="grid grid-cols-[130px_90px_1fr_1fr_80px_80px_80px_80px_120px] gap-0 px-4 py-3 border-b border-white/5 hover:bg-white/[0.02] transition-colors items-center"
              >
                {/* Fecha */}
                <div className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-white/20 shrink-0" />
                  <span className="text-xs font-mono text-white/70">{c.fecha_str}</span>
                </div>

                {/* Estado */}
                <div>
                  {c.estado === "cerrado" ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">
                      <Lock className="w-2.5 h-2.5" /> Cerrado
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-green-400 bg-green-500/10 border border-green-500/20 px-2 py-0.5 rounded-full">
                      <Unlock className="w-2.5 h-2.5" /> Reabierto
                    </span>
                  )}
                </div>

                {/* Cerrado por */}
                <div className="flex items-center gap-1.5">
                  <User className="w-3 h-3 text-white/15 shrink-0" />
                  <span className="text-xs text-white/50 truncate">{c.cerrado_por}</span>
                </div>

                {/* Hora cierre */}
                <div className="flex items-center gap-1.5">
                  <Clock className="w-3 h-3 text-white/15 shrink-0" />
                  <span className="text-[11px] text-white/40 font-mono">{c.cerrado_en_str}</span>
                </div>

                {/* Puestos */}
                <span className="text-xs text-center text-white/50">{c.total_puestos ?? "-"}</span>

                {/* Cubiertos */}
                <span className="text-xs text-center text-green-400/70">{c.cubiertos ?? "-"}</span>

                {/* Descubiertos */}
                <span className={`text-xs text-center ${(c.descubiertos ?? 0) > 0 ? "text-red-400/70" : "text-white/20"}`}>
                  {c.descubiertos ?? "-"}
                </span>

                {/* Ausencias */}
                <span className={`text-xs text-center ${(c.ausencias ?? 0) > 0 ? "text-orange-400/70" : "text-white/20"}`}>
                  {c.ausencias ?? "-"}
                </span>

                {/* Acciones */}
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={() => setDetalleFecha(c.fecha_iso)}
                    className="text-[11px] text-primary/70 hover:text-primary transition-colors font-medium"
                  >
                    Detalle
                  </button>
                  <button
                    onClick={() => setLocation(`/admin/operaciones/pizarron-historico?fecha=${c.fecha_iso}`)}
                    className="flex items-center gap-1 text-[11px] text-amber-400/60 hover:text-amber-300 transition-colors font-medium"
                    title="Ver pizarrón completo de este día"
                  >
                    <Layout className="w-3 h-3" />
                    Pizarrón
                  </button>
                  {esAdmin && c.estado === "cerrado" && (
                    <button
                      onClick={() => setReabrirCierre(c)}
                      className="flex items-center gap-1 text-[11px] text-orange-400/60 hover:text-orange-300 transition-colors font-medium"
                      title="Reabrir este día (solo admin)"
                    >
                      <KeyRound className="w-3 h-3" />
                      Reabrir
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Reaperturas sub-info */}
        {cierres.some((c) => c.reabierto_por) && (
          <div className="space-y-2">
            <p className="text-[10px] text-white/25 uppercase tracking-widest font-semibold">
              Reaperturas registradas
            </p>
            {cierres.filter((c) => c.reabierto_por).map((c) => (
              <div
                key={c.id}
                className="flex items-start gap-3 bg-red-500/5 border border-red-500/10 rounded-xl px-3 py-2.5 text-xs"
              >
                <RotateCcw className="w-3.5 h-3.5 text-red-400/60 mt-0.5 shrink-0" />
                <div>
                  <span className="text-white/50">
                    <span className="text-white/70 font-mono">{c.fecha_str}</span>
                    {" "}reabierto por{" "}
                    <span className="text-white/70">{c.reabierto_por}</span>
                    {" "}·{" "}
                    <span className="text-white/40 font-mono">{c.reabierto_en_str}</span>
                  </span>
                  {c.motivo_reapertura && (
                    <p className="text-white/30 mt-0.5">{c.motivo_reapertura}</p>
                  )}
                </div>
                <button
                  onClick={() => setDetalleFecha(c.fecha_iso)}
                  className="ml-auto text-[10px] text-primary/60 hover:text-primary shrink-0"
                >
                  Detalle
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {detalleFecha && (
        <ModalDetalle
          fechaISO={detalleFecha}
          onClose={() => setDetalleFecha(null)}
        />
      )}

      {reabrirCierre && (
        <ModalReabrirHistorico
          cierre={reabrirCierre}
          currentUser={currentUser}
          onClose={() => setReabrirCierre(null)}
          onSuccess={() => {
            qc.invalidateQueries({ queryKey: ["operaciones-cierres-historial"] });
            qc.invalidateQueries({ queryKey: ["operaciones-cierre-hoy"] });
          }}
        />
      )}
    </AdminLayout>
  );
}
