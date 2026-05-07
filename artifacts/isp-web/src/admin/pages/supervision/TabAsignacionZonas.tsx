import { useEffect, useState } from "react";
import { Trash2, UserPlus, Users } from "lucide-react";
import type { ZonaConSupervisores, SupervisorDisponible } from "./types";

const API_BASE = "/api";

function getSession(): string {
  return (typeof sessionStorage !== "undefined"
    ? sessionStorage.getItem("isp_admin_session_v2")
    : null) || "";
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "x-isp-session": getSession(),
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw new Error(j.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export function TabAsignacionZonas() {
  const [zonas, setZonas] = useState<ZonaConSupervisores[]>([]);
  const [supervisores, setSupervisores] = useState<SupervisorDisponible[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [seleccion, setSeleccion] = useState<Record<number, number>>({});
  const [busy, setBusy] = useState<number | null>(null);

  async function cargar() {
    try {
      setLoading(true);
      setError(null);
      const [z, s] = await Promise.all([
        api<{ zonas: ZonaConSupervisores[] }>("/supervision-zonas"),
        api<{ supervisores: SupervisorDisponible[] }>("/supervision-zonas/supervisores-disponibles"),
      ]);
      setZonas(z.zonas);
      setSupervisores(s.supervisores);
    } catch (err: any) {
      setError(err.message || "Error al cargar");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { cargar(); }, []);

  async function asignar(zonaId: number) {
    const empId = seleccion[zonaId];
    if (!empId) return;
    try {
      setBusy(zonaId);
      await api("/supervision-zonas", {
        method: "POST",
        body: JSON.stringify({ zona_id: zonaId, employee_id: empId }),
      });
      setSeleccion(prev => ({ ...prev, [zonaId]: 0 }));
      await cargar();
    } catch (err: any) {
      alert(err.message || "Error al asignar");
    } finally {
      setBusy(null);
    }
  }

  async function quitar(asignacionId: number) {
    if (!confirm("¿Quitar este supervisor de la zona?")) return;
    try {
      await api(`/supervision-zonas/${asignacionId}`, { method: "DELETE" });
      await cargar();
    } catch (err: any) {
      alert(err.message || "Error al eliminar");
    }
  }

  if (loading) return <div className="text-white/50 text-sm p-4">Cargando zonas…</div>;
  if (error)   return <div className="text-rose-300 text-sm p-4">{error}</div>;

  return (
    <div className="space-y-3">
      <p className="text-xs text-white/50">
        Asigna supervisores a zonas operativas. Un supervisor puede estar en varias zonas y una zona puede tener varios supervisores.
      </p>

      {zonas.length === 0 && (
        <div className="text-white/40 text-sm p-4 border border-white/10 rounded">
          No hay zonas operativas creadas. Créalas desde Pizarrón → Zonas.
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {zonas.map(z => {
          const yaAsignados = new Set(z.supervisores.map(s => s.employee_id));
          const disponibles = supervisores.filter(s => !yaAsignados.has(s.id));
          return (
            <div key={z.zona_id} className="border border-white/10 rounded-lg bg-[#0b1424] p-3">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <h3 className="text-sm font-bold text-white">{z.zona_nombre}</h3>
                  {z.zona_descripcion && (
                    <p className="text-[11px] text-white/40">{z.zona_descripcion}</p>
                  )}
                </div>
                <span className="text-[10px] text-white/40 inline-flex items-center gap-1">
                  <Users className="w-3 h-3" /> {z.supervisores.length}
                </span>
              </div>

              <div className="space-y-1 mb-2">
                {z.supervisores.length === 0 && (
                  <p className="text-[11px] text-white/30 italic">Sin supervisores asignados</p>
                )}
                {z.supervisores.map(s => (
                  <div key={s.asignacion_id} className="flex items-center justify-between bg-white/5 rounded px-2 py-1">
                    <div className="text-[12px] text-white truncate">
                      {s.nombre_completo}
                      {s.telefono && <span className="text-white/30 ml-2">{s.telefono}</span>}
                    </div>
                    <button
                      onClick={() => quitar(s.asignacion_id)}
                      className="text-rose-400 hover:text-rose-300 p-1"
                      title="Quitar"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              <div className="flex gap-2 pt-2 border-t border-white/5">
                <select
                  value={seleccion[z.zona_id] || ""}
                  onChange={e => setSeleccion(prev => ({ ...prev, [z.zona_id]: Number(e.target.value) }))}
                  className="flex-1 bg-[#060e1c] border border-white/10 rounded px-2 py-1 text-xs text-white"
                  disabled={disponibles.length === 0}
                >
                  <option value="">{disponibles.length === 0 ? "Todos asignados" : "Seleccionar supervisor…"}</option>
                  {disponibles.map(s => (
                    <option key={s.id} value={s.id}>{s.nombre_completo}</option>
                  ))}
                </select>
                <button
                  onClick={() => asignar(z.zona_id)}
                  disabled={!seleccion[z.zona_id] || busy === z.zona_id}
                  className="px-2 py-1 bg-primary text-black text-xs font-bold rounded inline-flex items-center gap-1 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <UserPlus className="w-3.5 h-3.5" /> Asignar
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
