import { useState } from "react";
import { ChevronDown, Loader2, Printer } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { EventoRrhh } from "@/lib/pdfRrhh";
import { generarActaAdministrativa } from "@/lib/pdfRrhh";
import { construirDatosActa } from "./helpers";

export function BatchActasPanel({ eventos }: { eventos: EventoRrhh[] }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [desde, setDesde] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10));
  const [hasta, setHasta] = useState(() => new Date().toISOString().slice(0, 10));
  const [tipoFiltro, setTipoFiltro] = useState("");
  const [printing, setPrinting] = useState(false);

  const filtrados = eventos.filter((e) => {
    const f = new Date(e.fecha).toISOString().slice(0, 10);
    if (desde && f < desde) return false;
    if (hasta && f > hasta) return false;
    if (tipoFiltro && e.tipo_evento !== tipoFiltro) return false;
    if (e.estado === "anulado") return false;
    return true;
  });

  async function imprimirTodo() {
    if (!filtrados.length) return;
    setPrinting(true);
    let count = 0;
    for (const ev of filtrados) {
      try {
        const datos = await construirDatosActa(ev);
        await generarActaAdministrativa(datos);
        count++;
        await new Promise((r) => setTimeout(r, 180));
      } catch {
        // continúa con el siguiente
      }
    }
    setPrinting(false);
    toast({ title: `${count} acta(s) generadas`, description: "Revisa tu carpeta de Descargas." });
  }

  return (
    <div className="bg-[#07111f] border border-white/8 rounded-2xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-white/3 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <Printer className="w-4 h-4 text-cyan-400" />
          <span className="text-sm font-semibold text-white/80">Impresión Batch de Actas</span>
          <span className="text-[10px] text-white/30 bg-white/5 border border-white/8 px-2 py-0.5 rounded-full">
            {filtrados.length} evento{filtrados.length !== 1 ? "s" : ""} en rango
          </span>
        </div>
        <ChevronDown className={`w-4 h-4 text-white/30 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="border-t border-white/8 p-5 space-y-4">
          <div className="flex flex-wrap gap-3 items-end">
            <label className="flex flex-col gap-1">
              <span className="text-[10px] text-white/30 uppercase tracking-widest">Desde</span>
              <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)}
                className="bg-[#0c1929] border border-white/10 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-cyan-500/50" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[10px] text-white/30 uppercase tracking-widest">Hasta</span>
              <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)}
                className="bg-[#0c1929] border border-white/10 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-cyan-500/50" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[10px] text-white/30 uppercase tracking-widest">Tipo</span>
              <select value={tipoFiltro} onChange={(e) => setTipoFiltro(e.target.value)}
                className="bg-[#0c1929] border border-white/10 rounded-xl px-3 py-2 text-sm text-white/60 outline-none focus:border-cyan-500/50 appearance-none">
                <option value="">Todos</option>
                <option value="falta">Falta</option>
                <option value="suspension">Suspensión</option>
                <option value="amonestacion">Amonestación</option>
              </select>
            </label>
            <button
              onClick={imprimirTodo}
              disabled={printing || filtrados.length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl text-xs font-semibold text-white transition-all"
            >
              {printing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Printer className="w-3.5 h-3.5" />}
              {printing ? "Generando..." : `Generar ${filtrados.length} acta(s)`}
            </button>
          </div>
          {filtrados.length > 0 && (
            <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
              {filtrados.map((e) => (
                <div key={e.id} className="flex items-center justify-between px-3 py-1.5 bg-white/3 border border-white/6 rounded-xl text-xs">
                  <span className="text-white/60 truncate">{e.employee_nombre}</span>
                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    <span className="text-white/30">{String(e.fecha ?? "").slice(0, 10)}</span>
                    <span className="text-[10px] px-1.5 py-0.5 bg-white/5 border border-white/10 rounded text-white/40">{e.tipo_evento}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
