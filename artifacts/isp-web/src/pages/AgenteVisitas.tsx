import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowLeft, Camera, UserCheck, Car, Loader2, CheckCircle2, XCircle,
  Search, Clock, AlertTriangle, RefreshCw, Trash2, X,
} from "lucide-react";

const API = "/api";
const DEVICE_KEY = "isp_device";

interface DeviceCreds { uuid: string; token: string }

interface VisitaAbierta {
  id: number;
  tipo: "persona" | "vehiculo";
  dpi_numero: string | null;
  nombre_completo: string | null;
  placa: string | null;
  marca_vehiculo: string | null;
  color_vehiculo: string | null;
  conductor_nombre: string | null;
  motivo: string | null;
  a_quien_visita: string | null;
  entrada_at: string;
  foto_persona_url: string | null;
  foto_vehiculo_url: string | null;
}

function leerDeviceCreds(): DeviceCreds | null {
  try {
    const raw = localStorage.getItem(DEVICE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as DeviceCreds;
    if (!p.uuid || !p.token) return null;
    return p;
  } catch { return null; }
}

function fmtHora(iso: string): string {
  return new Date(iso).toLocaleTimeString("es-GT", {
    hour: "2-digit", minute: "2-digit", timeZone: "America/Guatemala",
  });
}
function fmtDuracion(iso: string): string {
  const min = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
  if (min < 60) return `${min} min`;
  return `${Math.floor(min/60)}h ${min%60}min`;
}

type Vista = "menu" | "elegir_tipo" | "entrada_persona" | "entrada_vehiculo" | "salida_lista";

export default function AgenteVisitas() {
  const [device] = useState<DeviceCreds | null>(() => leerDeviceCreds());
  const [vista, setVista] = useState<Vista>("menu");
  const [puestoNombre, setPuestoNombre] = useState<string>("");
  const [clienteNombre, setClienteNombre] = useState<string>("");
  const [personas, setPersonas] = useState<VisitaAbierta[]>([]);
  const [vehiculos, setVehiculos] = useState<VisitaAbierta[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  // Si no hay device, mensaje y botón para volver
  if (!device) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6 text-center">
        <AlertTriangle className="w-16 h-16 text-amber-400 mb-4" />
        <h1 className="text-2xl font-bold mb-2">Teléfono no autorizado</h1>
        <p className="text-slate-400 mb-6 text-sm">
          Este teléfono no está vinculado a un puesto. Pedile al admin que lo registre.
        </p>
        <a href="/agente/inicio" className="bg-blue-600 hover:bg-blue-700 px-6 py-3 rounded-lg font-semibold">
          Volver al inicio
        </a>
      </div>
    );
  }

  async function cargarAbiertas() {
    setLoading(true);
    setErr(null);
    try {
      const r = await fetch(
        `${API}/agente/visitas/abiertas?device_uuid=${encodeURIComponent(device!.uuid)}&device_token=${encodeURIComponent(device!.token)}`
      );
      const data = await r.json();
      if (!r.ok) {
        setErr(data.mensaje || data.error || "Error cargando visitas abiertas");
        return;
      }
      setPersonas(data.personas ?? []);
      setVehiculos(data.vehiculos ?? []);
      setPuestoNombre(data.puesto_nombre || "");
      setClienteNombre(data.cliente_nombre || "");
    } catch {
      setErr("No se pudo conectar con el servidor");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void cargarAbiertas();
    const t = setInterval(() => void cargarAbiertas(), 30000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function showOk(msg: string) {
    setOkMsg(msg);
    setTimeout(() => setOkMsg(null), 3000);
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col">
      {/* Header */}
      <header className="bg-[#060e1c] border-b border-slate-800 px-4 py-3 flex items-center gap-3 sticky top-0 z-20">
        {vista !== "menu" ? (
          <button onClick={() => setVista("menu")} className="text-slate-300 hover:text-white">
            <ArrowLeft className="w-5 h-5" />
          </button>
        ) : (
          <a href="/agente/inicio" className="text-slate-300 hover:text-white">
            <ArrowLeft className="w-5 h-5" />
          </a>
        )}
        <div className="flex-1 min-w-0">
          <div className="font-bold text-sm leading-tight">Visitas</div>
          <div className="text-[11px] text-slate-400 truncate">
            {puestoNombre} {clienteNombre && `· ${clienteNombre}`}
          </div>
        </div>
      </header>

      {/* Mensajes globales */}
      {err && (
        <div className="bg-rose-500/10 border-b border-rose-500/30 px-4 py-2 text-xs text-rose-200 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{err}</span>
          <button onClick={() => setErr(null)} className="ml-auto"><X className="w-3.5 h-3.5" /></button>
        </div>
      )}
      {okMsg && (
        <div className="bg-emerald-500/10 border-b border-emerald-500/30 px-4 py-2 text-xs text-emerald-200 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          <span>{okMsg}</span>
        </div>
      )}

      <main className="flex-1 px-4 py-5 max-w-md mx-auto w-full">
        {vista === "menu" && (
          <MenuPrincipal
            personas={personas}
            vehiculos={vehiculos}
            loading={loading}
            onRegistrarEntrada={() => setVista("elegir_tipo")}
            onRegistrarSalida={() => setVista("salida_lista")}
            onRefresh={cargarAbiertas}
          />
        )}

        {vista === "elegir_tipo" && (
          <ElegirTipo
            onPersona={() => setVista("entrada_persona")}
            onVehiculo={() => setVista("entrada_vehiculo")}
          />
        )}

        {vista === "entrada_persona" && (
          <EntradaPersona
            device={device}
            onCancel={() => setVista("menu")}
            onSuccess={(nombre) => { showOk(`Entrada registrada: ${nombre}`); setVista("menu"); void cargarAbiertas(); }}
          />
        )}

        {vista === "entrada_vehiculo" && (
          <EntradaVehiculo
            device={device}
            onCancel={() => setVista("menu")}
            onSuccess={(placa) => { showOk(`Entrada registrada: ${placa}`); setVista("menu"); void cargarAbiertas(); }}
          />
        )}

        {vista === "salida_lista" && (
          <SalidaLista
            device={device}
            personas={personas}
            vehiculos={vehiculos}
            loading={loading}
            onSuccess={(label) => { showOk(`Salida registrada: ${label}`); void cargarAbiertas(); }}
            onError={(m) => setErr(m)}
          />
        )}
      </main>
    </div>
  );
}

// ─── Menú principal ─────────────────────────────────────────────────────────
function MenuPrincipal({
  personas, vehiculos, loading, onRegistrarEntrada, onRegistrarSalida, onRefresh,
}: {
  personas: VisitaAbierta[]; vehiculos: VisitaAbierta[]; loading: boolean;
  onRegistrarEntrada: () => void; onRegistrarSalida: () => void; onRefresh: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-3">
          <div className="flex items-center gap-1.5 text-[11px] text-emerald-300 font-semibold uppercase">
            <UserCheck className="w-3 h-3" /> Personas adentro
          </div>
          <div className="text-2xl font-bold text-white mt-0.5">{personas.length}</div>
        </div>
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
          <div className="flex items-center gap-1.5 text-[11px] text-blue-300 font-semibold uppercase">
            <Car className="w-3 h-3" /> Vehículos adentro
          </div>
          <div className="text-2xl font-bold text-white mt-0.5">{vehiculos.length}</div>
        </div>
      </div>

      <button
        onClick={onRegistrarEntrada}
        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-5 rounded-lg flex items-center justify-center gap-2 text-lg"
      >
        <UserCheck className="w-6 h-6" /> Registrar ENTRADA
      </button>

      <button
        onClick={onRegistrarSalida}
        disabled={personas.length + vehiculos.length === 0}
        className="w-full bg-rose-600 hover:bg-rose-700 disabled:bg-slate-700 disabled:cursor-not-allowed text-white font-bold py-5 rounded-lg flex items-center justify-center gap-2 text-lg"
      >
        <Clock className="w-6 h-6" /> Registrar SALIDA
      </button>

      <div className="flex items-center justify-between pt-2">
        <span className="text-[11px] text-slate-500">Quién está adentro:</span>
        <button onClick={onRefresh} className="text-xs text-slate-400 hover:text-white flex items-center gap-1">
          <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} /> Refrescar
        </button>
      </div>

      {(personas.length + vehiculos.length) === 0 ? (
        <div className="text-center text-slate-500 text-sm bg-slate-900/40 border border-slate-800 rounded-lg py-6">
          Nadie adentro en este momento.
        </div>
      ) : (
        <div className="space-y-2">
          {personas.map(p => (
            <div key={p.id} className="bg-slate-900 border border-slate-800 rounded-lg p-3 flex items-center gap-3">
              <UserCheck className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{p.nombre_completo}</div>
                <div className="text-[11px] text-slate-500 font-mono">{p.dpi_numero}</div>
                {p.a_quien_visita && <div className="text-[11px] text-slate-400">→ {p.a_quien_visita}</div>}
              </div>
              <div className="text-right text-[11px]">
                <div className="text-slate-300">{fmtHora(p.entrada_at)}</div>
                <div className="text-slate-500">{fmtDuracion(p.entrada_at)}</div>
              </div>
            </div>
          ))}
          {vehiculos.map(v => (
            <div key={v.id} className="bg-slate-900 border border-slate-800 rounded-lg p-3 flex items-center gap-3">
              <Car className="w-4 h-4 text-blue-400 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-mono font-bold truncate">{v.placa}</div>
                <div className="text-[11px] text-slate-500">
                  {[v.marca_vehiculo, v.color_vehiculo].filter(Boolean).join(" · ")}
                </div>
                {v.conductor_nombre && <div className="text-[11px] text-slate-400">Cond: {v.conductor_nombre}</div>}
              </div>
              <div className="text-right text-[11px]">
                <div className="text-slate-300">{fmtHora(v.entrada_at)}</div>
                <div className="text-slate-500">{fmtDuracion(v.entrada_at)}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Elegir tipo ────────────────────────────────────────────────────────────
function ElegirTipo({ onPersona, onVehiculo }: { onPersona: () => void; onVehiculo: () => void }) {
  return (
    <div className="space-y-4 pt-4">
      <h2 className="text-xl font-bold text-center">¿Qué entra?</h2>
      <button
        onClick={onPersona}
        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-8 rounded-lg flex flex-col items-center gap-2"
      >
        <UserCheck className="w-12 h-12" />
        <span className="text-lg">Persona</span>
      </button>
      <button
        onClick={onVehiculo}
        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-8 rounded-lg flex flex-col items-center gap-2"
      >
        <Car className="w-12 h-12" />
        <span className="text-lg">Vehículo</span>
      </button>
    </div>
  );
}

// ─── Entrada de persona ─────────────────────────────────────────────────────
function EntradaPersona({
  device, onCancel, onSuccess,
}: { device: DeviceCreds; onCancel: () => void; onSuccess: (nombre: string) => void }) {
  const [paso, setPaso] = useState<"foto_dpi" | "datos" | "foto_persona" | "extra" | "guardando">("foto_dpi");
  const [fotoDpi, setFotoDpi] = useState<string | null>(null);
  const [extrayendo, setExtrayendo] = useState(false);
  const [datos, setDatos] = useState({ nombre_completo: "", dpi_numero: "", fecha_nacimiento: "", genero: "" });
  const [fotoPersona, setFotoPersona] = useState<string | null>(null);
  const [extra, setExtra] = useState({ a_quien_visita: "", motivo: "", observaciones: "" });
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const fileRef2 = useRef<HTMLInputElement>(null);

  async function tomarFotoDpi(file: File) {
    setError(null);
    if (file.size > 6 * 1024 * 1024) {
      setError("La foto pesa más de 6MB. Intenta con menor calidad.");
      return;
    }
    const dataUrl = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.readAsDataURL(file);
    });
    setFotoDpi(dataUrl);
    setExtrayendo(true);
    try {
      const r = await fetch(`${API}/agente/visitas/extraer-dpi`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imagen: dataUrl, device_uuid: device.uuid, device_token: device.token }),
      });
      const data = await r.json();
      if (!r.ok) {
        setError(data.error || "No se pudo leer el DPI. Llena los datos a mano.");
      } else {
        setDatos({
          nombre_completo: data.datos?.nombre_completo ?? "",
          dpi_numero: data.datos?.dpi ?? "",
          fecha_nacimiento: data.datos?.fecha_nacimiento ?? "",
          genero: data.datos?.genero ?? "",
        });
      }
      setPaso("datos");
    } catch {
      setError("Error contactando IA. Llena los datos a mano.");
      setPaso("datos");
    } finally {
      setExtrayendo(false);
    }
  }

  async function tomarFotoPersona(file: File) {
    if (file.size > 6 * 1024 * 1024) {
      setError("La foto pesa más de 6MB.");
      return;
    }
    const dataUrl = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.readAsDataURL(file);
    });
    setFotoPersona(dataUrl);
    setPaso("extra");
  }

  async function guardar() {
    setPaso("guardando");
    setError(null);
    try {
      const body = {
        device_uuid: device.uuid,
        device_token: device.token,
        tipo: "persona",
        dpi_numero: datos.dpi_numero,
        nombre_completo: datos.nombre_completo,
        fecha_nacimiento: datos.fecha_nacimiento || null,
        genero: datos.genero || null,
        dpi_frente_url: fotoDpi,
        foto_persona_url: fotoPersona,
        ...extra,
      };
      const r = await fetch(`${API}/agente/visitas/entrada`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await r.json();
      if (!r.ok) {
        setError(data.error || "Error al guardar");
        setPaso("extra");
        return;
      }
      onSuccess(datos.nombre_completo || datos.dpi_numero);
    } catch {
      setError("Error de conexión");
      setPaso("extra");
    }
  }

  if (paso === "foto_dpi") {
    return (
      <div className="space-y-4">
        <h2 className="text-lg font-bold text-center">Foto del DPI</h2>
        <p className="text-xs text-slate-400 text-center">
          Toma una foto del frente del DPI. La IA va a leer los datos automáticamente.
        </p>
        <button
          onClick={() => fileRef.current?.click()}
          disabled={extrayendo}
          className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-700 text-white font-bold py-12 rounded-lg flex flex-col items-center gap-3"
        >
          {extrayendo ? (
            <>
              <Loader2 className="w-12 h-12 animate-spin" />
              <span>Leyendo el DPI…</span>
            </>
          ) : (
            <>
              <Camera className="w-12 h-12" />
              <span>Tomar foto del DPI</span>
            </>
          )}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void tomarFotoDpi(f);
            e.target.value = "";
          }}
        />
        {error && <p className="text-rose-300 text-xs text-center">{error}</p>}
        <button onClick={onCancel} className="w-full text-slate-400 text-sm py-3">
          Cancelar
        </button>
      </div>
    );
  }

  if (paso === "datos") {
    return (
      <div className="space-y-3">
        <h2 className="text-lg font-bold">Datos de la persona</h2>
        {fotoDpi && (
          <div className="relative">
            <img src={fotoDpi} alt="DPI" className="w-full rounded border border-slate-800 max-h-48 object-contain bg-slate-900" />
            <button onClick={() => { setFotoDpi(null); setPaso("foto_dpi"); }} className="absolute top-2 right-2 bg-rose-600/90 rounded-full p-1.5">
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        )}
        <div>
          <label className="block text-xs text-slate-400 mb-1">Nombre completo</label>
          <input type="text" value={datos.nombre_completo} onChange={e => setDatos({ ...datos, nombre_completo: e.target.value.toUpperCase() })}
            className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2.5 text-base" />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">DPI / CUI</label>
          <input type="text" inputMode="numeric" value={datos.dpi_numero} onChange={e => setDatos({ ...datos, dpi_numero: e.target.value.replace(/\D/g, "") })}
            className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2.5 text-base font-mono" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Nacimiento</label>
            <input type="date" value={datos.fecha_nacimiento} onChange={e => setDatos({ ...datos, fecha_nacimiento: e.target.value })}
              className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2.5 text-sm" />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Género</label>
            <select value={datos.genero} onChange={e => setDatos({ ...datos, genero: e.target.value })}
              className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2.5 text-sm">
              <option value="">—</option>
              <option value="Masculino">Masculino</option>
              <option value="Femenino">Femenino</option>
            </select>
          </div>
        </div>
        <button
          onClick={() => setPaso("foto_persona")}
          disabled={!datos.dpi_numero || datos.dpi_numero.length < 5}
          className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-700 disabled:cursor-not-allowed text-white font-bold py-4 rounded-lg"
        >
          Continuar
        </button>
        <button onClick={onCancel} className="w-full text-slate-400 text-sm py-2">Cancelar</button>
      </div>
    );
  }

  if (paso === "foto_persona") {
    return (
      <div className="space-y-3">
        <h2 className="text-lg font-bold text-center">Foto de la persona (opcional)</h2>
        <p className="text-xs text-slate-400 text-center">Esto ayuda a identificar al visitante.</p>
        {fotoPersona && (
          <div className="relative">
            <img src={fotoPersona} alt="Persona" className="w-full rounded border border-slate-800 max-h-72 object-contain bg-slate-900" />
            <button onClick={() => setFotoPersona(null)} className="absolute top-2 right-2 bg-rose-600/90 rounded-full p-1.5">
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        )}
        <button
          onClick={() => fileRef2.current?.click()}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-6 rounded-lg flex flex-col items-center gap-2"
        >
          <Camera className="w-8 h-8" />
          <span>{fotoPersona ? "Tomar otra foto" : "Tomar foto"}</span>
        </button>
        <input
          ref={fileRef2}
          type="file"
          accept="image/*"
          capture="user"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void tomarFotoPersona(f);
            e.target.value = "";
          }}
        />
        <button
          onClick={() => setPaso("extra")}
          className="w-full bg-slate-700 hover:bg-slate-600 text-white py-4 rounded-lg"
        >
          {fotoPersona ? "Continuar" : "Saltar foto"}
        </button>
      </div>
    );
  }

  if (paso === "extra" || paso === "guardando") {
    return (
      <div className="space-y-3">
        <h2 className="text-lg font-bold">Detalles de la visita</h2>
        <div>
          <label className="block text-xs text-slate-400 mb-1">¿A quién visita?</label>
          <input type="text" value={extra.a_quien_visita} onChange={e => setExtra({ ...extra, a_quien_visita: e.target.value })}
            placeholder="Nombre de la persona o empresa"
            className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2.5 text-base" />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">Motivo</label>
          <input type="text" value={extra.motivo} onChange={e => setExtra({ ...extra, motivo: e.target.value })}
            placeholder="Reunión, entrega, mantenimiento…"
            className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2.5 text-base" />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">Observaciones</label>
          <textarea value={extra.observaciones} onChange={e => setExtra({ ...extra, observaciones: e.target.value })}
            rows={2}
            className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2.5 text-sm" />
        </div>
        {error && <p className="text-rose-300 text-xs text-center">{error}</p>}
        <button
          onClick={guardar}
          disabled={paso === "guardando"}
          className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-700 text-white font-bold py-5 rounded-lg flex items-center justify-center gap-2 text-lg"
        >
          {paso === "guardando" ? <><Loader2 className="w-5 h-5 animate-spin" /> Guardando…</> : <><CheckCircle2 className="w-5 h-5" /> Confirmar entrada</>}
        </button>
        <button onClick={onCancel} className="w-full text-slate-400 text-sm py-2">Cancelar</button>
      </div>
    );
  }

  return null;
}

// ─── Entrada de vehículo ────────────────────────────────────────────────────
function EntradaVehiculo({
  device, onCancel, onSuccess,
}: { device: DeviceCreds; onCancel: () => void; onSuccess: (placa: string) => void }) {
  const [paso, setPaso] = useState<"foto_vehi" | "datos" | "conductor" | "extra" | "guardando">("foto_vehi");
  const [fotoVehi, setFotoVehi] = useState<string | null>(null);
  const [datos, setDatos] = useState({ placa: "", marca_vehiculo: "", color_vehiculo: "" });
  const [conductor, setConductor] = useState({ nombre: "", dpi: "", foto_dpi: null as string | null });
  const [extrayendoConductor, setExtrayendoConductor] = useState(false);
  const [extra, setExtra] = useState({ a_quien_visita: "", motivo: "", observaciones: "" });
  const [error, setError] = useState<string | null>(null);
  const fileRefV = useRef<HTMLInputElement>(null);
  const fileRefC = useRef<HTMLInputElement>(null);

  async function tomarFotoVehi(file: File) {
    if (file.size > 6 * 1024 * 1024) { setError("La foto pesa más de 6MB."); return; }
    const dataUrl = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.readAsDataURL(file);
    });
    setFotoVehi(dataUrl);
    setPaso("datos");
  }

  async function tomarFotoDpiConductor(file: File) {
    if (file.size > 6 * 1024 * 1024) { setError("La foto pesa más de 6MB."); return; }
    const dataUrl = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.readAsDataURL(file);
    });
    setConductor(c => ({ ...c, foto_dpi: dataUrl }));
    setExtrayendoConductor(true);
    try {
      const r = await fetch(`${API}/agente/visitas/extraer-dpi`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imagen: dataUrl, device_uuid: device.uuid, device_token: device.token }),
      });
      const data = await r.json();
      if (r.ok && data.datos) {
        setConductor(c => ({
          ...c,
          nombre: data.datos.nombre_completo ?? c.nombre,
          dpi: data.datos.dpi ?? c.dpi,
        }));
      }
    } catch { /* noop */ }
    setExtrayendoConductor(false);
  }

  async function guardar() {
    setPaso("guardando");
    setError(null);
    try {
      const body = {
        device_uuid: device.uuid,
        device_token: device.token,
        tipo: "vehiculo",
        placa: datos.placa,
        marca_vehiculo: datos.marca_vehiculo,
        color_vehiculo: datos.color_vehiculo,
        foto_vehiculo_url: fotoVehi,
        conductor_dpi_numero: conductor.dpi || null,
        conductor_nombre: conductor.nombre || null,
        conductor_dpi_frente_url: conductor.foto_dpi,
        ...extra,
      };
      const r = await fetch(`${API}/agente/visitas/entrada`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await r.json();
      if (!r.ok) {
        setError(data.error || "Error al guardar");
        setPaso("extra");
        return;
      }
      onSuccess(datos.placa);
    } catch {
      setError("Error de conexión");
      setPaso("extra");
    }
  }

  if (paso === "foto_vehi") {
    return (
      <div className="space-y-4">
        <h2 className="text-lg font-bold text-center">Foto del vehículo</h2>
        <p className="text-xs text-slate-400 text-center">
          Toma una foto que muestre la placa con claridad.
        </p>
        {fotoVehi && (
          <div className="relative">
            <img src={fotoVehi} alt="Vehículo" className="w-full rounded border border-slate-800 max-h-72 object-contain bg-slate-900" />
            <button onClick={() => setFotoVehi(null)} className="absolute top-2 right-2 bg-rose-600/90 rounded-full p-1.5">
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        )}
        <button
          onClick={() => fileRefV.current?.click()}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-12 rounded-lg flex flex-col items-center gap-3"
        >
          <Camera className="w-12 h-12" />
          <span>{fotoVehi ? "Tomar otra foto" : "Tomar foto"}</span>
        </button>
        <input ref={fileRefV} type="file" accept="image/*" capture="environment" className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) void tomarFotoVehi(f); e.target.value = ""; }} />
        {fotoVehi && (
          <button onClick={() => setPaso("datos")} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-4 rounded-lg font-bold">
            Continuar
          </button>
        )}
        {!fotoVehi && (
          <button onClick={() => setPaso("datos")} className="w-full text-slate-400 text-sm py-3">
            Saltar foto
          </button>
        )}
        {error && <p className="text-rose-300 text-xs text-center">{error}</p>}
        <button onClick={onCancel} className="w-full text-slate-400 text-sm py-2">Cancelar</button>
      </div>
    );
  }

  if (paso === "datos") {
    return (
      <div className="space-y-3">
        <h2 className="text-lg font-bold">Datos del vehículo</h2>
        <div>
          <label className="block text-xs text-slate-400 mb-1">Placa</label>
          <input type="text" value={datos.placa} onChange={e => setDatos({ ...datos, placa: e.target.value.toUpperCase().replace(/\s+/g, "") })}
            placeholder="P-123ABC"
            className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-3 text-2xl font-mono font-bold text-center tracking-wider" />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">Marca / modelo (opcional)</label>
          <input type="text" value={datos.marca_vehiculo} onChange={e => setDatos({ ...datos, marca_vehiculo: e.target.value })}
            placeholder="Toyota Hilux"
            className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2.5 text-base" />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">Color (opcional)</label>
          <input type="text" value={datos.color_vehiculo} onChange={e => setDatos({ ...datos, color_vehiculo: e.target.value })}
            placeholder="Blanco"
            className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2.5 text-base" />
        </div>
        <button
          onClick={() => setPaso("conductor")}
          disabled={!datos.placa || datos.placa.length < 3}
          className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-700 disabled:cursor-not-allowed text-white font-bold py-4 rounded-lg"
        >
          Continuar
        </button>
        <button onClick={onCancel} className="w-full text-slate-400 text-sm py-2">Cancelar</button>
      </div>
    );
  }

  if (paso === "conductor") {
    return (
      <div className="space-y-3">
        <h2 className="text-lg font-bold">Datos del conductor</h2>
        <button
          onClick={() => fileRefC.current?.click()}
          disabled={extrayendoConductor}
          className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-700 text-white font-bold py-4 rounded-lg flex items-center justify-center gap-2"
        >
          {extrayendoConductor ? (
            <><Loader2 className="w-5 h-5 animate-spin" /> Leyendo DPI…</>
          ) : (
            <><Camera className="w-5 h-5" /> {conductor.foto_dpi ? "Tomar otra foto del DPI" : "Foto del DPI (opcional)"}</>
          )}
        </button>
        <input ref={fileRefC} type="file" accept="image/*" capture="environment" className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) void tomarFotoDpiConductor(f); e.target.value = ""; }} />
        <div>
          <label className="block text-xs text-slate-400 mb-1">Nombre del conductor</label>
          <input type="text" value={conductor.nombre} onChange={e => setConductor({ ...conductor, nombre: e.target.value.toUpperCase() })}
            className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2.5 text-base" />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">DPI del conductor (opcional)</label>
          <input type="text" inputMode="numeric" value={conductor.dpi} onChange={e => setConductor({ ...conductor, dpi: e.target.value.replace(/\D/g, "") })}
            className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2.5 text-base font-mono" />
        </div>
        <button onClick={() => setPaso("extra")} className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-lg font-bold">
          Continuar
        </button>
        <button onClick={onCancel} className="w-full text-slate-400 text-sm py-2">Cancelar</button>
      </div>
    );
  }

  if (paso === "extra" || paso === "guardando") {
    return (
      <div className="space-y-3">
        <h2 className="text-lg font-bold">Detalles de la visita</h2>
        <div>
          <label className="block text-xs text-slate-400 mb-1">¿A quién visita?</label>
          <input type="text" value={extra.a_quien_visita} onChange={e => setExtra({ ...extra, a_quien_visita: e.target.value })}
            className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2.5 text-base" />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">Motivo</label>
          <input type="text" value={extra.motivo} onChange={e => setExtra({ ...extra, motivo: e.target.value })}
            placeholder="Carga, entrega, taller…"
            className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2.5 text-base" />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">Observaciones</label>
          <textarea value={extra.observaciones} onChange={e => setExtra({ ...extra, observaciones: e.target.value })}
            rows={2}
            className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2.5 text-sm" />
        </div>
        {error && <p className="text-rose-300 text-xs text-center">{error}</p>}
        <button
          onClick={guardar}
          disabled={paso === "guardando"}
          className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-700 text-white font-bold py-5 rounded-lg flex items-center justify-center gap-2 text-lg"
        >
          {paso === "guardando" ? <><Loader2 className="w-5 h-5 animate-spin" /> Guardando…</> : <><CheckCircle2 className="w-5 h-5" /> Confirmar entrada</>}
        </button>
        <button onClick={onCancel} className="w-full text-slate-400 text-sm py-2">Cancelar</button>
      </div>
    );
  }

  return null;
}

// ─── Salida ────────────────────────────────────────────────────────────────
function SalidaLista({
  device, personas, vehiculos, loading, onSuccess, onError,
}: {
  device: DeviceCreds;
  personas: VisitaAbierta[]; vehiculos: VisitaAbierta[]; loading: boolean;
  onSuccess: (label: string) => void; onError: (m: string) => void;
}) {
  const [busqueda, setBusqueda] = useState("");
  const [marcando, setMarcando] = useState<number | null>(null);
  const [confirmando, setConfirmando] = useState<VisitaAbierta | null>(null);

  async function marcarSalida(v: VisitaAbierta) {
    setMarcando(v.id);
    setConfirmando(null);
    try {
      const body = {
        device_uuid: device.uuid,
        device_token: device.token,
        visita_id: v.id,
      };
      const r = await fetch(`${API}/agente/visitas/salida`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await r.json();
      if (!r.ok) {
        onError(data.mensaje || data.error || "Error al registrar salida");
        return;
      }
      onSuccess(v.tipo === "persona" ? (v.nombre_completo ?? v.dpi_numero ?? "") : (v.placa ?? ""));
    } catch {
      onError("Error de conexión");
    } finally {
      setMarcando(null);
    }
  }

  const all = [...personas, ...vehiculos];
  const filtrados = busqueda
    ? all.filter(v => {
        const q = busqueda.toLowerCase();
        return (
          (v.nombre_completo ?? "").toLowerCase().includes(q) ||
          (v.dpi_numero ?? "").includes(q) ||
          (v.placa ?? "").toLowerCase().includes(q) ||
          (v.conductor_nombre ?? "").toLowerCase().includes(q)
        );
      })
    : all;

  if (all.length === 0) {
    return (
      <div className="text-center py-12 text-slate-500">
        Nadie adentro en este momento.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-bold">¿Quién está saliendo?</h2>
      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
        <input
          type="text"
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          placeholder="Buscar por DPI, nombre o placa…"
          className="w-full bg-slate-900 border border-slate-700 rounded pl-9 pr-3 py-2.5 text-base"
        />
      </div>
      <p className="text-xs text-slate-400">Toca a la persona o vehículo para marcar su salida.</p>
      <div className="space-y-2">
        {filtrados.map(v => (
          <button
            key={v.id}
            onClick={() => setConfirmando(v)}
            disabled={marcando === v.id}
            className="w-full bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg p-3 flex items-center gap-3 text-left disabled:opacity-50"
          >
            {v.tipo === "persona" ? (
              <UserCheck className="w-5 h-5 text-emerald-400 flex-shrink-0" />
            ) : (
              <Car className="w-5 h-5 text-blue-400 flex-shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              {v.tipo === "persona" ? (
                <>
                  <div className="text-sm font-medium truncate">{v.nombre_completo}</div>
                  <div className="text-[11px] text-slate-500 font-mono">{v.dpi_numero}</div>
                </>
              ) : (
                <>
                  <div className="text-sm font-mono font-bold">{v.placa}</div>
                  <div className="text-[11px] text-slate-500">{v.conductor_nombre ?? v.marca_vehiculo}</div>
                </>
              )}
              <div className="text-[10px] text-slate-500">Adentro: {fmtDuracion(v.entrada_at)}</div>
            </div>
            {marcando === v.id ? (
              <Loader2 className="w-5 h-5 animate-spin text-rose-400" />
            ) : (
              <span className="text-xs bg-rose-600 px-3 py-1.5 rounded text-white font-bold">SALIDA</span>
            )}
          </button>
        ))}
      </div>

      {confirmando && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-end sm:items-center justify-center p-4"
          onClick={() => setConfirmando(null)}
        >
          <div
            className="bg-slate-900 border-2 border-rose-600 rounded-2xl w-full max-w-md p-5 space-y-4"
            onClick={e => e.stopPropagation()}
          >
            <div className="text-center">
              <div className="text-xs uppercase text-rose-400 font-bold tracking-wide mb-1">Confirmar salida</div>
              {confirmando.tipo === "persona" ? (
                <>
                  <UserCheck className="w-12 h-12 text-emerald-400 mx-auto mb-2" />
                  <div className="text-xl font-bold">{confirmando.nombre_completo}</div>
                  <div className="text-sm text-slate-400 font-mono">{confirmando.dpi_numero}</div>
                </>
              ) : (
                <>
                  <Car className="w-12 h-12 text-blue-400 mx-auto mb-2" />
                  <div className="text-2xl font-mono font-bold">{confirmando.placa}</div>
                  <div className="text-sm text-slate-400">{confirmando.conductor_nombre ?? confirmando.marca_vehiculo}</div>
                </>
              )}
              <div className="text-xs text-slate-500 mt-2">Adentro: {fmtDuracion(confirmando.entrada_at)}</div>
            </div>
            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={() => setConfirmando(null)}
                className="bg-slate-700 hover:bg-slate-600 py-4 rounded-lg font-bold text-base"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => marcarSalida(confirmando)}
                disabled={marcando !== null}
                className="bg-rose-600 hover:bg-rose-500 py-4 rounded-lg font-bold text-base disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {marcando !== null ? <Loader2 className="w-5 h-5 animate-spin" /> : "Marcar salida"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
