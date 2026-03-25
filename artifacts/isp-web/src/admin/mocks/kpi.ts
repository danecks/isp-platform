import type { KPIData } from "../types";

export const mockKPI: KPIData = {
  tiempoRespuestaPromedio: 11,
  tiempoResolucionPromedio: 3.2,
  incidenciasPorCliente: [
    { cliente: "Distribuidora Nacional S.A.", total: 4 },
    { cliente: "Banco Industrial S.A.", total: 2 },
    { cliente: "Agro Exportaciones del Sur", total: 2 },
    { cliente: "Importadora Agro-GT", total: 2 },
    { cliente: "Cervecería Centro Americana", total: 1 },
    { cliente: "Hospital Herrera Llerandi", total: 1 },
    { cliente: "Supermercados La Torre", total: 1 },
    { cliente: "Grupo Pantaleón", total: 1 },
  ],
  leadsDelMes: 7,
  postulacionesDelMes: 7,
  custodiasActivas: 2,
  tareasCerradas: 3,
  slaCumplido: 87,
};

export const tendenciaIncidencias = [
  { mes: "Oct", total: 12 },
  { mes: "Nov", total: 9 },
  { mes: "Dic", total: 7 },
  { mes: "Ene", total: 14 },
  { mes: "Feb", total: 11 },
  { mes: "Mar", total: 8 },
];

export const tendenciaLeads = [
  { mes: "Oct", total: 4 },
  { mes: "Nov", total: 6 },
  { mes: "Dic", total: 3 },
  { mes: "Ene", total: 8 },
  { mes: "Feb", total: 5 },
  { mes: "Mar", total: 7 },
];
