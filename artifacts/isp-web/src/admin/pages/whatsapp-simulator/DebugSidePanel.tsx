/**
 * Sidebar derecho: muestra los detalles técnicos del último mensaje procesado
 * (validación, usuario, intención, sesión, entidad creada y duración).
 */

import { useState } from "react";
import {
  Activity, AlertCircle, Bug, ChevronRight, Clock, Database,
  Info, Shield, Tag, User,
} from "lucide-react";
import { INTENCION_LABELS } from "./constants";
import type { DebugInfo } from "./types";

export function DebugSidePanel({ debug }: { debug: DebugInfo | null }) {
  const [open, setOpen] = useState(true);

  return (
    <div className={`shrink-0 border-l border-gray-700/30 bg-[#111b21] flex flex-col transition-all duration-200 ${open ? "w-64" : "w-10"}`}>
      <button
        onClick={() => setOpen(!open)}
        className="h-10 flex items-center justify-center text-gray-500 hover:text-white border-b border-gray-700/30 shrink-0"
        title={open ? "Cerrar debug" : "Ver debug"}
      >
        {open ? <ChevronRight size={16} /> : <Bug size={16} />}
      </button>

      {open && (
        <div className="flex-1 overflow-y-auto p-3 space-y-4">
          <div>
            <p className="text-[9px] uppercase tracking-widest text-gray-500 mb-2 font-semibold flex items-center gap-1">
              <Bug size={10} /> Último mensaje
            </p>
          </div>

          {!debug ? (
            <div className="text-center py-10">
              <Info size={24} className="mx-auto text-gray-700 mb-2" />
              <p className="text-[11px] text-gray-600">Envía un mensaje para ver los detalles técnicos aquí.</p>
            </div>
          ) : (
            <div className="space-y-3">
              <Section title="Validación" icon={<Shield size={11} />}>
                <Row label="Teléfono" value={debug.validacion.telefono} mono />
                <Row
                  label="Autorizado"
                  value={debug.validacion.autorizado ? "✓ Sí" : "✗ No"}
                  color={debug.validacion.autorizado ? "text-green-400" : "text-red-400"}
                />
                {debug.validacion.motivo && (
                  <Row label="Motivo" value={debug.validacion.motivo} color="text-orange-400" />
                )}
              </Section>

              {debug.usuario && (
                <Section title="Usuario detectado" icon={<User size={11} />}>
                  <Row label="Nombre" value={debug.usuario.nombre ?? "—"} />
                  <Row label="Rol" value={debug.usuario.rol ?? "externo"} />
                  <Row label="Estado" value={debug.usuario.estado ?? "externo"} />
                  <Row
                    label="Teléfono"
                    value={debug.usuario.tieneTelefono ? "✓ Registrado" : "✗ No tiene"}
                    color={debug.usuario.tieneTelefono ? "text-green-400" : "text-orange-400"}
                  />
                </Section>
              )}

              <Section title="Clasificación" icon={<Tag size={11} />}>
                <Row
                  label="Intención"
                  value={INTENCION_LABELS[debug.clasificacion.intencion] ?? debug.clasificacion.intencion}
                />
                {debug.alias && <Row label="Alias" value={debug.alias} color="text-teal-400" />}
              </Section>

              {debug.sesion.activa && (
                <Section title="Sesión anticipo" icon={<Activity size={11} />}>
                  <Row label="Activa" value="Sí" color="text-yellow-400" />
                  <Row label="Estado" value={debug.sesion.estado ?? "—"} />
                  {debug.sesion.limiteTotal != null && (
                    <Row label="Límite total" value={`Q${debug.sesion.limiteTotal.toLocaleString("es-GT")}`} color="text-blue-400" />
                  )}
                  {debug.sesion.montoSolicitado != null && (
                    <Row label="Monto pedido" value={`Q${debug.sesion.montoSolicitado.toLocaleString("es-GT")}`} color="text-yellow-400" />
                  )}
                  {debug.sesion.limiteRestante != null && (
                    <Row
                      label="Saldo disponible"
                      value={`Q${debug.sesion.limiteRestante.toLocaleString("es-GT")}`}
                      color={debug.sesion.limiteRestante <= 0 ? "text-red-400" : "text-green-400"}
                    />
                  )}
                </Section>
              )}

              <Section title="Entidad" icon={<Database size={11} />}>
                <Row
                  label="Modo"
                  value={debug.entidad.dryRun ? "DRY RUN" : "REAL"}
                  color={debug.entidad.dryRun ? "text-blue-400" : "text-amber-400"}
                />
                <Row label="Tabla" value={debug.entidad.tabla ?? "—"} />
                <Row
                  label="Creada"
                  value={debug.entidad.dryRun ? "No (simulado)" : debug.entidad.creada ? `Sí — #${debug.entidad.id}` : "No"}
                  color={debug.entidad.creada ? "text-green-400" : "text-gray-500"}
                />
              </Section>

              <Section title="Performance" icon={<Clock size={11} />}>
                <Row label="Duración" value={`${debug.duracionMs} ms`} />
                <Row
                  label="Persistencia"
                  value={debug.persistencia === "real" ? "BD Real" : "Simulado"}
                  color={debug.persistencia === "real" ? "text-amber-400" : "text-blue-400"}
                />
              </Section>

              {debug.errores.length > 0 && (
                <Section title="Errores" icon={<AlertCircle size={11} />} headerColor="text-red-400">
                  {debug.errores.map((e, i) => (
                    <p key={i} className="text-[10px] text-red-300 font-mono break-all leading-relaxed">{e}</p>
                  ))}
                </Section>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Section({ title, icon, children, headerColor = "text-gray-400" }: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  headerColor?: string;
}) {
  return (
    <div className="bg-gray-800/30 border border-gray-700/30 rounded-xl p-2.5">
      <div className={`flex items-center gap-1.5 mb-2 ${headerColor}`}>
        {icon}
        <span className="text-[9px] uppercase tracking-widest font-semibold">{title}</span>
      </div>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function Row({ label, value, color = "text-gray-300", mono = false }: {
  label: string;
  value: string;
  color?: string;
  mono?: boolean;
}) {
  return (
    <div className="flex justify-between gap-1 items-start">
      <span className="text-[10px] text-gray-600 shrink-0">{label}</span>
      <span className={`text-[10px] text-right break-all ${color} ${mono ? "font-mono" : ""}`}>{value}</span>
    </div>
  );
}
