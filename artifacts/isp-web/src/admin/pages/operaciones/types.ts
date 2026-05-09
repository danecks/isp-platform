
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
export type GrupoRanking = "P1" | "P2" | "P3" | "P4" | "P5";

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
};
export const RANKING_MOTIVO_CONFIG: Record<string, { label: string; cls: string }> = {
  disponible:      { label: "Disponible",     cls: "text-emerald-300 bg-emerald-500/15" },
  descanso_ciclo:  { label: "HE",             cls: "text-blue-300 bg-blue-500/15" },
  misma_zona:      { label: "Misma zona",     cls: "text-primary/90 bg-primary/15" },
  zona_exp:        { label: "Zona",           cls: "text-primary/70 bg-primary/10" },
  conoce_cliente:  { label: "Conoce cliente", cls: "text-amber-300 bg-amber-500/15" },
  conoce_puesto:   { label: "Conoce puesto",  cls: "text-purple-300 bg-purple-500/15" },
  contingencia:    { label: "Contingencia",   cls: "text-orange-300 bg-orange-500/15" },
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
  