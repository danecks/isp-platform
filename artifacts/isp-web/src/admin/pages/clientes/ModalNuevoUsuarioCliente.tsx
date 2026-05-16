import { useState } from "react";
import { createPortal } from "react-dom";
import { X, Loader2, Plus, Mail, Phone, Lock, AlertCircle, Check } from "lucide-react";
import { API, h } from "./_shared";

export function ModalNuevoUsuarioCliente({ clienteDbId, onClose, onCreated }: {
  clienteDbId: number;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [form, setForm] = useState({ nombre: "", username: "", correo: "", password: "", confirmPassword: "", telefono: "", estado: "activo" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [usernameError, setUsernameError] = useState("");

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  async function checkUsername(u: string) {
    if (!u.trim()) return;
    try {
      const r = await fetch(`${API}/users/check?username=${encodeURIComponent(u.trim())}`, { headers: h() });
      const data = await r.json();
      setUsernameError(data.available ? "" : "Este username ya está en uso");
    } catch { /* ignorar */ }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (usernameError) { setError(usernameError); return; }
    if (form.password !== form.confirmPassword) { setError("Las contraseñas no coinciden"); return; }
    if (form.password.length < 4) { setError("Contraseña mínimo 4 caracteres"); return; }
    setLoading(true);
    setError("");
    try {
      const r = await fetch(`${API}/clientes/${clienteDbId}/usuarios`, {
        method: "POST",
        headers: h(),
        body: JSON.stringify({ nombre: form.nombre, username: form.username.toLowerCase(), correo: form.correo || undefined, password: form.password, telefono: form.telefono || undefined, estado: form.estado }),
      });
      if (!r.ok) { const d = await r.json(); throw new Error(d.error ?? "Error al crear usuario"); }
      onCreated();
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4">
      <div className="bg-[#07111f] border border-white/10 rounded-2xl w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-white/5 sticky top-0 bg-[#07111f] z-10">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-primary/15 border border-primary/20 flex items-center justify-center">
              <Plus className="w-3.5 h-3.5 text-primary" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Nuevo Usuario del Cliente</h2>
              <p className="text-[10px] text-white/40">Acceso al Portal de Clientes</p>
            </div>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="space-y-1.5">
            <label className="text-[11px] text-white/50 font-medium">Nombre completo *</label>
            <input value={form.nombre} onChange={e => set("nombre", e.target.value)} required
              className="w-full h-9 bg-[#060e1c] border border-white/10 text-white text-sm rounded-md px-3 outline-none focus:border-primary/50"
              placeholder="Ej: Ana García" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-[11px] text-white/50 font-medium">Username *</label>
              <input value={form.username} onChange={e => { set("username", e.target.value.toLowerCase()); setUsernameError(""); }}
                onBlur={e => checkUsername(e.target.value)} required
                className={`w-full h-9 bg-[#060e1c] border text-white text-sm rounded-md px-3 outline-none ${usernameError ? "border-red-500/60" : "border-white/10 focus:border-primary/50"}`}
                placeholder="ana.garcia" />
              {usernameError && <p className="text-[10px] text-red-400">{usernameError}</p>}
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] text-white/50 font-medium">Estado</label>
              <select value={form.estado} onChange={e => set("estado", e.target.value)}
                className="w-full h-9 bg-[#060e1c] border border-white/10 text-white text-sm rounded-md px-3 outline-none focus:border-primary/50">
                <option value="activo">Activo</option>
                <option value="inactivo">Inactivo</option>
              </select>
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-[11px] text-white/50 font-medium flex items-center gap-1"><Mail className="w-3 h-3" />Correo</label>
            <input type="email" value={form.correo} onChange={e => set("correo", e.target.value)}
              className="w-full h-9 bg-[#060e1c] border border-white/10 text-white text-sm rounded-md px-3 outline-none focus:border-primary/50"
              placeholder="correo@empresa.gt" />
          </div>
          <div className="space-y-1.5">
            <label className="text-[11px] text-white/50 font-medium flex items-center gap-1"><Phone className="w-3 h-3" />Teléfono</label>
            <input value={form.telefono} onChange={e => set("telefono", e.target.value)}
              className="w-full h-9 bg-[#060e1c] border border-white/10 text-white text-sm rounded-md px-3 font-mono outline-none focus:border-primary/50"
              placeholder="50212345678" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-[11px] text-white/50 font-medium flex items-center gap-1"><Lock className="w-3 h-3" />Contraseña *</label>
              <input type="password" value={form.password} onChange={e => set("password", e.target.value)} required
                className="w-full h-9 bg-[#060e1c] border border-white/10 text-white text-sm rounded-md px-3 outline-none focus:border-primary/50"
                placeholder="Mínimo 4 car." />
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] text-white/50 font-medium">Confirmar *</label>
              <input type="password" value={form.confirmPassword} onChange={e => set("confirmPassword", e.target.value)} required
                className="w-full h-9 bg-[#060e1c] border border-white/10 text-white text-sm rounded-md px-3 outline-none focus:border-primary/50"
                placeholder="Repita" />
            </div>
          </div>
          {error && (
            <div className="flex items-center gap-2 bg-red-950/40 border border-red-500/20 rounded-lg px-3 py-2">
              <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
              <p className="text-xs text-red-400">{error}</p>
            </div>
          )}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 h-9 border border-white/10 text-white/60 rounded-md text-xs hover:text-white hover:border-white/20 transition-colors">
              Cancelar
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 h-9 bg-primary text-[#050d1a] font-bold rounded-md text-xs hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5">
              {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><Check className="w-3.5 h-3.5" />Crear Usuario</>}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
