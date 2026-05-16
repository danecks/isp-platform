interface Props {
  puestosDescubiertos: number;
  poolDisponiblesCount: number;
  fechaVistaCerrada: boolean;
}

export function AlertaPoolDescubiertos({ puestosDescubiertos, poolDisponiblesCount, fechaVistaCerrada }: Props) {
  if (poolDisponiblesCount > 0 || puestosDescubiertos === 0 || fechaVistaCerrada) return null;
  return (
    <div className="shrink-0 flex items-center gap-2.5 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-2.5">
      <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse flex-shrink-0" />
      <p className="text-xs font-semibold text-red-300">
        Sin agentes disponibles en el pool
      </p>
      <span className="text-[10px] text-red-400/60">·</span>
      <p className="text-xs text-red-400/70">
        Hay {puestosDescubiertos} puesto{puestosDescubiertos !== 1 ? "s" : ""} descubierto{puestosDescubiertos !== 1 ? "s" : ""} y ningún agente libre para asignar. Considera liberar un agente de su puesto actual o verificar el estado de los suspendidos.
      </p>
    </div>
  );
}
