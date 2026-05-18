import { numeroALetrasGT } from "./helpers/numeroALetras";
import type { FormatoCheque, CalibracionCheque } from "./helpers/calibracionCheque";
import type { PlanillaLinea } from "../types";

// Renderiza N hojas, una por cheque, con campos posicionados absolutamente
// sobre coordenadas calibrables. La hoja física (cheque preimpreso) va
// debajo y solo se imprime el texto en las posiciones exactas.

function fmtFechaCheque(d: Date): string {
  return d.toLocaleDateString("es-GT", { year: "numeric", month: "long", day: "numeric" });
}

function fmtMontoNumero(n: number): string {
  // Asteriscos protegen contra alteración (convención de cheques GT)
  const num = n.toLocaleString("es-GT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `***Q ${num}***`;
}

export function PlantillaCheques({
  lineas, formato, calibracion, fechaCheque,
}: {
  lineas: PlanillaLinea[];
  formato: FormatoCheque;
  calibracion: CalibracionCheque;
  fechaCheque: Date;
}) {
  const cheques = lineas.filter(l => (l.forma_pago ?? "").toLowerCase() === "cheque");

  if (cheques.length === 0) {
    return (
      <div className={`print-cheques formato-${formato}`}>
        <p style={{ padding: "20mm", textAlign: "center" }}>
          No hay empleados con forma de pago "cheque" en esta planilla.
        </p>
      </div>
    );
  }

  const altoMm = formato === "continuo" ? calibracion.altoCheque : 280;
  const dx = calibracion.offsetX;
  const dy = calibracion.offsetY;

  return (
    <div className={`print-cheques formato-${formato}`}>
      {cheques.map(l => {
        const monto = parseFloat(l.total_neto);
        const letras = numeroALetrasGT(monto);
        return (
          <div key={l.id} className="cheque-hoja" style={{ height: `${altoMm}mm` }}>
            <div className="cheque-campo fecha" style={{
              left: `${calibracion.fechaX + dx}mm`, top: `${calibracion.fechaY + dy}mm`,
            }}>
              {fmtFechaCheque(fechaCheque)}
            </div>
            <div className="cheque-campo beneficiario" style={{
              left: `${calibracion.beneficiarioX + dx}mm`, top: `${calibracion.beneficiarioY + dy}mm`,
            }}>
              {l.nombre_completo}
            </div>
            <div className="cheque-campo monto-numero" style={{
              left: `${calibracion.montoNumeroX + dx}mm`, top: `${calibracion.montoNumeroY + dy}mm`,
            }}>
              {fmtMontoNumero(monto)}
            </div>
            <div className="cheque-campo monto-letras" style={{
              left: `${calibracion.montoLetrasX + dx}mm`, top: `${calibracion.montoLetrasY + dy}mm`,
            }}>
              {letras}
            </div>
          </div>
        );
      })}
    </div>
  );
}
