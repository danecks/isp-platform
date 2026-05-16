import { MapPin, Building2, X } from "lucide-react";

interface ZonaItem { id: string; nombre: string; }
interface ClienteItem { id: string; nombre: string; }

interface Props {
  zonasDisponibles: ZonaItem[];
  clientesDisponiblesFiltro: ClienteItem[];
  filtroZona: string;
  filtroCliente: string;
  totalPuestosFiltrados: number;
  onCambiarZona: (z: string) => void;
  onCambiarCliente: (c: string) => void;
  onLimpiar: () => void;
}

export function FiltrosZonaCliente({
  zonasDisponibles,
  clientesDisponiblesFiltro,
  filtroZona,
  filtroCliente,
  totalPuestosFiltrados,
  onCambiarZona,
  onCambiarCliente,
  onLimpiar,
}: Props) {
  if (zonasDisponibles.length === 0 && clientesDisponiblesFiltro.length <= 1) return null;
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {zonasDisponibles.length > 0 && (
        <div className="flex items-center gap-1 bg-[#0c1929] border border-white/8 rounded-xl px-1.5 py-1">
          <MapPin className="w-3 h-3 text-white/20 ml-1" />
          <select
            value={filtroZona}
            onChange={(e) => onCambiarZona(e.target.value)}
            className="bg-transparent text-xs text-white/60 outline-none pr-1"
          >
            <option value="">Todas las zonas</option>
            {zonasDisponibles.map((z) => (
              <option key={z.id} value={z.id}>{z.nombre}</option>
            ))}
          </select>
        </div>
      )}
      {clientesDisponiblesFiltro.length > 1 && (
        <div className="flex items-center gap-1 bg-[#0c1929] border border-white/8 rounded-xl px-1.5 py-1">
          <Building2 className="w-3 h-3 text-white/20 ml-1" />
          <select
            value={filtroCliente}
            onChange={(e) => onCambiarCliente(e.target.value)}
            className="bg-transparent text-xs text-white/60 outline-none pr-1"
          >
            <option value="">Todos los clientes</option>
            {clientesDisponiblesFiltro.map((c) => (
              <option key={c.id} value={c.id}>{c.nombre}</option>
            ))}
          </select>
        </div>
      )}
      {(filtroZona || filtroCliente) && (
        <button
          onClick={onLimpiar}
          className="flex items-center gap-1 text-[10px] text-amber-400/60 hover:text-amber-400 transition-colors px-2 py-1.5 border border-amber-500/20 rounded-xl"
        >
          <X className="w-3 h-3" /> Limpiar filtros
        </button>
      )}
      {(filtroZona || filtroCliente) && (
        <span className="text-[10px] text-white/20">
          Mostrando {totalPuestosFiltrados} puestos
        </span>
      )}
    </div>
  );
}
