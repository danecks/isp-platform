import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AlertTriangle, Gavel, X } from "lucide-react";
import { api } from "./helpers";
import type { CausalLegal, Empleado, Motivo, TipoAmon } from "./types";

export function NuevaAmonestacionModal({ esRRHH, esSupervisor, onClose, onCreada }: {
  esRRHH: boolean; esSupervisor: boolean; onClose: () => void; onCreada: () => void;
}) {
  const [empBusq, setEmpBusq] = useState("");
  const [empSel, setEmpSel] = useState<Empleado | null>(null);
  const [tipo, setTipo] = useState<TipoAmon>("llamada_atencion");
  const [motivoSel, setMotivoSel] = useState<string>("");
  const [motivoLibre, setMotivoLibre] = useState<string>("");
  const [monto, setMonto] = useState<string>("");
  const [descripcion, setDescripcion] = useState("");
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
  const [causalCodigos, setCausalCodigos] = useState<string[]>([]);
  const [aplicaDescuento, setAplicaDescuento] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Modo: RRHH levanta directo. Operaciones/Supervisor envían solicitud a RRHH.
  const modoSolicitud = !esRRHH;

  const empleados = useQuery({
    queryKey: ["empleados-slim-amon"],
    queryFn: () => api<Empleado[]>("/employees"),
  });
  const motivos = useQuery({
    queryKey: ["amon-motivos"],
    queryFn: () => api<Motivo[]>("/amonestaciones/motivos"),
  });
  const causales = useQuery({
    queryKey: ["amon-causales-legales"],
    queryFn: () => api<CausalLegal[]>("/amonestaciones/causales-legales"),
    enabled: tipo === "acta_administrativa",
  });

  const filtrados = useMemo(() => {
    if (!empleados.data) return [];
    const q = empBusq.trim().toLowerCase();
    return empleados.data
      .filter(e => e.estadoLaboral === "activo")
      .filter(e =>
        !q || e.nombreCompleto.toLowerCase().includes(q) || (e.dpi || "").includes(q)
      )
      .slice(0, 8);
  }, [empleados.data, empBusq]);

  const motivoSugMonto = motivos.data?.find(m => m.nombre === motivoSel)?.monto_sugerido || 0;
  useEffect(() => {
    if (tipo === "economica" && motivoSel && motivoSugMonto > 0 && !monto) {
      setMonto(String(motivoSugMonto));
    }
  }, [motivoSel, tipo, motivoSugMonto, monto]);
  // Limpiar campos no aplicables al cambiar de tipo
  useEffect(() => {
    if (tipo !== "acta_administrativa") {
      setCausalCodigos([]); setAplicaDescuento(false);
    }
    if (tipo === "llamada_atencion") setMonto("");
  }, [tipo]);

  const requiereMonto = tipo === "economica" || (tipo === "acta_administrativa" && aplicaDescuento);

  const crear = useMutation({
    mutationFn: async () => {
      if (!empSel) throw new Error("Selecciona un colaborador");
      const motivoFinal = motivoSel || motivoLibre.trim();
      if (!motivoFinal) throw new Error("Indica un motivo");
      if (tipo === "acta_administrativa" && causalCodigos.length === 0) {
        throw new Error("Selecciona al menos una causal del Art. 77 para el acta");
      }
      if (requiereMonto && (Number(monto) || 0) <= 0) {
        throw new Error("El monto debe ser mayor a 0");
      }
      const baseBody = {
        employee_id: empSel.id,
        motivo: motivoFinal,
        descripcion: descripcion || null,
        cliente_id: null, cliente_nombre: null,
        puesto_id: null, puesto_nombre: null,
      };
      if (modoSolicitud) {
        return api("/amonestaciones/solicitudes-creacion", {
          method: "POST",
          body: JSON.stringify({
            ...baseBody,
            tipo_solicitado: tipo,
            causal_legal_codigos: tipo === "acta_administrativa" ? causalCodigos : null,
            monto_sugerido: requiereMonto ? Number(monto) : 0,
            fecha_incidente: fecha,
          }),
        });
      }
      return api("/amonestaciones", {
        method: "POST",
        body: JSON.stringify({
          ...baseBody,
          tipo,
          monto: requiereMonto ? Number(monto) : 0,
          fecha,
          causal_legal_codigos: tipo === "acta_administrativa" ? causalCodigos : null,
          aplica_descuento: tipo === "acta_administrativa" ? aplicaDescuento : false,
        }),
      });
    },
    onSuccess: onCreada,
    onError: (e: Error) => setError(e.message),
  });

  const causalesSel = (causales.data || []).filter(c => causalCodigos.includes(c.codigo));
  const toggleCausal = (codigo: string) => {
    setCausalCodigos(prev => prev.includes(codigo) ? prev.filter(c => c !== codigo) : [...prev, codigo]);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-[#0d1117] border border-white/10 rounded-2xl w-full max-w-2xl my-8">
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <h3 className="text-white font-semibold flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-400" />
            {modoSolicitud ? "Enviar solicitud a RRHH" : "Levantar amonestación"}
          </h3>
          <button onClick={onClose} className="text-white/40 hover:text-white"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-4 space-y-4">
          {/* Colaborador */}
          <div>
            <label className="text-xs text-white/50 font-medium">Colaborador *</label>
            {empSel ? (
              <div className="flex items-center justify-between bg-white/5 border border-white/10 rounded-lg px-3 py-2 mt-1">
                <div>
                  <div className="text-white text-sm">{empSel.nombreCompleto}</div>
                  <div className="text-white/40 text-xs">DPI: {empSel.dpi || "—"}</div>
                </div>
                <button onClick={() => setEmpSel(null)} className="text-white/40 hover:text-white"><X className="w-4 h-4" /></button>
              </div>
            ) : (
              <>
                <input
                  type="text"
                  value={empBusq}
                  onChange={e => setEmpBusq(e.target.value)}
                  placeholder="Buscar por nombre o DPI…"
                  className="w-full mt-1 bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
                />
                {empBusq && (
                  <div className="mt-1 bg-black/40 border border-white/10 rounded-lg max-h-48 overflow-y-auto">
                    {filtrados.length === 0 ? (
                      <div className="p-2 text-white/30 text-xs">Sin resultados</div>
                    ) : filtrados.map(e => (
                      <button key={e.id} onClick={() => { setEmpSel(e); setEmpBusq(""); }}
                        className="w-full text-left px-3 py-2 text-sm text-white/80 hover:bg-white/5 border-b border-white/5">
                        <div>{e.nombreCompleto}</div>
                        <div className="text-white/40 text-xs">{e.dpi}</div>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Tipo */}
          <div>
            <label className="text-xs text-white/50 font-medium">Tipo *</label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mt-1">
              <button onClick={() => setTipo("llamada_atencion")}
                className={`p-3 rounded-lg border text-sm text-left transition ${
                  tipo === "llamada_atencion" ? "bg-blue-500/15 border-blue-500/40 text-blue-200" : "bg-white/5 border-white/10 text-white/60"
                }`}>
                <div className="font-semibold">Llamada de atención</div>
                <div className="text-xs opacity-70">Solo registro, sin descuento</div>
              </button>
              <button onClick={() => setTipo("economica")}
                className={`p-3 rounded-lg border text-sm text-left transition ${
                  tipo === "economica" ? "bg-orange-500/15 border-orange-500/40 text-orange-200" : "bg-white/5 border-white/10 text-white/60"
                }`}>
                <div className="font-semibold">Económica</div>
                <div className="text-xs opacity-70">Se descuenta en planilla</div>
              </button>
              <button onClick={() => setTipo("acta_administrativa")}
                className={`p-3 rounded-lg border text-sm text-left transition ${
                  tipo === "acta_administrativa" ? "bg-purple-500/15 border-purple-500/40 text-purple-200" : "bg-white/5 border-white/10 text-white/60"
                }`}>
                <div className="font-semibold flex items-center gap-1"><Gavel className="w-3.5 h-3.5" /> Acta Administrativa</div>
                <div className="text-xs opacity-70">Documento legal (Art. 77)</div>
              </button>
            </div>
            {modoSolicitud && (
              <div className="text-xs text-amber-300/80 mt-2 bg-amber-500/5 border border-amber-500/20 rounded-lg p-2">
                Como {esSupervisor ? "supervisor/operaciones" : "usuario"} no levantas la amonestación directamente: tu solicitud llegará a RRHH para revisión y aprobación.
              </div>
            )}
          </div>

          {/* Causal legal — solo acta */}
          {tipo === "acta_administrativa" && (
            <div className="space-y-2">
              <div>
                <label className="text-xs text-purple-300 font-medium">
                  Causales legales Art. 77 Código de Trabajo * <span className="text-purple-200/60">(puedes seleccionar varias)</span>
                </label>
                <div className="mt-1 max-h-56 overflow-y-auto bg-black/30 border border-purple-500/30 rounded-lg divide-y divide-purple-500/10">
                  {causales.data?.map(c => {
                    const checked = causalCodigos.includes(c.codigo);
                    return (
                      <label key={c.codigo}
                        className={`flex items-start gap-2 px-3 py-2 cursor-pointer hover:bg-purple-500/10 transition ${checked ? "bg-purple-500/15" : ""}`}>
                        <input type="checkbox" checked={checked} onChange={() => toggleCausal(c.codigo)}
                          className="mt-0.5 rounded border-purple-500/30 bg-black/40 accent-purple-500" />
                        <span className="text-sm text-white">
                          <span className="text-purple-300 font-medium">{c.inciso}</span> {c.titulo}
                        </span>
                      </label>
                    );
                  })}
                </div>
                {causalesSel.length > 0 && (
                  <div className="mt-2 text-xs text-purple-200/80 bg-purple-500/5 border border-purple-500/20 rounded-lg p-2 space-y-2">
                    <div className="font-medium text-purple-300">
                      {causalesSel[0].articulo} — {causalesSel.length} {causalesSel.length === 1 ? "causal seleccionada" : "causales seleccionadas"}
                    </div>
                    <ul className="list-disc list-inside space-y-1 leading-relaxed">
                      {causalesSel.map(c => (
                        <li key={c.codigo}><b>{c.inciso}</b> {c.descripcion}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
              {!modoSolicitud && (
                <label className="flex items-center gap-2 text-sm text-white/80 cursor-pointer">
                  <input type="checkbox" checked={aplicaDescuento} onChange={e => setAplicaDescuento(e.target.checked)}
                    className="rounded border-white/20 bg-black/30" />
                  Aplicar también descuento económico vinculado al acta
                </label>
              )}
            </div>
          )}

          {/* Motivo */}
          <div>
            <label className="text-xs text-white/50 font-medium">Motivo *</label>
            <select value={motivoSel} onChange={e => setMotivoSel(e.target.value)}
              className="w-full mt-1 bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white">
              <option value="">— Selecciona o escribe abajo —</option>
              {motivos.data?.map(m => (
                <option key={m.id} value={m.nombre}>
                  {m.nombre}{m.monto_sugerido > 0 ? ` (sugerido Q${m.monto_sugerido})` : ""}
                </option>
              ))}
            </select>
            {!motivoSel && (
              <input type="text" value={motivoLibre} onChange={e => setMotivoLibre(e.target.value)}
                placeholder="…o escribe el motivo libre"
                className="w-full mt-2 bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white" />
            )}
          </div>

          {/* Monto (económica o acta+descuento) */}
          {requiereMonto && (
            <div>
              <label className="text-xs text-white/50 font-medium">
                {modoSolicitud ? "Monto sugerido (Q) *" : "Monto a descontar (Q) *"}
              </label>
              <input type="number" min="0" step="0.01" value={monto} onChange={e => setMonto(e.target.value)}
                className="w-full mt-1 bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white" />
              <div className="text-xs text-white/30 mt-1">
                Se descontará en la próxima planilla del período donde caiga la fecha.
              </div>
            </div>
          )}

          {/* Descripción */}
          <div>
            <label className="text-xs text-white/50 font-medium">Descripción / contexto</label>
            <textarea value={descripcion} onChange={e => setDescripcion(e.target.value)}
              rows={3}
              placeholder="Detalle de lo ocurrido (opcional)"
              className="w-full mt-1 bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white resize-none" />
          </div>

          {/* Fecha */}
          <div>
            <label className="text-xs text-white/50 font-medium">Fecha</label>
            <input type="date" value={fecha} onChange={e => setFecha(e.target.value)}
              className="w-full mt-1 bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white" />
          </div>

        </div>
        <div className="p-4 border-t border-white/10 sticky bottom-0 bg-[#0d1117] rounded-b-2xl space-y-2">
          {error && (
            <div className="text-red-400 text-sm bg-red-500/10 border border-red-500/30 rounded-lg p-2">
              {error}
            </div>
          )}
          <div className="flex justify-end gap-2">
            <button onClick={onClose} className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white/70 rounded-lg text-sm">
              Cancelar
            </button>
            <button
              onClick={() => { setError(null); crear.mutate(); }}
              disabled={crear.isPending || !empSel}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-black font-semibold rounded-lg text-sm"
              data-action="crear-o-solicitar"
            >
              {crear.isPending ? "Guardando…" : (modoSolicitud ? "Enviar solicitud" : "Guardar amonestación")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
