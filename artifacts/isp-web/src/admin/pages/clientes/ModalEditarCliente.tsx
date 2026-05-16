import { useState } from "react";
import { createPortal } from "react-dom";
import { X, Loader2 } from "lucide-react";
import { API, h, ClienteFicha } from "./_shared";

export function ModalEditarCliente({
  cliente,
  onClose,
  onSaved,
}: {
  cliente: ClienteFicha;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    nombre: cliente.nombre ?? "",
    nombreComercial: cliente.nombreComercial ?? "",
    nit: cliente.nit ?? "",
    sector: cliente.sector ?? "",
    observaciones_contractuales: cliente.observaciones_contractuales ?? "",
    fecha_inicio_contrato: cliente.fecha_inicio_contrato?.substring(0, 10) ?? "",
    tarifa_base_mensual: cliente.tarifa_base_mensual ?? "",
    estado_contrato: cliente.estado_contrato ?? "activo",
    notas: cliente.notas ?? "",
    dotacion_uniforme_num: String(cliente.dotacion_uniforme_num ?? 0),
    dotacion_uniforme_frecuencia_meses: String(cliente.dotacion_uniforme_frecuencia_meses ?? 0),
    contrato_sin_prueba: cliente.contrato_sin_prueba ?? false,
    tipo_servicio: cliente.tipo_servicio ?? "vigilancia",
  });
  const [saving, setSaving] = useState(false);

  const up = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));

  async function submit() {
    setSaving(true);
    try {
      const r1 = await fetch(`${API}/clientes/${cliente.id}/contrato`, {
        method: "PATCH",
        headers: h(),
        body: JSON.stringify({
          ...form,
          tarifa_base_mensual: form.tarifa_base_mensual ? Number(form.tarifa_base_mensual) : null,
          fecha_inicio_contrato: form.fecha_inicio_contrato || null,
          nombreComercial: form.nombreComercial || null,
          nit: form.nit || null,
          sector: form.sector || null,
          contrato_sin_prueba: form.contrato_sin_prueba,
          tipo_servicio: form.tipo_servicio,
        }),
      });
      if (!r1.ok) throw new Error("Error al guardar contrato");
      const r2 = await fetch(`${API}/uniformes/config-cliente/${cliente.id}`, {
        method: "PATCH",
        headers: h(),
        body: JSON.stringify({
          dotacion_uniforme_num: parseInt(form.dotacion_uniforme_num) || 0,
          dotacion_uniforme_frecuencia_meses: parseInt(form.dotacion_uniforme_frecuencia_meses) || 0,
        }),
      });
      if (!r2.ok) throw new Error("Error al guardar uniformes");
      onSaved();
    } catch { /* ignore */ }
    setSaving(false);
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-[#07111f] border border-white/10 rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-white/8">
          <h3 className="text-sm font-bold text-white">Editar cliente</h3>
          <button onClick={onClose} className="text-white/30 hover:text-white"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5 space-y-3 max-h-[65vh] overflow-y-auto">
          {[
            { label: "Nombre legal *", k: "nombre", type: "text" },
            { label: "Nombre comercial", k: "nombreComercial", type: "text" },
            { label: "NIT", k: "nit", type: "text" },
            { label: "Sector", k: "sector", type: "text" },
            { label: "Tarifa base mensual (Q)", k: "tarifa_base_mensual", type: "number" },
            { label: "Fecha inicio de contrato", k: "fecha_inicio_contrato", type: "date" },
          ].map(({ label, k, type }) => (
            <div key={k} className="space-y-1">
              <label className="text-[10px] text-white/40 uppercase tracking-wide">{label}</label>
              <input
                type={type}
                value={(form as any)[k]}
                onChange={(e) => up(k, e.target.value)}
                className="w-full bg-[#060e1c] border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-primary/50"
              />
            </div>
          ))}
          {/* Dotación de uniformes */}
          <div className="pt-1 pb-0.5">
            <p className="text-[10px] text-orange-400/70 uppercase tracking-widest font-semibold">Dotación de Uniformes</p>
            <p className="text-[10px] text-white/30 mt-0.5">Uniforme pagado por el cliente (titulares). 0 = no aplica.</p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-[10px] text-white/40 uppercase tracking-wide">Uniformes por dotación</label>
              <input
                type="number" min="0" max="10"
                value={form.dotacion_uniforme_num}
                onChange={(e) => up("dotacion_uniforme_num", e.target.value)}
                className="w-full bg-[#060e1c] border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-primary/50"
                placeholder="0"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] text-white/40 uppercase tracking-wide">Cada (meses)</label>
              <input
                type="number" min="0" max="36"
                value={form.dotacion_uniforme_frecuencia_meses}
                onChange={(e) => up("dotacion_uniforme_frecuencia_meses", e.target.value)}
                className="w-full bg-[#060e1c] border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-primary/50"
                placeholder="6"
              />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] text-white/40 uppercase tracking-wide">Tipo de servicio</label>
            <select
              value={form.tipo_servicio}
              onChange={(e) => up("tipo_servicio", e.target.value)}
              className="w-full bg-[#060e1c] border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-primary/50"
            >
              <option value="vigilancia">Vigilancia (Puestos fijos)</option>
              <option value="custodia">Custodia (Fuerza diaria)</option>
              <option value="mixto">Mixto</option>
            </select>
          </div>
          <div className="pt-1 pb-0.5">
            <p className="text-[10px] text-blue-400/70 uppercase tracking-widest font-semibold">Período de Prueba</p>
          </div>
          <button
            type="button"
            onClick={() => setForm(p => ({ ...p, contrato_sin_prueba: !p.contrato_sin_prueba }))}
            className={`w-full flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors ${form.contrato_sin_prueba ? "border-blue-500/30 bg-blue-500/5" : "border-white/10 bg-[#060e1c]"}`}
          >
            <div className={`w-8 h-5 rounded-full flex items-center px-0.5 transition-colors ${form.contrato_sin_prueba ? "bg-blue-500" : "bg-white/15"}`}>
              <div className={`w-4 h-4 rounded-full bg-white shadow transition-transform ${form.contrato_sin_prueba ? "translate-x-3" : "translate-x-0"}`} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-white/80 font-medium">Contrato sin período de prueba</p>
              <p className="text-[10px] text-white/30 mt-0.5">
                {form.contrato_sin_prueba
                  ? "Los empleados asignados como titulares dentro del primer mes acumularán prestaciones desde su fecha de ingreso."
                  : "Los empleados pasan 2 meses de período de prueba antes de acumular prestaciones (regla estándar)."}
              </p>
            </div>
          </button>
          <div className="space-y-1">
            <label className="text-[10px] text-white/40 uppercase tracking-wide">Estado del contrato</label>
            <select
              value={form.estado_contrato}
              onChange={(e) => up("estado_contrato", e.target.value)}
              className="w-full bg-[#060e1c] border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-primary/50"
            >
              <option value="activo">Activo</option>
              <option value="negociacion">En negociación</option>
              <option value="suspendido">Suspendido</option>
              <option value="inactivo">Inactivo</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] text-white/40 uppercase tracking-wide">Observaciones contractuales</label>
            <textarea
              value={form.observaciones_contractuales}
              onChange={(e) => up("observaciones_contractuales", e.target.value)}
              rows={3}
              className="w-full bg-[#060e1c] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 outline-none focus:border-primary/50 resize-none"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] text-white/40 uppercase tracking-wide">Notas internas</label>
            <textarea
              value={form.notas}
              onChange={(e) => up("notas", e.target.value)}
              rows={2}
              className="w-full bg-[#060e1c] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 outline-none focus:border-primary/50 resize-none"
            />
          </div>
        </div>
        <div className="flex gap-2 p-5 border-t border-white/8">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-white/10 text-sm text-white/50 hover:text-white transition-colors">Cancelar</button>
          <button
            onClick={submit}
            disabled={saving}
            className="flex-1 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-sm font-bold text-white disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
          >
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Guardar
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
