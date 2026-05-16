import { useState } from "react";
import {
  Loader2, Save, CheckCircle, AlertTriangle, Landmark, ToggleLeft, ToggleRight,
} from "lucide-react";
import { API, h, ClienteFicha } from "./_shared";

// ─── Departamentos de Guatemala ──────────────────────────────────────────────
const DEPTOS_GT = [
  { cod: 1, nombre: "Guatemala" }, { cod: 2, nombre: "El Progreso" },
  { cod: 3, nombre: "Sacatepéquez" }, { cod: 4, nombre: "Chimaltenango" },
  { cod: 5, nombre: "Escuintla" }, { cod: 6, nombre: "Santa Rosa" },
  { cod: 7, nombre: "Sololá" }, { cod: 8, nombre: "Totonicapán" },
  { cod: 9, nombre: "Quetzaltenango" }, { cod: 10, nombre: "Suchitepéquez" },
  { cod: 11, nombre: "Retalhuleu" }, { cod: 12, nombre: "San Marcos" },
  { cod: 13, nombre: "Huehuetenango" }, { cod: 14, nombre: "El Quiché" },
  { cod: 15, nombre: "Baja Verapaz" }, { cod: 16, nombre: "Alta Verapaz" },
  { cod: 17, nombre: "El Petén" }, { cod: 18, nombre: "Izabal" },
  { cod: 19, nombre: "Zacapa" }, { cod: 20, nombre: "Chiquimula" },
  { cod: 21, nombre: "Jalapa" }, { cod: 22, nombre: "Jutiapa" },
];

export function TabIGSSCentro({ cliente, onSaved }: { cliente: ClienteFicha; onSaved: () => void }) {
  const [form, setForm] = useState({
    igss_aplica: cliente.igss_aplica ?? false,
    igss_codigo_centro: cliente.igss_codigo_centro ?? "",
    igss_direccion: cliente.igss_direccion ?? "",
    igss_zona: cliente.igss_zona ?? "",
    igss_departamento: cliente.igss_departamento?.toString() ?? "",
    igss_municipio: cliente.igss_municipio?.toString() ?? "",
    igss_codigo_actividad: cliente.igss_codigo_actividad ?? "",
    igss_contacto: cliente.igss_contacto ?? "",
    igss_fax: cliente.igss_fax ?? "",
    igss_email: cliente.igss_email ?? "",
    igss_telefono: cliente.igss_telefono ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const up = (k: string, v: string | boolean) => setForm((p) => ({ ...p, [k]: v }));

  const handleSave = async () => {
    setSaving(true); setError(""); setSaved(false);
    try {
      const r = await fetch(`${API}/igss/clientes/${cliente.id}/centro`, {
        method: "PATCH",
        headers: h(),
        body: JSON.stringify({
          ...form,
          igss_departamento: form.igss_departamento ? Number(form.igss_departamento) : null,
          igss_municipio: form.igss_municipio ? Number(form.igss_municipio) : null,
          igss_codigo_centro: form.igss_codigo_centro || null,
          igss_direccion: form.igss_direccion || null,
          igss_zona: form.igss_zona || null,
          igss_codigo_actividad: form.igss_codigo_actividad || null,
          igss_contacto: form.igss_contacto || null,
          igss_fax: form.igss_fax || null,
          igss_email: form.igss_email || null,
          igss_telefono: form.igss_telefono || null,
        }),
      });
      if (!r.ok) throw new Error((await r.json()).error || "Error al guardar");
      setSaved(true);
      onSaved();
      setTimeout(() => setSaved(false), 2500);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const inp = "w-full bg-[#060e1c] border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-white/20 outline-none focus:border-primary/40";
  const lbl = "text-[10px] text-white/40 uppercase tracking-wide block mb-1";

  return (
    <div className="p-6 space-y-6">
      {/* Toggle principal */}
      <div className="flex items-center justify-between bg-white/3 border border-white/8 rounded-xl px-4 py-3">
        <div>
          <p className="text-sm font-semibold text-white">Registrar como Centro de Trabajo IGSS</p>
          <p className="text-[11px] text-white/35 mt-0.5">
            Al activar, este cliente aparecerá en el módulo IGSS como un centro de trabajo en el archivo de planilla.
          </p>
        </div>
        <button
          onClick={() => up("igss_aplica", !form.igss_aplica)}
          className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all ${
            form.igss_aplica
              ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400"
              : "bg-white/5 border-white/15 text-white/40 hover:text-white/60"
          }`}
        >
          {form.igss_aplica
            ? <><ToggleRight className="w-4 h-4" /> Activo</>
            : <><ToggleLeft className="w-4 h-4" /> Inactivo</>}
        </button>
      </div>

      {form.igss_aplica && (
        <div className="space-y-5">
          <p className="text-[10px] text-white/30 uppercase tracking-widest font-semibold border-b border-white/5 pb-2">
            Datos del Centro de Trabajo — se usan en el archivo TXT del IGSS
          </p>

          {/* Fila 1: código + actividad económica */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={lbl}>Código del Centro *</label>
              <input
                value={form.igss_codigo_centro}
                onChange={(e) => up("igss_codigo_centro", e.target.value)}
                placeholder="1"
                className={inp}
              />
              <p className="text-[9px] text-white/25 mt-1">Número secuencial asignado por el patrono (1, 2, 3…)</p>
            </div>
            <div>
              <label className={lbl}>Código Actividad Económica</label>
              <input
                value={form.igss_codigo_actividad}
                onChange={(e) => up("igss_codigo_actividad", e.target.value)}
                placeholder="803011"
                className={inp}
              />
              <p className="text-[9px] text-white/25 mt-1">Ej: 803011 (vigilancia y seguridad)</p>
            </div>
          </div>

          {/* Fila 2: dirección + zona */}
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2">
              <label className={lbl}>Dirección física del centro</label>
              <input
                value={form.igss_direccion}
                onChange={(e) => up("igss_direccion", e.target.value)}
                placeholder="9ª Av. 11-65 Zona 1"
                className={inp}
              />
            </div>
            <div>
              <label className={lbl}>Zona</label>
              <input
                value={form.igss_zona}
                onChange={(e) => up("igss_zona", e.target.value)}
                placeholder="1"
                className={inp}
              />
            </div>
          </div>

          {/* Fila 3: departamento + municipio */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={lbl}>Departamento</label>
              <select
                value={form.igss_departamento}
                onChange={(e) => up("igss_departamento", e.target.value)}
                className={inp}
              >
                <option value="">Seleccionar departamento…</option>
                {DEPTOS_GT.map((d) => (
                  <option key={d.cod} value={d.cod}>{d.cod} — {d.nombre}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={lbl}>Código de Municipio</label>
              <input
                type="number"
                min={1}
                value={form.igss_municipio}
                onChange={(e) => up("igss_municipio", e.target.value)}
                placeholder="1"
                className={inp}
              />
              <p className="text-[9px] text-white/25 mt-1">Código IGSS del municipio dentro del departamento</p>
            </div>
          </div>

          {/* Fila 4: contacto + teléfono + fax */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className={lbl}>Persona de contacto</label>
              <input
                value={form.igss_contacto}
                onChange={(e) => up("igss_contacto", e.target.value)}
                placeholder="Nombre del encargado"
                className={inp}
              />
            </div>
            <div>
              <label className={lbl}>Teléfono IGSS</label>
              <input
                value={form.igss_telefono}
                onChange={(e) => up("igss_telefono", e.target.value)}
                placeholder="2234-5678"
                className={inp}
              />
            </div>
            <div>
              <label className={lbl}>Fax</label>
              <input
                value={form.igss_fax}
                onChange={(e) => up("igss_fax", e.target.value)}
                placeholder="2234-5679"
                className={inp}
              />
            </div>
          </div>

          {/* Fila 5: email */}
          <div>
            <label className={lbl}>Correo electrónico IGSS</label>
            <input
              type="email"
              value={form.igss_email}
              onChange={(e) => up("igss_email", e.target.value)}
              placeholder="administracion@empresa.gt"
              className={`${inp} max-w-sm`}
            />
          </div>
        </div>
      )}

      {/* Alerta info */}
      {!form.igss_aplica && (
        <div className="bg-white/3 border border-white/8 rounded-xl p-4 flex items-start gap-3">
          <Landmark className="w-4 h-4 text-white/20 shrink-0 mt-0.5" />
          <div className="text-xs text-white/30 leading-relaxed">
            Este cliente no está configurado como Centro de Trabajo del IGSS. Activa la opción arriba para registrar los datos que aparecerán en la planilla mensual.
          </div>
        </div>
      )}

      {/* Guardar */}
      <div className="flex items-center gap-3 pt-2">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary hover:bg-primary/90 text-black text-xs font-bold transition-all disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          Guardar configuración IGSS
        </button>
        {saved && (
          <span className="flex items-center gap-1 text-xs text-emerald-400">
            <CheckCircle className="w-3.5 h-3.5" /> Guardado
          </span>
        )}
        {error && (
          <span className="text-xs text-red-400 flex items-center gap-1">
            <AlertTriangle className="w-3.5 h-3.5" />{error}
          </span>
        )}
      </div>
    </div>
  );
}
