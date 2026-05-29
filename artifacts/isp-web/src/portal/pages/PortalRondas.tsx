import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PortalLayout } from "@/portal/layout/PortalLayout";
import { portalGet, getActivePortalClienteId } from "@/lib/portalApi";
import { IspPdf } from "@/lib/pdfExport";
import { QrCode, Info, Download } from "lucide-react";
import {
  PeriodoToggle, CumplimientoCard, QrEventListItem,
  PERIODO_LABEL, fmtFechaHora,
  type Periodo, type RondaEventoCore, type CumplimientoRondas,
} from "@/shared/operaciones";

interface CumplimientoResp { rondas: CumplimientoRondas | null }

interface MiCliente {
  portal_cliente_id: string;
  nombre: string;
}

export default function PortalRondas() {
  const [periodo, setPeriodo] = useState<Periodo>("7d");
  const [generando, setGenerando] = useState(false);

  const { data: eventos = [], isLoading } = useQuery<RondaEventoCore[]>({
    queryKey: ["portal-qr-rondas", periodo],
    queryFn: () => portalGet<RondaEventoCore[]>(`/portal/qr/rondas?periodo=${periodo}`),
  });

  const { data: cumpl } = useQuery<CumplimientoResp>({
    queryKey: ["portal-qr-cumplimiento-rondas", periodo],
    queryFn: () => portalGet<CumplimientoResp>(`/portal/qr/cumplimiento?periodo=${periodo}`),
  });

  const { data: clientes = [] } = useQuery<MiCliente[]>({
    queryKey: ["portal-mis-clientes"],
    queryFn: () => portalGet<MiCliente[]>("/portal/mis-clientes"),
  });

  const clienteNombre =
    clientes.find((c) => c.portal_cliente_id === getActivePortalClienteId())?.nombre;

  const sinDatos = eventos.length === 0 && !(cumpl?.rondas && cumpl.rondas.total_puntos > 0);

  async function descargarReporte() {
    setGenerando(true);
    try {
      const pdf = await new IspPdf({
        titulo: "Reporte de Rondas QR",
        subtitulo: PERIODO_LABEL[periodo],
        cliente: clienteNombre,
      }).build();

      const r = cumpl?.rondas;
      pdf.addResumenCards([
        { label: "Cumplimiento", valor: r?.pct_cumplimiento != null ? `${r.pct_cumplimiento}%` : "—", color: "green" },
        { label: "Puntos cubiertos", valor: r ? `${r.puntos_con_escaneo}/${r.total_puntos}` : "—", color: "blue" },
        { label: "Escaneos totales", valor: eventos.length, color: "yellow" },
      ]);

      if (r && r.detalle.length > 0) {
        pdf.addSeccionTitulo("Cumplimiento por punto");
        pdf.addTabla(
          ["Punto de control", "Escaneos", "Último escaneo"],
          r.detalle.map((p) => [
            p.punto_nombre,
            p.escaneos,
            p.ultimo ? fmtFechaHora(p.ultimo) : "Sin escaneos",
          ]),
        );
      }

      const fecha = new Date().toISOString().slice(0, 10);
      pdf.save(`reporte-rondas-${fecha}.pdf`);
    } finally {
      setGenerando(false);
    }
  }

  return (
    <PortalLayout title="Rondas QR">
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-bold text-white">Rondas de Vigilancia</h2>
          <p className="text-sm text-white/40 mt-1">
            Recorridos QR escaneados por los agentes en sus puestos
          </p>
        </div>
        <div className="flex items-center gap-2">
          <PeriodoToggle value={periodo} onChange={setPeriodo} />
          <button
            onClick={descargarReporte}
            disabled={generando || sinDatos}
            className="flex items-center gap-2 px-3 py-2 bg-primary/15 hover:bg-primary/25 disabled:opacity-40 disabled:cursor-not-allowed border border-primary/20 text-primary rounded-lg text-sm font-medium transition-colors"
          >
            <Download className="w-4 h-4" />
            {generando ? "Generando..." : "Descargar reporte"}
          </button>
        </div>
      </div>

      {cumpl?.rondas && cumpl.rondas.total_puntos > 0 && (
        <CumplimientoCard
          titulo="Cumplimiento de rondas"
          pct={cumpl.rondas.pct_cumplimiento}
          totalAgregado={cumpl.rondas.puntos_con_escaneo}
          totalUniverso={cumpl.rondas.total_puntos}
          agregadoLabel="puntos QR"
          items={cumpl.rondas.detalle.map((p) => ({
            id: p.punto_id,
            nombre: p.punto_nombre,
            conteo: p.escaneos,
            ultimo: p.ultimo,
            unidad: "escaneo",
          }))}
        />
      )}

      {isLoading ? (
        <div className="flex items-center justify-center h-48">
          <div className="text-white/40 text-sm animate-pulse">Cargando rondas...</div>
        </div>
      ) : eventos.length === 0 ? (
        <div className="bg-[#0d1c30] border border-white/5 rounded-xl p-12 text-center">
          <QrCode className="w-10 h-10 text-white/10 mx-auto mb-3" />
          <p className="text-white/40 text-sm">
            No hay rondas registradas en {PERIODO_LABEL[periodo].toLowerCase()}
          </p>
        </div>
      ) : (
        <div className="bg-[#0d1c30] border border-white/5 rounded-xl overflow-hidden">
          <div className="divide-y divide-white/5">
            {eventos.map((ev) => (
              <QrEventListItem
                key={ev.id}
                resultado={ev.resultado}
                icono={<QrCode className="w-4 h-4" />}
                titulo={ev.punto_nombre}
                chip={ev.ronda_nombre}
                subtituloIzq={ev.user_nombre}
                cuando={ev.escaneado_en}
                distanciaMetros={ev.distancia_metros}
              />
            ))}
          </div>
        </div>
      )}

      <div className="flex items-start gap-3 bg-primary/5 border border-primary/10 rounded-xl p-4 mt-6">
        <Info className="w-4 h-4 text-primary/70 mt-0.5 shrink-0" />
        <p className="text-xs text-white/50">
          Los códigos QR de ronda están físicamente colocados en puntos estratégicos de su instalación.
          Los agentes deben escanearlos durante su recorrido para confirmar que realizaron la verificación.
        </p>
      </div>
    </PortalLayout>
  );
}
