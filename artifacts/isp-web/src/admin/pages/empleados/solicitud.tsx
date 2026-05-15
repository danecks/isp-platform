import { useState, useEffect, useRef, type ElementType } from "react";
  import { QRCodeSVG } from "qrcode.react";
  import { createPortal } from "react-dom";
  import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
  import {
    Users, Search, X, Loader2, RefreshCw,
    Building2, MapPin, Phone, Mail, Calendar, Hash,
    Shield, Briefcase, BarChart2, CheckSquare, Wallet,
    AlertTriangle, Zap, Activity, Clock, TrendingUp,
    UserCheck, BadgeCheck, Plus, Pencil, LayoutList,
    LayoutGrid, ChevronDown, UserX, UserCheck2, MessageSquare,
    Link2, Unlink, Lock, Save, Banknote, MessageCircle, XCircle,
    TrendingDown, Minus, ShieldAlert, ShieldCheck, ShieldOff,
    ArrowUpRight, ArrowDownRight, Repeat2, ArrowLeftRight, MapPinned, Map, History,
    UserCog, Sun, Umbrella, CheckCircle2, Info, ChevronRight, QrCode, Download,
    ClipboardList, FileText, Scale, FileSignature, Printer, Camera,
    CalendarClock, Trash2,
  } from "lucide-react";
  import { useToast } from "@/hooks/use-toast";
  import { generarContratoLaboral, cargarPatronoDesdeConfig, type DatosContratoLaboral } from "@/lib/pdfRrhh";
  import { useDeleteMode } from "@/contexts/DeleteModeContext";
  import DescansoSemanalEditor from "../../components/DescansoSemanalEditor";
  import { getSessionToken } from "@/lib/httpClient";
  import {
    type Empleado, type KpiData, type Asignacion, type UserVinculado, type PuestoTitular, type HistorialRelevo,
    type OperacionData, type EventoKPIFront, type KPIDisciplinario, type MovimientoRotacion, type KPIRotacion,
    type FormState, type AsignacionOperativa, type TipoPersonalConfig,
    API_BASE, sessionHeader, iniciales, fmtFecha, fmtRelativa, fmtQ, maskDpi,
    ESTADO_LAB, AVATAR_COLORS, avatarColor, FORM_EMPTY, TIPO_PERSONAL_CFG,
    VALID_TIPOS_PERSONAL, useTiposPersonal, TipoPersonalBadge, EstadoBadge,
    KpiCard, ProgressBar,
  } from "./shared";
  
export function SolFila({ label, value }: { label: string; value?: string | null }) {
  if (!value || value === "no" || value === "0") return null;
  return (
    <div className="flex gap-3 py-1.5 border-b border-white/5 last:border-0">
      <span className="text-white/30 text-xs w-40 shrink-0">{label}</span>
      <span className="text-white text-xs font-medium break-words flex-1">{value}</span>
    </div>
  );
}

export function SolSeccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="bg-white/3 border border-white/8 rounded-xl p-4 space-y-0.5">
      <p className="text-[10px] font-bold uppercase tracking-wider text-primary mb-3">{titulo}</p>
      {children}
    </div>
  );
}

export function TabSolicitudEmpleo({ dpi, nombre }: { dpi: string; nombre: string }) {
  const [sol, setSol] = useState<Record<string, string> | null | "loading">("loading");

  useEffect(() => {
    if (!dpi) { setSol(null); return; }
    setSol("loading");
    fetch(`/api/solicitudes-empleo/by-dpi/${encodeURIComponent(dpi)}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => setSol(data))
      .catch(() => setSol(null));
  }, [dpi]);

  if (sol === "loading") return (
    <div className="flex items-center justify-center py-16">
      <Loader2 className="w-6 h-6 text-primary animate-spin" />
    </div>
  );

  if (!sol) return (
    <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
      <ClipboardList className="w-10 h-10 text-white/15" />
      <p className="text-white/40 text-sm">No se encontró solicitud de empleo asociada al DPI de este colaborador.</p>
      <p className="text-white/20 text-xs">Solo aparece si el colaborador llenó el formulario del kiosco.</p>
    </div>
  );

  const fecha = sol.created_at ? new Date(sol.created_at).toLocaleDateString("es-GT", { year: "numeric", month: "long", day: "numeric" }) : "";

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <ClipboardList className="w-4 h-4 text-primary" />
          <span className="text-white/60 text-sm font-semibold">Formulario de Solicitud de Empleo</span>
        </div>
        <div className="flex items-center gap-2">
          {fecha && <span className="text-white/30 text-xs">{fecha}</span>}
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/20 font-semibold uppercase">{sol.canal ?? "kiosco"}</span>
        </div>
      </div>

      {sol.foto_url && (
        <div className="flex items-center gap-3 bg-white/3 border border-white/8 rounded-xl p-3">
          <img src={sol.foto_url} alt="Foto" className="w-14 h-14 rounded-full object-cover border-2 border-primary/40" />
          <div>
            <p className="text-white text-sm font-semibold">{nombre}</p>
            <p className="text-white/30 text-xs">Foto capturada en solicitud</p>
          </div>
        </div>
      )}

      <SolSeccion titulo="Datos Personales">
        <SolFila label="Plaza solicitada"     value={sol.puesto_solicitado} />
        <SolFila label="Nombre completo"      value={sol.nombre_completo} />
        <SolFila label="DPI"                  value={sol.dpi} />
        <SolFila label="Fecha de nacimiento"  value={sol.fecha_nacimiento} />
        <SolFila label="Género"               value={sol.genero} />
        <SolFila label="Estado civil"         value={sol.estado_civil} />
        <SolFila label="Nacionalidad"         value={sol.nacionalidad} />
        <SolFila label="Lugar de nacimiento"  value={sol.lugar_nacimiento} />
        <SolFila label="Profesión"            value={sol.profesion} />
        <SolFila label="Teléfono"             value={sol.telefono} />
        <SolFila label="Teléfono fijo"        value={sol.telefono_fijo} />
        <SolFila label="Correo"               value={sol.correo} />
        <SolFila label="NIT"                  value={sol.nit} />
        <SolFila label="IGSS"                 value={sol.igss} />
        <SolFila label="Grado de estudios"    value={sol.grado_estudios} />
      </SolSeccion>

      <SolSeccion titulo="Domicilio y Banco">
        <SolFila label="Dirección"            value={sol.direccion} />
        <SolFila label="Municipio"            value={sol.municipio} />
        <SolFila label="Departamento"         value={sol.departamento} />
        <SolFila label="Tiempo residencia"    value={sol.tiempo_residencia} />
        <SolFila label="Tipo vivienda"        value={sol.tipo_vivienda} />
        <SolFila label="Renta mensual"        value={sol.renta_mensual ? `Q${sol.renta_mensual}` : ""} />
        <SolFila label="Banco"                value={sol.banco} />
        <SolFila label="Tipo cuenta"          value={sol.tipo_cuenta} />
        <SolFila label="Núm. cuenta"          value={sol.num_cuenta} />
        <SolFila label="Forma de pago"        value={sol.forma_pago === "deposito" ? "Depósito a cuenta" : sol.forma_pago === "cheque" ? "Cheque" : sol.forma_pago} />
        <SolFila label="Licencia conducir"    value={sol.tiene_licencia === "si" ? `Sí — ${sol.tipo_licencia ?? ""} (vence: ${sol.vigencia_licencia ?? ""})` : ""} />
      </SolSeccion>

      <SolSeccion titulo="Familia">
        <SolFila label="Padre"                value={sol.nombre_padre} />
        <SolFila label="Tel. padre"           value={sol.tel_padre} />
        <SolFila label="Madre"                value={sol.nombre_madre} />
        <SolFila label="Tel. madre"           value={sol.tel_madre} />
        <SolFila label="Cónyuge"              value={sol.nombre_conyuge} />
        <SolFila label="Ocupación cónyuge"    value={sol.ocup_conyuge} />
        <SolFila label="Tel. cónyuge"         value={sol.tel_conyuge} />
        <SolFila label="Dependientes"         value={sol.num_dependientes !== "0" ? sol.num_dependientes : ""} />
        <SolFila label="Hermano 1"            value={sol.hermano1_nombre} />
        <SolFila label="Hermano 2"            value={sol.hermano2_nombre} />
        <SolFila label="Facebook"             value={sol.facebook} />
        <SolFila label="Instagram"            value={sol.instagram} />
      </SolSeccion>

      <SolSeccion titulo="Salud">
        <SolFila label="Estatura"             value={sol.estatura ? `${sol.estatura} m` : ""} />
        <SolFila label="Peso"                 value={sol.peso ? `${sol.peso} kg` : ""} />
        <SolFila label="Enfermedad crónica"   value={sol.enfermedad_cronica === "si" ? `Sí — ${sol.enfermedad_det ?? ""}` : ""} />
        <SolFila label="Medicamentos"         value={sol.medicamento === "si" ? `Sí — ${sol.medicamento_det ?? ""}` : ""} />
        <SolFila label="Impedimento físico"   value={sol.impedimento_fisico === "si" ? `Sí — ${sol.impedimento_det ?? ""}` : ""} />
        <SolFila label="Consume alcohol"      value={sol.consume_alcohol === "si" ? "Sí" : ""} />
        <SolFila label="Consume drogas"       value={sol.consume_drogas === "si" ? "Sí" : ""} />
        <SolFila label="Tatuajes"             value={sol.tiene_tatuajes === "si" ? `Sí — ${sol.tatuajes_det ?? ""}` : ""} />
        <SolFila label="Contacto emergencia"  value={sol.nombre_contacto_emergencia} />
        <SolFila label="Tel. emergencia"      value={sol.telefono_emergencia} />
        <SolFila label="Parentesco"           value={sol.parentesco_emergencia} />
      </SolSeccion>

      <SolSeccion titulo="Antecedentes y Finanzas">
        <SolFila label="Proceso judicial"     value={sol.proceso_judicial === "si" ? `Sí — ${sol.proceso_det ?? ""}` : ""} />
        <SolFila label="Detenido antes"       value={sol.detenido === "si" ? `Sí — ${sol.detencion_det ?? ""}` : ""} />
        <SolFila label="Tiene deudas"         value={sol.tiene_deudas === "si" ? `Sí — ${sol.estado_deuda ?? ""}` : ""} />
        <SolFila label="Gastos mensuales"     value={sol.gastos_mensuales ? `Q${sol.gastos_mensuales}` : ""} />
        <SolFila label="Préstamo"             value={sol.tiene_prestamo === "si" ? `Sí — Q${sol.monto_prestamo ?? ""}` : ""} />
      </SolSeccion>

      <SolSeccion titulo="Educación">
        <SolFila label="Primaria"             value={sol.prim_escuela ? `${sol.prim_escuela} (${sol.prim_lugar ?? ""}) — ${sol.prim_titulo ?? ""}` : ""} />
        <SolFila label="Básicos"              value={sol.bas_escuela ? `${sol.bas_escuela} (${sol.bas_lugar ?? ""}) — ${sol.bas_titulo ?? ""}` : ""} />
        <SolFila label="Diversificado"        value={sol.div_escuela ? `${sol.div_escuela} (${sol.div_lugar ?? ""}) — ${sol.div_titulo ?? ""}` : ""} />
        <SolFila label="Universidad"          value={sol.uni_escuela ? `${sol.uni_escuela} (${sol.uni_lugar ?? ""}) — ${sol.uni_titulo ?? ""}` : ""} />
      </SolSeccion>

      <SolSeccion titulo="Experiencia Laboral">
        <SolFila label="Empresa 1"            value={sol.emp1_nombre ? `${sol.emp1_nombre} — ${sol.emp1_puesto ?? ""} (${sol.emp1_inicio ?? ""} – ${sol.emp1_fin ?? ""})` : ""} />
        <SolFila label="Empresa 2"            value={sol.emp2_nombre ? `${sol.emp2_nombre} — ${sol.emp2_puesto ?? ""} (${sol.emp2_inicio ?? ""} – ${sol.emp2_fin ?? ""})` : ""} />
        <SolFila label="Empresa 3"            value={sol.emp3_nombre ? `${sol.emp3_nombre} — ${sol.emp3_puesto ?? ""} (${sol.emp3_inicio ?? ""} – ${sol.emp3_fin ?? ""})` : ""} />
      </SolSeccion>

      <SolSeccion titulo="Seguridad y Habilidades">
        <SolFila label="Exp. seguridad"       value={sol.experiencia_seguridad === "si" ? `Sí — ${sol.anios_experiencia ?? "0"} años` : ""} />
        <SolFila label="Empresa anterior"     value={sol.empresa_anterior} />
        <SolFila label="Tipos seguridad"      value={sol.tipos_seguridad} />
        <SolFila label="Servicio militar"     value={sol.servicio_militar === "si" ? `Sí — ${sol.rango_militar ?? ""}, ${sol.unidad_militar ?? ""}` : ""} />
        <SolFila label="Fue policía"          value={sol.fue_policia === "si" ? `Sí — ${sol.motivo_baja_policial ?? ""}` : ""} />
        <SolFila label="Habilidades"          value={sol.habilidades} />
        <SolFila label="Disponible rotativo"  value={sol.disp_rotativo === "si" ? "Sí" : ""} />
        <SolFila label="Disponible nocturno"  value={sol.disp_nocturno === "si" ? "Sí" : ""} />
        <SolFila label="Disponible fines sem." value={sol.disp_fds === "si" ? "Sí" : ""} />
        <SolFila label="Tiene vehículo"       value={sol.tiene_vehiculo === "si" ? "Sí" : ""} />
        <SolFila label="Licencia de armas"    value={sol.licencia_armas === "si" ? "Sí" : ""} />
        <SolFila label="Pretensión salarial"  value={sol.pretension_salarial ? `Q${sol.pretension_salarial}` : ""} />
        <SolFila label="Familiar en empresa"  value={sol.familiar_en_empresa === "si" ? `Sí — ${sol.nombre_familiar_empresa ?? ""}` : ""} />
        <SolFila label="Disp. exterior"       value={sol.disponible_exterior === "si" ? "Sí" : ""} />
      </SolSeccion>

      <SolSeccion titulo="Referencias Personales">
        <SolFila label="Referencia 1"         value={sol.ref1_nombre ? `${sol.ref1_nombre} — ${sol.ref1_ocupacion ?? ""} — ${sol.ref1_tel ?? ""}` : ""} />
        <SolFila label="Referencia 2"         value={sol.ref2_nombre ? `${sol.ref2_nombre} — ${sol.ref2_ocupacion ?? ""} — ${sol.ref2_tel ?? ""}` : ""} />
        <SolFila label="Referencia 3"         value={sol.ref3_nombre ? `${sol.ref3_nombre} — ${sol.ref3_ocupacion ?? ""} — ${sol.ref3_tel ?? ""}` : ""} />
      </SolSeccion>

      {(sol.dpi_frente_url || sol.dpi_reverso_url) && (
        <SolSeccion titulo="Imágenes DPI">
          <div className="flex gap-3 pt-1">
            {sol.dpi_frente_url && (
              <div className="flex-1">
                <p className="text-white/30 text-xs mb-1">Frente</p>
                <img src={sol.dpi_frente_url} alt="DPI frente" className="rounded-lg border border-white/10 w-full object-cover max-h-32" />
              </div>
            )}
            {sol.dpi_reverso_url && (
              <div className="flex-1">
                <p className="text-white/30 text-xs mb-1">Reverso</p>
                <img src={sol.dpi_reverso_url} alt="DPI reverso" className="rounded-lg border border-white/10 w-full object-cover max-h-32" />
              </div>
            )}
          </div>
        </SolSeccion>
      )}
    </div>
  );
}

// ─── Tab: Contratos del empleado ─────────────────────────────────────────────
