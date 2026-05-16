/**
 * Hook con el estado y operaciones del simulador (carga de usuarios, envío de
 * mensaje, limpieza de sesión). Centraliza el llamado a la API para que los
 * componentes de UI permanezcan declarativos.
 */

import { useCallback, useEffect, useState } from "react";
import { API } from "./constants";
import type { ChatMessage, DebugInfo, UsuarioSimulador } from "./types";

interface EnviarOpts {
  skipVal?: boolean;
}

interface UseSimuladorArgs {
  telefonoActivo: string;
  nombreActivo: string;
  persistir: boolean;
  skipValidacion: boolean;
}

export function useSimulador({
  telefonoActivo,
  nombreActivo,
  persistir,
  skipValidacion,
}: UseSimuladorArgs) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [usuarios, setUsuarios] = useState<UsuarioSimulador[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastDebug, setLastDebug] = useState<DebugInfo | null>(null);

  useEffect(() => {
    fetch(`${API}/simulador/usuarios`)
      .then(r => r.json())
      .then(setUsuarios)
      .catch(() => {});
  }, []);

  const enviar = useCallback(async (texto: string, opts?: EnviarOpts) => {
    if (!texto.trim() || loading) return;
    const tel = telefonoActivo.trim();
    if (!tel) {
      alert("Por favor selecciona un usuario o ingresa un número de teléfono.");
      return;
    }

    const msgId = `msg-${Date.now()}`;
    setMessages(prev => [...prev, {
      id: msgId + "-u",
      from: "user",
      text: texto.trim(),
      ts: new Date(),
    }]);
    setLoading(true);

    try {
      const res = await fetch(`${API}/simulador`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          telefono: tel,
          nombre: nombreActivo,
          mensaje: texto.trim(),
          persistir,
          skipValidacion: opts?.skipVal ?? skipValidacion,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setMessages(prev => [...prev, {
          id: msgId + "-e",
          from: "bot",
          text: `Error: ${data.error ?? "Error desconocido"}`,
          ts: new Date(),
          error: true,
        }]);
      } else {
        setLastDebug(data.debug);
        setMessages(prev => [...prev, {
          id: msgId + "-b",
          from: "bot",
          text: data.respuesta ?? "(Sin respuesta generada)",
          ts: new Date(),
          tipo: data.tipo,
          debug: data.debug,
        }]);
      }
    } catch {
      setMessages(prev => [...prev, {
        id: msgId + "-err",
        from: "bot",
        text: "Error de conexión con el servidor.",
        ts: new Date(),
        error: true,
      }]);
    }
    setLoading(false);
  }, [telefonoActivo, nombreActivo, persistir, skipValidacion, loading]);

  const limpiarSesion = useCallback(async () => {
    if (!telefonoActivo) return;
    await fetch(`${API}/simulador/sesion`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ telefono: telefonoActivo }),
    });
    setMessages(prev => [...prev, {
      id: `sys-${Date.now()}`,
      from: "bot",
      text: "🔄 Sesiones de anticipo y verificación DPI limpiadas. El próximo mensaje iniciará un flujo nuevo.",
      ts: new Date(),
    }]);
  }, [telefonoActivo]);

  const limpiarConversacion = useCallback(() => setMessages([]), []);

  return {
    messages,
    usuarios,
    loading,
    lastDebug,
    enviar,
    limpiarSesion,
    limpiarConversacion,
  };
}
