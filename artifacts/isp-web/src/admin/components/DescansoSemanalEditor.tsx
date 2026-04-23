import { useEffect, useState } from "react";

const API_BASE =
  ((import.meta as Record<string, unknown>).env as Record<string, string> | undefined)?.VITE_API_BASE ?? "/api";

const DIAS = [
  { value: "domingo", label: "Domingo" },
  { value: "lunes", label: "Lunes" },
  { value: "martes", label: "Martes" },
  { value: "miercoles", label: "Miércoles" },
  { value: "jueves", label: "Jueves" },
  { value: "viernes", label: "Viernes" },
  { value: "sabado", label: "Sábado" },
];

type Override = {
  id: number;
  semana_inicio: string;
  dia_descanso: string;
};

function lunesDeFecha(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const off = (dt.getUTCDay() + 6) % 7;
  dt.setUTCDate(dt.getUTCDate() - off);
  return dt.toISOString().slice(0, 10);
}

function domingoDeLunes(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + 6));
  return dt.toISOString().slice(0, 10);
}

function fmtRango(lunes: string): string {
  const dom = domingoDeLunes(lunes);
  const f = (s: string) => {
    const [y, m, d] = s.split("-");
    return `${d}/${m}/${y}`;
  };
  return `Sem. ${f(lunes)} → ${f(dom)}`;
}

export default function DescansoSemanalEditor({
  employeeId,
  diaDescansoDefault,
}: {
  employeeId: number;
  diaDescansoDefault?: string | null;
}) {
  const [items, setItems] = useState<Override[]>([]);
  const [loading, setLoading] = useState(true);
  const [fechaSel, setFechaSel] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [diaSel, setDiaSel] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const r = await fetch(`${API_BASE}/employees/${employeeId}/descanso-semanal`);
      if (!r.ok) throw new Error("Error al cargar");
      const data = await r.json();
      setItems(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setError(e.message ?? "Error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (employeeId) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employeeId]);

  async function guardar() {
    if (!fechaSel || !diaSel) {
      setError("Selecciona una semana y un día");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const r = await fetch(`${API_BASE}/employees/${employeeId}/descanso-semanal`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ semana_inicio: lunesDeFecha(fechaSel), dia_descanso: diaSel }),
      });
      if (!r.ok) throw new Error("No se pudo guardar");
      setDiaSel("");
      await load();
    } catch (e: any) {
      setError(e.message ?? "Error");
    } finally {
      setSaving(false);
    }
  }

  async function eliminar(semana: string) {
    if (!confirm("¿Eliminar este día de descanso de esta semana?")) return;
    try {
      const r = await fetch(
        `${API_BASE}/employees/${employeeId}/descanso-semanal/${semana}`,
        { method: "DELETE" }
      );
      if (!r.ok) throw new Error("No se pudo eliminar");
      await load();
    } catch (e: any) {
      setError(e.message ?? "Error");
    }
  }

  if (!employeeId) return null;

  return (
    <div className="space-y-2 border border-white/10 rounded-lg p-3 bg-[#060e1c]/60">
      <div className="flex items-center justify-between">
        <p className="text-[11px] text-white/60 font-medium uppercase tracking-wider">
          Día de descanso por semana
        </p>
        {diaDescansoDefault && (
          <span className="text-[10px] text-white/40">
            por defecto: <span className="text-white/70">{diaDescansoDefault}</span>
          </span>
        )}
      </div>
      <p className="text-[10px] text-white/40 leading-snug">
        Si una semana el descanso debe rotar a otro día, agrégalo aquí.
        Solo afecta turnos diarios (no ciclos largos como 24x24).
      </p>

      <div className="grid grid-cols-12 gap-2 items-end pt-1">
        <div className="col-span-5 space-y-1">
          <label className="text-[10px] text-white/40">Semana (cualquier día)</label>
          <input
            type="date"
            value={fechaSel}
            onChange={(e) => setFechaSel(e.target.value)}
            className="w-full bg-[#060e1c] border border-white/10 rounded px-2 py-1.5 text-xs text-white outline-none focus:border-primary/50"
          />
          {fechaSel && (
            <p className="text-[10px] text-white/30">{fmtRango(lunesDeFecha(fechaSel))}</p>
          )}
        </div>
        <div className="col-span-4 space-y-1">
          <label className="text-[10px] text-white/40">Día de descanso</label>
          <select
            value={diaSel}
            onChange={(e) => setDiaSel(e.target.value)}
            className="w-full bg-[#060e1c] border border-white/10 rounded px-2 py-1.5 text-xs text-white outline-none focus:border-primary/50 appearance-none"
          >
            <option value="">— Seleccionar —</option>
            {DIAS.map((d) => (
              <option key={d.value} value={d.value}>{d.label}</option>
            ))}
          </select>
        </div>
        <div className="col-span-3">
          <button
            type="button"
            onClick={guardar}
            disabled={saving || !diaSel}
            className="w-full bg-primary/80 hover:bg-primary text-white text-xs font-medium px-3 py-1.5 rounded disabled:opacity-40 transition-colors"
          >
            {saving ? "Guardando…" : "Agregar"}
          </button>
        </div>
      </div>

      {error && <p className="text-[10px] text-red-400">{error}</p>}

      <div className="pt-1">
        {loading ? (
          <p className="text-[11px] text-white/40">Cargando…</p>
        ) : items.length === 0 ? (
          <p className="text-[11px] text-white/40">Sin overrides. Aplica el día por defecto.</p>
        ) : (
          <ul className="space-y-1 max-h-40 overflow-y-auto">
            {items.map((o) => (
              <li
                key={o.id}
                className="flex items-center justify-between text-xs bg-white/[0.03] border border-white/5 rounded px-2 py-1.5"
              >
                <div className="flex flex-col">
                  <span className="text-white/80">{fmtRango(o.semana_inicio)}</span>
                  <span className="text-[10px] text-white/40">
                    descansa: <span className="text-white/70">{o.dia_descanso}</span>
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => eliminar(o.semana_inicio)}
                  className="text-[10px] text-red-400/80 hover:text-red-400"
                >
                  Eliminar
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
