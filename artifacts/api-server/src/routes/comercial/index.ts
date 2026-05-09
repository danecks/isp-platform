/**
 * Dominio Comercial — leads y postulaciones (web público)
 *
 * - leads:        captación y conversión a clientes (`POST /leads`,
 *                 `POST /leads/:id/convertir-cliente`).
 * - applications: postulaciones generadas desde el sitio público
 *                 (`/reclutamiento`). El kiosco interno se maneja en
 *                 `routes/reclutamiento/solicitudes-empleo`.
 */
export { default as leadsRouter } from "./leads";
export { default as applicationsRouter } from "./applications";
