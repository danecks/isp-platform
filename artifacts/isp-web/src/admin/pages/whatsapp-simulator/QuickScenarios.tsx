/**
 * Barra de escenarios rápidos sobre el input. Se muestra agrupada por
 * "internos / externos / DPI" para facilitar pruebas frecuentes.
 *
 * Los escenarios se cargan desde `GET /api/simulador/escenarios` (tabla
 * `wa_simulator_scenarios`) y se administran desde
 * `/admin/simulador-whatsapp/escenarios`.
 */

import { useEffect, useState } from "react";
import { API } from "./constants";
import type { QuickScenario } from "./types";

interface Props {
  onEnviar: (msg: string, opts?: { skipVal?: boolean }) => void;
}

export function QuickScenarios({ onEnviar }: Props) {
  const [escenarios, setEscenarios] = useState<QuickScenario[]>([]);

  useEffect(() => {
    fetch(`${API}/simulador/escenarios`)
      .then(r => r.json())
      .then((rows: QuickScenario[]) => setEscenarios(Array.isArray(rows) ? rows : []))
      .catch(() => setEscenarios([]));
  }, []);

  const internos = escenarios.filter(s => s.grupo === "interno");
  const externos = escenarios.filter(s => s.grupo === "externo");
  const dpis = escenarios.filter(s => s.grupo === "dpi");

  return (
    <div className="bg-[#111b21] border-t border-gray-700/20 px-4 py-2.5 shrink-0">
      <div className="flex flex-wrap gap-3">
        <Group title="Internos (registrado)">
          {internos.map(s => (
            <button
              key={s.id}
              onClick={() => onEnviar(s.mensaje, { skipVal: s.skipValidacion })}
              className={`text-xs px-2.5 py-1 rounded-lg border transition-all hover:opacity-80 ${s.color}`}
              title={s.mensaje}
            >
              {s.icono} {s.label}
            </button>
          ))}
        </Group>

        <div className="w-px bg-gray-700/30 self-stretch" />

        <Group title="Externos (número desconocido)">
          {externos.map(s => (
            <button
              key={s.id}
              onClick={() => onEnviar(s.mensaje, { skipVal: s.skipValidacion })}
              className={`text-xs px-2.5 py-1 rounded-lg border transition-all hover:opacity-80 ${s.color}`}
              title={s.mensaje}
            >
              {s.icono} {s.label}
            </button>
          ))}
        </Group>

        <div className="w-px bg-gray-700/30 self-stretch" />

        <div>
          <p className="text-[9px] uppercase tracking-widest text-cyan-700 mb-1.5 font-semibold">
            Flujo DPI <span className="text-gray-600">(respuestas rápidas)</span>
          </p>
          <div className="flex flex-wrap gap-1.5">
            {dpis.map(s => (
              <button
                key={s.id}
                onClick={() => onEnviar(s.mensaje)}
                className={`text-xs px-2.5 py-1 rounded-lg border transition-all hover:opacity-80 ${s.color}`}
                title={`Enviar: "${s.mensaje}"`}
              >
                {s.icono} {s.label}
              </button>
            ))}
          </div>
          <p className="text-[9px] text-gray-700 mt-1">
            Primero activa "🔐 Anticipo/Emergencia externo" con número desconocido, luego usa DPI o SI/NO
          </p>
        </div>
      </div>
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[9px] uppercase tracking-widest text-gray-600 mb-1.5 font-semibold">{title}</p>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}
