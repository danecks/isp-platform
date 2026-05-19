import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { FileSpreadsheet, Printer, Receipt, X } from "lucide-react";
import type { PlanillaDetalle } from "../types";
import { PlantillaPlanillaCompleta } from "./PlantillaPlanillaCompleta";
import { PlantillaCheques } from "./PlantillaCheques";
import { PlantillaAcreditaciones, type VarianteAcreditacion } from "./PlantillaAcreditaciones";
import { CalibracionPanel } from "./CalibracionPanel";
import { useConfigEmpresa } from "./helpers/empresa";
import {
  type FormatoCheque, getCalibracion, saveCalibracion,
} from "./helpers/calibracionCheque";
import "./print.css";

type Vista = "menu" | "planilla" | "cheques" | "acreditaciones";

export function ModalImprimir({
  planilla, onClose,
}: {
  planilla: PlanillaDetalle;
  onClose: () => void;
}) {
  const { empresa } = useConfigEmpresa();
  const [vista, setVista] = useState<Vista>("menu");
  const [formatoCheque, setFormatoCheque] = useState<FormatoCheque>("continuo");
  const [varianteAcred, setVarianteAcred] = useState<VarianteAcreditacion>("con_firma");
  const [fechaCheque, setFechaCheque] = useState(() => new Date().toISOString().slice(0, 10));
  const [calibracion, setCalibracion] = useState(() => getCalibracion("generico", "continuo"));

  // Recargar calibración al cambiar formato
  useEffect(() => {
    setCalibracion(getCalibracion("generico", formatoCheque));
  }, [formatoCheque]);

  // Guardar calibración al cambiar
  useEffect(() => {
    saveCalibracion("generico", formatoCheque, calibracion);
  }, [calibracion, formatoCheque]);

  // Mientras este modal está montado, marcamos el body con `printing-planilla`
  // para activar las reglas @media print de print.css que ocultan #root y
  // dejan visible sólo el portal `.print-root`. La clase se quita al cerrar
  // para no contaminar otras vistas imprimibles del sistema.
  useEffect(() => {
    document.body.classList.add("printing-planilla");
    return () => { document.body.classList.remove("printing-planilla"); };
  }, []);

  const cheques = useMemo(
    () => planilla.lineas.filter(l => (l.forma_pago ?? "").toLowerCase() === "cheque"),
    [planilla.lineas]
  );
  const acreditaciones = useMemo(
    () => planilla.lineas.filter(l =>
      ["acreditacion", "transferencia"].includes((l.forma_pago ?? "").toLowerCase())
    ),
    [planilla.lineas]
  );

  function imprimir() {
    setTimeout(() => window.print(), 100);
  }

  // Renderiza la vista de impresión activa en un portal con la clase .print-root
  const printContent = vista !== "menu" ? createPortal(
    <div className="print-root print-only">
      {vista === "planilla" && (
        <PlantillaPlanillaCompleta planilla={planilla} empresa={empresa} />
      )}
      {vista === "cheques" && (
        <PlantillaCheques
          lineas={planilla.lineas}
          formato={formatoCheque}
          calibracion={calibracion}
          fechaCheque={new Date(fechaCheque + "T12:00:00")}
        />
      )}
      {vista === "acreditaciones" && (
        <PlantillaAcreditaciones planilla={planilla} empresa={empresa} variante={varianteAcred} />
      )}
    </div>,
    document.body
  ) : null;

  return (
    <>
      {printContent}
      <div className="no-print fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
        <div className="bg-[#0d1b2a] border border-[#1e3a5f] rounded-lg w-full max-w-md max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between p-4 border-b border-[#1e3a5f]">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Printer className="h-5 w-5 text-amber-400" />
              {vista === "menu" ? "Imprimir" :
                vista === "planilla" ? "Planilla completa" :
                vista === "cheques" ? "Cheques" : "Acreditaciones"}
            </h3>
            <Button variant="ghost" size="sm" onClick={onClose} className="text-[#8bacc8]">
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="p-4 space-y-3">
            {vista === "menu" && (
              <>
                <OpcionImprimir
                  icon={<FileSpreadsheet className="h-5 w-5" />}
                  titulo="Planilla completa"
                  desc={`${planilla.total_colaboradores} colaboradores · tabla horizontal multipágina`}
                  onClick={() => setVista("planilla")}
                />
                <OpcionImprimir
                  icon={<Receipt className="h-5 w-5" />}
                  titulo="Cheques"
                  desc={cheques.length === 0
                    ? "Sin empleados con forma de pago «cheque»"
                    : `${cheques.length} cheque(s) · imprime sobre cheque físico`}
                  disabled={cheques.length === 0}
                  onClick={() => setVista("cheques")}
                />
                <OpcionImprimir
                  icon={<Receipt className="h-5 w-5" />}
                  titulo="Acreditaciones"
                  desc={acreditaciones.length === 0
                    ? "Sin empleados con forma de pago «acreditación»"
                    : `${acreditaciones.length} voucher(s) bancario(s)`}
                  disabled={acreditaciones.length === 0}
                  onClick={() => setVista("acreditaciones")}
                />
              </>
            )}

            {vista === "planilla" && (
              <PanelImprimir
                onVolver={() => setVista("menu")}
                onImprimir={imprimir}
              >
                <p className="text-xs text-[#8bacc8]">
                  Se imprime en hoja <strong>carta apaisada</strong>, con encabezado
                  de empresa, totales y firmas. Multipágina automático.
                </p>
              </PanelImprimir>
            )}

            {vista === "cheques" && (
              <PanelImprimir onVolver={() => setVista("menu")} onImprimir={imprimir}>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-[#8bacc8] block mb-1">Formato</label>
                    <div className="flex gap-2">
                      <BtnToggle
                        active={formatoCheque === "continuo"}
                        onClick={() => setFormatoCheque("continuo")}
                        label="Continuo (lazo)"
                      />
                      <BtnToggle
                        active={formatoCheque === "carta"}
                        onClick={() => setFormatoCheque("carta")}
                        label="Hoja carta"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-[#8bacc8] block mb-1">Fecha del cheque</label>
                    <input
                      type="date" value={fechaCheque}
                      onChange={e => setFechaCheque(e.target.value)}
                      className="w-full bg-[#0a1628] border border-[#1e3a5f] rounded px-2 py-1 text-white text-sm"
                    />
                  </div>
                  <CalibracionPanel formato={formatoCheque} cal={calibracion} onChange={setCalibracion} />
                </div>
              </PanelImprimir>
            )}

            {vista === "acreditaciones" && (
              <PanelImprimir onVolver={() => setVista("menu")} onImprimir={imprimir}>
                <label className="text-xs text-[#8bacc8] block mb-1">Variante</label>
                <div className="flex gap-2">
                  <BtnToggle
                    active={varianteAcred === "con_firma"}
                    onClick={() => setVarianteAcred("con_firma")}
                    label="Con firma del empleado"
                  />
                  <BtnToggle
                    active={varianteAcred === "archivo"}
                    onClick={() => setVarianteAcred("archivo")}
                    label="Archivo interno"
                  />
                </div>
              </PanelImprimir>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function OpcionImprimir({
  icon, titulo, desc, onClick, disabled,
}: {
  icon: React.ReactNode; titulo: string; desc: string;
  onClick: () => void; disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick} disabled={disabled}
      className="w-full text-left p-3 rounded border border-[#1e3a5f] bg-[#0a1628]/40
                 hover:bg-[#0a1628] hover:border-amber-700/60 transition
                 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:border-[#1e3a5f]
                 flex items-start gap-3"
    >
      <div className="text-amber-400 mt-0.5">{icon}</div>
      <div>
        <div className="text-white font-medium text-sm">{titulo}</div>
        <div className="text-xs text-[#8bacc8] mt-0.5">{desc}</div>
      </div>
    </button>
  );
}

function PanelImprimir({
  children, onVolver, onImprimir,
}: {
  children: React.ReactNode; onVolver: () => void; onImprimir: () => void;
}) {
  return (
    <div className="space-y-3">
      {children}
      <div className="flex justify-between gap-2 pt-2 border-t border-[#1e3a5f]">
        <Button variant="ghost" size="sm" onClick={onVolver} className="text-[#8bacc8]">
          ← Cambiar tipo
        </Button>
        <Button onClick={onImprimir} className="bg-amber-600 hover:bg-amber-500 text-white gap-2">
          <Printer className="h-4 w-4" />
          Imprimir
        </Button>
      </div>
    </div>
  );
}

function BtnToggle({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded text-xs font-medium border transition ${
        active
          ? "bg-amber-600 border-amber-500 text-white"
          : "bg-[#0a1628] border-[#1e3a5f] text-[#8bacc8] hover:border-amber-700/60"
      }`}
    >
      {label}
    </button>
  );
}
