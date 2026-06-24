
export type PoolTab =
  | "disponibles" | "disponiblesCubriendo" | "vacacionistasCubriendo" | "trabajando"
  | "descansandoCiclo" | "haciendoHE" | "enDescanso" | "suspendidos"
  | "enPuesto" | "enSSA" | "faltando" | "enVacaciones";

export interface Puesto {
  id: number;
  cliente_id: number | null;
  cliente_nombre: string;
  nombre: string;
  turno: string;
  agente_id: number | null;
  agente_nombre: string | null;
  estado: string; // cubierto | descubierto
  agente_estado_laboral: string | null;
  agente_telefono: string | null;
  /** Fecha de alta/ingreso del agente que trabaja hoy (YYYY-MM-DD) — para tooltip */
  agente_fecha_ingreso?: string | null;
  agente_area: string | null;
  notas: string | null;
  orden: number;
  titular_employee_id: number | null;
  titular_nombre: string | null;
  horario: string | null;
  jornada: string | null;
  sede_id: number | null;
  sede_nombre: string | null;
  zona_operativa_id: number | null;
  zona_nombre: string | null;
  hora_entrada: string | null;
  hora_salida: string | null;
  estado_operativo_puesto: string | null;
  tipo_turno_id: number | null;
  turno_nombre: string | null;
  fecha_inicio_ciclo: string | null;
  ciclo_horas: number | null;
  tipo_ciclo: "diario" | "alternado" | null;
  horas_trabajo: number | null;
  horas_descanso: number | null;
  descanso_por_ciclo?: boolean;
  /** Vacaciones activas del titular en la fecha consultada */
  titular_vac_tipo?: "vacaciones" | "vacaciones_trabajadas" | null;
  titular_vac_inicio?: string | null;
  titular_vac_fin?: string | null;
  /** Días para que el titular regrese de vacaciones (1 = vuelve mañana). 0 = ya volvió. */
  titular_vac_dias_regreso?: number | null;
  /** El titular del puesto está de vacaciones HOY (vaciado virtual del slot, PIZ-VAC-01) */
  titular_en_vacaciones?: boolean;
  /** El titular del puesto fue dado de baja / suspendido / con licencia (vaciado virtual, PIZ-BAJA-01) */
  titular_dado_de_baja?: boolean;
  titular_estado_laboral?: string | null;
  /** Arma asignada al puesto (si existe) */
  arma_id?: number | null;
  arma_codigo?: string | null;
  arma_tipo?: string | null;
  arma_marca?: string | null;
  /** Tipo de puesto: normal (operativo) o custodia */
  tipo_puesto?: "normal" | "custodia" | null;
  /** El agente asignado tiene un segmento activo HOY dentro de las horas esperadas del turno */
  agente_en_turno?: boolean;
  /** Turno corto (≤12h) y actualmente fuera de turno → disponible para horas extras */
  apto_horas_extra?: boolean;
  /** Puestos con múltiples titulares (24x24 / 24x48 / etc.) */
  es_par_24x24?: boolean;
  /** Todos los titulares del puesto con su estado de ciclo individual */
  titulares?: TitularCiclo[];
  /** Titular que trabaja hoy */
  par_trabajando?: TitularCiclo;
  /** Titular que descansa hoy */
  par_descansando?: TitularCiclo;
  /** Hay un relevo activo hoy (agente_id y agente_nombre ya fueron sobreescritos con el relevo) */
  es_relevo_dia?: boolean;
  /** El titular que trabaja hoy tiene una falta registrada */
  titular_faltando?: boolean;
  falta_anulada_reactivable?: boolean;
  /** El puesto tiene un slot vacío en la plantilla (puede auto-asignar) */
  tiene_slot_vacio?: boolean;
  /** El agente_id mostrado proviene del titular puro (no hay cobertura manual del día en BD).
   *  Si es true, el botón "Remover agente" se oculta porque /liberar fallaría (agente_id NULL en BD). */
  agente_virtual_titular?: boolean;
  /** Slot virtual de custodia (no es un puesto real) */
  es_custodia?: boolean;
  slot_numero?: number;
  notas_custodia?: string | null;
}

/** Titular individual con su propio estado de ciclo */
export interface TitularCiclo {
  employee_id: number;
  nombre: string;
  orden: number;
  fecha_inicio_ciclo: string | null;
  trabaja_hoy: boolean;
  descanso_por_ciclo: boolean;
  /** Datos de contacto para el tooltip (enriquecidos por el backend del tablero) */
  telefono?: string | null;
  fecha_ingreso?: string | null;
}

export interface ClienteBoard {
  clienteId: number | null;
  clienteNombre: string;
  fechaInicioContrato?: string | null;
  iniciaHoy?: boolean;
  tipoServicio?: string;
  puestos: Puesto[];
}

export interface Agente {
  id: number;
  nombre_completo: string;
  estado_laboral: string;
  puesto: string | null;
  area: string | null;
  sede: string | null;
  telefono: string | null;
  wa_autorizado: boolean;
  supervisor_id: number | null;
  /** EOA: titular | disponible | pool_relevo | sin_asignacion */
  tipo_asignacion_eoa: string;
  /** Solo para agentes en categoría faltando */
  estado_puesto_titular?: string | null;
  nombre_puesto_titular?: string | null;
  cliente_puesto_titular?: string | null;
  /** Motor de turnos — disponibles post-proceso */
  disponibleHE?: boolean;
  turno_nombre?: string | null;
  /** Zona operativa del agente (desde titular o EOA) */
  zona_operativa_id?: number | null;
  zona_nombre?: string | null;
  /** Hints de experiencia previa — solo presentes cuando se provee puesto_id al pool */
  conoce_puesto?: boolean;
  conoce_cliente?: boolean;
  misma_zona_exp?: boolean;
  /** Tipo de personal — identifica supervisores/jefes inyectados como contingencia */
  tipo_personal?: string;
  /** Vacaciones activas del agente: 'vacaciones' | 'vacaciones_trabajadas' | null */
  vacacion_activa_tipo?: string | null;
  /** Flag del backend: true si el agente tiene vacaciones_trabajadas activas */
  vacacion_trabajada?: boolean;
  /** Etiqueta de la sección del pool — solo presente en modo búsqueda global */
  _seccionLabel?: string;
  /** Fecha de ingreso del empleado (YYYY-MM-DD). Si es futura, no debe ser asignable. */
  fecha_ingreso?: string | null;
}

  // ── Tipos para ranking de candidatos ─────────────────────────────────────────
  // P5: supervisores y jefes de servicio (contingencia operativa — menor prioridad)
  // P6: agentes que ya están trabajando/cubriendo hoy (en turno) — última opción,
  //     antes quedaban completamente fuera del selector de tramos.
export type GrupoRanking = "P1" | "P2" | "P3" | "P4" | "P5" | "P6";

export interface AgenteRankeado extends Agente {
  grupo: GrupoRanking;
  /** Etiquetas que explican por qué aparece en esta posición */
  motivos: string[];
  score: number;
}

export const RANKING_GRUPO_CONFIG: Record<GrupoRanking, { label: string; sub: string; headerColor: string; borderColor: string }> = {
  P1: { label: "Disponible · Misma zona",         sub: "Primera opción",        headerColor: "text-emerald-300",    borderColor: "border-emerald-500/25" },
  P2: { label: "Descanso de ciclo · Misma zona",  sub: "Disponible con HE",     headerColor: "text-blue-300",       borderColor: "border-blue-500/20" },
  P3: { label: "Disponible · Otras zonas",        sub: "Sin zona coincidente",  headerColor: "text-white/50",       borderColor: "border-white/8" },
  P4: { label: "Descanso de ciclo · Otras zonas", sub: "Disponible con HE",     headerColor: "text-white/30",       borderColor: "border-white/5" },
  P5: { label: "Contingencia operativa",          sub: "Supervisor / Jefe",     headerColor: "text-orange-300/80",  borderColor: "border-orange-500/15" },
  P6: { label: "En turno hoy",                    sub: "Ya cubriendo · doble cobertura", headerColor: "text-teal-300/80", borderColor: "border-teal-500/15" },
};
export const RANKING_MOTIVO_CONFIG: Record<string, { label: string; cls: string }> = {
  disponible:      { label: "Disponible",     cls: "text-emerald-300 bg-emerald-500/15" },
  descanso_ciclo:  { label: "HE",             cls: "text-blue-300 bg-blue-500/15" },
  misma_zona:      { label: "Misma zona",     cls: "text-primary/90 bg-primary/15" },
  zona_exp:        { label: "Zona",           cls: "text-primary/70 bg-primary/10" },
  conoce_cliente:  { label: "Conoce cliente", cls: "text-amber-300 bg-amber-500/15" },
  conoce_puesto:   { label: "Conoce puesto",  cls: "text-purple-300 bg-purple-500/15" },
  contingencia:    { label: "Contingencia",   cls: "text-orange-300 bg-orange-500/15" },
  en_turno:        { label: "En turno",       cls: "text-teal-300 bg-teal-500/15" },
};

export interface SupervisorPool {
  id: number;
  nombre_completo: string;
  estado_laboral: string;
  puesto: string | null;
  area: string | null;
  sede: string | null;
  telefono: string | null;
  zona_operativa_id: number | null;
  zona_nombre: string | null;
  tipo_turno_id: number | null;
  turno_nombre: string | null;
  tipo_ciclo_turno: string | null;
  horas_trabajo_turno: string | null;
  fecha_inicio_ciclo_turno: string | null;
  estado_display: string;
  // Calculado por el motor de turnos
  trabaja_hoy: boolean | null;
  trabaja_mañana: boolean | null;
  disponible_he: boolean;
  estado_ciclo: "trabajando" | "disponible_he" | "descansando_ciclo" | "sin_turno" | "licencia" | "suspendido" | null;
  puede_cubrir: boolean;
  faltando?: boolean;
  falta_evento_id?: number | null;
}

export interface JefeServicioPool {
  id: number;
  nombre_completo: string;
  estado_laboral: string;
  puesto: string | null;
  area: string | null;
  telefono: string | null;
  zona_operativa_id: number | null;
  zona_nombre: string | null;
  tipo_turno_id: number | null;
  turno_nombre: string | null;
  tipo_ciclo_turno: string | null;
  horas_trabajo_turno: string | null;
  fecha_inicio_ciclo_turno: string | null;
  estado_display: string;
  // Calculado por el motor de turnos en el backend
  trabaja_hoy: boolean | null;
  trabaja_mañana: boolean | null;
  estado_ciclo: "trabajando" | "descansando_ciclo" | "sin_turno" | "licencia" | "suspendido" | null;
  faltando?: boolean;
  falta_evento_id?: number | null;
}

// PERS-SLOT-01: Personal administrativo con plantilla en personal_slots
export interface AdministrativoPool {
  id: number;
  nombre_completo: string;
  estado_laboral: string;
  puesto: string | null;
  area: string | null;
  sede: string | null;
  telefono: string | null;
  tipo_personal: string | null;
  estado_display: string;
  ps_horas_turno: number | null;
  ps_hora_entrada: string | null;
  trabaja_hoy: boolean | null;
  trabaja_mañana: boolean | null;
  estado_ciclo: "trabajando" | "descansando_ciclo" | "sin_turno" | "licencia" | "suspendido" | null;
  faltando?: boolean;
  falta_evento_id?: number | null;
}

export const SUBAREA_LABELS: Record<string, { label: string; cls: string }> = {
  gerencia:              { label: "Gerencia", cls: "text-amber-300/80 bg-amber-500/10 border-amber-500/25" },
  administrativo_rrhh:   { label: "RRHH",     cls: "text-sky-300/80 bg-sky-500/10 border-sky-500/25" },
  administrativo_bodega: { label: "Bodega",   cls: "text-teal-300/80 bg-teal-500/10 border-teal-500/25" },
  administrativo:        { label: "Admin",    cls: "text-slate-200/80 bg-slate-500/15 border-slate-400/25" },
};

export interface Pool {
  trabajando: Agente[];
  descansandoCiclo: Agente[];
  haciendoHE: Agente[];
  disponibles: Agente[];
  disponiblesCubriendo: Agente[];
  vacacionistasCubriendo: Agente[];
  enPuesto: Agente[];
  enSSA: Agente[];
  enDescanso: Agente[];
  suspendidos: Agente[];
  faltando: Agente[];
  enVacaciones: Agente[];
  supervisores: SupervisorPool[];
  jefes_servicio: JefeServicioPool[];
  administrativos?: AdministrativoPool[];
  fecha_hoy: string;
  fecha_mañana: string;
  total: number;
}

export interface PlanFuturo {
  id: number;
  fecha: string;
  puesto_id: number | null;
  puesto_nombre: string | null;
  cliente_nombre: string | null;
  tipo_evento: string;
  tipo_ausencia: string | null;
  tipo_cobertura_futura: string | null;
  ssa_id: string | null;
  ssa_tipo_solicitud: string | null;
  titular_ausente_id: number | null;
  titular_ausente_nombre: string | null;
  relevo_id: number | null;
  relevo_nombre: string | null;
  motivo: string | null;
  notas: string | null;
  estado: string;
  fuente: string;
}

export interface AgentePoolFuturo {
  id: number;
  nombre_completo: string;
  elegible_pool: boolean;
  estado_laboral: string;
  tipo_personal?: string;
  puesto_id: number | null;
  puesto_nombre: string | null;
  cliente_nombre: string | null;
  turno_nombre: string | null;
  horas_trabajo: number | null;
  horas_descanso: number | null;
  fecha_inicio_ciclo: string | null;
  estado_turno?: string;
  fuente_ausencia?: string;
  tipo_ausencia_rrhh?: string;
  razon_no_elegible?: string;
  plan_tipo_ausencia?: string | null;
}

export interface PlanAgenteSSA {
  plan_id: number;
  relevo_id: number | null;
  relevo_nombre: string | null;
}

export interface SsaAgente {
  id: number;
  nombre: string;
  telefono: string | null;
  estado: string;
}

export interface InicioProyecto {
  tipo: "inicio_cliente" | "ssa";
  ssa_id: string | null;
  tipo_solicitud: string | null;
  cliente_id: number;
  cliente_nombre: string;
  cliente_nombre_comercial: string | null;
  sector: string | null;
  notas: string | null;
  fecha_inicio_contrato: string;
  fecha_inicio?: string;
  total_puestos: number;
  puestos_con_titular: number;
  puestos_sin_titular: number;
  dias_para_inicio?: number;
  descripcion: string | null;
  hora_inicio: string | null;
  hora_fin: string | null;
  estado_ssa: string | null;
  plan_agentes: PlanAgenteSSA[];
  puestos: Array<{
    id: number;
    nombre: string;
    turno_nombre: string | null;
    titular_nombre: string | null;
    activo: boolean;
  }> | null;
}

export interface PoolFuturoData {
  fecha: string;
  trabajando: AgentePoolFuturo[];
  descansando: AgentePoolFuturo[];
  disponible: AgentePoolFuturo[];
  relevoProgramado: AgentePoolFuturo[];
  ausenteProgramado: AgentePoolFuturo[];
  noElegible: AgentePoolFuturo[];
  iniciosProyecto: InicioProyecto[];
  totales: {
    trabajando: number;
    descansando: number;
    disponible: number;
    relevoProgramado: number;
    ausenteProgramado: number;
    noElegible: number;
    iniciosProyecto: number;
  };
}

export interface Movimiento {
  id: number;
  puesto_id: number | null;
  cliente_nombre: string;
  puesto_nombre: string;
  agente_saliente_nombre: string | null;
  agente_entrante_nombre: string | null;
  tipo: string;
  motivo: string | null;
  usuario_cambio: string;
  notas: string | null;
  fecha_hora: string;
}

export interface ClienteDisponible {
  id: number;
  nombre: string;
  nombre_comercial: string | null;
  portal_cliente_id: string | null;
}

export interface CierreResumen {
  totalPuestos: number;
  cubiertos: number;
  descubiertos: number;
  cubiertosPorTitular: number;
  cubiertosPorRelevo: number;
  ausencias: number;
  horasExtra: number;
}

export interface AgenteDeclino {
  id: number;
  nombre: string;
  motivo: string;
  fecha: string;
}

export interface TarjetaSSAPendiente {
  id: string;
  tipo_solicitud: string;
  fecha: string;
  hora_inicio: string | null;
  hora_fin: string | null;
  cantidad_guardias: number;
  prioridad: string;
  descripcion: string | null;
  estado_general: string;
  plan_agente_id: number | null;
  plan_agente_nombre: string | null;
  estado_operaciones: string;
  estado_facturacion: string;
  estado_preplanilla: string | null;
  enviado_preplanilla_at: string | null;
  agente_id: number | null;
  agente_nombre: string | null;
  agente_nombre_completo: string | null;
  tipo_cobertura: string | null;
  cliente_nombre: string | null;
  sede_nombre: string | null;
  puesto_nombre: string | null;
  monto_estimado: string | null;
  motivo_ultima_remocion: string | null;
  agentes_rechazados: AgenteDeclino[];
  agentes: SsaAgente[];
}

export interface CierreDiaRecord {
  id: number;
  fecha: string;
  fecha_str?: string;
  estado: string;
  cerrado_por: string;
  cerrado_en: string;
  comentario: string | null;
  reabierto_por: string | null;
  reabierto_en: string | null;
  motivo_reapertura: string | null;
}

export interface DiaPendienteCierre {
  fecha: string;
  fechaStr: string;
}

export interface CierreHoyData {
  estado: "abierto" | "cerrado";
  cierre: CierreDiaRecord | null;
  fechaActiva: string;
  fechaActivaStr: string;
  esFechaFutura: boolean;
  cierreDeHoy: CierreDiaRecord | null;
  resumen: CierreResumen;
  advertencias: string[];
  diasPendientesCierre: DiaPendienteCierre[];
  diasCerrados?: string[];
}

export interface Segmento {
  id: number;
  fecha: string;
  puesto_id: number;
  employee_id: number | null;
  empleado_nombre: string | null;
  empleado_nombre_join: string | null;
  tipo_cobertura: string;
  hora_inicio: string | null;
  hora_fin: string | null;
  horas_calculadas: string | null;
  motivo: string | null;
  fue_en_dia_descanso: boolean;
  genera_horas_extra: boolean;
  observaciones: string | null;
  puesto_nombre_join: string | null;
}

export interface EmpleadoBusqueda {
  id: number;
  nombreCompleto: string;
  puesto: string | null;
  area: string | null;
  estadoLaboral?: string | null;
}

// ─── Selector Agrupado por Estado Operativo ──────────────────────────────────

export type GrupoEstado = "disponible" | "descansando" | "en_puesto" | "en_ssa" | "ausente";

export interface AgenteAgrupado {
  id: number;
  nombre: string;
  grupo: GrupoEstado;
  detalle: string | null;
}

export const GRUPO_CONFIG: Record<GrupoEstado, {
  label: string;
  color: string;
  dot: string;
  badge: string | null;
  seleccionable: boolean;
  advertencia: string | null;
}> = {
  disponible:  { label: "Disponibles",  color: "text-green-400",       dot: "bg-green-500",    badge: null,  seleccionable: true,  advertencia: null },
  descansando: { label: "Descansando",  color: "text-blue-400",        dot: "bg-blue-400",     badge: "HE",  seleccionable: true,  advertencia: "Este agente está en período de descanso. Se asignará como horas extra." },
  en_puesto:   { label: "En puesto",    color: "text-teal-400",        dot: "bg-teal-400",     badge: null,  seleccionable: true,  advertencia: "Este agente ya está cubriendo un puesto activo. ¿Confirmar doble asignación?" },
  en_ssa:      { label: "En SSA",       color: "text-amber-400",       dot: "bg-amber-400",    badge: null,  seleccionable: true,  advertencia: "Este agente ya está asignado a otro servicio especial. ¿Confirmar igualmente?" },
  ausente:     { label: "Ausentes",     color: "text-red-400/60",      dot: "bg-red-400/50",   badge: null,  seleccionable: false, advertencia: null },
};

export function normalizarPoolActual(p: Pool): AgenteAgrupado[] {
  const r: AgenteAgrupado[] = [];
  for (const a of (p.disponibles ?? []))              r.push({ id: a.id, nombre: a.nombre_completo, grupo: "disponible",  detalle: null });
  for (const a of (p.disponiblesCubriendo ?? []))     r.push({ id: a.id, nombre: a.nombre_completo, grupo: "disponible",  detalle: "Cubriendo hoy" });
  for (const a of (p.descansandoCiclo ?? []))         r.push({ id: a.id, nombre: a.nombre_completo, grupo: "descansando", detalle: a.turno_nombre ?? null });
  for (const a of (p.trabajando ?? []))               r.push({ id: a.id, nombre: a.nombre_completo, grupo: "en_puesto",   detalle: a.nombre_puesto_titular ?? null });
  for (const a of (p.enDescanso ?? []))               r.push({ id: a.id, nombre: a.nombre_completo, grupo: "descansando", detalle: "Licencia" });
  for (const a of (p.enPuesto ?? []))                 r.push({ id: a.id, nombre: a.nombre_completo, grupo: "en_puesto",   detalle: a.nombre_puesto_titular ?? null });
  for (const a of (p.enSSA ?? []))                    r.push({ id: a.id, nombre: a.nombre_completo, grupo: "en_ssa",      detalle: null });
  for (const a of [...(p.suspendidos ?? []), ...(p.faltando ?? [])]) r.push({ id: a.id, nombre: a.nombre_completo, grupo: "ausente", detalle: null });
  return r;
}

export function poolFuturoToAgente(a: AgentePoolFuturo): Agente {
  return {
    id: a.id,
    nombre_completo: a.nombre_completo,
    estado_laboral: a.estado_laboral,
    puesto: a.puesto_nombre,
    area: null,
    sede: null,
    telefono: null,
    wa_autorizado: false,
    supervisor_id: null,
    tipo_asignacion_eoa: a.puesto_id ? "titular" : "disponible",
    tipo_personal: a.tipo_personal,
    turno_nombre: a.turno_nombre,
    disponibleHE: false,
  };
}

export function normalizarPoolFuturo(p: PoolFuturoData): AgenteAgrupado[] {
  const r: AgenteAgrupado[] = [];
  for (const a of p.disponible)        r.push({ id: a.id, nombre: a.nombre_completo, grupo: "disponible",  detalle: null });
  for (const a of p.relevoProgramado)  r.push({ id: a.id, nombre: a.nombre_completo, grupo: "disponible",  detalle: "Relevo programado" });
  for (const a of p.descansando)       r.push({ id: a.id, nombre: a.nombre_completo, grupo: "descansando", detalle: a.turno_nombre ?? null });
  for (const a of p.trabajando)        r.push({ id: a.id, nombre: a.nombre_completo, grupo: "en_puesto",   detalle: a.puesto_nombre ?? null });
  for (const a of p.ausenteProgramado) r.push({ id: a.id, nombre: a.nombre_completo, grupo: "ausente",     detalle: a.plan_tipo_ausencia ?? null });
  for (const a of p.noElegible)        r.push({ id: a.id, nombre: a.nombre_completo, grupo: "ausente",     detalle: a.razon_no_elegible ?? null });
  return r;
}

// ─── Configuración de turnos / plantilla ─────────────────────────────────────

export interface TurnoApiItem {
  id: number;
  nombre: string;
  descripcion: string | null;
  horas_trabajo: number;
  horas_descanso: number;
  ciclo_horas: number;
  tipo_ciclo: "diario" | "alternado";
  dias_trabajo: number;
  dias_descanso: number;
  puestos_count: number;
  num_titulares: number;
}

export interface SlotItem {
  id: number;
  slot_numero: number;
  horas_turno: number;
  hora_entrada: string;
  hora_entrada_por_semana: string[] | null;
  // TURNOS-05: excepciones puntuales por día del ciclo. Mapa { "1": "08:00", "2": "22:00" }.
  // Excluyente con hora_entrada_por_semana (solo uno activo a la vez).
  hora_entrada_por_dia?: Record<string, string> | null;
  dias_trabajo: number[];
  dias_medio_turno: number[];
  longitud_ciclo: number;
  fecha_inicio_ciclo: string | null;
  empleado_id: number | null;
  empleado_nombre: string | null;
  empleado_estado: string | null;
}

export type OldTitularAccion = "disponible" | "pool_relevo" | "sin_asignacion";

export const MOTIVOS_TITULAR = [
  { value: "cobertura_definitiva",    label: "Cobertura definitiva" },
  { value: "reemplazo_permanente",    label: "Reemplazo permanente" },
  { value: "baja_titular_anterior",   label: "Baja del titular anterior" },
  { value: "reestructuracion",        label: "Reestructuración" },
  { value: "ascenso",                 label: "Ascenso / promoción" },
  { value: "otro",                    label: "Otro" },
];

export type PreviewCustodia = {
  tipo: "arma" | "vehiculo";
  id: number;
  codigo: string;
  referencaNombre: string;
  custodioAnteriorNombre: string;
  custodioNuevoNombre: string;
};

// ─── Catálogos de etiquetas y motivos compartidos ────────────────────────────

export const TIPOS_AUSENCIA_FUTURO = [
  { value: "permiso_con_goce",  label: "Permiso con goce" },
  { value: "permiso_sin_goce",  label: "Permiso sin goce" },
  { value: "vacaciones",        label: "Vacaciones" },
  { value: "incapacidad",       label: "Incapacidad" },
  { value: "suspension",        label: "Suspensión programada" },
  { value: "otro",              label: "Otro" },
];

export const LABELS_AUSENCIA_FUTURO: Record<string, string> = {
  permiso_con_goce: "Permiso c/goce",
  permiso_sin_goce: "Permiso s/goce",
  vacaciones:       "Vacaciones",
  incapacidad:      "Incapacidad",
  suspension:       "Suspensión",
  otro:             "Ausencia",
};

export const LABELS_FUENTE_AUSENCIA: Record<string, string> = {
  rrhh:                "RRHH",
  planificacion_futura: "Planificado",
};

export const LABELS_AUSENCIA_RRHH: Record<string, string> = {
  permiso:          "Permiso",
  vacaciones:       "Vacaciones",
  incapacidad:      "Incapacidad",
  suspension:       "Suspensión",
  falta:            "Falta",
  permiso_sin_goce: "Permiso s/goce",
};

export const MOTIVOS_SALIDA: {
  value: string;
  label: string;
  desc: string;
  grupo: "descuento" | "sin_descuento";
  genera_rrhh?: boolean;
  requiere_hora_abandono?: boolean;
  requiere_aprobacion_rrhh?: boolean;
}[] = [
  { value: "falta_total",        label: "Falta total",            desc: "No se presentó sin justificación. Descuento de 3 días (24h) o 2 días (12h).",                     grupo: "descuento",     genera_rrhh: true },
  { value: "abandono_parcial",   label: "Abandono parcial",       desc: "Se retiró antes de terminar su turno sin autorización. Descuento proporcional.",                  grupo: "descuento",     genera_rrhh: true, requiere_hora_abandono: true },
  { value: "permiso_sin_goce",   label: "Permiso s/goce",         desc: "Permiso solicitado sin pago. Requiere aprobación de RRHH; si se rechaza, se convierte en falta.", grupo: "descuento",     genera_rrhh: true, requiere_aprobacion_rrhh: true },
  { value: "incapacidad",        label: "Incapacidad IGSS",       desc: "Suspensión médica del IGSS. Genera evento en RRHH para seguimiento.",                             grupo: "sin_descuento", genera_rrhh: true },
  { value: "permiso_con_goce",   label: "Permiso c/goce",         desc: "Permiso autorizado con goce de sueldo (duelo, matrimonio, etc.).",                                grupo: "sin_descuento" },
];

export const TIPOS_NOVEDAD = MOTIVOS_SALIDA;

export const GRUPO_COLORS: Record<string, string> = {
  descuento:     "text-red-300 bg-red-500/10 border-red-500/25 data-[active]:bg-red-500/25 data-[active]:border-red-500/60",
  sin_descuento: "text-emerald-300 bg-emerald-500/10 border-emerald-500/25 data-[active]:bg-emerald-500/25 data-[active]:border-emerald-500/60",
};

export const TIPOS_COBERTURA: { value: string; label: string }[] = [
  { value: "disponible",        label: "Agente disponible del pool" },
  { value: "relevo",            label: "Relevo temporal" },
  { value: "horas_extra",       label: "Horas extra al titular" },
  { value: "cambio_titular",    label: "Cambio de titular" },
  { value: "contratacion_nueva", label: "Contratación nueva" },
];

export const TIPO_SSA_LABELS: Record<string, string> = {
  guardia_extra: "Guardia Extra",
  ampliacion_horario: "Ampliación de Horario",
  cobertura_evento: "Cobertura de Evento",
  custodia_extra: "Custodia Extra",
  apoyo_temporal: "Apoyo Temporal",
};

export const MOTIVOS_REMOCION = [
  { value: "error_asignacion", label: "Error de asignación", color: "text-orange-400 bg-orange-500/12 border-orange-500/25" },
  { value: "agente_declino",   label: "Agente declinó",      color: "text-red-400 bg-red-500/12 border-red-500/25" },
  { value: "cambio_operativo", label: "Cambio operativo",    color: "text-blue-400 bg-blue-500/12 border-blue-500/25" },
  { value: "no_disponible",    label: "No disponible",       color: "text-yellow-400 bg-yellow-500/12 border-yellow-500/25" },
  { value: "otro",             label: "Otro",                color: "text-white/40 bg-white/5 border-white/15" },
] as const;

export const ESTADO_PUESTO_BADGE: Record<string, { label: string; cls: string }> = {
  relevo_completo:  { label: "Falta",       cls: "bg-red-500/20 text-red-300" },
  relevo_parcial:   { label: "Parcial",     cls: "bg-amber-500/20 text-amber-300" },
  abandono_parcial: { label: "Abandono",    cls: "bg-red-500/20 text-red-300" },
  suspension:       { label: "Suspendido",  cls: "bg-orange-500/20 text-orange-300" },
  vacaciones:       { label: "Vacaciones",  cls: "bg-blue-500/20 text-blue-300" },
  incapacidad:      { label: "Incapacidad", cls: "bg-purple-500/20 text-purple-300" },
};
  