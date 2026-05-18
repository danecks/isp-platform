import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowRight, Banknote, CalendarDays, CheckCircle2, ChevronLeft, Download,
  FileSpreadsheet, Lock, Printer, Settings, TrendingUp, Undo2, Users, Wallet,
} from "lucide-react";
import { BASE, fmtFecha, fmtQ } from "./helpers";
import { ACCION_LABEL, EstadoBadge, KpiCard, SIGUIENTE_ESTADO } from "./badges";
import { ModalImprimir } from "./impresion";
import { ModalTransferencias } from "./ModalTransferencias";
import { TabAnticipos } from "./TabAnticipos";
import { TabFaltas } from "./TabFaltas";
import { TabHorasExtra } from "./TabHorasExtra";
import { TabIGSS } from "./TabIGSS";
import { TabPlanillaGeneral } from "./TabPlanillaGeneral";
import { TabTarifasHE } from "./TabTarifasHE";
import type { PlanillaDetalle as PlanillaDetalleData } from "./types";

const API = `${BASE}/api`;

export function DetallePlanilla({
  planilla, onBack, onCambiarEstado, onRevertir,
}: {
  planilla: PlanillaDetalleData;
  onBack: () => void;
  onCambiarEstado: () => void;
  onRevertir: () => void;
}) {
  function handleExportCSV() {
    window.open(`${API}/nomina/planilla/${planilla.id}/export`, "_blank");
  }

  const [modalTransferencias, setModalTransferencias] = useState(false);
  const [modalImprimir, setModalImprimir] = useState(false);

  const siguienteEstado = SIGUIENTE_ESTADO[planilla.estado];
  const puedeRevertir = planilla.estado !== "pagada";

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" onClick={onBack} size="sm" className="text-[#8bacc8] hover:text-white gap-1">
            <ChevronLeft className="h-4 w-4" />
            Volver
          </Button>
          <Separator orientation="vertical" className="h-6 bg-[#1e3a5f]" />
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold text-white">
                {fmtFecha(planilla.periodo_desde)} — {fmtFecha(planilla.periodo_hasta)}
              </h2>
              <EstadoBadge estado={planilla.estado} />
            </div>
            <div className="text-xs text-[#8bacc8] mt-0.5">
              Generada por <strong>{planilla.generado_por}</strong> · {planilla.total_colaboradores} colaboradores
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button onClick={() => setModalImprimir(true)} variant="outline"
            className="border-[#1e3a5f] text-[#8bacc8] hover:text-white gap-2">
            <Printer className="h-4 w-4" />
            Imprimir
          </Button>
          <Button onClick={handleExportCSV} variant="outline"
            className="border-[#1e3a5f] text-[#8bacc8] hover:text-white gap-2">
            <Download className="h-4 w-4" />
            Exportar CSV
          </Button>
          <Button onClick={() => setModalTransferencias(true)} variant="outline"
            className="border-amber-700/60 text-amber-300 hover:text-amber-200 hover:border-amber-600 gap-2">
            <Banknote className="h-4 w-4" />
            Archivos de transferencia
          </Button>
          {puedeRevertir && (
            <Button onClick={onRevertir} variant="outline"
              className="border-red-800 text-red-400 hover:text-red-300 hover:border-red-700 gap-2">
              <Undo2 className="h-4 w-4" />
              Revertir
            </Button>
          )}
          {siguienteEstado && (
            <Button onClick={onCambiarEstado} className="bg-amber-600 hover:bg-amber-500 text-white gap-2">
              <ArrowRight className="h-4 w-4" />
              {ACCION_LABEL[siguienteEstado]}
            </Button>
          )}
          {planilla.estado === "pagada" && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-900/50 border border-green-700 rounded text-green-300 text-sm">
              <CheckCircle2 className="h-4 w-4" /> Planilla pagada
            </span>
          )}
        </div>
      </div>

      {/* Nota: solo lectura */}
      <div className="bg-amber-950/30 border border-amber-700/50 rounded p-3 flex gap-2 text-xs text-amber-300">
        <Lock className="h-3.5 w-3.5 mt-0.5 shrink-0" />
        Esta planilla es de solo lectura. Si necesitas corregir datos, ve a Pre-Planilla,
        corrige y cierra el período nuevamente. Luego podrás generar una nueva planilla.
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Colaboradores" value={String(planilla.total_colaboradores)} icon={<Users className="h-5 w-5" />} />
        <KpiCard label="Sueldo Período" value={fmtQ(planilla.total_sueldo_periodo)} icon={<CalendarDays className="h-5 w-5" />} />
        <KpiCard label="Total Bruto" value={fmtQ(planilla.total_bruto)}
          sub={`HE: ${fmtQ(planilla.total_valor_he)} | Desc: ${fmtQ(planilla.total_desc_faltas)}`}
          icon={<TrendingUp className="h-5 w-5" />} />
        <KpiCard label="Total Neto a Pagar" value={fmtQ(planilla.total_neto)}
          sub={`IGSS + ISR + Anticipos descontados`}
          icon={<Wallet className="h-5 w-5" />} />
      </div>

      {/* Tabs multi-hoja */}
      <Tabs defaultValue="general" className="space-y-4">
        <TabsList className="bg-[#0a1628] border border-[#1e3a5f]">
          <TabsTrigger value="general" className="data-[state=active]:bg-amber-700 data-[state=active]:text-white text-[#8bacc8]">
            <FileSpreadsheet className="h-4 w-4 mr-1.5" />
            Planilla General
          </TabsTrigger>
          <TabsTrigger value="he" className="data-[state=active]:bg-amber-700 data-[state=active]:text-white text-[#8bacc8]">
            Horas Extra
            {planilla.lineas.filter(l => parseFloat(l.horas_extra) > 0).length > 0 && (
              <Badge className="ml-1.5 bg-amber-900 text-amber-300 text-xs">
                {planilla.lineas.filter(l => parseFloat(l.horas_extra) > 0).length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="faltas" className="data-[state=active]:bg-amber-700 data-[state=active]:text-white text-[#8bacc8]">
            Faltas / Desc.
            {planilla.lineas.filter(l => l.faltas > 0 || l.suspensiones > 0).length > 0 && (
              <Badge className="ml-1.5 bg-red-900 text-red-300 text-xs">
                {planilla.lineas.filter(l => l.faltas > 0 || l.suspensiones > 0).length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="anticipos" className="data-[state=active]:bg-amber-700 data-[state=active]:text-white text-[#8bacc8]">
            Anticipos
            {planilla.lineas.filter(l => parseFloat(l.anticipos) > 0).length > 0 && (
              <Badge className="ml-1.5 bg-orange-900 text-orange-300 text-xs">
                {planilla.lineas.filter(l => parseFloat(l.anticipos) > 0).length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="igss" className="data-[state=active]:bg-amber-700 data-[state=active]:text-white text-[#8bacc8]">
            IGSS
            {planilla.lineas.filter(l => l.aplica_igss).length > 0 && (
              <Badge className="ml-1.5 bg-emerald-900 text-emerald-300 text-xs">
                {planilla.lineas.filter(l => l.aplica_igss).length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="tarifas" className="data-[state=active]:bg-amber-700 data-[state=active]:text-white text-[#8bacc8]">
            <Settings className="h-4 w-4 mr-1.5" />
            Tarifas HE
          </TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="bg-[#0d1b2a] border border-[#1e3a5f] rounded-lg overflow-hidden">
          <TabPlanillaGeneral lineas={planilla.lineas} />
          {!planilla.lineas.length && (
            <div className="text-center py-8 text-[#8bacc8]">Sin líneas en esta planilla</div>
          )}
        </TabsContent>

        <TabsContent value="he" className="bg-[#0d1b2a] border border-[#1e3a5f] rounded-lg overflow-hidden">
          <TabHorasExtra lineas={planilla.lineas} />
        </TabsContent>

        <TabsContent value="faltas" className="bg-[#0d1b2a] border border-[#1e3a5f] rounded-lg overflow-hidden">
          <TabFaltas lineas={planilla.lineas} />
        </TabsContent>

        <TabsContent value="anticipos" className="bg-[#0d1b2a] border border-[#1e3a5f] rounded-lg overflow-hidden">
          <TabAnticipos lineas={planilla.lineas} />
        </TabsContent>

        <TabsContent value="igss" className="bg-[#0d1b2a] border border-[#1e3a5f] rounded-lg overflow-hidden">
          <TabIGSS lineas={planilla.lineas} />
        </TabsContent>

        <TabsContent value="tarifas" className="bg-[#0d1b2a] border border-[#1e3a5f] rounded-lg overflow-hidden">
          <TabTarifasHE />
        </TabsContent>
      </Tabs>

      {modalTransferencias && (
        <ModalTransferencias
          planillaId={planilla.id}
          onClose={() => setModalTransferencias(false)}
        />
      )}

      {modalImprimir && (
        <ModalImprimir planilla={planilla} onClose={() => setModalImprimir(false)} />
      )}
    </div>
  );
}
