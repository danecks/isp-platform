import { fmtFecha, fmtQ } from "../helpers";
import type { PlanillaDetalle } from "../types";
import type { ConfigEmpresa } from "./helpers/empresa";

// Renderiza la planilla completa lista para imprimir (tabla horizontal multipágina).
// Se monta dentro de un contenedor `.print-root` que sólo es visible al imprimir.
export function PlantillaPlanillaCompleta({
  planilla, empresa,
}: {
  planilla: PlanillaDetalle;
  empresa: ConfigEmpresa | null;
}) {
  const totales = planilla.lineas.reduce((acc, l) => {
    acc.sueldo += parseFloat(l.sueldo_periodo);
    acc.he += parseFloat(l.valor_he);
    acc.bruto += parseFloat(l.total_bruto);
    acc.desc += parseFloat(l.desc_faltas);
    acc.igss += parseFloat(l.igss_trabajador ?? "0");
    acc.isr += parseFloat(l.isr ?? "0");
    acc.anticipos += parseFloat(l.anticipos);
    acc.otros += parseFloat(l.otros_descuentos ?? "0");
    acc.neto += parseFloat(l.total_neto);
    return acc;
  }, { sueldo: 0, he: 0, bruto: 0, desc: 0, igss: 0, isr: 0, anticipos: 0, otros: 0, neto: 0 });

  return (
    <div className="print-planilla">
      <div className="print-header">
        <img src="/images/logo-isp.png" alt="ISP" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
        <div className="titulo">
          <h1>{empresa?.nombre_empresa ?? "Investigaciones y Seguridad Profesional, S.A."}</h1>
          <div className="meta">
            NIT: {empresa?.nit_empresa ?? "—"} · {empresa?.direccion_empresa ?? ""}
          </div>
          <div className="meta">
            <strong>Planilla de sueldos</strong> · Período: {fmtFecha(planilla.periodo_desde)} al {fmtFecha(planilla.periodo_hasta)}
            {" · "}Colaboradores: {planilla.total_colaboradores}
          </div>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Nombre</th>
            <th>DPI</th>
            <th>Puesto</th>
            <th>Sede / Cliente</th>
            <th className="num">Sueldo período</th>
            <th className="num">Bonif.</th>
            <th className="num">HE</th>
            <th className="num">Bruto</th>
            <th className="num">Desc. faltas</th>
            <th className="num">IGSS</th>
            <th className="num">ISR</th>
            <th className="num">Anticipos</th>
            <th className="num">Otros</th>
            <th className="num">Líquido</th>
            <th>Forma de pago</th>
          </tr>
        </thead>
        <tbody>
          {planilla.lineas.map((l, i) => {
            const bonif = parseFloat(l.sueldo_periodo) > 0 ? 250 : 0; // bonificación incentivo
            return (
              <tr key={l.id}>
                <td>{i + 1}</td>
                <td>{l.nombre_completo}</td>
                <td>{l.dpi ?? "—"}</td>
                <td>{l.puesto ?? "—"}</td>
                <td>{[l.sede, l.cliente].filter(Boolean).join(" / ") || "—"}</td>
                <td className="num">{fmtQ(l.sueldo_periodo)}</td>
                <td className="num">{fmtQ(bonif)}</td>
                <td className="num">{fmtQ(l.valor_he)}</td>
                <td className="num">{fmtQ(l.total_bruto)}</td>
                <td className="num">{fmtQ(l.desc_faltas)}</td>
                <td className="num">{fmtQ(l.igss_trabajador ?? 0)}</td>
                <td className="num">{fmtQ(l.isr ?? 0)}</td>
                <td className="num">{fmtQ(l.anticipos)}</td>
                <td className="num">{fmtQ(l.otros_descuentos ?? 0)}</td>
                <td className="num"><strong>{fmtQ(l.total_neto)}</strong></td>
                <td>{(l.forma_pago ?? "—").toUpperCase()}</td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr style={{ fontWeight: "bold", background: "#f3f3f3" }}>
            <td colSpan={5} style={{ textAlign: "right" }}>TOTALES</td>
            <td className="num">{fmtQ(totales.sueldo)}</td>
            <td className="num">—</td>
            <td className="num">{fmtQ(totales.he)}</td>
            <td className="num">{fmtQ(totales.bruto)}</td>
            <td className="num">{fmtQ(totales.desc)}</td>
            <td className="num">{fmtQ(totales.igss)}</td>
            <td className="num">{fmtQ(totales.isr)}</td>
            <td className="num">{fmtQ(totales.anticipos)}</td>
            <td className="num">{fmtQ(totales.otros)}</td>
            <td className="num">{fmtQ(totales.neto)}</td>
            <td></td>
          </tr>
        </tfoot>
      </table>

      <div className="firmas">
        <div className="firma">
          <div className="linea" />
          Elaborado por
        </div>
        <div className="firma">
          <div className="linea" />
          Revisado por
        </div>
        <div className="firma">
          <div className="linea" />
          {empresa?.representante_nombre ?? "Representante legal"}
        </div>
      </div>
    </div>
  );
}
