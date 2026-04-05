/**
 * NFC PILOTO — Módulo experimental de control operativo NFC
 * ──────────────────────────────────────────────────────────
 * SANDBOX MODE activo. No afecta planilla, RRHH ni pizarrón productivo.
 * Todo registro vive en tablas nfc_* aisladas.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Cpu, Tag, Activity, CheckCircle, AlertTriangle, Plus,
  RefreshCw, Search, X, Wifi, WifiOff, Smartphone, User,
  Clock, ClipboardList, BarChart3, History, Shield, ShieldCheck,
  ShieldAlert, Check, XCircle, Loader2, AlertCircle, Eye,
  Maximize2, Minimize2, RotateCcw, Ban, ChevronDown, Zap,
  Camera, Settings, QrCode, Calendar,
} from "lucide-react";
import { AdminLayout } from "../layout/AdminLayout";
import { useToast } from "@/hooks/use-toast";

// ──────────────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────────────
interface NfcDevice {
  id: number; device_code: string; device_name: string;
  puesto_id_ref: number | null; cliente_id_ref: number | null;
  status: string; sandbox_mode: boolean; last_seen_at: string | null;
  notes: string | null; created_at: string; nombre_puesto?: string; cliente_nombre?: string;
}
interface NfcTag {
  id: number; tag_uid: string; profile_type: string;
  empleado_id_ref: number | null; alias: string | null;
  status: string; sandbox_mode: boolean; issued_at: string | null;
  revoked_at: string | null; notes: string | null; created_at: string;
  empleado_nombre?: string;
}
interface NfcEvent {
  id: number; tag_id: number | null; empleado_id_ref: number | null;
  device_id: number | null; puesto_id_ref: number | null;
  event_type: string; scheduled_status: string; validation_status: string;
  photo_path: string | null; notes: string | null; event_at: string;
  validated_by: string | null; validated_at: string | null;
  tag_uid?: string; profile_type?: string; alias?: string;
  nombre_empleado?: string; device_name?: string; nombre_puesto?: string;
}
interface NfcForm {
  id: number; supervisor_id_ref: number | null; device_id: number | null;
  puesto_id_ref: number | null; agente_id_ref: number | null;
  arma_estado: string; uniforme_estado: string; puesto_estado: string;
  agente_estado: string; observaciones: string | null; form_status: string;
  created_at: string;
  supervisor_nombre?: string; agente_nombre?: string; nombre_puesto?: string; device_name?: string;
}
interface DashboardStats {
  total_devices: number; active_tags: number; events_today: number;
  pending_validations: number; supervisor_forms_today: number; last_events: NfcEvent[];
}
interface RefPuesto { id: number; nombre_puesto: string; }
interface RefEmpleado { id: number; nombre_completo: string; tipo_personal: string; }

// ──────────────────────────────────────────────────────────────────────────────
// API helper
// ──────────────────────────────────────────────────────────────────────────────
function getSession() { return sessionStorage.getItem("isp_admin_session_v2") || ""; }
async function api(path: string, opts?: RequestInit) {
  return fetch(path, {
    headers: { "Content-Type": "application/json", "x-isp-session": getSession(), ...(opts?.headers ?? {}) },
    ...opts,
  });
}

// ──────────────────────────────────────────────────────────────────────────────
// Small helpers
// ──────────────────────────────────────────────────────────────────────────────
function fmtDate(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("es-GT", { timeZone: "America/Guatemala", dateStyle: "short", timeStyle: "short" });
}

function EventTypeBadge({ type }: { type: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    INICIO_TURNO: { label: "Inicio turno", cls: "bg-green-500/15 text-green-300 border-green-500/20" },
    FIN_TURNO: { label: "Fin turno", cls: "bg-blue-500/15 text-blue-300 border-blue-500/20" },
    INTENTO_IRREGULAR: { label: "Irregular", cls: "bg-red-500/15 text-red-300 border-red-500/20" },
    COBERTURA_POTENCIAL: { label: "Cobertura potencial", cls: "bg-amber-500/15 text-amber-300 border-amber-500/20" },
    VALIDACION_PENDIENTE: { label: "Validación pendiente", cls: "bg-purple-500/15 text-purple-300 border-purple-500/20" },
  };
  const m = map[type] ?? { label: type, cls: "bg-white/5 text-white/50 border-white/10" };
  return <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${m.cls}`}>{m.label}</span>;
}

function SchedBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    programado: { label: "Programado", cls: "text-green-300 bg-green-500/10" },
    cobertura_potencial: { label: "Cobertura potencial", cls: "text-amber-300 bg-amber-500/10" },
    no_programado: { label: "No programado", cls: "text-red-300 bg-red-500/10" },
    fuera_horario: { label: "Fuera de horario", cls: "text-orange-300 bg-orange-500/10" },
    pendiente: { label: "Pendiente", cls: "text-white/50 bg-white/5" },
  };
  const m = map[status] ?? { label: status, cls: "text-white/50 bg-white/5" };
  return <span className={`text-[10px] px-2 py-0.5 rounded-full ${m.cls}`}>{m.label}</span>;
}

function ValBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string; icon: React.ReactNode }> = {
    validado_manualmente: { label: "Validado", cls: "text-green-300 bg-green-500/10 border-green-500/20", icon: <ShieldCheck className="w-3 h-3" /> },
    pendiente: { label: "Pendiente", cls: "text-amber-300 bg-amber-500/10 border-amber-500/20", icon: <Clock className="w-3 h-3" /> },
    rechazado: { label: "Rechazado", cls: "text-red-300 bg-red-500/10 border-red-500/20", icon: <ShieldAlert className="w-3 h-3" /> },
  };
  const m = map[status] ?? { label: status, cls: "text-white/50 bg-white/5 border-white/10", icon: null };
  return <span className={`flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${m.cls}`}>{m.icon}{m.label}</span>;
}

function StatusDot({ status }: { status: string }) {
  const active = status === "active";
  return <span className={`inline-block w-2 h-2 rounded-full ${active ? "bg-green-400" : "bg-red-400/60"}`} />;
}

function StatCard({ label, value, icon, color }: { label: string; value: number; icon: React.ReactNode; color: string }) {
  const colors: Record<string, string> = {
    blue: "from-blue-500/10 to-blue-600/5 border-blue-500/20 text-blue-300",
    green: "from-green-500/10 to-green-600/5 border-green-500/20 text-green-300",
    amber: "from-amber-500/10 to-amber-600/5 border-amber-500/20 text-amber-300",
    red: "from-red-500/10 to-red-600/5 border-red-500/20 text-red-300",
    purple: "from-purple-500/10 to-purple-600/5 border-purple-500/20 text-purple-300",
  };
  const c = colors[color] ?? colors.blue;
  return (
    <div className={`bg-gradient-to-br ${c} border rounded-xl p-4`}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-white/50">{label}</span>
        <span className="opacity-70">{icon}</span>
      </div>
      <p className="text-3xl font-bold text-white mt-1">{value}</p>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Kiosk Mode overlay
// ──────────────────────────────────────────────────────────────────────────────
interface ScanResult {
  event: NfcEvent; profile_type: string; nombre_empleado: string;
  puesto_nombre: string; event_type: string; scheduled_status: string; mensaje: string;
}

function KioskScreen({ devices, onClose }: { devices: NfcDevice[]; onClose?: () => void }) {
  const { toast } = useToast();
  const [deviceCode, setDeviceCode] = useState("");
  const [tagUid, setTagUid] = useState("");
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState("");
  const [showSuperForm, setShowSuperForm] = useState(false);
  const [supervisorForm, setSupervisorForm] = useState({
    arma_estado: "sin_novedad", uniforme_estado: "completo",
    puesto_estado: "sin_novedad", agente_estado: "presente", observaciones: "",
  });
  const [savingForm, setSavingForm] = useState(false);
  const tagRef = useRef<HTMLInputElement>(null);

  const selectedDevice = devices.find(d => d.device_code === deviceCode);

  const doScan = useCallback(async () => {
    if (!tagUid.trim() || !deviceCode) {
      setError("Selecciona un dispositivo e ingresa el UID del tag");
      return;
    }
    setScanning(true); setError(""); setResult(null);
    try {
      const r = await api("/api/pilot/nfc/scan", {
        method: "POST",
        body: JSON.stringify({ tag_uid: tagUid.trim(), device_code: deviceCode }),
      });
      const data = await r.json();
      if (!r.ok) { setError(data.error || "Error en el scan"); return; }
      setResult(data);
      setTagUid("");
      if (data.profile_type === "SUPERVISOR") setShowSuperForm(true);
    } catch (e) { setError(String(e)); }
    finally { setScanning(false); setTimeout(() => tagRef.current?.focus(), 100); }
  }, [tagUid, deviceCode]);

  async function guardarFormSupervisor() {
    if (!result) return;
    setSavingForm(true);
    try {
      const r = await api("/api/pilot/nfc/supervisor/forms", {
        method: "POST",
        body: JSON.stringify({
          ...supervisorForm,
          device_id: result.event.device_id,
          puesto_id_ref: result.event.puesto_id_ref,
          form_items: [
            { item_type: "radio", item_name: "Radio", item_status: "ok" },
            { item_type: "baston", item_name: "Bastón", item_status: "ok" },
            { item_type: "linterna", item_name: "Linterna", item_status: "ok" },
            { item_type: "chaleco", item_name: "Chaleco", item_status: "ok" },
          ],
        }),
      });
      if (r.ok) {
        toast({ title: "Formulario guardado", description: "Inspección registrada correctamente" });
        setShowSuperForm(false); setResult(null);
      }
    } finally { setSavingForm(false); }
  }

  const eventColor: Record<string, string> = {
    INICIO_TURNO: "border-green-500 bg-green-500/10",
    FIN_TURNO: "border-blue-500 bg-blue-500/10",
    INTENTO_IRREGULAR: "border-red-500 bg-red-500/10",
    COBERTURA_POTENCIAL: "border-amber-500 bg-amber-500/10",
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#04080f] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-white/10 bg-black/30">
        <div className="flex items-center gap-2">
          <Cpu className="w-5 h-5 text-blue-400" />
          <span className="text-sm font-bold text-white">Kiosko NFC</span>
          <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-1.5 py-0.5 rounded">SANDBOX</span>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={deviceCode}
            onChange={e => setDeviceCode(e.target.value)}
            className="text-xs bg-white/5 border border-white/15 rounded-lg px-3 py-1.5 text-white"
          >
            <option value="">— Seleccionar dispositivo —</option>
            {devices.filter(d => d.status === "active").map(d => (
              <option key={d.id} value={d.device_code}>{d.device_name} ({d.device_code})</option>
            ))}
          </select>
          {onClose && (
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 text-white/60 hover:text-white">
              <Minimize2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Main area */}
      <div className="flex-1 flex items-center justify-center p-8">
        {!result && !showSuperForm && (
          <div className="max-w-md w-full text-center space-y-6">
            {/* NFC Icon */}
            <div className="flex justify-center">
              <div className="w-32 h-32 rounded-full border-4 border-blue-500/30 flex items-center justify-center bg-blue-500/5 animate-pulse">
                <Wifi className="w-16 h-16 text-blue-400" />
              </div>
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white">Acerca tu llavero NFC</h1>
              <p className="text-white/50 mt-2 text-sm">o ingresa el UID manualmente para pruebas</p>
            </div>

            {!deviceCode && (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 text-amber-300 text-sm">
                Selecciona un dispositivo en la barra superior
              </div>
            )}
            {deviceCode && selectedDevice && (
              <div className="bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-white/60">
                <Smartphone className="w-4 h-4 inline mr-2 text-blue-400" />
                {selectedDevice.device_name}
                {selectedDevice.nombre_puesto && <span className="ml-2 text-white/30">· {selectedDevice.nombre_puesto}</span>}
              </div>
            )}

            <div className="flex gap-2">
              <input
                ref={tagRef}
                type="text"
                value={tagUid}
                onChange={e => setTagUid(e.target.value)}
                onKeyDown={e => e.key === "Enter" && doScan()}
                placeholder="UID del tag NFC (ej. A1B2C3D4)"
                className="flex-1 bg-white/5 border border-white/15 rounded-xl px-4 py-3 text-white placeholder-white/25 text-sm focus:outline-none focus:border-blue-500/50"
                autoFocus
              />
              <button
                onClick={doScan}
                disabled={scanning || !deviceCode}
                className="bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white px-5 py-3 rounded-xl font-semibold transition-colors flex items-center gap-2"
              >
                {scanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                {scanning ? "..." : "Scan"}
              </button>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-300 text-sm flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {error}
              </div>
            )}
          </div>
        )}

        {/* RESULT: Agente */}
        {result && !showSuperForm && (
          <div className={`max-w-md w-full border-2 rounded-3xl p-8 text-center space-y-4 ${eventColor[result.event_type] ?? "border-white/20 bg-white/5"}`}>
            <div className="flex justify-center">
              <div className="w-20 h-20 rounded-full bg-white/10 flex items-center justify-center">
                <User className="w-10 h-10 text-white" />
              </div>
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{result.nombre_empleado || "Agente"}</p>
              {result.puesto_nombre && <p className="text-white/60 text-sm mt-1">{result.puesto_nombre}</p>}
            </div>
            <div className="flex justify-center gap-2 flex-wrap">
              <EventTypeBadge type={result.event_type} />
              <SchedBadge status={result.scheduled_status} />
            </div>
            <p className="text-lg text-white/80 font-medium">{result.mensaje}</p>
            <p className="text-xs text-white/30">{fmtDate(result.event.event_at)}</p>
            <button
              onClick={() => setResult(null)}
              className="mt-2 bg-white/10 hover:bg-white/15 text-white px-6 py-2.5 rounded-xl font-medium transition-colors flex items-center gap-2 mx-auto"
            >
              <RotateCcw className="w-4 h-4" /> Siguiente scan
            </button>
          </div>
        )}

        {/* RESULT: Supervisor form */}
        {showSuperForm && result && (
          <div className="max-w-lg w-full space-y-4">
            <div className="text-center">
              <Shield className="w-12 h-12 text-indigo-400 mx-auto mb-2" />
              <h2 className="text-xl font-bold text-white">Formulario de Supervisión</h2>
              <p className="text-white/50 text-sm">{result.nombre_empleado} · {result.puesto_nombre}</p>
            </div>

            {[
              { key: "arma_estado", label: "Estado del Arma", opts: [["asignada","Asignada"],["sin_novedad","Sin novedad"],["danada","Dañada"],["mantenimiento","Mantenimiento"],["no_entregada","No entregada"]] },
              { key: "uniforme_estado", label: "Uniforme del Agente", opts: [["completo","Completo"],["incompleto","Incompleto"],["danado","Dañado"],["requiere_reemplazo","Requiere reemplazo"]] },
              { key: "puesto_estado", label: "Estado del Puesto", opts: [["sin_novedad","Sin novedad"],["con_novedad","Con novedad"],["riesgo_detectado","Riesgo detectado"],["observacion_cliente","Observación del cliente"]] },
              { key: "agente_estado", label: "Estado del Agente", opts: [["presente","Presente"],["no_presente","No presente"],["uniforme_incompleto","Uniforme incompleto"],["sin_arma","Sin arma"],["observacion_disciplinaria","Observación disciplinaria"],["requiere_seguimiento_rrhh","Requiere seguimiento RRHH"]] },
            ].map(f => (
              <div key={f.key} className="bg-white/5 border border-white/10 rounded-xl p-4">
                <label className="text-xs text-white/50 font-medium mb-2 block">{f.label}</label>
                <div className="flex flex-wrap gap-2">
                  {f.opts.map(([val, lbl]) => (
                    <button
                      key={val}
                      onClick={() => setSupervisorForm(p => ({ ...p, [f.key]: val }))}
                      className={`text-xs px-3 py-1.5 rounded-lg border transition-colors font-medium ${supervisorForm[f.key as keyof typeof supervisorForm] === val ? "bg-indigo-500/20 border-indigo-500/40 text-indigo-300" : "bg-white/5 border-white/10 text-white/50 hover:text-white/80"}`}
                    >
                      {lbl}
                    </button>
                  ))}
                </div>
              </div>
            ))}

            <div className="bg-white/5 border border-white/10 rounded-xl p-4">
              <label className="text-xs text-white/50 font-medium mb-2 block">Observaciones</label>
              <textarea
                value={supervisorForm.observaciones}
                onChange={e => setSupervisorForm(p => ({ ...p, observaciones: e.target.value }))}
                rows={2}
                placeholder="Observaciones adicionales..."
                className="w-full bg-transparent text-white text-sm placeholder-white/25 resize-none focus:outline-none"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => { setShowSuperForm(false); setResult(null); }}
                className="flex-1 bg-white/5 border border-white/15 text-white/60 hover:text-white py-3 rounded-xl font-medium transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={guardarFormSupervisor}
                disabled={savingForm}
                className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white py-3 rounded-xl font-bold transition-colors flex items-center justify-center gap-2"
              >
                {savingForm ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                Guardar inspección
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-6 py-2 border-t border-white/5 flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
        <span className="text-xs text-white/30">Módulo Piloto NFC · SANDBOX ACTIVO · No afecta sistema productivo</span>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Modal base
// ──────────────────────────────────────────────────────────────────────────────
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-[#0d1f35] border border-white/10 rounded-2xl w-full max-w-lg shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <h2 className="text-sm font-bold text-white">{title}</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-white/10 text-white/50 hover:text-white"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs text-white/50 font-medium">{label}</label>
      {children}
    </div>
  );
}

const inputCls = "w-full bg-white/5 border border-white/15 rounded-xl px-3 py-2 text-sm text-white placeholder-white/25 focus:outline-none focus:border-blue-500/50";
const selectCls = `${inputCls} cursor-pointer`;

// ──────────────────────────────────────────────────────────────────────────────
// Main page component
// ──────────────────────────────────────────────────────────────────────────────
export default function NfcPiloto({ kioskMode }: { kioskMode?: boolean }) {
  const { toast } = useToast();
  const [tab, setTab] = useState<"dashboard"|"devices"|"tags"|"events"|"validation"|"forms"|"audit">("dashboard");
  const [kioskOpen, setKioskOpen] = useState(!!kioskMode);

  // Data
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [devices, setDevices] = useState<NfcDevice[]>([]);
  const [tags, setTags] = useState<NfcTag[]>([]);
  const [events, setEvents] = useState<NfcEvent[]>([]);
  const [pending, setPending] = useState<NfcEvent[]>([]);
  const [forms, setForms] = useState<NfcForm[]>([]);
  const [auditLogs, setAuditLogs] = useState<{ id: number; entity_type: string; entity_id: number; action: string; actor: string; created_at: string; meta: Record<string,unknown> }[]>([]);
  const [refPuestos, setRefPuestos] = useState<RefPuesto[]>([]);
  const [refEmpleados, setRefEmpleados] = useState<RefEmpleado[]>([]);

  // Loading
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Filters
  const [evDesde, setEvDesde] = useState("");
  const [evHasta, setEvHasta] = useState("");
  const [evEstado, setEvEstado] = useState("");
  const [tagSearch, setTagSearch] = useState("");
  const [devSearch, setDevSearch] = useState("");

  // Modals
  const [showDevModal, setShowDevModal] = useState(false);
  const [showTagModal, setShowTagModal] = useState(false);
  const [showValModal, setShowValModal] = useState<NfcEvent | null>(null);
  const [showFormDetail, setShowFormDetail] = useState<number | null>(null);

  // Form state: new device
  const [devForm, setDevForm] = useState({ device_code: "", device_name: "", puesto_id_ref: "", notes: "" });
  // Form state: new tag
  const [tagForm, setTagForm] = useState({ tag_uid: "", profile_type: "AGENTE", empleado_id_ref: "", alias: "", notes: "" });
  // Validation note
  const [valNota, setValNota] = useState("");

  // ── Loaders ──────────────────────────────────────────────────────────────
  const loadDashboard = useCallback(async () => {
    const r = await api("/api/pilot/nfc/dashboard"); if (r.ok) setStats(await r.json());
  }, []);
  const loadDevices = useCallback(async () => {
    const r = await api("/api/pilot/nfc/devices"); if (r.ok) setDevices(await r.json());
  }, []);
  const loadTags = useCallback(async () => {
    const r = await api("/api/pilot/nfc/tags"); if (r.ok) setTags(await r.json());
  }, []);
  const loadEvents = useCallback(async () => {
    const qs = new URLSearchParams();
    if (evDesde) qs.set("desde", evDesde);
    if (evHasta) qs.set("hasta", evHasta);
    if (evEstado) qs.set("estado", evEstado);
    const r = await api(`/api/pilot/nfc/shift-events?${qs}`); if (r.ok) setEvents(await r.json());
  }, [evDesde, evHasta, evEstado]);
  const loadPending = useCallback(async () => {
    const r = await api("/api/pilot/nfc/validation/pending"); if (r.ok) setPending(await r.json());
  }, []);
  const loadForms = useCallback(async () => {
    const r = await api("/api/pilot/nfc/supervisor/forms"); if (r.ok) setForms(await r.json());
  }, []);
  const loadAudit = useCallback(async () => {
    const r = await api("/api/pilot/nfc/audit-logs"); if (r.ok) setAuditLogs(await r.json());
  }, []);
  const loadRefs = useCallback(async () => {
    const [rp, re] = await Promise.all([api("/api/pilot/nfc/ref/puestos"), api("/api/pilot/nfc/ref/empleados")]);
    if (rp.ok) setRefPuestos(await rp.json());
    if (re.ok) setRefEmpleados(await re.json());
  }, []);

  const reloadAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([loadDashboard(), loadDevices(), loadTags(), loadRefs()]);
    setLoading(false);
  }, [loadDashboard, loadDevices, loadTags, loadRefs]);

  useEffect(() => { reloadAll(); }, [reloadAll]);
  useEffect(() => { if (tab === "events") loadEvents(); }, [tab, loadEvents, evDesde, evHasta, evEstado]);
  useEffect(() => { if (tab === "validation") loadPending(); }, [tab, loadPending]);
  useEffect(() => { if (tab === "forms") loadForms(); }, [tab, loadForms]);
  useEffect(() => { if (tab === "audit") loadAudit(); }, [tab, loadAudit]);

  // ── Actions ──────────────────────────────────────────────────────────────
  async function createDevice() {
    if (!devForm.device_code || !devForm.device_name) return toast({ title: "Campos requeridos", variant: "destructive" });
    setSaving(true);
    const r = await api("/api/pilot/nfc/devices", { method: "POST", body: JSON.stringify({ ...devForm, puesto_id_ref: devForm.puesto_id_ref || null }) });
    setSaving(false);
    if (r.ok) {
      toast({ title: "Dispositivo creado" });
      setShowDevModal(false); setDevForm({ device_code: "", device_name: "", puesto_id_ref: "", notes: "" });
      loadDevices(); loadDashboard();
    } else { toast({ title: "Error", description: await r.text(), variant: "destructive" }); }
  }

  async function createTag() {
    if (!tagForm.tag_uid) return toast({ title: "UID requerido", variant: "destructive" });
    setSaving(true);
    const r = await api("/api/pilot/nfc/tags", { method: "POST", body: JSON.stringify({ ...tagForm, empleado_id_ref: tagForm.empleado_id_ref || null }) });
    setSaving(false);
    if (r.ok) {
      toast({ title: "Tag registrado" });
      setShowTagModal(false); setTagForm({ tag_uid: "", profile_type: "AGENTE", empleado_id_ref: "", alias: "", notes: "" });
      loadTags(); loadDashboard();
    } else { toast({ title: "Error", description: await r.text(), variant: "destructive" }); }
  }

  async function revokeTag(id: number) {
    if (!confirm("¿Revocar este tag? Ya no podrá usarse para marcar.")) return;
    const r = await api(`/api/pilot/nfc/tags/${id}/revoke`, { method: "POST" });
    if (r.ok) { toast({ title: "Tag revocado" }); loadTags(); } else { toast({ title: "Error", variant: "destructive" }); }
  }

  async function toggleDevice(dev: NfcDevice) {
    const newStatus = dev.status === "active" ? "inactive" : "active";
    const r = await api(`/api/pilot/nfc/devices/${dev.id}`, { method: "PATCH", body: JSON.stringify({ status: newStatus }) });
    if (r.ok) { toast({ title: newStatus === "active" ? "Dispositivo activado" : "Dispositivo desactivado" }); loadDevices(); }
  }

  async function approveVal(id: number) {
    const r = await api(`/api/pilot/nfc/validation/${id}/approve`, { method: "POST", body: JSON.stringify({ notas: valNota }) });
    if (r.ok) { toast({ title: "Evento validado" }); setShowValModal(null); setValNota(""); loadPending(); loadDashboard(); }
    else { toast({ title: "Error", variant: "destructive" }); }
  }

  async function rejectVal(id: number) {
    const r = await api(`/api/pilot/nfc/validation/${id}/reject`, { method: "POST", body: JSON.stringify({ notas: valNota }) });
    if (r.ok) { toast({ title: "Evento rechazado" }); setShowValModal(null); setValNota(""); loadPending(); loadDashboard(); }
    else { toast({ title: "Error", variant: "destructive" }); }
  }

  // ── Filtered data ────────────────────────────────────────────────────────
  const filteredDevices = devices.filter(d =>
    d.device_name.toLowerCase().includes(devSearch.toLowerCase()) ||
    d.device_code.toLowerCase().includes(devSearch.toLowerCase())
  );
  const filteredTags = tags.filter(t =>
    t.tag_uid.toLowerCase().includes(tagSearch.toLowerCase()) ||
    (t.alias || "").toLowerCase().includes(tagSearch.toLowerCase()) ||
    (t.empleado_nombre || "").toLowerCase().includes(tagSearch.toLowerCase())
  );

  // ── Kiosk mode ────────────────────────────────────────────────────────────
  if (kioskOpen) {
    return <KioskScreen devices={devices} onClose={kioskMode ? undefined : () => setKioskOpen(false)} />;
  }

  const tabs = [
    { id: "dashboard", label: "Dashboard", icon: <BarChart3 className="w-3.5 h-3.5" /> },
    { id: "devices", label: "Dispositivos", icon: <Smartphone className="w-3.5 h-3.5" />, badge: devices.length || undefined },
    { id: "tags", label: "Tags NFC", icon: <Tag className="w-3.5 h-3.5" />, badge: tags.filter(t => t.status === "active").length || undefined },
    { id: "events", label: "Eventos", icon: <Activity className="w-3.5 h-3.5" /> },
    { id: "validation", label: "Validación", icon: <ShieldCheck className="w-3.5 h-3.5" />, badge: pending.length || undefined, badgeColor: "red" },
    { id: "forms", label: "Supervisión", icon: <ClipboardList className="w-3.5 h-3.5" /> },
    { id: "audit", label: "Auditoría", icon: <History className="w-3.5 h-3.5" /> },
  ] as const;

  return (
    <AdminLayout title="Control Operativo NFC · Piloto">
      {/* Sandbox banner */}
      <div className="mb-4 flex items-center gap-3 bg-amber-500/10 border border-amber-500/25 rounded-xl px-4 py-2.5">
        <Cpu className="w-4 h-4 text-amber-400 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-xs text-amber-300 font-semibold">MODO SANDBOX ACTIVO</p>
          <p className="text-[11px] text-amber-300/60">Este módulo opera en aislamiento total. No afecta planilla, pre-planilla, RRHH ni el pizarrón operativo.</p>
        </div>
        <button
          onClick={() => setKioskOpen(true)}
          className="flex items-center gap-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 px-3 py-2 rounded-lg transition-colors shrink-0"
        >
          <Maximize2 className="w-3.5 h-3.5" />Modo Kiosko
        </button>
        <button onClick={reloadAll} disabled={loading} className="p-2 rounded-lg hover:bg-white/10 text-white/40 hover:text-white transition-colors">
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 mb-5 overflow-x-auto pb-1">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id as typeof tab)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-colors relative ${tab === t.id ? "bg-blue-600/20 text-blue-300 border border-blue-500/25" : "text-white/50 hover:text-white hover:bg-white/5"}`}
          >
            {t.icon}{t.label}
            {"badge" in t && t.badge ? (
              <span className={`ml-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full ${"badgeColor" in t && t.badgeColor === "red" ? "bg-red-500/20 text-red-300" : "bg-blue-500/20 text-blue-300"}`}>{t.badge}</span>
            ) : null}
          </button>
        ))}
      </div>

      {/* ── DASHBOARD ────────────────────────────────────────────────────── */}
      {tab === "dashboard" && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <StatCard label="Dispositivos" value={stats?.total_devices ?? 0} icon={<Smartphone className="w-4 h-4" />} color="blue" />
            <StatCard label="Tags activos" value={stats?.active_tags ?? 0} icon={<Tag className="w-4 h-4" />} color="green" />
            <StatCard label="Eventos hoy" value={stats?.events_today ?? 0} icon={<Activity className="w-4 h-4" />} color="purple" />
            <StatCard label="Pend. validación" value={stats?.pending_validations ?? 0} icon={<Clock className="w-4 h-4" />} color="amber" />
            <StatCard label="Supervisiones hoy" value={stats?.supervisor_forms_today ?? 0} icon={<Shield className="w-4 h-4" />} color="blue" />
          </div>

          {/* Last events */}
          <div className="bg-white/3 border border-white/8 rounded-xl">
            <div className="px-5 py-3 border-b border-white/8 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">Últimos eventos</h3>
              <button onClick={() => setTab("events")} className="text-xs text-blue-400 hover:text-blue-300">Ver todos</button>
            </div>
            {!stats?.last_events.length ? (
              <div className="py-10 text-center text-white/30 text-sm">Sin eventos registrados aún</div>
            ) : (
              <div className="divide-y divide-white/5">
                {stats.last_events.map(ev => (
                  <div key={ev.id} className="flex items-center gap-3 px-5 py-3">
                    <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
                      {ev.profile_type === "SUPERVISOR" ? <Shield className="w-4 h-4 text-indigo-400" /> : <User className="w-4 h-4 text-blue-400" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white font-medium truncate">{ev.nombre_empleado || "—"}</p>
                      <p className="text-xs text-white/40 truncate">{ev.nombre_puesto || "—"}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <EventTypeBadge type={ev.event_type} />
                      <span className="text-[10px] text-white/30">{fmtDate(ev.event_at)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quick actions */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: "Registrar dispositivo", icon: <Smartphone className="w-4 h-4" />, action: () => { setTab("devices"); setShowDevModal(true); } },
              { label: "Registrar tag NFC", icon: <Tag className="w-4 h-4" />, action: () => { setTab("tags"); setShowTagModal(true); } },
              { label: "Revisar pendientes", icon: <ShieldCheck className="w-4 h-4" />, action: () => setTab("validation") },
              { label: "Abrir kiosko", icon: <Maximize2 className="w-4 h-4" />, action: () => setKioskOpen(true) },
            ].map((q, i) => (
              <button
                key={i}
                onClick={q.action}
                className="flex items-center gap-3 px-4 py-3.5 bg-white/4 border border-white/8 hover:bg-white/8 hover:border-white/15 rounded-xl transition-colors text-left"
              >
                <span className="text-blue-400">{q.icon}</span>
                <span className="text-sm text-white/80 font-medium">{q.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── DEVICES ──────────────────────────────────────────────────────── */}
      {tab === "devices" && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
              <input value={devSearch} onChange={e => setDevSearch(e.target.value)} placeholder="Buscar dispositivo..." className={`${inputCls} pl-9`} />
            </div>
            <button onClick={() => setShowDevModal(true)} className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors">
              <Plus className="w-3.5 h-3.5" />Nuevo
            </button>
          </div>

          {!filteredDevices.length ? (
            <div className="py-16 text-center text-white/30 text-sm">
              <Smartphone className="w-8 h-8 mx-auto mb-2 opacity-20" />
              No hay dispositivos registrados
            </div>
          ) : (
            <div className="space-y-2">
              {filteredDevices.map(dev => (
                <div key={dev.id} className="flex items-center gap-4 bg-white/3 border border-white/8 rounded-xl px-5 py-3.5">
                  <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0">
                    <Smartphone className="w-5 h-5 text-blue-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-white">{dev.device_name}</p>
                      <StatusDot status={dev.status} />
                      <span className="text-[10px] text-amber-300 bg-amber-500/10 px-1.5 py-0.5 rounded font-mono">sandbox</span>
                    </div>
                    <p className="text-xs text-white/40 font-mono mt-0.5">{dev.device_code}</p>
                    {dev.nombre_puesto && <p className="text-xs text-white/30 mt-0.5">{dev.nombre_puesto}</p>}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[10px] text-white/30">{dev.last_seen_at ? `Visto: ${fmtDate(dev.last_seen_at)}` : "Sin actividad"}</p>
                    <div className="flex items-center gap-2 mt-1 justify-end">
                      <button
                        onClick={() => toggleDevice(dev)}
                        className={`text-[10px] px-2.5 py-1 rounded-lg border font-semibold transition-colors ${dev.status === "active" ? "text-red-300/70 border-red-500/20 hover:bg-red-500/10" : "text-green-300/70 border-green-500/20 hover:bg-green-500/10"}`}
                      >
                        {dev.status === "active" ? "Desactivar" : "Activar"}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── TAGS ────────────────────────────────────────────────────────── */}
      {tab === "tags" && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
              <input value={tagSearch} onChange={e => setTagSearch(e.target.value)} placeholder="Buscar tag, empleado, alias..." className={`${inputCls} pl-9`} />
            </div>
            <button onClick={() => setShowTagModal(true)} className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors">
              <Plus className="w-3.5 h-3.5" />Nuevo tag
            </button>
          </div>

          {!filteredTags.length ? (
            <div className="py-16 text-center text-white/30 text-sm">
              <Tag className="w-8 h-8 mx-auto mb-2 opacity-20" />
              No hay tags registrados
            </div>
          ) : (
            <div className="space-y-2">
              {filteredTags.map(tag => (
                <div key={tag.id} className={`flex items-center gap-4 border rounded-xl px-5 py-3.5 ${tag.status === "revoked" ? "bg-red-500/5 border-red-500/15 opacity-60" : "bg-white/3 border-white/8"}`}>
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${tag.profile_type === "SUPERVISOR" ? "bg-indigo-500/15 border border-indigo-500/25" : "bg-green-500/10 border border-green-500/20"}`}>
                    {tag.profile_type === "SUPERVISOR" ? <Shield className="w-5 h-5 text-indigo-400" /> : <User className="w-5 h-5 text-green-400" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-white">{tag.alias || tag.tag_uid}</p>
                      <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${tag.profile_type === "SUPERVISOR" ? "bg-indigo-500/15 text-indigo-300" : "bg-green-500/10 text-green-300"}`}>{tag.profile_type}</span>
                      {tag.status !== "active" && <span className="text-[9px] bg-red-500/15 text-red-300 px-1.5 py-0.5 rounded uppercase">{tag.status}</span>}
                    </div>
                    <p className="text-xs text-white/40 font-mono mt-0.5">{tag.tag_uid}</p>
                    {tag.empleado_nombre && <p className="text-xs text-white/30">{tag.empleado_nombre}</p>}
                  </div>
                  <div className="shrink-0 flex items-center gap-2">
                    <p className="text-[10px] text-white/25">{fmtDate(tag.created_at)}</p>
                    {tag.status === "active" && (
                      <button onClick={() => revokeTag(tag.id)} className="text-[10px] text-red-300/60 border border-red-500/20 hover:bg-red-500/10 px-2.5 py-1 rounded-lg font-semibold transition-colors flex items-center gap-1">
                        <Ban className="w-3 h-3" />Revocar
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── EVENTS ──────────────────────────────────────────────────────── */}
      {tab === "events" && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 flex-wrap">
            <input type="date" value={evDesde} onChange={e => setEvDesde(e.target.value)} className={`${inputCls} w-36 [color-scheme:dark]`} placeholder="Desde" />
            <input type="date" value={evHasta} onChange={e => setEvHasta(e.target.value)} className={`${inputCls} w-36 [color-scheme:dark]`} placeholder="Hasta" />
            <select value={evEstado} onChange={e => setEvEstado(e.target.value)} className={`${selectCls} w-44`}>
              <option value="">Todos los estados</option>
              <option value="pendiente">Pendiente</option>
              <option value="validado_manualmente">Validado</option>
              <option value="rechazado">Rechazado</option>
            </select>
            <button onClick={loadEvents} className="flex items-center gap-1.5 bg-blue-600/20 border border-blue-500/30 text-blue-300 text-xs px-3 py-2 rounded-lg hover:bg-blue-600/30 transition-colors">
              <Search className="w-3.5 h-3.5" />Filtrar
            </button>
          </div>

          {!events.length ? (
            <div className="py-16 text-center text-white/30 text-sm">
              <Activity className="w-8 h-8 mx-auto mb-2 opacity-20" />
              Sin eventos en el período seleccionado
            </div>
          ) : (
            <div className="bg-white/3 border border-white/8 rounded-xl overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-white/8">
                    {["Hora", "Empleado", "Puesto", "Tipo", "Programación", "Validación"].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-white/40 font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {events.map(ev => (
                    <tr key={ev.id} className="hover:bg-white/3 transition-colors">
                      <td className="px-4 py-3 text-white/50 whitespace-nowrap">{fmtDate(ev.event_at)}</td>
                      <td className="px-4 py-3 text-white font-medium">{ev.nombre_empleado || "—"}</td>
                      <td className="px-4 py-3 text-white/60">{ev.nombre_puesto || "—"}</td>
                      <td className="px-4 py-3"><EventTypeBadge type={ev.event_type} /></td>
                      <td className="px-4 py-3"><SchedBadge status={ev.scheduled_status} /></td>
                      <td className="px-4 py-3"><ValBadge status={ev.validation_status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── VALIDATION QUEUE ────────────────────────────────────────────── */}
      {tab === "validation" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-white/60">{pending.length} eventos pendientes de validación manual</p>
            <button onClick={loadPending} className="flex items-center gap-1 text-xs text-white/40 hover:text-white/70"><RefreshCw className="w-3.5 h-3.5" />Actualizar</button>
          </div>

          {!pending.length ? (
            <div className="py-16 text-center">
              <CheckCircle className="w-10 h-10 mx-auto mb-3 text-green-400/40" />
              <p className="text-white/30 text-sm">No hay eventos pendientes de validación</p>
            </div>
          ) : (
            <div className="space-y-3">
              {pending.map(ev => (
                <div key={ev.id} className="bg-white/3 border border-amber-500/20 rounded-xl p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
                      <Clock className="w-5 h-5 text-amber-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-white">{ev.nombre_empleado || "Agente sin ID"}</p>
                        <EventTypeBadge type={ev.event_type} />
                        <SchedBadge status={ev.scheduled_status} />
                      </div>
                      <p className="text-xs text-white/40 mt-0.5">{ev.nombre_puesto || "—"} · {ev.device_name || "—"}</p>
                      <p className="text-[11px] text-white/30 mt-0.5 font-mono">{fmtDate(ev.event_at)} · Tag: {ev.tag_uid || "—"}</p>
                      {ev.photo_path && <p className="text-[10px] text-blue-300/50 mt-0.5 flex items-center gap-1"><Camera className="w-3 h-3" />Foto disponible</p>}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => { setShowValModal(ev); setValNota(""); }}
                        className="flex items-center gap-1 text-xs font-semibold text-blue-300 border border-blue-500/25 bg-blue-500/8 hover:bg-blue-500/15 px-3 py-1.5 rounded-lg transition-colors"
                      >
                        <Eye className="w-3 h-3" />Revisar
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── SUPERVISOR FORMS ────────────────────────────────────────────── */}
      {tab === "forms" && (
        <div className="space-y-4">
          {!forms.length ? (
            <div className="py-16 text-center">
              <ClipboardList className="w-10 h-10 mx-auto mb-3 text-white/20" />
              <p className="text-white/30 text-sm">No hay formularios de supervisión registrados</p>
            </div>
          ) : (
            <div className="space-y-2">
              {forms.map(f => (
                <div key={f.id} className="bg-white/3 border border-white/8 rounded-xl px-5 py-3.5">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center shrink-0">
                      <Shield className="w-5 h-5 text-indigo-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-white">{f.nombre_puesto || "—"}</p>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full ${f.puesto_estado === "sin_novedad" ? "bg-green-500/10 text-green-300" : f.puesto_estado === "riesgo_detectado" ? "bg-red-500/10 text-red-300" : "bg-amber-500/10 text-amber-300"}`}>
                          {f.puesto_estado.replace(/_/g," ")}
                        </span>
                      </div>
                      <p className="text-xs text-white/40 mt-0.5">
                        Supervisor: {f.supervisor_nombre || "—"} · Agente: {f.agente_nombre || "—"}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-[10px] text-white/30">{fmtDate(f.created_at)}</p>
                      <div className="flex gap-1.5 mt-1 justify-end text-[10px] text-white/40">
                        <span>Arma: <span className={f.arma_estado === "sin_novedad" ? "text-green-300" : "text-amber-300"}>{f.arma_estado.replace(/_/g," ")}</span></span>
                        <span>·</span>
                        <span>Uniforme: <span className={f.uniforme_estado === "completo" ? "text-green-300" : "text-amber-300"}>{f.uniforme_estado.replace(/_/g," ")}</span></span>
                      </div>
                    </div>
                  </div>
                  {f.observaciones && (
                    <p className="mt-2 pt-2 border-t border-white/5 text-xs text-white/40 italic">{f.observaciones}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── AUDIT LOG ───────────────────────────────────────────────────── */}
      {tab === "audit" && (
        <div>
          {!auditLogs.length ? (
            <div className="py-16 text-center text-white/30 text-sm">
              <History className="w-8 h-8 mx-auto mb-2 opacity-20" />
              Sin registros de auditoría
            </div>
          ) : (
            <div className="bg-white/3 border border-white/8 rounded-xl overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-white/8">
                    {["Fecha", "Entidad", "ID", "Acción", "Actor"].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-white/40 font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {auditLogs.map(log => (
                    <tr key={log.id} className="hover:bg-white/3">
                      <td className="px-4 py-2.5 text-white/40 whitespace-nowrap">{fmtDate(log.created_at)}</td>
                      <td className="px-4 py-2.5 text-white/70 font-mono">{log.entity_type}</td>
                      <td className="px-4 py-2.5 text-white/40">{log.entity_id ?? "—"}</td>
                      <td className="px-4 py-2.5">
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${log.action.includes("reject") ? "bg-red-500/10 text-red-300" : log.action.includes("approve") || log.action.includes("ok") ? "bg-green-500/10 text-green-300" : "bg-blue-500/10 text-blue-300"}`}>{log.action}</span>
                      </td>
                      <td className="px-4 py-2.5 text-white/50">{log.actor || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── MODALS ────────────────────────────────────────────────────────── */}

      {/* New device modal */}
      {showDevModal && (
        <Modal title="Registrar dispositivo NFC" onClose={() => setShowDevModal(false)}>
          <div className="space-y-4">
            <Field label="Código del dispositivo *">
              <input value={devForm.device_code} onChange={e => setDevForm(p => ({ ...p, device_code: e.target.value.toUpperCase() }))} placeholder="Ej. TABLET-PUESTO-001" className={inputCls} />
            </Field>
            <Field label="Nombre del dispositivo *">
              <input value={devForm.device_name} onChange={e => setDevForm(p => ({ ...p, device_name: e.target.value }))} placeholder="Ej. Tablet Puesto Principal Torre A" className={inputCls} />
            </Field>
            <Field label="Puesto operativo (referencia, solo lectura)">
              <select value={devForm.puesto_id_ref} onChange={e => setDevForm(p => ({ ...p, puesto_id_ref: e.target.value }))} className={selectCls}>
                <option value="">— Sin asignar —</option>
                {refPuestos.map(p => <option key={p.id} value={p.id}>{p.nombre_puesto}</option>)}
              </select>
            </Field>
            <Field label="Notas">
              <textarea value={devForm.notes} onChange={e => setDevForm(p => ({ ...p, notes: e.target.value }))} rows={2} placeholder="Notas opcionales..." className={`${inputCls} resize-none`} />
            </Field>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowDevModal(false)} className="flex-1 py-2.5 bg-white/5 border border-white/10 text-white/60 rounded-xl text-sm hover:text-white transition-colors">Cancelar</button>
              <button onClick={createDevice} disabled={saving} className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}Registrar
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* New tag modal */}
      {showTagModal && (
        <Modal title="Registrar tag NFC" onClose={() => setShowTagModal(false)}>
          <div className="space-y-4">
            <Field label="UID del tag NFC *">
              <input value={tagForm.tag_uid} onChange={e => setTagForm(p => ({ ...p, tag_uid: e.target.value.toUpperCase() }))} placeholder="Ej. A1B2C3D4 (del llavero NFC)" className={inputCls} />
            </Field>
            <Field label="Tipo de perfil">
              <select value={tagForm.profile_type} onChange={e => setTagForm(p => ({ ...p, profile_type: e.target.value }))} className={selectCls}>
                <option value="AGENTE">Agente</option>
                <option value="SUPERVISOR">Supervisor</option>
              </select>
            </Field>
            <Field label="Empleado asociado (referencia)">
              <select value={tagForm.empleado_id_ref} onChange={e => setTagForm(p => ({ ...p, empleado_id_ref: e.target.value }))} className={selectCls}>
                <option value="">— Sin vincular —</option>
                {refEmpleados.map(e => <option key={e.id} value={e.id}>{e.nombre_completo} ({e.tipo_personal})</option>)}
              </select>
            </Field>
            <Field label="Alias / nombre del llavero">
              <input value={tagForm.alias} onChange={e => setTagForm(p => ({ ...p, alias: e.target.value }))} placeholder="Ej. Llavero Rojo #012" className={inputCls} />
            </Field>
            <Field label="Notas">
              <textarea value={tagForm.notes} onChange={e => setTagForm(p => ({ ...p, notes: e.target.value }))} rows={2} className={`${inputCls} resize-none`} />
            </Field>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowTagModal(false)} className="flex-1 py-2.5 bg-white/5 border border-white/10 text-white/60 rounded-xl text-sm hover:text-white transition-colors">Cancelar</button>
              <button onClick={createTag} disabled={saving} className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}Registrar
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Validation modal */}
      {showValModal && (
        <Modal title="Revisar evento piloto" onClose={() => setShowValModal(null)}>
          <div className="space-y-4">
            <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-2">
              <div className="flex items-center gap-2">
                <EventTypeBadge type={showValModal.event_type} />
                <SchedBadge status={showValModal.scheduled_status} />
              </div>
              <p className="text-white font-semibold">{showValModal.nombre_empleado || "Agente"}</p>
              <p className="text-sm text-white/50">{showValModal.nombre_puesto || "—"} · {showValModal.device_name || "—"}</p>
              <p className="text-xs text-white/30 font-mono">{fmtDate(showValModal.event_at)}</p>
              {showValModal.photo_path && (
                <div className="mt-2 pt-2 border-t border-white/8">
                  <p className="text-[10px] text-blue-300/50 flex items-center gap-1"><Camera className="w-3 h-3" />Foto capturada: {showValModal.photo_path}</p>
                </div>
              )}
            </div>
            <Field label="Nota de revisión">
              <textarea value={valNota} onChange={e => setValNota(e.target.value)} rows={2} placeholder="Observaciones del revisor..." className={`${inputCls} resize-none`} />
            </Field>
            <div className="flex gap-3">
              <button
                onClick={() => rejectVal(showValModal.id)}
                className="flex-1 py-2.5 bg-red-500/10 border border-red-500/25 text-red-300 hover:bg-red-500/15 rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2"
              >
                <XCircle className="w-4 h-4" />Rechazar
              </button>
              <button
                onClick={() => approveVal(showValModal.id)}
                className="flex-1 py-2.5 bg-green-600/20 border border-green-500/25 text-green-300 hover:bg-green-600/30 rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2"
              >
                <ShieldCheck className="w-4 h-4" />Validar
              </button>
            </div>
          </div>
        </Modal>
      )}
    </AdminLayout>
  );
}
