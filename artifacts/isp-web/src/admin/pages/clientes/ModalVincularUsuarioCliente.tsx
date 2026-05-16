import { useState } from "react";
import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import { X, Loader2, UserCog, AlertCircle, Check } from "lucide-react";
import { API, h } from "./_shared";

interface UsuarioClienteDisponible {
  id: number;
  nombre: string;
  username: string;
  correo: string | null;
  telefono: string | null;
  estado: string;
  cliente_id: string | null;
  cliente_db_id: number | null;
  cliente_nombre: string | null;
  clientes_vinculados?: Array<{
    portal_cliente_id: string;
    cliente_db_id: number | null;
    cliente_nombre: string | null;
  }>;
}

export function ModalVincularUsuarioCliente({
  clienteDbId, onClose, onLinked,
}: { clienteDbId: number; onClose: () => void; onLinked: () => void }) {
  const [busqueda, setBusqueda] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const { data: candidatos = [], isLoading } = useQuery<UsuarioClienteDisponible[]>({
    queryKey: ["users-cliente-disponibles"],
    queryFn: async () => {
      const r = await fetch(`${API}/users/cliente-disponibles`, { headers: h() });
      if (!r.ok) throw new Error();
      return r.json();
    },
    staleTime: 10_000,
  });

  const filtrados = candidatos.filter(u => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return true;
    return u.nombre.toLowerCase().includes(q) || u.username.toLowerCase().includes(q);
  });

  async function handleVincular() {
    if (!selectedId) return;
    setLoading(true);
    setError("");
    try {
      const r = await fetch(`${API}/clientes/${clienteDbId}/usuarios/vincular`, {
        method: "POST",
        headers: h(),
        body: JSON.stringify({ userId: selectedId }),
      });
      if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error(d.error ?? "Error al vincular"); }
      onLinked();
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4">
      <div className="bg-[#07111f] border border-white/10 rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-blue-500/15 border border-blue-500/20 flex items-center justify-center">
              <UserCog className="w-3.5 h-3.5 text-blue-300" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Vincular Usuario Existente</h2>
              <p className="text-[10px] text-white/40">Elige un usuario con rol cliente para asociarlo a este cliente</p>
            </div>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5 space-y-3 overflow-y-auto flex-1">
          <input value={busqueda} onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre o username..."
            className="w-full h-9 bg-[#060e1c] border border-white/10 text-white text-sm rounded-md px-3 outline-none focus:border-primary/50" />
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-white/30" />
            </div>
          ) : filtrados.length === 0 ? (
            <p className="text-center text-xs text-white/40 py-8">
              No hay usuarios con rol cliente disponibles.
            </p>
          ) : (
            <div className="space-y-1.5">
              {filtrados.map(u => {
                const vinculados = u.clientes_vinculados ?? [];
                const yaVinculadoEste = vinculados.some(v => v.cliente_db_id === clienteDbId);
                const otrosVinculos = vinculados.filter(v => v.cliente_db_id !== clienteDbId);
                const sel = selectedId === u.id;
                return (
                  <button
                    key={u.id}
                    type="button"
                    disabled={yaVinculadoEste}
                    onClick={() => setSelectedId(u.id)}
                    className={`w-full text-left p-3 rounded-lg border transition-colors ${
                      yaVinculadoEste
                        ? "bg-white/[0.02] border-white/5 opacity-40 cursor-not-allowed"
                        : sel
                          ? "bg-blue-500/10 border-blue-500/40"
                          : "bg-[#060e1c] border-white/10 hover:border-white/20"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-white truncate">{u.nombre}</p>
                          <code className="text-[10px] text-primary bg-primary/10 px-1.5 py-0.5 rounded">@{u.username}</code>
                          {u.estado !== "activo" && (
                            <span className="text-[9px] text-red-400 bg-red-400/10 px-1.5 py-0.5 rounded">Inactivo</span>
                          )}
                        </div>
                        {yaVinculadoEste && (
                          <p className="text-[10px] text-green-400 mt-1">Ya vinculado a este cliente</p>
                        )}
                        {!yaVinculadoEste && otrosVinculos.length > 0 && (
                          <p className="text-[10px] text-blue-300/70 mt-1">
                            También vinculado a: {otrosVinculos.map(v => v.cliente_nombre).join(", ")}
                          </p>
                        )}
                      </div>
                      {sel && <Check className="w-4 h-4 text-blue-300 shrink-0" />}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
          {error && (
            <div className="flex items-center gap-2 bg-red-950/40 border border-red-500/20 rounded-lg px-3 py-2">
              <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
              <p className="text-xs text-red-400">{error}</p>
            </div>
          )}
        </div>
        <div className="p-5 border-t border-white/5 flex gap-3">
          <button type="button" onClick={onClose}
            className="flex-1 h-9 border border-white/10 text-white/60 rounded-md text-xs hover:text-white hover:border-white/20 transition-colors">
            Cancelar
          </button>
          <button type="button" onClick={handleVincular} disabled={!selectedId || loading}
            className="flex-1 h-9 bg-blue-500 text-white font-bold rounded-md text-xs hover:bg-blue-400 transition-colors disabled:opacity-40 flex items-center justify-center gap-1.5">
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><Check className="w-3.5 h-3.5" />Vincular</>}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
