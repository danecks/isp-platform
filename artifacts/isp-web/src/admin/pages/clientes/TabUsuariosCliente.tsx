import { useState } from "react";
import { createPortal } from "react-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Loader2, Plus, X, UserCog, KeyRound, Power, PowerOff, Mail, Phone, Shield,
} from "lucide-react";
import { API, h } from "./_shared";
import { ModalNuevoUsuarioCliente } from "./ModalNuevoUsuarioCliente";
import { ModalVincularUsuarioCliente } from "./ModalVincularUsuarioCliente";

interface UsuarioCliente {
  id: number;
  nombre: string;
  username: string;
  correo: string | null;
  telefono: string | null;
  rol: string;
  estado: string;
  cliente_id: string | null;
  created_at: string;
}

export function TabUsuariosCliente({ clienteDbId }: { clienteDbId: number }) {
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [showVincularModal, setShowVincularModal] = useState(false);
  const [resettingPw, setResettingPw] = useState<UsuarioCliente | null>(null);
  const [newPw, setNewPw] = useState("");
  const [pwLoading, setPwLoading] = useState(false);

  const { data: usuarios = [], isLoading } = useQuery<UsuarioCliente[]>({
    queryKey: ["clientes-usuarios", clienteDbId],
    queryFn: async () => {
      const r = await fetch(`${API}/clientes/${clienteDbId}/usuarios`, { headers: h() });
      if (!r.ok) throw new Error();
      return r.json();
    },
    staleTime: 30_000,
  });

  async function toggleEstado(u: UsuarioCliente) {
    const nuevoEstado = u.estado === "activo" ? "inactivo" : "activo";
    await fetch(`${API}/users/${u.id}`, {
      method: "PATCH",
      headers: h(),
      body: JSON.stringify({ estado: nuevoEstado }),
    });
    qc.invalidateQueries({ queryKey: ["clientes-usuarios", clienteDbId] });
  }

  async function resetPassword() {
    if (!resettingPw || newPw.length < 4) return;
    setPwLoading(true);
    try {
      await fetch(`${API}/users/${resettingPw.id}`, {
        method: "PATCH",
        headers: h(),
        body: JSON.stringify({ password: newPw }),
      });
      setResettingPw(null);
      setNewPw("");
    } finally {
      setPwLoading(false);
    }
  }

  if (isLoading) return (
    <div className="flex items-center justify-center py-12">
      <Loader2 className="w-5 h-5 animate-spin text-white/30" />
    </div>
  );

  return (
    <div className="p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold text-white/70">Usuarios del Portal</p>
          <p className="text-[10px] text-white/30 mt-0.5">Cuentas con acceso al portal de clientes vinculadas a este cliente</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowVincularModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/10 border border-blue-500/20 text-blue-300 rounded-lg text-xs font-semibold hover:bg-blue-500/20 transition-colors">
            <UserCog className="w-3 h-3" />Vincular existente
          </button>
          <button onClick={() => setShowModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 border border-primary/20 text-primary rounded-lg text-xs font-semibold hover:bg-primary/20 transition-colors">
            <Plus className="w-3 h-3" />Nuevo Usuario
          </button>
        </div>
      </div>

      {/* Lista */}
      {usuarios.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-white/10 rounded-xl">
          <UserCog className="w-7 h-7 text-white/10 mx-auto mb-3" />
          <p className="text-white/40 text-sm font-medium">Sin usuarios registrados</p>
          <p className="text-white/20 text-xs mt-1">Crea un usuario para que este cliente acceda al portal.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {usuarios.map(u => (
            <div key={u.id} className="bg-[#070f1c] border border-white/8 rounded-xl p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-sm font-semibold text-white truncate">{u.nombre}</p>
                    <span className={`shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold border ${
                      u.estado === "activo"
                        ? "text-green-400 bg-green-400/10 border-green-400/20"
                        : "text-red-400 bg-red-400/10 border-red-400/20"
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${u.estado === "activo" ? "bg-green-400" : "bg-red-400"}`} />
                      {u.estado === "activo" ? "Activo" : "Inactivo"}
                    </span>
                  </div>
                  <code className="text-[11px] text-primary bg-primary/10 px-1.5 py-0.5 rounded">@{u.username}</code>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
                    {u.correo && (
                      <span className="flex items-center gap-1 text-[10px] text-white/40">
                        <Mail className="w-3 h-3" />{u.correo}
                      </span>
                    )}
                    {u.telefono && (
                      <span className="flex items-center gap-1 text-[10px] text-white/40">
                        <Phone className="w-3 h-3" />{u.telefono}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => { setResettingPw(u); setNewPw(""); }}
                    title="Cambiar contraseña"
                    className="p-1.5 rounded-lg text-white/30 hover:text-yellow-400 hover:bg-yellow-400/10 transition-colors border border-white/8 hover:border-yellow-400/20"
                  >
                    <KeyRound className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => toggleEstado(u)}
                    title={u.estado === "activo" ? "Desactivar" : "Activar"}
                    className={`p-1.5 rounded-lg border transition-colors ${
                      u.estado === "activo"
                        ? "text-white/30 hover:text-red-400 border-white/8 hover:bg-red-400/10 hover:border-red-400/20"
                        : "text-white/30 hover:text-green-400 border-white/8 hover:bg-green-400/10 hover:border-green-400/20"
                    }`}
                  >
                    {u.estado === "activo" ? <PowerOff className="w-3.5 h-3.5" /> : <Power className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Regla de negocio */}
      <div className="bg-blue-950/20 border border-blue-500/15 rounded-xl px-4 py-3 flex items-start gap-2">
        <Shield className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5" />
        <p className="text-[10px] text-blue-300/70 leading-relaxed">
          Los usuarios creados aquí tienen rol <strong>cliente</strong> y acceso únicamente al portal de clientes.
          Quedan ligados automáticamente al ID de portal de este cliente.
        </p>
      </div>

      {/* Modal nueva contraseña */}
      {resettingPw && createPortal(
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4">
          <div className="bg-[#07111f] border border-white/10 rounded-2xl w-full max-w-xs p-5 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold text-white">Cambiar contraseña</p>
              <button onClick={() => setResettingPw(null)} className="text-white/40 hover:text-white"><X className="w-4 h-4" /></button>
            </div>
            <p className="text-[11px] text-white/40">Nueva contraseña para <strong className="text-white/70">{resettingPw.nombre}</strong></p>
            <div className="flex items-center gap-2">
              <input
                type="password"
                value={newPw}
                onChange={e => setNewPw(e.target.value)}
                placeholder="Mínimo 4 caracteres"
                className="flex-1 h-9 bg-[#060e1c] border border-white/10 text-white text-sm rounded-md px-3 outline-none focus:border-primary/50"
              />
            </div>
            <div className="flex gap-2">
              <button onClick={() => setResettingPw(null)} className="flex-1 h-9 border border-white/10 text-white/60 rounded-md text-xs hover:text-white">Cancelar</button>
              <button onClick={resetPassword} disabled={pwLoading || newPw.length < 4}
                className="flex-1 h-9 bg-yellow-500 text-black font-bold rounded-md text-xs hover:bg-yellow-400 disabled:opacity-40 flex items-center justify-center gap-1">
                {pwLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><KeyRound className="w-3.5 h-3.5" />Cambiar</>}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Modal crear usuario */}
      {showModal && (
        <ModalNuevoUsuarioCliente
          clienteDbId={clienteDbId}
          onClose={() => setShowModal(false)}
          onCreated={() => {
            qc.invalidateQueries({ queryKey: ["clientes-usuarios", clienteDbId] });
          }}
        />
      )}

      {/* Modal vincular usuario existente */}
      {showVincularModal && (
        <ModalVincularUsuarioCliente
          clienteDbId={clienteDbId}
          onClose={() => setShowVincularModal(false)}
          onLinked={() => {
            qc.invalidateQueries({ queryKey: ["clientes-usuarios", clienteDbId] });
          }}
        />
      )}
    </div>
  );
}
