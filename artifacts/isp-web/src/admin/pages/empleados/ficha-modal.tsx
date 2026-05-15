import { useState, useEffect, useRef, type ElementType } from "react";
  import { QRCodeSVG } from "qrcode.react";
  import { createPortal } from "react-dom";
  import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
  import {
    Users, Search, X, Loader2, RefreshCw,
    Building2, MapPin, Phone, Mail, Calendar, Hash,
    Shield, Briefcase, BarChart2, CheckSquare, Wallet,
    AlertTriangle, Zap, Activity, Clock, TrendingUp,
    UserCheck, BadgeCheck, Plus, Pencil, LayoutList,
    LayoutGrid, ChevronDown, UserX, UserCheck2, MessageSquare,
    Link2, Unlink, Lock, Save, Banknote, MessageCircle, XCircle,
    TrendingDown, Minus, ShieldAlert, ShieldCheck, ShieldOff,
    ArrowUpRight, ArrowDownRight, Repeat2, ArrowLeftRight, MapPinned, Map, History,
    UserCog, Sun, Umbrella, CheckCircle2, Info, ChevronRight, QrCode, Download,
    ClipboardList, FileText, Scale, FileSignature, Printer, Camera,
    CalendarClock, Trash2,
  } from "lucide-react";
  import { useToast } from "@/hooks/use-toast";
  import { generarContratoLaboral, cargarPatronoDesdeConfig, type DatosContratoLaboral } from "@/lib/pdfRrhh";
  import { useDeleteMode } from "@/contexts/DeleteModeContext";
  import DescansoSemanalEditor from "../../components/DescansoSemanalEditor";
  import { getSessionToken } from "@/lib/httpClient";
  import {
    type Empleado, type KpiData, type Asignacion, type UserVinculado, type PuestoTitular, type HistorialRelevo,
    type OperacionData, type EventoKPIFront, type KPIDisciplinario, type MovimientoRotacion, type KPIRotacion,
    type FormState, type AsignacionOperativa, type TipoPersonalConfig,
    API_BASE, sessionHeader, iniciales, fmtFecha, fmtRelativa, fmtQ, maskDpi,
    ESTADO_LAB, AVATAR_COLORS, avatarColor, FORM_EMPTY, TIPO_PERSONAL_CFG,
    VALID_TIPOS_PERSONAL, useTiposPersonal, TipoPersonalBadge, EstadoBadge,
    KpiCard, ProgressBar,
  } from "./shared";
  import { TabPerfil, TabSistema } from "./perfil";
  import { TabAsignacionOperativa, TabAsignaciones, TabOperacion, TabHistorialAsignaciones } from "./asignaciones";
  import { TabPlantillaPersonal } from "./descanso";
  import { TabVacaciones } from "./vacaciones";
  import { TabAnticipo } from "./anticipos";
  import { TabKPI } from "./kpi";
  import { TabAmonestacionesEmpleado } from "./amonestaciones";
  import { TabSolicitudEmpleo } from "./solicitud";
  import { TabContratos } from "./contratos";
  import { TabIndemnizacion } from "./indemnizacion";
  import { ModalBajaEmpleado, ModalSuspenderEmpleado } from "./estado";
  
export function FichaModal({
  emp,
  onClose,
  onEdit,
  onEstado,
}: {
  emp: Empleado;
  onClose: () => void;
  onEdit: (e: Empleado) => void;
  onEstado: (e: Empleado, estado: string, extras?: { fechaDesde?: string; fechaHasta?: string; observaciones?: string }) => void;
}) {
  const [tab, setTab] = useState<"perfil" | "asignacion-op" | "asignaciones" | "sistema" | "operacion" | "historial" | "kpi" | "anticipos" | "vacaciones" | "qr" | "solicitud" | "contratos" | "indemnizacion" | "amonestaciones" | "plantilla">("perfil");
  const [showEstado, setShowEstado] = useState(false);
  const [bajaModal, setBajaModal]   = useState(false);
  const [suspenderModal, setSuspenderModal] = useState(false);
  const est = ESTADO_LAB[emp.estadoLaboral] ?? { label: emp.estadoLaboral, color: "text-white/40 bg-white/5 border-white/10", dot: "bg-white/40" };

  const muestraPlantilla = emp.tipoPersonal === "supervisor" || emp.tipoPersonal === "administrativo";

  const tabs = [
    { key: "perfil",        label: "Perfil",         icon: UserCheck },
    { key: "asignacion-op", label: "Asignación",     icon: MapPinned },
    ...(muestraPlantilla ? [{ key: "plantilla" as const, label: "Plantilla de turno", icon: CalendarClock }] : []),
    { key: "vacaciones",    label: "Vacaciones",     icon: Sun },
    { key: "asignaciones",  label: "Portal",         icon: Briefcase },
    { key: "qr",            label: "Carnet QR",      icon: QrCode },
    { key: "sistema",       label: "Sistema",        icon: Lock },
    { key: "operacion",     label: "Operación",      icon: Activity },
    { key: "historial",     label: "Historial",      icon: History },
    { key: "kpi",           label: "KPI",            icon: BarChart2 },
    { key: "anticipos",     label: "Anticipos",      icon: Wallet },
    { key: "amonestaciones",label: "Amonestaciones", icon: AlertTriangle },
    { key: "indemnizacion", label: "Indemnización",  icon: Scale },
    { key: "contratos",     label: "Contratos",      icon: FileSignature },
    { key: "solicitud",     label: "Solicitud",      icon: ClipboardList },
  ] as const;

  // ── QR token state ─────────────────────────────────────────────────────────
  const [qrTokenData, setQrTokenData] = useState<{ id: number; qr_token: string } | null | "loading">("loading");
  const [generandoQr, setGenerandoQr] = useState(false);
  const qrRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (tab !== "qr") return;
    setQrTokenData("loading");
    fetch(`/api/agente/tokens`, { headers: sessionHeader() })
      .then(r => r.ok ? r.json() : [])
      .then((lista: Array<{ employee_id: number; qr_token: string | null; token_id: number | null }>) => {
        const found = lista.find(a => a.employee_id === emp.id);
        setQrTokenData(found?.token_id && found.qr_token ? { id: found.token_id, qr_token: found.qr_token } : null);
      })
      .catch(() => setQrTokenData(null));
  }, [tab, emp.id]);

  async function generarQr() {
    setGenerandoQr(true);
    try {
      const res = await fetch("/api/agente/tokens/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...sessionHeader() },
        body: JSON.stringify({ employee_id: emp.id }),
      });
      const data = await res.json();
      if (data.ok && data.token) setQrTokenData({ id: data.token.id, qr_token: data.token.qr_token });
    } finally { setGenerandoQr(false); }
  }

  function descargarQr() {
    if (!qrRef.current) return;
    const svg = qrRef.current.querySelector("svg");
    if (!svg) return;
    const canvas = document.createElement("canvas");
    const sz = 300;
    canvas.width = sz; canvas.height = sz;
    const ctx = canvas.getContext("2d")!;
    const img = new Image();
    img.onload = () => { ctx.drawImage(img, 0, 0, sz, sz); const a = document.createElement("a"); a.download = `qr-${emp.nombreCompleto}.png`; a.href = canvas.toDataURL(); a.click(); };
    img.src = "data:image/svg+xml;base64," + btoa(new XMLSerializer().serializeToString(svg));
  }

  const ESTADOS_CAMBIO = ["activo", "suspendido", "baja", "licencia"].filter((e) => e !== emp.estadoLaboral);

  const portal = createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 backdrop-blur-sm p-4 pt-8 overflow-auto">
      <div className="bg-[#07111f] border border-white/10 rounded-2xl w-full max-w-2xl shadow-2xl">
        {/* Header */}
        <div className="flex items-start gap-4 p-5 border-b border-white/8">
          <div className={`w-14 h-14 rounded-xl flex items-center justify-center text-xl font-bold text-white shrink-0 ${avatarColor(emp.nombreCompleto)}`}>
            {iniciales(emp.nombreCompleto)}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-bold text-white truncate">{emp.nombreCompleto}</h2>
            <p className="text-xs text-white/50 mt-0.5">{emp.puesto ?? "Colaborador"} · {emp.area ?? "—"}</p>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <EstadoBadge estado={emp.estadoLaboral} />
              {emp.sede && (
                <span className="flex items-center gap-1 text-[10px] text-white/30">
                  <MapPin className="w-3 h-3" />{emp.sede}
                </span>
              )}
              {emp.dpi && (
                <span className="flex items-center gap-1 text-[10px] text-white/30">
                  <Hash className="w-3 h-3" />{maskDpi(emp.dpi)}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {/* Cambio rápido de estado */}
            <div className="relative">
              <button
                onClick={() => setShowEstado(!showEstado)}
                className="flex items-center gap-1 text-xs text-white/40 hover:text-white/70 bg-white/5 hover:bg-white/8 border border-white/10 rounded-lg px-2.5 py-1.5 transition-colors"
              >
                <ChevronDown className="w-3.5 h-3.5" />
                Estado
              </button>
              {showEstado && (
                <div className="absolute right-0 top-full mt-1 bg-[#07111f] border border-white/10 rounded-xl shadow-xl z-10 overflow-hidden min-w-[130px]">
                  {ESTADOS_CAMBIO.map((e) => {
                    const cfg = ESTADO_LAB[e];
                    return (
                      <button
                        key={e}
                        onClick={() => {
                          setShowEstado(false);
                          if (e === "baja") {
                            setBajaModal(true);
                          } else if (e === "suspendido") {
                            setSuspenderModal(true);
                          } else {
                            onEstado(emp, e);
                          }
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs text-white/60 hover:bg-white/5 transition-colors"
                      >
                        <span className={`w-2 h-2 rounded-full ${cfg?.dot ?? "bg-white/40"}`} />
                        {cfg?.label ?? e}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            <button
              onClick={() => onEdit(emp)}
              className="flex items-center gap-1 text-xs text-white/40 hover:text-white/70 bg-white/5 hover:bg-white/8 border border-white/10 rounded-lg px-2.5 py-1.5 transition-colors"
            >
              <Pencil className="w-3.5 h-3.5" />
              Editar
            </button>
            <button onClick={onClose} className="text-white/30 hover:text-white transition-colors ml-1">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-white/8 overflow-x-auto">
          {tabs.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex items-center gap-1.5 px-4 py-3 text-xs font-medium transition-colors whitespace-nowrap flex-1 justify-center ${
                tab === key ? "text-primary border-b-2 border-primary" : "text-white/40 hover:text-white"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>

        {/* Contenido */}
        <div className="p-5 max-h-[65vh] overflow-y-auto">
          {tab === "perfil" && <TabPerfil emp={emp} />}
          {tab === "asignacion-op" && <TabAsignacionOperativa empId={emp.id} />}
          {tab === "plantilla" && <TabPlantillaPersonal emp={emp} />}
          {tab === "vacaciones" && <TabVacaciones emp={emp} />}
          {tab === "asignaciones" && <TabAsignaciones empId={emp.id} />}
          {tab === "solicitud" && <TabSolicitudEmpleo dpi={emp.dpi ?? ""} nombre={emp.nombreCompleto} />}
          {tab === "amonestaciones" && <TabAmonestacionesEmpleado empId={emp.id} />}
          {tab === "qr" && (
            <div className="space-y-5">
              <div className="flex items-center gap-2 mb-1">
                <QrCode className="w-4 h-4 text-blue-400" />
                <p className="text-white/60 text-sm font-semibold uppercase tracking-wide">Carnet QR del colaborador</p>
              </div>

              {qrTokenData === "loading" ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
                </div>
              ) : qrTokenData ? (
                <>
                  <div className="flex flex-col items-center gap-4">
                    <div ref={qrRef} className="bg-white p-4 rounded-2xl shadow-xl">
                      <QRCodeSVG
                        value={`${window.location.origin}/agente?token=${qrTokenData.qr_token}`}
                        size={180}
                        level="H"
                        includeMargin={false}
                      />
                    </div>
                    <p className="text-white/40 text-xs text-center max-w-xs leading-relaxed">
                      El agente escanea este código con cualquier cámara para fichar.
                    </p>
                  </div>

                  <div className="bg-white/3 border border-white/8 rounded-xl p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-white/40 text-xs">Token activo</span>
                      <span className="text-green-400 text-xs font-semibold">● Activo</span>
                    </div>
                    <p className="text-white/30 text-xs font-mono break-all">{qrTokenData.qr_token}</p>
                  </div>

                  <div className="flex gap-2">
                    <button onClick={descargarQr}
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-blue-600/10 hover:bg-blue-600/20 border border-blue-500/20 rounded-xl text-xs text-blue-300 font-semibold transition-colors">
                      <Download className="w-3.5 h-3.5" /> Descargar QR
                    </button>
                    <button onClick={generarQr} disabled={generandoQr}
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-amber-600/10 hover:bg-amber-600/20 border border-amber-500/20 rounded-xl text-xs text-amber-300 font-semibold transition-colors disabled:opacity-50">
                      {generandoQr ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <QrCode className="w-3.5 h-3.5" />}
                      Regenerar QR
                    </button>
                  </div>
                </>
              ) : (
                <div className="text-center py-6">
                  <div className="w-16 h-16 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <QrCode className="w-8 h-8 text-white/20" />
                  </div>
                  <p className="text-white/50 text-sm mb-1 font-semibold">Sin código QR</p>
                  <p className="text-white/30 text-xs mb-5">Este colaborador no tiene un código QR activo.</p>
                  <button onClick={generarQr} disabled={generandoQr}
                    className="px-6 py-2.5 bg-blue-600/15 hover:bg-blue-600/25 border border-blue-500/25 rounded-xl text-sm text-blue-300 font-semibold flex items-center gap-2 mx-auto disabled:opacity-50 transition-colors">
                    {generandoQr ? <Loader2 className="w-4 h-4 animate-spin" /> : <QrCode className="w-4 h-4" />}
                    Generar código QR
                  </button>
                </div>
              )}
            </div>
          )}
          {tab === "sistema" && <TabSistema emp={emp} />}
          {tab === "operacion" && <TabOperacion empId={emp.id} />}
          {tab === "historial" && <TabHistorialAsignaciones empId={emp.id} />}
          {tab === "kpi" && <TabKPI empId={emp.id} />}
          {tab === "anticipos" && <TabAnticipo emp={emp} />}
          {tab === "indemnizacion" && <TabIndemnizacion emp={emp} />}
          {tab === "contratos" && <TabContratos emp={emp} />}
        </div>
      </div>
    </div>,
    document.body
  );
  return (
    <>
      {portal}
      {bajaModal && (
        <ModalBajaEmpleado
          emp={emp}
          onClose={() => setBajaModal(false)}
          onSuccess={() => { onEstado(emp, "baja"); }}
        />
      )}
      {suspenderModal && (
        <ModalSuspenderEmpleado
          emp={emp}
          onClose={() => setSuspenderModal(false)}
          onConfirm={(extras) => {
            setSuspenderModal(false);
            onEstado(emp, "suspendido", extras);
          }}
        />
      )}
    </>
  );
}
