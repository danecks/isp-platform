/**
 * Burbuja individual de mensaje (usuario o bot) con panel de debug expandible.
 */

import { useState } from "react";
import { Bot, Bug, User } from "lucide-react";
import type { ChatMessage } from "./types";
import { INTENCION_LABELS } from "./constants";

export function MsgBubble({ msg }: { msg: ChatMessage }) {
  const [showDebug, setShowDebug] = useState(false);
  const isUser = msg.from === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} mb-2`}>
      {!isUser && (
        <div className="w-7 h-7 rounded-full bg-green-600 flex items-center justify-center mr-2 mt-1 shrink-0">
          <Bot size={14} className="text-white" />
        </div>
      )}
      <div className="max-w-[75%]">
        <div className={`rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
          isUser
            ? "bg-[#005c4b] text-white rounded-tr-sm"
            : msg.error
              ? "bg-red-900/50 border border-red-600/30 text-red-200 rounded-tl-sm"
              : "bg-[#1f2c34] text-gray-100 rounded-tl-sm"
        }`}>
          <pre className="whitespace-pre-wrap font-sans text-sm">{msg.text}</pre>
        </div>
        <div className={`flex items-center gap-2 mt-0.5 ${isUser ? "justify-end" : "justify-start"}`}>
          <span className="text-[10px] text-gray-500">
            {msg.ts.toLocaleTimeString("es-GT", { hour: "2-digit", minute: "2-digit" })}
          </span>
          {msg.tipo && !isUser && (
            <span className="text-[10px] text-green-600 font-mono">
              {INTENCION_LABELS[msg.tipo] ?? msg.tipo}
            </span>
          )}
          {msg.debug && !isUser && (
            <button
              onClick={() => setShowDebug(!showDebug)}
              className="text-[10px] text-gray-600 hover:text-gray-400 flex items-center gap-0.5"
            >
              <Bug size={10} />
              {showDebug ? "cerrar" : "debug"}
            </button>
          )}
        </div>

        {showDebug && msg.debug && (
          <div className="mt-2 bg-gray-900/80 border border-gray-700/50 rounded-xl p-3 text-xs font-mono space-y-1.5">
            <div className="flex items-center gap-2 text-gray-400 mb-2 font-sans">
              <Bug size={12} /> <span className="font-semibold">Información de depuración</span>
              <span className="ml-auto text-gray-600">{msg.debug.duracionMs}ms</span>
            </div>
            <DebugRow label="Teléfono" value={msg.debug.validacion.telefono} />
            <DebugRow
              label="Autorizado"
              value={msg.debug.validacion.autorizado ? "✓ Sí" : `✗ No (${msg.debug.validacion.motivo})`}
              color={msg.debug.validacion.autorizado ? "text-green-400" : "text-red-400"}
            />
            <DebugRow
              label="Usuario"
              value={msg.debug.usuario?.nombre ?? "Externo / No registrado"}
            />
            <DebugRow label="Rol" value={msg.debug.usuario?.rol ?? "—"} />
            <DebugRow
              label="Intención"
              value={INTENCION_LABELS[msg.debug.clasificacion.intencion] ?? msg.debug.clasificacion.intencion}
            />
            {msg.debug.alias && <DebugRow label="Alias resuelto" value={msg.debug.alias} color="text-teal-400" />}
            {msg.debug.sesion.activa && (
              <DebugRow label="Sesión anticipo" value={`Activa · ${msg.debug.sesion.estado}`} color="text-yellow-400" />
            )}
            <DebugRow
              label="Entidad"
              value={
                msg.debug.entidad.dryRun
                  ? `DRY RUN — ${msg.debug.entidad.tabla ?? "n/a"}`
                  : msg.debug.entidad.creada
                    ? `✓ Creada en ${msg.debug.entidad.tabla} #${msg.debug.entidad.id}`
                    : "No creada"
              }
              color={msg.debug.entidad.dryRun ? "text-blue-400" : msg.debug.entidad.creada ? "text-green-400" : "text-gray-500"}
            />
            <DebugRow
              label="Persistencia"
              value={msg.debug.persistencia === "real" ? "✓ Real (DB)" : "⬡ Simulado (DRY RUN)"}
              color={msg.debug.persistencia === "real" ? "text-amber-400" : "text-blue-400"}
            />
            {msg.debug.errores.length > 0 && (
              <div className="bg-red-900/30 rounded px-2 py-1 mt-1">
                <p className="text-red-400 font-sans font-semibold mb-0.5">Errores:</p>
                {msg.debug.errores.map((e, i) => <p key={i} className="text-red-300">{e}</p>)}
              </div>
            )}
          </div>
        )}
      </div>
      {isUser && (
        <div className="w-7 h-7 rounded-full bg-[#2a3942] flex items-center justify-center ml-2 mt-1 shrink-0">
          <User size={14} className="text-gray-300" />
        </div>
      )}
    </div>
  );
}

function DebugRow({ label, value, color = "text-gray-300" }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex gap-2">
      <span className="text-gray-500 shrink-0 w-28">{label}:</span>
      <span className={color}>{value}</span>
    </div>
  );
}
