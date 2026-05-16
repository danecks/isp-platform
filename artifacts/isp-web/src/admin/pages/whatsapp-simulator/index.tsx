/**
 * SIMULADOR DE WHATSAPP — Panel administrativo (orquestador)
 *
 * Permite al administrador simular conversaciones con el bot usando distintos
 * perfiles, números y mensajes, sin necesidad de la API real de Meta.
 *
 *  ┌────────────┬──────────────────────────────┬──────────────┐
 *  │ ConfigPanel│         ChatPanel            │ DebugSidePanel│
 *  │ (props)    │ (header / mensajes / input)  │ (último debug)│
 *  └────────────┴──────────────────────────────┴──────────────┘
 *
 * Modos:
 *   Simulado → dry-run, no escribe en DB
 *   Real     → persiste entidades en DB (marcadas como simulador_admin)
 */

import { useState } from "react";
import { AdminLayout } from "@/admin/layout/AdminLayout";
import { ChatPanel } from "./ChatPanel";
import { ConfigPanel } from "./ConfigPanel";
import { DebugSidePanel } from "./DebugSidePanel";
import { useSimulador } from "./use-simulador";
import type { UsuarioSimulador } from "./types";

export default function SimuladorWhatsApp() {
  const [usuarioSel, setUsuarioSel] = useState<UsuarioSimulador | null>(null);
  const [telManual, setTelManual] = useState("");
  const [nombreManual, setNombreManual] = useState("Externo Simulado");
  const [persistir, setPersistir] = useState(false);
  const [skipValidacion, setSkipValidacion] = useState(false);
  const [showConfig, setShowConfig] = useState(true);

  const telefonoActivo = usuarioSel?.telefono ?? telManual;
  const nombreActivo = usuarioSel?.nombre ?? nombreManual;
  const rolActivo = usuarioSel?.rol ?? "externo";

  const {
    messages, usuarios, loading, lastDebug,
    enviar, limpiarSesion, limpiarConversacion,
  } = useSimulador({ telefonoActivo, nombreActivo, persistir, skipValidacion });

  return (
    <AdminLayout title="Simulador WhatsApp">
      <div className="flex h-[calc(100vh-64px)] overflow-hidden bg-[#0b141a]">
        <ConfigPanel
          showConfig={showConfig}
          setShowConfig={setShowConfig}
          persistir={persistir}
          setPersistir={setPersistir}
          skipValidacion={skipValidacion}
          setSkipValidacion={setSkipValidacion}
          usuarios={usuarios}
          usuarioSel={usuarioSel}
          setUsuarioSel={setUsuarioSel}
          telManual={telManual}
          setTelManual={setTelManual}
          nombreManual={nombreManual}
          setNombreManual={setNombreManual}
          telefonoActivo={telefonoActivo}
          nombreActivo={nombreActivo}
          rolActivo={rolActivo}
          onLimpiarConversacion={limpiarConversacion}
          onLimpiarSesion={limpiarSesion}
        />

        <ChatPanel
          messages={messages}
          loading={loading}
          persistir={persistir}
          telefonoActivo={telefonoActivo}
          rolActivo={rolActivo}
          onEnviar={enviar}
        />

        <DebugSidePanel debug={lastDebug} />
      </div>
    </AdminLayout>
  );
}
