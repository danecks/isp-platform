import { useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Save, Pencil, X, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { API_BASE, sessionHeader, type Empleado } from "./shared";

interface DetallePersonal {
  estado_civil: string | null;
  direccion: string | null;
  sexo: string | null;
  nit: string | null;
  fecha_nacimiento: string | null;
  lugar_nacimiento: string | null;
  municipio: string | null;
  departamento: string | null;
}

type FormPersonal = Record<keyof DetallePersonal, string>;

function aForm(d?: Partial<DetallePersonal>): FormPersonal {
  return {
    estado_civil: d?.estado_civil ?? "",
    direccion: d?.direccion ?? "",
    sexo: d?.sexo ?? "",
    nit: d?.nit ?? "",
    fecha_nacimiento: (d?.fecha_nacimiento ?? "").slice(0, 10),
    lugar_nacimiento: d?.lugar_nacimiento ?? "",
    municipio: d?.municipio ?? "",
    departamento: d?.departamento ?? "",
  };
}

const inputCls =
  "w-full bg-[#060e1c] border border-white/10 rounded-lg px-2.5 py-1.5 text-sm text-white outline-none focus:border-primary/40";

function Campo({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-[10px] text-white/40">{label}</label>
      {children}
    </div>
  );
}

function Lectura({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2 border-b border-white/5 last:border-0">
      <span className="text-xs text-white/40">{label}</span>
      <span className={`text-sm text-right ${value ? "text-white/80" : "text-amber-400/70 italic"}`}>
        {value || "Pendiente"}
      </span>
    </div>
  );
}

export function DatosPersonalesSection({ emp }: { emp: Empleado }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [editando, setEditando] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<FormPersonal>(aForm());

  const { data: det, isLoading } = useQuery<DetallePersonal>({
    queryKey: ["employee-detalle", emp.id],
    queryFn: () => fetch(`${API_BASE}/employees/${emp.id}`).then((r) => r.json()),
    staleTime: 30_000,
  });

  const set = (k: keyof FormPersonal, v: string) => setForm((f) => ({ ...f, [k]: v }));

  function abrir() {
    setForm(aForm(det));
    setEditando(true);
  }

  async function guardar() {
    setSaving(true);
    try {
      const r = await fetch(`${API_BASE}/employees/${emp.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...sessionHeader() },
        body: JSON.stringify({
          estadoCivil: form.estado_civil || null,
          direccion: form.direccion || null,
          sexo: form.sexo || null,
          nit: form.nit || null,
          fechaNacimiento: form.fecha_nacimiento || null,
          lugarNacimiento: form.lugar_nacimiento || null,
          municipio: form.municipio || null,
          departamento: form.departamento || null,
        }),
      });
      if (!r.ok) throw new Error("Error al guardar");
      toast({ title: "Datos personales actualizados", description: emp.nombreCompleto });
      qc.invalidateQueries({ queryKey: ["employee-detalle", emp.id] });
      qc.invalidateQueries({ queryKey: ["empleados"] });
      setEditando(false);
    } catch {
      toast({ title: "Error", description: "No se pudieron guardar los datos.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  const faltan = !det?.direccion || !det?.estado_civil || !det?.sexo || !det?.nit;

  return (
    <div className="bg-[#0c1929] border border-white/6 rounded-xl p-3 mt-2">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] text-white/30 uppercase tracking-widest">
          Datos para contrato
        </p>
        {!editando && !isLoading && (
          <button
            onClick={abrir}
            className="flex items-center gap-1 text-[10px] text-white/30 hover:text-primary transition-colors"
          >
            <Pencil className="w-3 h-3" /> {faltan ? "Completar" : "Editar"}
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="w-4 h-4 animate-spin text-primary" />
        </div>
      ) : editando ? (
        <div className="space-y-2">
          <Campo label="Dirección">
            <textarea
              value={form.direccion}
              onChange={(e) => set("direccion", e.target.value)}
              rows={2}
              className={inputCls}
            />
          </Campo>
          <div className="grid grid-cols-2 gap-2">
            <Campo label="Sexo">
              <select value={form.sexo} onChange={(e) => set("sexo", e.target.value)} className={inputCls}>
                <option value="">—</option>
                <option value="M">Masculino</option>
                <option value="F">Femenino</option>
              </select>
            </Campo>
            <Campo label="Estado civil">
              <select value={form.estado_civil} onChange={(e) => set("estado_civil", e.target.value)} className={inputCls}>
                <option value="">—</option>
                <option value="Soltero/a">Soltero/a</option>
                <option value="Casado/a">Casado/a</option>
                <option value="Unido/a">Unido/a</option>
              </select>
            </Campo>
            <Campo label="NIT">
              <input value={form.nit} onChange={(e) => set("nit", e.target.value)} className={inputCls} />
            </Campo>
            <Campo label="Fecha de nacimiento">
              <input type="date" value={form.fecha_nacimiento} onChange={(e) => set("fecha_nacimiento", e.target.value)} className={inputCls} />
            </Campo>
            <Campo label="Lugar de nacimiento">
              <input value={form.lugar_nacimiento} onChange={(e) => set("lugar_nacimiento", e.target.value)} className={inputCls} />
            </Campo>
            <Campo label="Municipio">
              <input value={form.municipio} onChange={(e) => set("municipio", e.target.value)} className={inputCls} />
            </Campo>
            <Campo label="Departamento">
              <input value={form.departamento} onChange={(e) => set("departamento", e.target.value)} className={inputCls} />
            </Campo>
          </div>
          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={guardar}
              disabled={saving}
              className="flex items-center gap-1 text-xs bg-primary text-black font-semibold px-2.5 py-1.5 rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
              Guardar
            </button>
            <button onClick={() => setEditando(false)} className="text-white/30 hover:text-white transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      ) : (
        <div>
          {faltan && (
            <div className="flex items-start gap-2 bg-amber-950/30 border border-amber-500/20 rounded-lg p-2 mb-2">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
              <p className="text-[10px] text-amber-400/80">
                Faltan datos para llenar el contrato. Usa "Completar" para capturarlos.
              </p>
            </div>
          )}
          <Lectura label="Dirección" value={det?.direccion ?? null} />
          <Lectura label="Sexo" value={det?.sexo === "M" ? "Masculino" : det?.sexo === "F" ? "Femenino" : (det?.sexo ?? null)} />
          <Lectura label="Estado civil" value={det?.estado_civil ?? null} />
          <Lectura label="NIT" value={det?.nit ?? null} />
          <Lectura label="Fecha de nacimiento" value={(det?.fecha_nacimiento ?? "").slice(0, 10) || null} />
          <Lectura label="Lugar de nacimiento" value={det?.lugar_nacimiento ?? null} />
          <Lectura label="Municipio" value={det?.municipio ?? null} />
          <Lectura label="Departamento" value={det?.departamento ?? null} />
        </div>
      )}
    </div>
  );
}
