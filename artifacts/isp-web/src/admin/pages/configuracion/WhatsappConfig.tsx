/**
 * WHATSAPP CONFIG — Panel de Configuración del Bot
 *
 * Permite al administrador editar sin tocar código:
 *  • Tab 1: Configuración General (nombre, estado, horarios, mensajes globales)
 *  • Tab 2: Mensajes del Bot (por evento — edición inline)
 *  • Tab 3: Opciones de Menú (por rol — toggle activo/inactivo + reordenar)
 *  • Tab 4: Auditoría (historial de cambios, solo lectura)
 */

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { AdminLayout } from "@/admin/layout/AdminLayout";
import {
  Settings,
  MessageSquare,
  Menu,
  ClipboardList,
  Save,
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertCircle,
  User,
  Clock,
  ChevronUp,
  ChevronDown,
  Edit2,
  X,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";

const API = "/api";

type Tab = "general" | "mensajes" | "menus" | "auditoria";

interface ConfigRow { id: number; clave: string; valor: string; tipo: string; descripcion?: string; updatedAt: string; }
interface MessageRow { id: number; clave: string; texto: string; descripcion?: string; updatedAt: string; }
interface MenuOption { id: number; rol: string; texto: string; accion: string; activo: boolean; orden: number; updatedAt: string; }
interface AuditRow { id: number; modulo: string; clave: string; valorAnterior?: string; valorNuevo: string; usuario?: string; createdAt: string; }

const ROL_LABELS: Record<string, string> = {
  externo: "Externo / Público",
  guardia: "Guardia / Colaborador",
  supervisor: "Supervisor",
  cliente: "Cliente",
};

const ROL_COLORS: Record<string, string> = {
  externo: "bg-gray-500/20 text-gray-300 border-gray-500/30",
  guardia: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  supervisor: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
  cliente: "bg-cyan-500/20 text-cyan-300 border-cyan-500/30",
};

const MOD_LABELS: Record<string, string> = {
  wa_config: "Config. General",
  wa_messages: "Mensajes",
  wa_menu_options: "Opciones de Menú",
};

function Toast({ msg, type, onClose }: { msg: string; type: "ok" | "err"; onClose: () => void }) {
  useEffect(() => { const t = setTimeout(onClose, 3500); return () => clearTimeout(t); }, [onClose]);
  const base = "fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3 rounded-xl shadow-lg text-sm font-medium border";
  const style = type === "ok"
    ? `${base} bg-green-900/90 text-green-200 border-green-600/40`
    : `${base} bg-red-900/90 text-red-200 border-red-600/40`;
  return createPortal(
    <div className={style}>
      {type === "ok" ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
      {msg}
      <button onClick={onClose} className="ml-2 opacity-60 hover:opacity-100"><X size={14} /></button>
    </div>,
    document.body
  );
}

// ─── MODAL de edición de texto largo ─────────────────────────────────────────
function EditModal({
  titulo,
  valor,
  descripcion,
  onSave,
  onClose,
}: {
  titulo: string;
  valor: string;
  descripcion?: string;
  onSave: (val: string) => Promise<void>;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(valor);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!draft.trim()) return;
    setSaving(true);
    await onSave(draft.trim());
    setSaving(false);
    onClose();
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
          <h3 className="text-base font-semibold text-white flex items-center gap-2">
            <Edit2 size={16} className="text-amber-400" />
            Editar: <span className="text-amber-400">{titulo}</span>
          </h3>
          <button onClick={onClose} className="text-gray-500 hover:text-white"><X size={18} /></button>
        </div>
        <div className="px-6 py-4 space-y-3">
          {descripcion && (
            <p className="text-xs text-gray-400 flex items-start gap-2">
              <AlertCircle size={13} className="mt-0.5 shrink-0 text-amber-500" />
              {descripcion}
            </p>
          )}
          <textarea
            className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white resize-none focus:outline-none focus:border-amber-500 h-36"
            value={draft}
            onChange={e => setDraft(e.target.value)}
            placeholder="Ingrese el valor..."
          />
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-700">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-400 hover:text-white rounded-lg border border-gray-700 hover:border-gray-500">
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !draft.trim()}
            className="px-4 py-2 text-sm bg-amber-600 hover:bg-amber-500 text-white rounded-lg font-medium disabled:opacity-50 flex items-center gap-2"
          >
            {saving ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
            Guardar
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ─── TAB: GENERAL ─────────────────────────────────────────────────────────────
function TabGeneral() {
  const [rows, setRows] = useState<ConfigRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ msg: string; type: "ok" | "err" } | null>(null);
  const [editing, setEditing] = useState<ConfigRow | null>(null);
  const [inlineEdits, setInlineEdits] = useState<Record<string, string>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const r = await fetch(`${API}/wa-config/general`);
      setRows(await r.json());
    } catch { setToast({ msg: "Error cargando configuración", type: "err" }); }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function saveKey(clave: string, valor: string) {
    setSavingKey(clave);
    try {
      const r = await fetch(`${API}/wa-config/general/${clave}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ valor }),
      });
      if (!r.ok) throw new Error();
      setToast({ msg: `"${clave}" actualizado correctamente`, type: "ok" });
      await load();
    } catch {
      setToast({ msg: "Error al guardar. Intente de nuevo.", type: "err" });
    }
    setSavingKey(null);
  }

  const TEXTO_LARGO = ["mensaje_bienvenida", "mensaje_fuera_horario", "mensaje_error"];

  function renderInput(row: ConfigRow) {
    const val = inlineEdits[row.clave] ?? row.valor;

    if (TEXTO_LARGO.includes(row.clave)) {
      return (
        <div className="flex items-start gap-2">
          <p className="text-sm text-gray-300 flex-1 bg-gray-800/60 rounded-lg px-3 py-2 min-h-[3rem] line-clamp-2">
            {row.valor}
          </p>
          <button
            onClick={() => setEditing(row)}
            className="shrink-0 p-2 text-amber-400 hover:bg-amber-400/10 rounded-lg transition-colors"
            title="Editar"
          >
            <Edit2 size={14} />
          </button>
        </div>
      );
    }

    if (row.clave === "estado_bot") {
      return (
        <div className="flex items-center gap-2">
          <select
            className="bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
            value={val}
            onChange={e => setInlineEdits(p => ({ ...p, [row.clave]: e.target.value }))}
          >
            <option value="activo">Activo</option>
            <option value="mantenimiento">Mantenimiento</option>
            <option value="solo_lectura">Solo lectura</option>
          </select>
          {inlineEdits[row.clave] && inlineEdits[row.clave] !== row.valor && (
            <button
              onClick={() => saveKey(row.clave, inlineEdits[row.clave])}
              disabled={savingKey === row.clave}
              className="p-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs"
            >
              {savingKey === row.clave ? <RefreshCw size={13} className="animate-spin" /> : <Save size={13} />}
            </button>
          )}
        </div>
      );
    }

    return (
      <div className="flex items-center gap-2">
        <input
          type={row.tipo === "hora" ? "time" : "text"}
          className="bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500 w-44"
          value={val}
          onChange={e => setInlineEdits(p => ({ ...p, [row.clave]: e.target.value }))}
        />
        {inlineEdits[row.clave] !== undefined && inlineEdits[row.clave] !== row.valor && (
          <button
            onClick={() => saveKey(row.clave, inlineEdits[row.clave])}
            disabled={savingKey === row.clave}
            className="p-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg"
          >
            {savingKey === row.clave ? <RefreshCw size={13} className="animate-spin" /> : <Save size={13} />}
          </button>
        )}
      </div>
    );
  }

  return (
    <div>
      {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
      {editing && (
        <EditModal
          titulo={editing.clave}
          valor={editing.valor}
          descripcion={editing.descripcion}
          onSave={(val) => saveKey(editing.clave, val)}
          onClose={() => setEditing(null)}
        />
      )}

      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold text-white">Configuración General del Bot</h2>
        <button onClick={load} className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg">
          <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <RefreshCw size={24} className="animate-spin text-amber-400" />
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map(row => (
            <div key={row.id} className="bg-gray-800/50 border border-gray-700/50 rounded-xl px-5 py-4 flex flex-col md:flex-row md:items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <code className="text-xs font-mono text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded">{row.clave}</code>
                  <span className="text-xs text-gray-500 border border-gray-700 px-1.5 py-0.5 rounded">{row.tipo}</span>
                </div>
                {row.descripcion && <p className="text-xs text-gray-400 mt-0.5">{row.descripcion}</p>}
              </div>
              <div className="md:w-80 shrink-0">
                {renderInput(row)}
              </div>
              <div className="text-xs text-gray-600 shrink-0 hidden lg:block">
                {new Date(row.updatedAt).toLocaleDateString("es-GT")}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── TAB: MENSAJES ────────────────────────────────────────────────────────────
function TabMensajes() {
  const [rows, setRows] = useState<MessageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ msg: string; type: "ok" | "err" } | null>(null);
  const [editing, setEditing] = useState<MessageRow | null>(null);

  async function load() {
    setLoading(true);
    try {
      const r = await fetch(`${API}/wa-config/messages`);
      setRows(await r.json());
    } catch { setToast({ msg: "Error cargando mensajes", type: "err" }); }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function saveMessage(clave: string, texto: string) {
    const r = await fetch(`${API}/wa-config/messages/${clave}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ texto }),
    });
    if (!r.ok) throw new Error("Error al guardar");
    setToast({ msg: `Mensaje "${clave}" actualizado`, type: "ok" });
    await load();
  }

  return (
    <div>
      {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
      {editing && (
        <EditModal
          titulo={editing.clave}
          valor={editing.texto}
          descripcion={editing.descripcion}
          onSave={async (val) => { await saveMessage(editing.clave, val); }}
          onClose={() => setEditing(null)}
        />
      )}

      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-base font-semibold text-white">Mensajes Automáticos del Bot</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            Edite el texto de cada mensaje. Los cambios se aplican en tiempo real al reiniciar el bot.
            Puede usar {"{codigo}"}, {"{monto}"} como variables de plantilla.
          </p>
        </div>
        <button onClick={load} className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg">
          <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <RefreshCw size={24} className="animate-spin text-amber-400" />
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map(row => (
            <div key={row.id} className="bg-gray-800/50 border border-gray-700/50 rounded-xl px-5 py-4 group">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5">
                    <code className="text-xs font-mono text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded">{row.clave}</code>
                  </div>
                  {row.descripcion && (
                    <p className="text-xs text-gray-500 mb-2">{row.descripcion}</p>
                  )}
                  <p className="text-sm text-gray-300 bg-gray-900/60 rounded-lg px-3 py-2 leading-relaxed">
                    {row.texto}
                  </p>
                </div>
                <button
                  onClick={() => setEditing(row)}
                  className="shrink-0 p-2 text-gray-500 hover:text-amber-400 hover:bg-amber-400/10 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                  title="Editar mensaje"
                >
                  <Edit2 size={15} />
                </button>
              </div>
              <div className="mt-2 text-xs text-gray-600 flex items-center gap-1">
                <Clock size={11} />
                Actualizado: {new Date(row.updatedAt).toLocaleString("es-GT")}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── TAB: MENÚS ──────────────────────────────────────────────────────────────
function TabMenus() {
  const [rows, setRows] = useState<MenuOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ msg: string; type: "ok" | "err" } | null>(null);
  const [savingId, setSavingId] = useState<number | null>(null);

  async function load() {
    setLoading(true);
    try {
      const r = await fetch(`${API}/wa-config/menus`);
      setRows(await r.json());
    } catch { setToast({ msg: "Error cargando menús", type: "err" }); }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function toggleActivo(opt: MenuOption) {
    setSavingId(opt.id);
    try {
      const r = await fetch(`${API}/wa-config/menus/${opt.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activo: !opt.activo }),
      });
      if (!r.ok) throw new Error();
      setToast({ msg: `Opción "${opt.texto.slice(0, 30)}..." ${!opt.activo ? "activada" : "desactivada"}`, type: "ok" });
      setRows(prev => prev.map(o => o.id === opt.id ? { ...o, activo: !o.activo } : o));
    } catch {
      setToast({ msg: "Error al actualizar opción", type: "err" });
    }
    setSavingId(null);
  }

  async function changeOrden(opt: MenuOption, dir: "up" | "down") {
    const roleOpts = rows.filter(o => o.rol === opt.rol).sort((a, b) => a.orden - b.orden);
    const idx = roleOpts.findIndex(o => o.id === opt.id);
    const swapWith = dir === "up" ? roleOpts[idx - 1] : roleOpts[idx + 1];
    if (!swapWith) return;

    setSavingId(opt.id);
    try {
      await fetch(`${API}/wa-config/menus/${opt.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orden: swapWith.orden }),
      });
      await fetch(`${API}/wa-config/menus/${swapWith.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orden: opt.orden }),
      });
      await load();
    } catch {
      setToast({ msg: "Error al reordenar", type: "err" });
    }
    setSavingId(null);
  }

  const roles = ["externo", "guardia", "supervisor", "cliente"];

  return (
    <div>
      {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}

      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-base font-semibold text-white">Opciones de Menú por Rol</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            Active/desactive opciones y cambie su orden para cada tipo de usuario.
          </p>
        </div>
        <button onClick={load} className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg">
          <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <RefreshCw size={24} className="animate-spin text-amber-400" />
        </div>
      ) : (
        <div className="space-y-6">
          {roles.map(rol => {
            const opts = rows.filter(o => o.rol === rol).sort((a, b) => a.orden - b.orden);
            return (
              <div key={rol}>
                <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border mb-3 ${ROL_COLORS[rol] || "bg-gray-500/20 text-gray-300 border-gray-500/30"}`}>
                  <User size={12} />
                  {ROL_LABELS[rol] || rol}
                  <span className="opacity-60">— {opts.length} opción(es)</span>
                </div>
                <div className="space-y-2">
                  {opts.map((opt, idx) => (
                    <div
                      key={opt.id}
                      className={`flex items-center gap-3 bg-gray-800/50 border rounded-xl px-4 py-3 transition-all ${
                        opt.activo ? "border-gray-700/50" : "border-gray-700/30 opacity-60"
                      }`}
                    >
                      <div className="flex flex-col gap-0.5">
                        <button
                          onClick={() => changeOrden(opt, "up")}
                          disabled={idx === 0 || savingId === opt.id}
                          className="p-0.5 text-gray-500 hover:text-white disabled:opacity-30"
                        >
                          <ChevronUp size={14} />
                        </button>
                        <button
                          onClick={() => changeOrden(opt, "down")}
                          disabled={idx === opts.length - 1 || savingId === opt.id}
                          className="p-0.5 text-gray-500 hover:text-white disabled:opacity-30"
                        >
                          <ChevronDown size={14} />
                        </button>
                      </div>

                      <span className="text-xs text-gray-500 font-mono w-5 text-center">{opt.orden}</span>

                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white">{opt.texto}</p>
                        <code className="text-xs text-gray-500">{opt.accion}</code>
                      </div>

                      <button
                        onClick={() => toggleActivo(opt)}
                        disabled={savingId === opt.id}
                        className={`shrink-0 flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium transition-all ${
                          opt.activo
                            ? "bg-green-600/20 text-green-400 hover:bg-green-600/30"
                            : "bg-gray-700/50 text-gray-400 hover:bg-gray-700"
                        }`}
                      >
                        {savingId === opt.id ? (
                          <RefreshCw size={12} className="animate-spin" />
                        ) : opt.activo ? (
                          <ToggleRight size={14} />
                        ) : (
                          <ToggleLeft size={14} />
                        )}
                        {opt.activo ? "Activo" : "Inactivo"}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── TAB: AUDITORÍA ───────────────────────────────────────────────────────────
function TabAuditoria() {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const r = await fetch(`${API}/wa-config/auditoria?limit=100`);
      setRows(await r.json());
    } catch {}
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-base font-semibold text-white">Historial de Cambios</h2>
          <p className="text-xs text-gray-400 mt-0.5">Registro de todos los cambios realizados en la configuración del bot.</p>
        </div>
        <button onClick={load} className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg">
          <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <RefreshCw size={24} className="animate-spin text-amber-400" />
        </div>
      ) : rows.length === 0 ? (
        <div className="text-center py-20">
          <ClipboardList size={40} className="mx-auto text-gray-600 mb-3" />
          <p className="text-gray-500">Sin cambios registrados aún</p>
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map(row => (
            <div key={row.id} className="bg-gray-800/40 border border-gray-700/40 rounded-xl px-4 py-3">
              <div className="flex flex-wrap items-center gap-2 mb-1.5">
                <span className="text-xs bg-gray-700 text-gray-300 px-2 py-0.5 rounded">
                  {MOD_LABELS[row.modulo] || row.modulo}
                </span>
                <code className="text-xs text-amber-400 font-mono">{row.clave}</code>
                {row.usuario && (
                  <span className="text-xs text-gray-500 flex items-center gap-1">
                    <User size={11} /> {row.usuario}
                  </span>
                )}
                <span className="text-xs text-gray-600 flex items-center gap-1 ml-auto">
                  <Clock size={11} />
                  {new Date(row.createdAt).toLocaleString("es-GT")}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 mt-2">
                {row.valorAnterior != null && (
                  <div className="bg-red-900/20 border border-red-700/30 rounded-lg px-3 py-2">
                    <p className="text-xs text-red-400 mb-1 font-medium">Valor anterior</p>
                    <p className="text-xs text-gray-300 font-mono break-all line-clamp-3">{row.valorAnterior}</p>
                  </div>
                )}
                <div className={`bg-green-900/20 border border-green-700/30 rounded-lg px-3 py-2 ${!row.valorAnterior ? "col-span-2" : ""}`}>
                  <p className="text-xs text-green-400 mb-1 font-medium">Valor nuevo</p>
                  <p className="text-xs text-gray-300 font-mono break-all line-clamp-3">{row.valorNuevo}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── COMPONENTE PRINCIPAL ─────────────────────────────────────────────────────
export default function WhatsappConfig() {
  const [tab, setTab] = useState<Tab>("general");

  const TABS: { id: Tab; label: string; icon: (props: any) => JSX.Element }[] = [
    { id: "general",   label: "General",         icon: Settings },
    { id: "mensajes",  label: "Mensajes",         icon: MessageSquare },
    { id: "menus",     label: "Opciones de Menú", icon: Menu },
    { id: "auditoria", label: "Auditoría",        icon: ClipboardList },
  ];

  return (
    <AdminLayout title="Configuración WhatsApp">
      <div className="p-6 max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2 bg-green-500/20 rounded-lg">
              <MessageSquare size={22} className="text-green-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Configuración WhatsApp</h1>
              <p className="text-sm text-gray-400">
                Personalice el comportamiento del asistente automático de WhatsApp
              </p>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2 bg-amber-900/20 border border-amber-700/30 rounded-xl px-4 py-2.5 text-xs text-amber-300">
            <AlertCircle size={14} className="shrink-0" />
            Los cambios en mensajes y configuración se aplican automáticamente. Los cambios de menú pueden requerir reinicio del bot.
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-800/50 border border-gray-700/50 rounded-xl p-1 mb-6">
          {TABS.map(t => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  tab === t.id
                    ? "bg-gray-700 text-white shadow"
                    : "text-gray-400 hover:text-white hover:bg-gray-700/50"
                }`}
              >
                <Icon size={15} />
                <span className="hidden sm:inline">{t.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab content */}
        <div>
          {tab === "general"   && <TabGeneral   />}
          {tab === "mensajes"  && <TabMensajes  />}
          {tab === "menus"     && <TabMenus     />}
          {tab === "auditoria" && <TabAuditoria />}
        </div>
      </div>
    </AdminLayout>
  );
}
