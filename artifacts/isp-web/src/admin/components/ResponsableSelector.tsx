/**
 * ResponsableSelector — autocompletado para asignar responsable de incidencias.
 *
 * Carga empleados del área administrativa, supervisión y jefes de servicio.
 * No permite texto libre: el valor debe ser seleccionado de la lista.
 */
import { useState, useEffect, useRef } from "react";
import { ChevronDown, Search, User, X } from "lucide-react";

const getSession = () => sessionStorage.getItem("isp_admin_session_v2") || "";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

// Puestos/áreas que califican como responsable de incidencias
const PUESTOS_CALIFICADOS = [
  "jefe", "supervisor", "director", "gerente", "coordinador",
  "administrador", "admin", "encargado", "responsable",
];
const AREAS_CALIFICADAS = ["supervisión", "administración", "administrativo", "dirección", "gerencia"];

function esResponsableCalificado(emp: { puesto?: string; area?: string }) {
  const p = (emp.puesto ?? "").toLowerCase();
  const a = (emp.area ?? "").toLowerCase();
  return (
    PUESTOS_CALIFICADOS.some((kw) => p.includes(kw)) ||
    AREAS_CALIFICADAS.some((kw) => a.includes(kw))
  );
}

interface Props {
  value: string;
  onChange: (nombre: string) => void;
  inputCls?: string;
  placeholder?: string;
  disabled?: boolean;
}

interface Empleado {
  id: number;
  nombreCompleto: string;
  puesto?: string;
  area?: string;
}

export function ResponsableSelector({ value, onChange, inputCls, placeholder, disabled }: Props) {
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState<Empleado[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [confirmed, setConfirmed] = useState(!!value);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sincronizar si el valor cambia desde afuera
  useEffect(() => {
    setQuery(value);
    setConfirmed(!!value);
  }, [value]);

  // Cerrar dropdown al click fuera
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  async function buscar(q: string) {
    setLoading(true);
    try {
      const qs = q.trim() ? `?q=${encodeURIComponent(q.trim())}` : "";
      const res = await fetch(`${BASE}/api/employees${qs}`, {
        headers: { "x-isp-session": getSession() },
      });
      if (!res.ok) throw new Error("error");
      const data: Empleado[] = await res.json();
      // Filtrar a personal calificado
      const filtrados = data.filter(esResponsableCalificado);
      setResults(filtrados);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }

  function handleInput(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value;
    setQuery(v);
    setConfirmed(false);
    onChange(""); // limpiar selección hasta que se elija de la lista
    setOpen(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => buscar(v), 250);
  }

  function handleFocus() {
    if (!open) {
      setOpen(true);
      buscar(query);
    }
  }

  function seleccionar(emp: Empleado) {
    setQuery(emp.nombreCompleto);
    onChange(emp.nombreCompleto);
    setConfirmed(true);
    setOpen(false);
  }

  function limpiar() {
    setQuery("");
    onChange("");
    setConfirmed(false);
    setOpen(false);
  }

  // Quitar px-* del inputCls para sustituirlos con pl-7 pr-7 (espacio para los íconos)
  const baseRaw = inputCls ?? "w-full bg-white/5 border border-white/10 rounded-lg py-2 text-xs text-white placeholder-white/25 focus:outline-none focus:border-primary/50 transition-colors";
  const base = baseRaw.replace(/\bpx-\S+/g, "");

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-white/25 pointer-events-none" />
        <input
          type="text"
          className={`${base} pl-7 pr-7`}
          placeholder={placeholder ?? "Buscar supervisor o jefe…"}
          value={query}
          onChange={handleInput}
          onFocus={handleFocus}
          disabled={disabled}
          autoComplete="off"
        />
        {query ? (
          <button
            type="button"
            onClick={limpiar}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
          >
            <X className="w-3 h-3" />
          </button>
        ) : (
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-white/25 pointer-events-none" />
        )}
      </div>

      {/* Confirmación visual */}
      {confirmed && value && (
        <p className="mt-0.5 text-[9px] text-emerald-400/80 flex items-center gap-1">
          <User className="w-2.5 h-2.5" />
          Asignado: {value}
        </p>
      )}

      {/* Dropdown de resultados */}
      {open && (
        <div className="absolute z-50 top-full mt-1 w-full bg-[#0d1b2e] border border-white/15 rounded-xl shadow-2xl overflow-hidden max-h-56 overflow-y-auto">
          {loading ? (
            <div className="px-3 py-3 text-[11px] text-white/30 text-center">Buscando…</div>
          ) : results.length === 0 ? (
            <div className="px-3 py-3 text-[11px] text-white/30 text-center">
              No se encontraron supervisores o jefes de servicio
            </div>
          ) : (
            results.map((emp) => (
              <button
                key={emp.id}
                type="button"
                onMouseDown={() => seleccionar(emp)}
                className="w-full text-left px-3 py-2.5 hover:bg-white/5 transition-colors border-b border-white/5 last:border-0"
              >
                <p className="text-xs text-white font-medium">{emp.nombreCompleto}</p>
                <p className="text-[10px] text-white/35 mt-0.5">
                  {emp.puesto ?? "Sin puesto"}{emp.area ? ` · ${emp.area}` : ""}
                </p>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
