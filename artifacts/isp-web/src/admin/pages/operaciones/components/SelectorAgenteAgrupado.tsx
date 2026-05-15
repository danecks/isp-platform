import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, CheckCircle2, ShieldCheck, UserMinus } from "lucide-react";
import {
  GRUPO_CONFIG,
  RANKING_GRUPO_CONFIG,
  RANKING_MOTIVO_CONFIG,
  normalizarPoolActual,
  normalizarPoolFuturo,
  type AgenteAgrupado,
  type AgenteRankeado,
  type GrupoEstado,
  type GrupoRanking,
  type Pool,
  type PoolFuturoData,
} from "../types";
import { rankCandidatos } from "../ranking";
import { API_BASE, avatarColor, getSession, iniciales } from "../utils";

export function SelectorAgenteAgrupado({
  fecha,
  idsExcluidos = [],
  seleccionado,
  onSelect,
  puestoId,
  zonaId,
}: {
  fecha: string;
  idsExcluidos?: number[];
  seleccionado: number | null;
  onSelect: (a: AgenteAgrupado) => void;
  puestoId?: number;
  zonaId?: number | null;
}) {
  const hoy = new Date().toISOString().split("T")[0];
  const esFuturo = fecha > hoy;
  const modoRanking = !esFuturo && !!puestoId && !!zonaId;

  const [busqueda, setBusqueda] = useState("");
  const [pendienteConf, setPendienteConf] = useState<AgenteAgrupado | null>(null);
  const [pendienteRanked, setPendienteRanked] = useState<AgenteRankeado | null>(null);

  const { data: poolActual } = useQuery<Pool>({
    queryKey: ["operaciones-pool"],
    queryFn: async () => {
      const r = await fetch(`${API_BASE}/operaciones/pool`, { headers: { "x-isp-session": getSession() } });
      if (!r.ok) throw new Error(`pool ${r.status}`);
      return r.json();
    },
    enabled: !esFuturo && !modoRanking,
    staleTime: 60_000,
  });

  const { data: poolRanked } = useQuery<Pool>({
    queryKey: ["operaciones-pool", puestoId],
    queryFn: async () => {
      const r = await fetch(`${API_BASE}/operaciones/pool?puesto_id=${puestoId}`, { headers: { "x-isp-session": getSession() } });
      if (!r.ok) throw new Error(`pool ranked ${r.status}`);
      return r.json();
    },
    enabled: modoRanking,
    staleTime: 60_000,
  });

  const { data: poolFuturoRaw } = useQuery<PoolFuturoData>({
    queryKey: ["pool-futuro", fecha],
    queryFn: async () => {
      const r = await fetch(`${API_BASE}/operaciones/pool-futuro?fecha=${fecha}`, { headers: { "x-isp-session": getSession() } });
      if (!r.ok) throw new Error(`pool-futuro ${r.status}`);
      return r.json();
    },
    enabled: esFuturo,
    staleTime: 120_000,
  });

  const candidatosRankeados = useMemo<AgenteRankeado[]>(() => {
    if (!modoRanking || !poolRanked) return [];
    return rankCandidatos(poolRanked, zonaId);
  }, [modoRanking, poolRanked, zonaId]);

  const todos = useMemo<AgenteAgrupado[]>(() => {
    if (modoRanking) return [];
    if (!esFuturo && poolActual)    return normalizarPoolActual(poolActual);
    if (esFuturo   && poolFuturoRaw) return normalizarPoolFuturo(poolFuturoRaw);
    return [];
  }, [modoRanking, esFuturo, poolActual, poolFuturoRaw]);

  const filtradosEstandar = useMemo(() => {
    const q = busqueda.toLowerCase();
    return todos.filter(
      (a) => !idsExcluidos.includes(a.id) && (!q || a.nombre.toLowerCase().includes(q)),
    );
  }, [todos, idsExcluidos, busqueda]);

  const filtradosRanked = useMemo(() => {
    const q = busqueda.toLowerCase();
    return candidatosRankeados.filter(
      (a) => !idsExcluidos.includes(a.id) && (!q || a.nombre_completo.toLowerCase().includes(q)),
    );
  }, [candidatosRankeados, idsExcluidos, busqueda]);

  function handleClickEstandar(a: AgenteAgrupado) {
    const cfg = GRUPO_CONFIG[a.grupo];
    if (!cfg.seleccionable) return;
    if (cfg.advertencia) { setPendienteConf(a); return; }
    onSelect(a);
  }

  function handleClickRanked(ar: AgenteRankeado) {
    const requiereConf = ar.grupo === "P2" || ar.grupo === "P4" || ar.grupo === "P5";
    if (requiereConf) { setPendienteRanked(ar); return; }
    onSelect({
      id: ar.id,
      nombre: ar.nombre_completo,
      grupo: "disponible",
      detalle: ar.puesto ?? null,
    } as AgenteAgrupado);
  }

  function confirmarRanked() {
    if (!pendienteRanked) return;
    onSelect({
      id: pendienteRanked.id,
      nombre: pendienteRanked.nombre_completo,
      grupo: pendienteRanked.grupo === "P5" ? "disponible" : "descansando",
      detalle: pendienteRanked.puesto ?? null,
      tipo_personal: (pendienteRanked as any).tipo_personal,
    } as AgenteAgrupado);
    setPendienteRanked(null);
  }

  if (modoRanking) {
    const gruposRanking = (["P1", "P2", "P3", "P4", "P5"] as GrupoRanking[])
      .map((g) => ({ g, lista: filtradosRanked.filter((a) => a.grupo === g) }))
      .filter((x) => x.lista.length > 0);

    return (
      <div className="space-y-2">
        <input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar agente…"
          className="w-full bg-[#060e1c] border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder:text-white/20 outline-none focus:border-indigo-400/40"
        />

        {pendienteRanked && (
          <div className={`border rounded-xl px-3 py-2.5 space-y-2 ${pendienteRanked.grupo === "P5" ? "bg-orange-500/10 border-orange-500/30" : "bg-amber-500/10 border-amber-500/30"}`}>
            <div className="flex items-start gap-2">
              {pendienteRanked.grupo === "P5"
                ? <ShieldCheck className="w-3.5 h-3.5 text-orange-400 shrink-0 mt-0.5" />
                : <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />}
              {pendienteRanked.grupo === "P5" ? (
                <p className="text-[10px] text-orange-300/80 leading-snug">
                  <span className="font-semibold">{pendienteRanked.nombre_completo}</span> es{" "}
                  {(pendienteRanked as any).tipo_personal === "supervisor" ? "Supervisor" : "Jefe de Servicio"}.
                  {" "}Esta es una <span className="font-semibold text-orange-300">cobertura de contingencia operativa</span>. Solo cubrirá temporalmente, sin cambiar titularidad.
                </p>
              ) : (
                <p className="text-[10px] text-amber-300/80 leading-snug">
                  <span className="font-semibold">{pendienteRanked.nombre_completo}</span> está en descanso de ciclo. Asignar implicaría horas extra.
                </p>
              )}
            </div>
            <div className="flex gap-2">
              <button onClick={confirmarRanked} className={`text-[10px] px-3 py-1 rounded-lg font-semibold ${pendienteRanked.grupo === "P5" ? "bg-orange-500/20 border border-orange-500/40 text-orange-300" : "bg-amber-500/20 border border-amber-500/40 text-amber-300"}`}>
                Confirmar
              </button>
              <button onClick={() => setPendienteRanked(null)} className="text-[10px] px-3 py-1 rounded-lg border border-white/10 text-white/40 hover:text-white/60">
                Cancelar
              </button>
            </div>
          </div>
        )}

        <div className="max-h-64 overflow-y-auto space-y-3 pr-0.5">
          {gruposRanking.length === 0 && (
            <div className="text-center py-5">
              <UserMinus className="w-5 h-5 text-white/10 mx-auto mb-1" />
              <p className="text-[11px] text-white/20">Sin candidatos disponibles</p>
            </div>
          )}
          {gruposRanking.map(({ g, lista }) => {
            const cfg = RANKING_GRUPO_CONFIG[g];
            return (
              <div key={g}>
                <div className="flex items-center gap-2 mb-1 px-0.5">
                  <span className={`text-[9px] font-bold uppercase tracking-widest ${cfg.headerColor}`}>
                    {cfg.label}
                  </span>
                  <span className="text-[9px] text-white/25">({lista.length})</span>
                </div>
                <div className="space-y-0.5">
                  {lista.map((ar) => {
                    const selec = seleccionado === ar.id;
                    return (
                      <button
                        key={ar.id}
                        onClick={() => handleClickRanked(ar)}
                        className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl border text-left transition-all ${
                          selec ? "bg-primary/15 border-primary/40" : `bg-[#0c1929] ${cfg.borderColor} hover:border-white/15`
                        }`}
                      >
                        <div className={`w-6 h-6 rounded flex items-center justify-center text-[9px] font-bold text-white shrink-0 ${avatarColor(ar.nombre_completo)}`}>
                          {iniciales(ar.nombre_completo)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-white/85 truncate">{ar.nombre_completo}</p>
                          {ar.puesto && (
                            <p className="text-[9px] text-white/28 truncate">{ar.puesto}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-0.5 shrink-0 flex-wrap justify-end max-w-[90px]">
                          {ar.motivos.slice(0, 3).map((m) => {
                            const mc = RANKING_MOTIVO_CONFIG[m];
                            if (!mc) return null;
                            return (
                              <span key={m} className={`text-[7px] font-bold px-1 py-0.5 rounded ${mc.cls}`}>
                                {mc.label}
                              </span>
                            );
                          })}
                        </div>
                        {selec && <CheckCircle2 className="w-3.5 h-3.5 text-primary shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
        <p className="text-[9px] text-white/18 text-right">Candidatos rankeados por zona · hoy</p>
      </div>
    );
  }

  const ORDEN: GrupoEstado[] = ["disponible", "descansando", "en_puesto", "en_ssa", "ausente"];
  const grupos = ORDEN
    .map((g) => ({ g, lista: filtradosEstandar.filter((a) => a.grupo === g) }))
    .filter((x) => x.lista.length > 0);

  return (
    <div className="space-y-2">
      <input
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
        placeholder="Buscar agente…"
        className="w-full bg-[#060e1c] border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder:text-white/20 outline-none focus:border-blue-400/40"
      />

      {pendienteConf && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl px-3 py-2.5 space-y-2">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
            <p className="text-[10px] text-amber-300/80 leading-snug">
              <span className="font-semibold">{pendienteConf.nombre}</span> — {GRUPO_CONFIG[pendienteConf.grupo].advertencia}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => { onSelect(pendienteConf); setPendienteConf(null); }}
              className="text-[10px] px-3 py-1 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-300 font-semibold"
            >
              Confirmar
            </button>
            <button
              onClick={() => setPendienteConf(null)}
              className="text-[10px] px-3 py-1 rounded-lg border border-white/10 text-white/40 hover:text-white/60"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      <div className="max-h-64 overflow-y-auto space-y-3 pr-0.5">
        {grupos.length === 0 && (
          <div className="text-center py-5">
            <UserMinus className="w-5 h-5 text-white/10 mx-auto mb-1" />
            <p className="text-[11px] text-white/20">Sin agentes disponibles</p>
          </div>
        )}
        {grupos.map(({ g, lista }) => {
          const cfg = GRUPO_CONFIG[g];
          return (
            <div key={g}>
              <div className="flex items-center gap-1.5 mb-1 px-0.5">
                <div className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                <span className={`text-[9px] font-bold uppercase tracking-widest ${cfg.color}`}>
                  {cfg.label} ({lista.length})
                </span>
              </div>
              <div className="space-y-0.5">
                {lista.map((a) => {
                  const selec = seleccionado === a.id;
                  const bloq  = !cfg.seleccionable;
                  return (
                    <button
                      key={a.id}
                      onClick={() => handleClickEstandar(a)}
                      disabled={bloq}
                      className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl border text-left transition-all ${
                        selec  ? "bg-primary/15 border-primary/40"
                        : bloq  ? "bg-white/2 border-white/4 opacity-40 cursor-not-allowed"
                        :         "bg-[#0c1929] border-white/6 hover:border-white/15"
                      }`}
                    >
                      <div className={`w-6 h-6 rounded flex items-center justify-center text-[9px] font-bold text-white shrink-0 ${avatarColor(a.nombre)}`}>
                        {iniciales(a.nombre)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-white/85 truncate">{a.nombre}</p>
                        {a.detalle && (
                          <p className="text-[9px] text-white/28 truncate">{a.detalle}</p>
                        )}
                      </div>
                      {cfg.badge && !bloq && (
                        <span className="text-[8px] font-bold px-1 py-0.5 rounded bg-blue-500/15 text-blue-400 border border-blue-500/20 shrink-0">
                          {cfg.badge}
                        </span>
                      )}
                      {selec && <CheckCircle2 className="w-3.5 h-3.5 text-primary shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-[9px] text-white/18 text-right">
        {esFuturo
          ? `Proyección para ${fecha.split("-").reverse().join("-")}`
          : "Estado operativo actual · hoy"}
      </p>
    </div>
  );
}
