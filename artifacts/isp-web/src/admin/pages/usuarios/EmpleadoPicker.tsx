import { useState, useEffect, useRef } from "react";
import { Search, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { getAdminSessionHeader } from "./shared";

interface EmpleadoLite {
  id: number;
  nombreCompleto: string;
  dpi?: string | null;
  puesto?: string | null;
  area?: string | null;
  estadoLaboral?: string | null;
}

interface EmpleadoPickerProps {
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
}

export function EmpleadoPicker({ value, onChange, placeholder }: EmpleadoPickerProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<EmpleadoLite[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [linked, setLinked] = useState<EmpleadoLite | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const id = value?.trim();
    if (!id) { setLinked(null); return; }
    if (linked && String(linked.id) === id) return;
    let abort = false;
    (async () => {
      try {
        const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
        const r = await fetch(`${BASE}/api/employees/${encodeURIComponent(id)}`, { headers: getAdminSessionHeader() });
        if (!r.ok) { if (!abort) setLinked(null); return; }
        const data = await r.json();
        if (!abort) setLinked({
          id: data.id,
          nombreCompleto: data.nombreCompleto ?? data.nombre_completo ?? "",
          dpi: data.dpi,
          puesto: data.puesto,
          area: data.area,
          estadoLaboral: data.estadoLaboral ?? data.estado_laboral,
        });
      } catch { if (!abort) setLinked(null); }
    })();
    return () => { abort = true; };
  }, [value]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim() || query.trim().length < 2) {
      setResults([]); setLoading(false);
      return;
    }
    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
        const r = await fetch(`${BASE}/api/employees?q=${encodeURIComponent(query.trim())}`, { headers: getAdminSessionHeader() });
        if (!r.ok) { setResults([]); return; }
        const data: EmpleadoLite[] = await r.json();
        setResults(data.slice(0, 15));
      } catch { setResults([]); }
      finally { setLoading(false); }
    }, 250);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  function pick(emp: EmpleadoLite) {
    onChange(String(emp.id));
    setLinked(emp);
    setQuery("");
    setResults([]);
    setOpen(false);
  }
  function clear() {
    onChange("");
    setLinked(null);
    setQuery("");
  }

  return (
    <div ref={wrapRef} className="space-y-2">
      {linked && value && (
        <div className="flex items-center justify-between gap-2 bg-primary/10 border border-primary/30 rounded-lg px-3 py-2">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-white truncate">{linked.nombreCompleto || `Empleado #${linked.id}`}</p>
            <p className="text-[10px] text-white/50 truncate">
              ID #{linked.id}
              {linked.dpi ? ` · DPI ${linked.dpi}` : ""}
              {linked.puesto ? ` · ${linked.puesto}` : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={clear}
            className="text-[10px] text-white/50 hover:text-red-400 px-2 py-1 rounded hover:bg-red-400/10 shrink-0"
          >
            Quitar
          </button>
        </div>
      )}

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
        <Input
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder ?? "Buscar empleado por nombre, DPI o puesto…"}
          className="pl-9 bg-[#060e1c] border-white/10 text-white text-sm h-10"
        />
        {open && (query.trim().length >= 2) && (
          <div className="absolute z-50 left-0 right-0 mt-1 bg-[#0a1628] border border-white/15 rounded-lg shadow-2xl max-h-72 overflow-y-auto">
            {loading && (
              <div className="px-3 py-3 text-xs text-white/40 flex items-center gap-2">
                <Loader2 className="w-3 h-3 animate-spin" /> Buscando…
              </div>
            )}
            {!loading && results.length === 0 && (
              <div className="px-3 py-3 text-xs text-white/40">Sin resultados.</div>
            )}
            {!loading && results.map(emp => (
              <button
                key={emp.id}
                type="button"
                onClick={() => pick(emp)}
                className="w-full text-left px-3 py-2 hover:bg-white/5 border-b border-white/5 last:border-b-0"
              >
                <p className="text-xs font-semibold text-white truncate">
                  {emp.nombreCompleto || `Empleado #${emp.id}`}
                </p>
                <p className="text-[10px] text-white/40 truncate">
                  ID #{emp.id}
                  {emp.dpi ? ` · DPI ${emp.dpi}` : ""}
                  {emp.puesto ? ` · ${emp.puesto}` : ""}
                  {emp.estadoLaboral ? ` · ${emp.estadoLaboral}` : ""}
                </p>
              </button>
            ))}
          </div>
        )}
      </div>

      {!linked && (
        <p className="text-[10px] text-white/30">
          Escribí al menos 2 letras (nombre, DPI o puesto). Ej: "da" → Daniel, Danilo…
        </p>
      )}
    </div>
  );
}
