import { fmtFecha, fmtQ } from "../helpers";
import { numeroALetrasGT } from "./helpers/numeroALetras";
import type { PlanillaDetalle, PlanillaLinea } from "../types";
import type { ConfigEmpresa } from "./helpers/empresa";

export type VarianteAcreditacion = "con_firma" | "archivo";

function VoucherEmpleado({
  linea, planilla, empresa, variante,
}: {
  linea: PlanillaLinea;
  planilla: PlanillaDetalle;
  empresa: ConfigEmpresa | null;
  variante: VarianteAcreditacion;
}) {
  const monto = parseFloat(linea.total_neto);
  return (
    <div className="voucher-acreditacion">
      <h3>COMPROBANTE DE ACREDITACIÓN BANCARIA</h3>
      <div style={{ textAlign: "center", fontSize: "8.5pt", marginBottom: "3mm" }}>
        {empresa?.nombre_empresa ?? "ISP, S.A."} · NIT: {empresa?.nit_empresa ?? "—"}
        <br />
        Período: {fmtFecha(planilla.periodo_desde)} al {fmtFecha(planilla.periodo_hasta)}
      </div>
      <div className="datos">
        <div><label>Empleado:</label> {linea.nombre_completo}</div>
        <div><label>DPI:</label> {linea.dpi ?? "—"}</div>
        <div><label>Puesto:</label> {linea.puesto ?? "—"}</div>
        <div><label>Sede:</label> {linea.sede ?? "—"}</div>
        <div><label>Banco:</label> {linea.banco ?? "—"}</div>
        <div><label>Tipo cuenta:</label> {linea.tipo_cuenta ?? "—"}</div>
        <div style={{ gridColumn: "1 / -1" }}>
          <label>No. de cuenta:</label> {linea.cuenta_bancaria ?? "—"}
        </div>
      </div>
      <div className="monto-grande">
        Monto acreditado: {fmtQ(monto)}
        <div style={{ fontSize: "9pt", fontWeight: "normal", marginTop: "2mm" }}>
          ({numeroALetrasGT(monto)})
        </div>
      </div>
      {variante === "con_firma" && (
        <div className="firma-empleado">
          <div className="col">
            <div className="linea" />
            Firma del empleado
          </div>
          <div className="col">
            <div className="linea" />
            Huella · Fecha
          </div>
        </div>
      )}
      {variante === "archivo" && (
        <div style={{ fontSize: "8pt", textAlign: "center", marginTop: "4mm", color: "#555" }}>
          Documento para archivo interno · Generado el {fmtFecha(new Date().toISOString())}
        </div>
      )}
    </div>
  );
}

export function PlantillaAcreditaciones({
  planilla, empresa, variante,
}: {
  planilla: PlanillaDetalle;
  empresa: ConfigEmpresa | null;
  variante: VarianteAcreditacion;
}) {
  const acreditaciones = planilla.lineas.filter(l =>
    ["acreditacion", "transferencia"].includes((l.forma_pago ?? "").toLowerCase())
  );

  if (acreditaciones.length === 0) {
    return (
      <div className="print-acreditaciones">
        <p style={{ padding: "20mm", textAlign: "center" }}>
          No hay empleados con forma de pago "acreditación" en esta planilla.
        </p>
      </div>
    );
  }

  return (
    <div className="print-acreditaciones">
      {acreditaciones.map(l => (
        <VoucherEmpleado
          key={l.id}
          linea={l}
          planilla={planilla}
          empresa={empresa}
          variante={variante}
        />
      ))}
    </div>
  );
}
