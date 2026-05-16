import { useState } from "react";
import { createPortal } from "react-dom";
import { X, Loader2 } from "lucide-react";
import { API, h } from "./_shared";

export function ModalNuevaSede({
  clientId,
  onClose,
  onSaved,
}: {
  clientId: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({ nombre: "", direccion: "", ciudad: "", contacto: "", telefono: "" });
  const [saving, setSaving] = useState(false);
  const up = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));

  async function submit() {
    if (!form.nombre.trim()) return;
    setSaving(true);
    try {
      await fetch(`${API}/clientes/${clientId}/sedes`, {
        method: "POST", headers: h(),
        body: JSON.stringify(form),
      });
      onSaved();
    } catch { /* ignore */ }
    setSaving(false);
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-[#07111f] border border-white/10 rounded-2xl w-full max-w-sm shadow-2xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-white">Nueva sede</h3>
          <button onClick={onClose} className="text-white/30 hover:text-white"><X className="w-4 h-4" /></button>
        </div>
        {[
          { k: "nombre", label: "Nombre de la sede *", ph: "Ej: Sede Central" },
          { k: "direccion", label: "Dirección", ph: "Dirección física" },
          { k: "ciudad", label: "Ciudad / Municipio", ph: "Guatemala, Mixco..." },
          { k: "contacto", label: "Contacto", ph: "Nombre de contacto" },
          { k: "telefono", label: "Teléfono", ph: "+502..." },
        ].map(({ k, label, ph }) => (
          <div key={k} className="space-y-1">
            <label className="text-xs text-white/40">{label}</label>
            <input
              type="text"
              value={(form as any)[k]}
              onChange={(e) => up(k, e.target.value)}
              placeholder={ph}
              className="w-full bg-[#060e1c] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 outline-none focus:border-primary/50"
            />
          </div>
        ))}
        <div className="flex gap-2 pt-1">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-white/10 text-sm text-white/50 hover:text-white transition-colors">Cancelar</button>
          <button
            onClick={submit}
            disabled={saving || !form.nombre.trim()}
            className="flex-1 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-sm font-bold text-white disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
          >
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Guardar sede
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
