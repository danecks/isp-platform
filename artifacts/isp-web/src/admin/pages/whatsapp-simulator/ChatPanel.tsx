/**
 * Área central: header con identidad activa, lista de mensajes con auto-scroll,
 * indicador de "escribiendo…" y caja de input. Compone QuickScenarios encima
 * del input.
 */

import { useEffect, useRef, useState } from "react";
import { Activity, Bot, MessageSquare, Phone, Send } from "lucide-react";
import { MsgBubble } from "./MsgBubble";
import { QuickScenarios } from "./QuickScenarios";
import { ROL_COLORS } from "./constants";
import type { ChatMessage } from "./types";

interface Props {
  messages: ChatMessage[];
  loading: boolean;
  persistir: boolean;
  telefonoActivo: string;
  rolActivo: string;
  onEnviar: (msg: string, opts?: { skipVal?: boolean }) => void;
}

export function ChatPanel({
  messages, loading, persistir, telefonoActivo, rolActivo, onEnviar,
}: Props) {
  const [input, setInput] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function submit() {
    if (!input.trim()) return;
    onEnviar(input);
    setInput("");
  }

  return (
    <div className="flex-1 flex flex-col min-w-0">
      {/* Chat header */}
      <div className="h-14 bg-[#202c33] border-b border-gray-700/30 flex items-center px-4 gap-3 shrink-0">
        <div className="w-8 h-8 rounded-full bg-green-600 flex items-center justify-center">
          <Bot size={16} className="text-white" />
        </div>
        <div>
          <p className="text-sm font-semibold text-white">Bot ISP, S.A.</p>
          <p className="text-[10px] text-gray-400 flex items-center gap-1">
            <Activity size={9} className="text-green-400" /> Sistema activo
            <span className="mx-1 text-gray-600">·</span>
            {persistir
              ? <span className="text-amber-400">Con persistencia (DB)</span>
              : <span className="text-blue-400">Modo simulado (DRY RUN)</span>
            }
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {telefonoActivo ? (
            <span className="text-[10px] text-gray-400 flex items-center gap-1 bg-gray-800/50 px-2 py-1 rounded-lg">
              <Phone size={10} className="text-green-400" />
              {telefonoActivo}
              <span className={`ml-1.5 text-[9px] px-1.5 py-0.5 rounded border ${ROL_COLORS[rolActivo] ?? ROL_COLORS.externo}`}>
                {rolActivo.toUpperCase()}
              </span>
            </span>
          ) : (
            <span className="text-[10px] text-orange-400 bg-orange-900/20 border border-orange-700/30 px-2 py-1 rounded-lg">
              Selecciona un usuario
            </span>
          )}
        </div>
      </div>

      {/* Messages */}
      <div
        className="flex-1 overflow-y-auto p-4"
        style={{
          backgroundImage: "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.03) 1px, transparent 0)",
          backgroundSize: "24px 24px",
        }}
      >
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center opacity-60">
            <MessageSquare size={36} className="text-gray-600 mb-3" />
            <p className="text-gray-400 font-medium">Simulador listo</p>
            <p className="text-gray-600 text-xs mt-1 max-w-xs">
              Selecciona un usuario y escribe un mensaje, o usa los escenarios rápidos del panel derecho.
            </p>
          </div>
        )}
        {messages.map(msg => <MsgBubble key={msg.id} msg={msg} />)}
        {loading && (
          <div className="flex justify-start mb-2">
            <div className="w-7 h-7 rounded-full bg-green-600 flex items-center justify-center mr-2 mt-1">
              <Bot size={14} className="text-white" />
            </div>
            <div className="bg-[#1f2c34] rounded-2xl rounded-tl-sm px-4 py-3">
              <div className="flex gap-1">
                {[0,1,2].map(i => (
                  <div key={i} className="w-2 h-2 rounded-full bg-gray-500 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                ))}
              </div>
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      <QuickScenarios onEnviar={onEnviar} />

      {/* Input */}
      <div className="bg-[#202c33] px-3 py-3 shrink-0">
        <div className="flex items-end gap-2">
          <div className="flex-1 bg-[#2a3942] rounded-2xl px-4 py-2.5 flex items-end gap-2">
            <textarea
              rows={1}
              placeholder="Escribe un mensaje…"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submit();
                }
              }}
              className="flex-1 bg-transparent text-sm text-white placeholder-gray-500 resize-none outline-none max-h-28 leading-relaxed"
              style={{ minHeight: "22px" }}
            />
          </div>
          <button
            onClick={submit}
            disabled={loading || !input.trim() || !telefonoActivo}
            className="w-10 h-10 rounded-full bg-green-600 hover:bg-green-500 disabled:bg-gray-700 disabled:opacity-50 flex items-center justify-center transition-all shrink-0"
          >
            <Send size={16} className="text-white ml-0.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
