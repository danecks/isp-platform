/**
 * Sidebar izquierdo: selector de modo, validación, usuario y acciones de
 * limpieza. Es un componente puramente controlado: el estado vive en el
 * orquestador y se pasa por props.
 */

import {
  ChevronRight, Database, MessageSquare, Phone, RefreshCw,
  Shield, Trash2, Zap,
} from "lucide-react";
import { ROL_COLORS } from "./constants";
import type { UsuarioSimulador } from "./types";

interface Props {
  showConfig: boolean;
  setShowConfig: (v: boolean) => void;
  persistir: boolean;
  setPersistir: (v: boolean) => void;
  skipValidacion: boolean;
  setSkipValidacion: (v: boolean) => void;
  usuarios: UsuarioSimulador[];
  usuarioSel: UsuarioSimulador | null;
  setUsuarioSel: (u: UsuarioSimulador | null) => void;
  telManual: string;
  setTelManual: (v: string) => void;
  nombreManual: string;
  setNombreManual: (v: string) => void;
  telefonoActivo: string;
  nombreActivo: string;
  rolActivo: string;
  onLimpiarConversacion: () => void;
  onLimpiarSesion: () => void;
}

export function ConfigPanel(props: Props) {
  const {
    showConfig, setShowConfig, persistir, setPersistir,
    skipValidacion, setSkipValidacion, usuarios, usuarioSel, setUsuarioSel,
    telManual, setTelManual, nombreManual, setNombreManual,
    telefonoActivo, nombreActivo, rolActivo,
    onLimpiarConversacion, onLimpiarSesion,
  } = props;

  return (
    <div className={`shrink-0 border-r border-gray-700/30 bg-[#111b21] flex flex-col transition-all duration-200 ${showConfig ? "w-72" : "w-10"}`}>
      <button
        onClick={() => setShowConfig(!showConfig)}
        className="h-10 flex items-center justify-center text-gray-500 hover:text-white border-b border-gray-700/30 shrink-0"
      >
        {showConfig ? <ChevronLeft16 /> : <ChevronRight size={16} />}
      </button>

      {showConfig && (
        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          {/* Header */}
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="p-1.5 bg-green-500/20 rounded-lg">
                <MessageSquare size={16} className="text-green-400" />
              </div>
              <h2 className="text-sm font-bold text-white">Simulador WA</h2>
            </div>
            <p className="text-[10px] text-gray-500 leading-relaxed">
              Simula el comportamiento del bot con distintos perfiles y mensajes.
            </p>
          </div>

          {/* Modo */}
          <div>
            <p className="text-[9px] uppercase tracking-widest text-gray-500 mb-2 font-semibold">Modo de simulación</p>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                onClick={() => setPersistir(false)}
                className={`py-2 px-2 rounded-lg text-xs font-medium border transition-all ${
                  !persistir
                    ? "bg-blue-500/20 text-blue-300 border-blue-500/40"
                    : "text-gray-500 border-gray-700/40 hover:text-gray-300 hover:border-gray-600"
                }`}
              >
                <Zap size={12} className="mx-auto mb-1" />
                Sin persistir
              </button>
              <button
                onClick={() => setPersistir(true)}
                className={`py-2 px-2 rounded-lg text-xs font-medium border transition-all ${
                  persistir
                    ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                    : "text-gray-500 border-gray-700/40 hover:text-gray-300 hover:border-gray-600"
                }`}
              >
                <Database size={12} className="mx-auto mb-1" />
                Con persistir
              </button>
            </div>
            <p className="text-[10px] text-gray-600 mt-1.5 leading-relaxed">
              {persistir
                ? "⚠ Creará registros reales en la base de datos."
                : "✓ DRY RUN: no escribe nada en la DB."}
            </p>
          </div>

          {/* Validación */}
          <div>
            <p className="text-[9px] uppercase tracking-widest text-gray-500 mb-2 font-semibold">Validación de número</p>
            <button
              onClick={() => setSkipValidacion(!skipValidacion)}
              className={`w-full py-2 px-3 rounded-lg text-xs font-medium border transition-all flex items-center gap-2 ${
                skipValidacion
                  ? "bg-orange-500/20 text-orange-300 border-orange-500/40"
                  : "bg-green-500/10 text-green-400 border-green-500/30"
              }`}
            >
              <Shield size={12} />
              {skipValidacion ? "Validación: OMITIDA" : "Validación: ACTIVA (real)"}
            </button>
            <p className="text-[10px] text-gray-600 mt-1 leading-relaxed">
              {skipValidacion
                ? "Todos los números pasan sin revisión."
                : "Valida que el número esté registrado y activo."}
            </p>
          </div>

          {/* Selector de usuario */}
          <div>
            <p className="text-[9px] uppercase tracking-widest text-gray-500 mb-2 font-semibold">Usuario simulado</p>

            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              <button
                onClick={() => setUsuarioSel(null)}
                className={`w-full text-left px-3 py-2 rounded-lg text-xs border transition-all ${
                  !usuarioSel
                    ? "bg-gray-600/30 text-white border-gray-500/40"
                    : "text-gray-400 border-gray-700/30 hover:text-gray-200 hover:bg-gray-700/20"
                }`}
              >
                <span className="font-medium">✎ Manual</span>
                <span className="text-gray-600 ml-1">(número libre)</span>
              </button>

              {usuarios.map(u => (
                <button
                  key={u.id}
                  onClick={() => setUsuarioSel(u)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-xs border transition-all ${
                    usuarioSel?.id === u.id
                      ? "bg-green-900/30 border-green-500/40"
                      : "text-gray-400 border-gray-700/30 hover:text-gray-200 hover:bg-gray-700/20"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className={`shrink-0 text-[9px] px-1.5 py-0.5 rounded border ${ROL_COLORS[u.rol] ?? ROL_COLORS.externo}`}>
                      {u.rol.toUpperCase()}
                    </span>
                    <span className="truncate font-medium text-white">{u.nombre}</span>
                  </div>
                  {u.telefono && (
                    <p className="text-[10px] text-gray-500 mt-0.5 flex items-center gap-1">
                      <Phone size={9} /> {u.telefono}
                    </p>
                  )}
                  {!u.telefono && (
                    <p className="text-[10px] text-orange-500 mt-0.5">Sin teléfono</p>
                  )}
                </button>
              ))}
            </div>

            {/* Manual phone + name */}
            {!usuarioSel && (
              <div className="mt-2 space-y-2">
                <input
                  type="text"
                  placeholder="Nombre del contacto"
                  value={nombreManual}
                  onChange={e => setNombreManual(e.target.value)}
                  className="w-full bg-gray-800/50 border border-gray-700/50 rounded-lg px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-green-500/50"
                />
                <input
                  type="text"
                  placeholder="Número (ej: 50255551234)"
                  value={telManual}
                  onChange={e => setTelManual(e.target.value)}
                  className="w-full bg-gray-800/50 border border-gray-700/50 rounded-lg px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-green-500/50"
                />
              </div>
            )}
          </div>

          {/* Estado activo */}
          {(usuarioSel || telManual) && (
            <div className="bg-gray-800/40 border border-gray-700/30 rounded-xl p-3">
              <p className="text-[9px] uppercase tracking-widest text-gray-500 mb-2 font-semibold">Identidad activa</p>
              <p className="text-xs text-white font-medium">{nombreActivo}</p>
              <p className="text-[10px] text-green-400 flex items-center gap-1 mt-0.5">
                <Phone size={10} /> {telefonoActivo || "—"}
              </p>
              <span className={`mt-1.5 inline-flex text-[9px] px-2 py-0.5 rounded border font-bold uppercase tracking-wider ${ROL_COLORS[rolActivo] ?? ROL_COLORS.externo}`}>
                {rolActivo}
              </span>
            </div>
          )}

          {/* Acciones de limpieza */}
          <div className="pt-1">
            <button
              onClick={onLimpiarConversacion}
              className="w-full text-xs text-gray-500 hover:text-white border border-gray-700/30 hover:border-gray-600 rounded-lg py-2 flex items-center justify-center gap-2 transition-all"
            >
              <Trash2 size={12} /> Limpiar conversación
            </button>
            <button
              onClick={onLimpiarSesion}
              className="w-full text-xs text-gray-500 hover:text-amber-300 border border-gray-700/30 hover:border-amber-500/30 rounded-lg py-2 flex items-center justify-center gap-2 transition-all mt-1.5"
            >
              <RefreshCw size={12} /> Resetear sesión anticipo
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ChevronLeft16() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}
