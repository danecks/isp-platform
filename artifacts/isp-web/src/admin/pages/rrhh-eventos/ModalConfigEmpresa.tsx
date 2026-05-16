import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Loader2, Save, Settings, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { API, getSession } from "./helpers";

export function ModalConfigEmpresa({ onClose }: { onClose: () => void }) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    representante_nombre: "",
    representante_dpi: "",
    representante_fecha_nacimiento: "",
    direccion_empresa: "",
    nombre_empresa: "",
    nit_empresa: "",
    patente_comercio: "",
    telefono_empresa: "",
    umbral_dias_consecutivos: 2,
    umbral_medios_turnos_mes: 6,
  });

  useEffect(() => {
    fetch(`${API}/config-empresa`, { headers: { "x-isp-session": getSession() } })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data) {
          setForm({
            representante_nombre: data.representante_nombre || "",
            representante_dpi: data.representante_dpi || "",
            representante_fecha_nacimiento: data.representante_fecha_nacimiento || "",
            direccion_empresa: data.direccion_empresa || "",
            nombre_empresa: data.nombre_empresa || "",
            nit_empresa: data.nit_empresa || "",
            patente_comercio: data.patente_comercio || "",
            telefono_empresa: data.telefono_empresa || "",
            umbral_dias_consecutivos: data.umbral_dias_consecutivos ?? 2,
            umbral_medios_turnos_mes: data.umbral_medios_turnos_mes ?? 6,
          });
        }
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleSave() {
    setSaving(true);
    try {
      const r = await fetch(`${API}/config-empresa`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "x-isp-session": getSession() },
        body: JSON.stringify(form),
      });
      if (!r.ok) throw new Error("Error al guardar");
      toast({ title: "Configuración guardada" });
      onClose();
    } catch {
      toast({ title: "Error al guardar configuración", variant: "destructive" });
    } finally { setSaving(false); }
  }

  const inputCls = "w-full bg-[#060e1c] border border-white/10 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-primary/40";

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="bg-[#07111f] border border-primary/20 rounded-2xl w-full max-w-lg shadow-2xl">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-white/8">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Settings className="w-4 h-4 text-primary" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-bold text-white">Configuración de Empresa</p>
            <p className="text-[11px] text-white/40">Datos para actas administrativas y avisos</p>
          </div>
          <button onClick={onClose} className="text-white/30 hover:text-white"><X className="w-4 h-4" /></button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 text-primary animate-spin" /></div>
        ) : (
          <div className="p-5 space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs text-white/50">Nombre de Empresa</label>
              <input value={form.nombre_empresa} onChange={e => setForm({ ...form, nombre_empresa: e.target.value })} placeholder="Investigaciones y Seguridad Profesional S.A." className={inputCls} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-white/50">Representante Legal</label>
              <input value={form.representante_nombre} onChange={e => setForm({ ...form, representante_nombre: e.target.value })} placeholder="Nombre completo del representante" className={inputCls} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs text-white/50">DPI del Representante Legal</label>
                <input value={form.representante_dpi} onChange={e => setForm({ ...form, representante_dpi: e.target.value })} placeholder="0000 00000 0000" className={inputCls} />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-white/50">Fecha de nacimiento del Representante</label>
                <input
                  type="date"
                  value={form.representante_fecha_nacimiento}
                  onChange={e => setForm({ ...form, representante_fecha_nacimiento: e.target.value })}
                  className={inputCls}
                />
                <p className="text-[10px] text-white/30">Se usa para imprimir “de XX años de edad” en los contratos.</p>
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-white/50">Dirección de la Empresa</label>
              <input value={form.direccion_empresa} onChange={e => setForm({ ...form, direccion_empresa: e.target.value })} placeholder="14 calle 15-52 zona 1, Barrio Gerona" className={inputCls} />
            </div>

            <div className="border-t border-white/8 pt-4">
              <p className="text-xs text-white/40 uppercase tracking-wide mb-3">Datos Mercantiles (para contratos laborales)</p>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-[11px] text-white/40">NIT de la empresa</label>
                    <input value={form.nit_empresa} onChange={e => setForm({ ...form, nit_empresa: e.target.value })} placeholder="1234567-8" className={inputCls} />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] text-white/40">Patente de Comercio</label>
                    <input value={form.patente_comercio} onChange={e => setForm({ ...form, patente_comercio: e.target.value })} placeholder="No. xxxxx, Folio yy, Libro zz" className={inputCls} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] text-white/40">Teléfono de la empresa</label>
                  <input value={form.telefono_empresa} onChange={e => setForm({ ...form, telefono_empresa: e.target.value })} placeholder="+502 2379 0700" className={inputCls} />
                </div>
              </div>
            </div>

            <div className="border-t border-white/8 pt-4">
              <p className="text-xs text-white/40 uppercase tracking-wide mb-3">Umbrales Disciplinarios</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[11px] text-white/40">Días consecutivos para causa justa</label>
                  <input type="number" min={1} max={30} value={form.umbral_dias_consecutivos} onChange={e => setForm({ ...form, umbral_dias_consecutivos: Number(e.target.value) })} className={inputCls} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] text-white/40">Medios turnos/mes para causa justa</label>
                  <input type="number" min={1} max={30} value={form.umbral_medios_turnos_mes} onChange={e => setForm({ ...form, umbral_medios_turnos_mes: Number(e.target.value) })} className={inputCls} />
                </div>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button onClick={onClose} className="flex-1 py-2 text-xs text-white/40 hover:text-white/70 border border-white/10 rounded-xl transition-colors">Cancelar</button>
              <button onClick={handleSave} disabled={saving} className="flex-1 py-2 text-xs font-semibold bg-primary/20 hover:bg-primary/30 border border-primary/30 text-primary rounded-xl transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50">
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                Guardar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
