import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { AdminLayout } from "../layout/AdminLayout";
import { StatusBadge } from "../components/StatusBadge";
import { anticiposApi, employeesApi, type Anticipo, type EmpleadoSlim } from "@/lib/api";
import { calcularCobroAnticipo } from "@/lib/anticipo-cobro";
import { IspPdf } from "@/lib/pdfExport";
import { useAuth } from "@/contexts/AuthContext";
import {
  Wallet,
  Filter,
  Loader2,
  RefreshCw,
  Download,
  CheckCircle2,
  XCircle,
  Clock,
  Banknote,
  MessageCircle,
  ExternalLink,
  Plus,
  AlertTriangle,
  Check,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type EstadoAnticipo = "pendiente" | "aprobada" | "rechazada" | "pagada";

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-GT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fmtQ(n: number) {
  return `Q${n.toLocaleString("es-GT")}`;
}

function fmtQ2(n: number) {
  return `Q${n.toLocaleString("es-GT", { minimumFractionDigits: 2 })}`;
}

// Estados en los que el anticipo ya quedó aprobado y sus cuotas/montos son fijos.
// "descontado" se asigna automáticamente al terminar de pagarse en planilla.
const ESTADOS_BLOQUEADOS = ["aprobada", "descontado", "pagada"];

// Etiqueta de quincena a partir de la fecha de inicio del período de planilla.
function quincenaLabel(periodoDesde: string) {
  const d = new Date(periodoDesde);
  const dia = d.getUTCDate();
  const q = dia <= 15 ? "1ra" : "2da";
  const mes = d.toLocaleDateString("es-GT", { month: "long", year: "numeric", timeZone: "UTC" });
  return `${q} quincena de ${mes}`;
}

function fmtFechaCorta(iso: string) {
  return new Date(iso).toLocaleDateString("es-GT", { day: "2-digit", month: "short", year: "numeric" });
}

const ESTADO_COLORES: Record<string, string> = {
  pendiente: "text-yellow-400 bg-yellow-400/10 border-yellow-400/20",
  aprobada:  "text-green-400 bg-green-400/10 border-green-400/20",
  rechazada: "text-red-400 bg-red-400/10 border-red-400/20",
  pagada:    "text-blue-400 bg-blue-400/10 border-blue-400/20",
};

const ESTADO_ICONOS: Record<string, React.ReactNode> = {
  pendiente: <Clock className="w-3 h-3" />,
  aprobada:  <CheckCircle2 className="w-3 h-3" />,
  rechazada: <XCircle className="w-3 h-3" />,
  pagada:    <Banknote className="w-3 h-3" />,
};

export default function Anticipos() {
  const [filtroEstado, setFiltroEstado] = useState<EstadoAnticipo | "todos">("todos");
  const [filtroOrigen, setFiltroOrigen] = useState<"todos" | "whatsapp" | "manual">("todos");
  const [pdfDesde, setPdfDesde] = useState("");
  const [pdfHasta, setPdfHasta] = useState("");
  const [pdfLoading, setPdfLoading] = useState(false);
  const [editando, setEditando] = useState<Anticipo | null>(null);
  const [nuevoEstado, setNuevoEstado] = useState<string>("");
  const [observacion, setObservacion] = useState<string>("");
  const [numCuotas, setNumCuotas] = useState<number>(1);
  const [confirmacion, setConfirmacion] = useState<null | "aprobar" | "cancelar">(null);

  const { currentUser } = useAuth();
  const esDirector = currentUser?.rol === "admin";

  const [modalNuevo, setModalNuevo] = useState(false);
  const [formEmpleadoId, setFormEmpleadoId] = useState<number | null>(null);
  const [formNombre, setFormNombre] = useState("");
  const [formBusqueda, setFormBusqueda] = useState("");
  const [mostrarDropdown, setMostrarDropdown] = useState(false);
  const [formCantidad, setFormCantidad] = useState("");
  const [formPuesto, setFormPuesto] = useState("");
  const [formDpi, setFormDpi] = useState("");
  const [formTelefono, setFormTelefono] = useState("");
  const [formObservaciones, setFormObservaciones] = useState("");
  const [formExtraordinario, setFormExtraordinario] = useState(false);

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["anticipos"],
    queryFn: () => anticiposApi.getAll(),
    refetchInterval: 30000,
  });

  const { data: config } = useQuery({
    queryKey: ["anticipos-config"],
    queryFn: anticiposApi.getConfig,
    staleTime: 60000,
  });

  const { data: empleados = [] } = useQuery<EmpleadoSlim[]>({
    queryKey: ["empleados-slim"],
    queryFn: employeesApi.getAll,
    enabled: modalNuevo,
    staleTime: 120000,
  });

  // Límite del colaborador seleccionado (se consulta solo cuando hay uno seleccionado)
  const { data: limiteData } = useQuery<{
    periodoActual: {
      limite: number | null; solicitado: number; restante: number | null; tieneLimite: boolean; periodo: string | null;
      liquidacionAcumulada?: number; kpiScore?: number; kpiClasificacion?: string; enRiesgo?: boolean; porcentajeTecho?: number; baseManual?: boolean;
    };
  }>({
    queryKey: ["anticipo-limite", formEmpleadoId],
    queryFn: () => fetch(`/api/employees/${formEmpleadoId}/anticipos`).then((r) => r.json()),
    enabled: !!formEmpleadoId && modalNuevo,
    staleTime: 30_000,
  });
  const limiteInfo = limiteData?.periodoActual;
  const montoParsed = parseFloat(formCantidad);
  const excedeLimite = limiteInfo?.tieneLimite && limiteInfo.restante !== null && !isNaN(montoParsed) && montoParsed > limiteInfo.restante;
  // Hay una restricción de tope que un anticipo extraordinario (autorizado por
  // el director) podría saltar.
  const hayRestriccionTope = !!(
    formEmpleadoId &&
    limiteInfo?.tieneLimite &&
    (excedeLimite || limiteInfo.enRiesgo || (limiteInfo.restante ?? 0) <= 0)
  );

  const empleadosFiltrados = formBusqueda.length >= 1
    ? empleados.filter((e) =>
        e.nombreCompleto.toLowerCase().includes(formBusqueda.toLowerCase()) ||
        (e.dpi ?? "").includes(formBusqueda)
      ).slice(0, 8)
    : [];

  function seleccionarEmpleado(emp: EmpleadoSlim) {
    setFormEmpleadoId(emp.id);
    setFormNombre(emp.nombreCompleto);
    setFormBusqueda(emp.nombreCompleto);
    setFormPuesto(emp.puesto ?? "");
    setFormDpi(emp.dpi ?? "");
    setFormTelefono(emp.telefono ?? "");
    setMostrarDropdown(false);
  }

  function limpiarSeleccionEmpleado() {
    setFormEmpleadoId(null);
    setFormNombre("");
    setFormBusqueda("");
    setFormPuesto("");
    setFormDpi("");
    setFormTelefono("");
    setFormExtraordinario(false);
  }

  const { mutate: actualizarEstado, isPending: guardando } = useMutation({
    mutationFn: ({ id, estado, observaciones, num_cuotas }: { id: number; estado: string; observaciones?: string; num_cuotas?: number }) =>
      anticiposApi.update(id, { estado, observaciones, num_cuotas }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["anticipos"] });
      setEditando(null);
      toast({ title: "Estado actualizado", description: "La solicitud fue actualizada." });
    },
    onError: (e: unknown) => {
      const err = e as { error?: string; message?: string };
      toast({
        title: "No se pudo actualizar",
        description: err?.error || err?.message || "Intenta de nuevo o avisa a soporte.",
        variant: "destructive",
      });
    },
  });

  const { mutate: crearAnticipo, isPending: creando } = useMutation({
    mutationFn: () =>
      anticiposApi.create({
        nombre: formNombre.trim(),
        cantidad: parseFloat(formCantidad),
        empleadoId: formEmpleadoId,
        puesto: formPuesto.trim() || undefined,
        dpi: formDpi.trim() || undefined,
        telefono: formTelefono.trim() || undefined,
        observaciones: formObservaciones.trim() || undefined,
        extraordinario: formExtraordinario || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["anticipos"] });
      setModalNuevo(false);
      setFormEmpleadoId(null); setFormNombre(""); setFormBusqueda("");
      setFormCantidad(""); setFormPuesto(""); setFormDpi("");
      setFormTelefono(""); setFormObservaciones(""); setFormExtraordinario(false); setMostrarDropdown(false);
      toast({
        title: formExtraordinario ? "Anticipo extraordinario creado" : "Anticipo creado",
        description: formExtraordinario
          ? "Se registró saltándose el tope, con tu autorización."
          : "El anticipo manual fue registrado.",
      });
    },
    onError: async (error: unknown) => {
      // Manejo especial de error 422 (excede_limite)
      if (error instanceof Response && error.status === 422) {
        const body = await error.json().catch(() => ({}));
        toast({
          title: "Límite excedido",
          description: body.mensaje ?? "El monto excede el saldo disponible del colaborador.",
          variant: "destructive",
        });
      } else {
        toast({ title: "Error", description: "No se pudo crear el anticipo.", variant: "destructive" });
      }
    },
  });

  const { data: pagosResumen, isLoading: cargandoPagos } = useQuery({
    queryKey: ["anticipo-pagos", editando?.id],
    queryFn: () => anticiposApi.getPagos(editando!.id),
    enabled: !!editando && ESTADOS_BLOQUEADOS.includes(editando.estado),
  });

  const anticipos = data?.anticipos ?? [];
  const totales = data?.totales;

  const filtrados = anticipos.filter((a) => {
    if (filtroEstado !== "todos" && a.estado !== filtroEstado) return false;
    if (filtroOrigen === "whatsapp" && a.origen !== "whatsapp") return false;
    if (filtroOrigen === "manual" && a.origen !== "manual") return false;
    return true;
  });

  function abrirEdicion(a: Anticipo) {
    setEditando(a);
    setNuevoEstado(a.estado);
    setObservacion(a.observaciones ?? "");
    setNumCuotas(a.numCuotas ?? 1);
    setConfirmacion(null);
  }

  function guardarCambio() {
    if (!editando) return;
    const bloqueado = ESTADOS_BLOQUEADOS.includes(editando.estado);
    // Aprobar desde un estado abierto requiere confirmación: una vez aprobado
    // queda fijo. La aprobación real se dispara desde el overlay de confirmación.
    if (!bloqueado && nuevoEstado === "aprobada") {
      setConfirmacion("aprobar");
      return;
    }
    // Resto de cambios (rechazar/marcar pagada desde abierto, o editar solo
    // observaciones en un anticipo ya aprobado) se guardan directo.
    actualizarEstado({
      id: editando.id,
      estado: nuevoEstado,
      observaciones: observacion,
    });
  }

  async function exportarPdf() {
    if (pdfDesde && pdfHasta && pdfDesde > pdfHasta) {
      toast({
        title: "Rango de fechas inválido",
        description: "La fecha 'desde' no puede ser posterior a 'hasta'.",
        variant: "destructive",
      });
      return;
    }
    setPdfLoading(true);
    try {
      // Reporte sobre lo visible (estado/origen) acotado por el rango de fechas.
      const rows = filtrados.filter((a) => {
        const f = new Date(a.fechaSolicitud);
        if (pdfDesde && f < new Date(pdfDesde + "T00:00:00")) return false;
        if (pdfHasta && f > new Date(pdfHasta + "T23:59:59")) return false;
        return true;
      });

      const montoTotal = rows.reduce((s, a) => s + Number(a.cantidad), 0);
      const cuenta = (estado: string) => rows.filter((a) => a.estado === estado).length;

      const pdf = await new IspPdf({
        titulo: "Reporte de Anticipos Salariales",
        desde: pdfDesde || undefined,
        hasta: pdfHasta || undefined,
        preparedBy: currentUser?.nombre,
      }).build();

      pdf.addSeccionTitulo("RESUMEN");
      pdf.addResumenCards([
        { label: "Solicitudes", valor: rows.length, color: "blue" },
        { label: "Monto Total", valor: fmtQ(montoTotal), color: "gray" },
        { label: "Pendientes", valor: cuenta("pendiente"), color: "yellow" },
        { label: "Aprobadas", valor: cuenta("aprobada"), color: "green" },
      ]);

      pdf.addSeccionTitulo("DETALLE DE ANTICIPOS");
      if (rows.length > 0) {
        pdf.addTabla(
          ["Fecha", "Nombre", "Puesto", "DPI", "Monto (Q)", "Estado", "Período", "Origen"],
          rows.map((a) => [
            fmtFechaCorta(a.fechaSolicitud),
            a.nombre,
            a.puesto ?? "—",
            a.dpi ?? "—",
            fmtQ(Number(a.cantidad)),
            a.estado,
            a.periodo?.replace("-dia", " día") ?? "—",
            a.origen,
          ]),
        );
      } else {
        pdf.addTextoResumen("No hay anticipos en el período seleccionado.");
      }

      const sufijo = pdfDesde || pdfHasta
        ? `${pdfDesde || "inicio"}_a_${pdfHasta || "hoy"}`
        : new Date().toISOString().split("T")[0];
      pdf.save(`anticipos-${sufijo}.pdf`);
    } finally {
      setPdfLoading(false);
    }
  }

  return (
    <AdminLayout title="Anticipos Salariales">
      <div className="space-y-6 max-w-[1400px]">

        {/* BANNER DE PERÍODO */}
        <div className={`rounded-xl border p-4 flex flex-wrap items-center gap-3 ${
          config?.habilitadoAhora
            ? "bg-green-400/5 border-green-400/20"
            : "bg-yellow-400/5 border-yellow-400/20"
        }`}>
          <Wallet className={`w-5 h-5 shrink-0 ${config?.habilitadoAhora ? "text-green-400" : "text-yellow-400"}`} />
          <div className="flex-1 min-w-0">
            <p className={`text-sm font-semibold ${config?.habilitadoAhora ? "text-green-300" : "text-yellow-300"}`}>
              {config?.habilitadoAhora
                ? `Período activo: ${config.periodoActual?.replace("-dia", " — día ")}`
                : "Período de solicitudes cerrado"}
            </p>
            <p className="text-xs text-white/40 mt-0.5">
              Días habilitados: {config?.diasHabilitados?.map((d) => `día ${d}`).join(" y ")} de cada mes
              {" · "}Tolerancia ±{config?.toleranciaDias} día(s)
            </p>
          </div>
          {config?.habilitadoAhora && (
            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider text-green-400 bg-green-400/10 border border-green-400/20">
              Abierto
            </span>
          )}
        </div>

        {/* STATS */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {(["pendiente", "aprobada", "rechazada", "pagada"] as EstadoAnticipo[]).map((e) => {
            const cnt = totales?.[e] ?? 0;
            return (
              <button
                key={e}
                onClick={() => setFiltroEstado(filtroEstado === e ? "todos" : e)}
                className={`bg-[#0c1829] border rounded-xl p-4 text-left transition-all cursor-pointer ${
                  filtroEstado === e ? "border-primary/40" : "border-white/5 hover:border-white/10"
                }`}
              >
                <p className="text-2xl font-bold text-white">{isLoading ? "—" : cnt}</p>
                <div className="flex items-center gap-1.5 mt-1">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${ESTADO_COLORES[e]}`}>
                    {ESTADO_ICONOS[e]}
                    {e}
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {/* MONTO TOTAL */}
        {totales && (
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-[#0c1829] border border-white/5 rounded-xl p-4">
              <p className="text-xs text-white/40 uppercase tracking-wider mb-1">Monto pendiente</p>
              <p className="text-2xl font-bold text-yellow-400">{fmtQ(totales.montoPendiente)}</p>
              <p className="text-xs text-white/30 mt-1">{totales.pendiente} solicitud(es)</p>
            </div>
            <div className="bg-[#0c1829] border border-white/5 rounded-xl p-4">
              <p className="text-xs text-white/40 uppercase tracking-wider mb-1">Monto aprobado</p>
              <p className="text-2xl font-bold text-green-400">{fmtQ(totales.montoAprobado)}</p>
              <p className="text-xs text-white/30 mt-1">{totales.aprobada} solicitud(es)</p>
            </div>
          </div>
        )}

        {/* FILTROS + ACCIONES */}
        <div className="bg-[#0c1829] border border-white/5 rounded-xl p-4">
          <div className="flex flex-wrap items-center gap-3">
            <Filter className="w-4 h-4 text-white/30 shrink-0" />

            {/* Estado */}
            <div className="flex flex-wrap gap-1.5">
              {(["todos", "pendiente", "aprobada", "rechazada", "pagada"] as const).map((e) => (
                <button
                  key={e}
                  onClick={() => setFiltroEstado(e)}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                    filtroEstado === e
                      ? "bg-primary text-white"
                      : "bg-white/5 text-white/50 hover:bg-white/10"
                  }`}
                >
                  {e === "todos" ? "Todos" : e.charAt(0).toUpperCase() + e.slice(1)}
                </button>
              ))}
            </div>

            <div className="w-px h-5 bg-white/10" />

            {/* Origen */}
            {(["todos", "whatsapp", "manual"] as const).map((o) => (
              <button
                key={o}
                onClick={() => setFiltroOrigen(o)}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                  filtroOrigen === o
                    ? "bg-[#25D366]/20 text-[#25D366] border border-[#25D366]/30"
                    : "bg-white/5 text-white/50 hover:bg-white/10"
                }`}
              >
                {o === "whatsapp" && <MessageCircle className="w-3 h-3" />}
                {o === "todos" ? "Todos los canales" : o.charAt(0).toUpperCase() + o.slice(1)}
              </button>
            ))}

            <div className="ml-auto flex items-center gap-2">
              <button
                onClick={() => refetch()}
                className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/50 hover:text-white transition-colors"
                title="Actualizar"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
              <input
                type="date"
                value={pdfDesde}
                onChange={(e) => setPdfDesde(e.target.value)}
                title="Desde"
                className="px-2 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white/70 text-xs focus:outline-none focus:border-primary/40"
              />
              <input
                type="date"
                value={pdfHasta}
                onChange={(e) => setPdfHasta(e.target.value)}
                title="Hasta"
                className="px-2 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white/70 text-xs focus:outline-none focus:border-primary/40"
              />
              <button
                onClick={exportarPdf}
                disabled={pdfLoading}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary text-xs font-medium transition-colors border border-primary/20 disabled:opacity-50"
              >
                {pdfLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                Exportar PDF
              </button>
              <button
                onClick={() => setModalNuevo(true)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary text-white text-xs font-semibold hover:bg-primary/90 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Nuevo anticipo
              </button>
            </div>
          </div>
        </div>

        {/* TABLA */}
        <div className="bg-[#0c1829] border border-white/5 rounded-xl overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center p-16">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : isError ? (
            <div className="p-8 text-center text-red-400 text-sm">Error al cargar solicitudes</div>
          ) : filtrados.length === 0 ? (
            <div className="p-12 text-center">
              <Wallet className="w-10 h-10 text-white/10 mx-auto mb-3" />
              <p className="text-white/30 text-sm">No hay solicitudes para los filtros seleccionados</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/5 text-white/30 text-xs uppercase tracking-wider">
                    <th className="text-left px-5 py-3 font-medium">ID</th>
                    <th className="text-left px-4 py-3 font-medium">Colaborador</th>
                    <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Puesto</th>
                    <th className="text-left px-4 py-3 font-medium hidden lg:table-cell">DPI</th>
                    <th className="text-right px-4 py-3 font-medium">Solicitado</th>
                    <th className="text-right px-4 py-3 font-medium hidden md:table-cell">A descontar</th>
                    <th className="text-left px-4 py-3 font-medium">Canal</th>
                    <th className="text-left px-4 py-3 font-medium">Estado</th>
                    <th className="text-left px-4 py-3 font-medium hidden xl:table-cell">Período</th>
                    <th className="text-left px-4 py-3 font-medium hidden lg:table-cell">Fecha</th>
                    <th className="text-left px-4 py-3 font-medium">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filtrados.map((a) => (
                    <tr
                      key={a.id}
                      className={`hover:bg-white/2 transition-colors ${
                        a.origen === "whatsapp" ? "bg-[#25D366]/3" : ""
                      }`}
                    >
                      <td className="px-5 py-3 font-mono text-xs text-white/40">ANT-{a.id}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 group/emp">
                          <p className="font-medium text-white text-sm">{a.nombre}</p>
                          {a.employeeId && (
                            <Link href="/admin/empleados">
                              <ExternalLink className="w-3 h-3 text-white/20 group-hover/emp:text-primary/60 transition-colors cursor-pointer shrink-0" />
                            </Link>
                          )}
                        </div>
                        {a.telefono && (
                          <p className="text-xs text-white/30 mt-0.5">{a.telefono}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell text-white/60 text-xs">
                        {a.puesto ?? "—"}
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell font-mono text-xs text-white/40">
                        {a.dpi ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-white">
                        {fmtQ(a.cantidad)}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-amber-400 hidden md:table-cell">
                        {a.montoCobro ? fmtQ(Number(a.montoCobro)) : fmtQ(calcularCobroAnticipo(a.cantidad, 1).montoCobro)}
                      </td>
                      <td className="px-4 py-3">
                        {a.origen === "whatsapp" ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-[#25D366]/10 text-[#25D366] border border-[#25D366]/20">
                            <MessageCircle className="w-3 h-3" />
                            WA
                          </span>
                        ) : (
                          <span className="text-xs text-white/30">Manual</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${ESTADO_COLORES[a.estado] ?? "text-white/50 bg-white/5 border-white/10"}`}>
                          {ESTADO_ICONOS[a.estado]}
                          {a.estado}
                        </span>
                      </td>
                      <td className="px-4 py-3 hidden xl:table-cell text-xs text-white/40 font-mono">
                        {a.periodo?.replace("-dia", " día") ?? "—"}
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell text-xs text-white/40">
                        {fmtDate(a.fechaSolicitud)}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => abrirEdicion(a)}
                          className="px-3 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-white/60 hover:text-white transition-colors border border-white/5"
                        >
                          Revisar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {filtrados.length > 0 && (
            <div className="border-t border-white/5 px-5 py-3 flex items-center justify-between text-xs text-white/30">
              <span>{filtrados.length} solicitud(es) mostradas</span>
              {totales && (
                <span>Total general: {fmtQ(anticipos.reduce((s, a) => s + a.cantidad, 0))}</span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* MODAL DE REVISIÓN */}
      {editando && (
        <div
          className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setEditando(null); }}
        >
          <div className="bg-[#0c1829] border border-white/10 rounded-2xl w-full max-w-md p-6 space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">Revisar Anticipo ANT-{editando.id}</h2>
              <button onClick={() => setEditando(null)} className="text-white/30 hover:text-white text-xl leading-none">×</button>
            </div>

            {/* Datos */}
            <div className="bg-white/3 rounded-xl p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-white/40">Colaborador</span>
                <span className="text-white font-medium">{editando.nombre}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/40">Puesto</span>
                <span className="text-white/70">{editando.puesto ?? "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/40">DPI</span>
                <span className="text-white/70 font-mono">{editando.dpi ?? "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/40">Teléfono</span>
                <span className="text-white/70">{editando.telefono ?? "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/40">Monto solicitado</span>
                <span className="text-white font-bold text-lg">{fmtQ(editando.cantidad)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/40">Monto a descontar</span>
                <span className="text-amber-400 font-bold text-lg">
                  {editando.montoCobro ? fmtQ(Number(editando.montoCobro)) : fmtQ(calcularCobroAnticipo(editando.cantidad, 1).montoCobro)}
                </span>
              </div>
              {editando.numCuotas && editando.numCuotas > 1 && (
                <div className="flex justify-between">
                  <span className="text-white/40">Cuotas de planilla</span>
                  <span className="text-amber-300 font-semibold">
                    {editando.numCuotas} pagos × {editando.cuotaMonto ? fmtQ(Number(editando.cuotaMonto)) : "—"}
                    <span className="text-white/30 font-normal ml-1">
                      ({editando.cuotasPagadas ?? 0}/{editando.numCuotas} pagadas)
                    </span>
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-white/40">Período</span>
                <span className="text-white/70 font-mono">{editando.periodo?.replace("-dia", " día") ?? "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/40">Canal</span>
                <span className="text-white/70">{editando.origen}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/40">Fecha solicitud</span>
                <span className="text-white/70">{fmtDate(editando.fechaSolicitud)}</span>
              </div>
            </div>

            {/* Cambiar estado — solo si el anticipo aún no está aprobado */}
            {!ESTADOS_BLOQUEADOS.includes(editando.estado) && (
            <div>
              <label className="block text-xs text-white/40 uppercase tracking-wider mb-2">Estado</label>
              <div className="grid grid-cols-2 gap-2">
                {(["pendiente", "aprobada", "rechazada", "pagada"] as EstadoAnticipo[]).map((e) => (
                  <button
                    key={e}
                    onClick={() => setNuevoEstado(e)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium border transition-all ${
                      nuevoEstado === e
                        ? ESTADO_COLORES[e]
                        : "text-white/30 bg-white/3 border-white/5 hover:bg-white/7"
                    }`}
                  >
                    {ESTADO_ICONOS[e]}
                    {e.charAt(0).toUpperCase() + e.slice(1)}
                  </button>
                ))}
              </div>
            </div>
            )}

            {/* Resumen de cuotas — anticipo ya aprobado (bloqueado): quincena + fecha exacta del cierre */}
            {ESTADOS_BLOQUEADOS.includes(editando.estado) && (
              <div className="space-y-3">
                <div className="flex items-start gap-2 text-xs text-amber-300/90 bg-amber-950/30 border border-amber-500/30 rounded-xl p-3">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>Anticipo aprobado: el número de cuotas y los montos quedaron fijos y no se pueden modificar.</span>
                </div>
                <div>
                  <p className="text-xs text-white/40 uppercase tracking-wider mb-2">Resumen de cuotas</p>
                  {cargandoPagos ? (
                    <p className="text-white/40 text-sm">Cargando...</p>
                  ) : pagosResumen ? (
                    <div className="space-y-1.5">
                      {Array.from({ length: pagosResumen.numCuotas }).map((_, i) => {
                        const pago = pagosResumen.pagos[i];
                        return (
                          <div key={i} className="flex items-start justify-between gap-3 text-sm border border-white/5 rounded-lg px-3 py-2">
                            <span className="text-white/70 shrink-0">Cuota {i + 1}</span>
                            {pago ? (
                              <span className="text-right">
                                <span className="text-green-400 font-medium flex items-center gap-1 justify-end">
                                  <CheckCircle2 className="w-3 h-3" /> Pagada
                                </span>
                                <span className="block text-white/50 text-xs mt-0.5">{quincenaLabel(pago.periodoDesde)}</span>
                                <span className="block text-white/40 text-xs">Cierre: {fmtFechaCorta(pago.fechaGeneracion)}</span>
                              </span>
                            ) : (
                              <span className="text-yellow-400/80 text-xs flex items-center gap-1">
                                <Clock className="w-3 h-3" /> Pendiente
                              </span>
                            )}
                          </div>
                        );
                      })}
                      <div className="flex justify-between text-xs text-white/40 pt-1">
                        <span>{pagosResumen.cuotasPagadas}/{pagosResumen.numCuotas} pagadas</span>
                        <span>Cada cuota: {pagosResumen.cuotaMonto ? fmtQ2(Number(pagosResumen.cuotaMonto)) : "—"}</span>
                      </div>
                    </div>
                  ) : (
                    <p className="text-white/40 text-sm">Sin información de pagos.</p>
                  )}
                </div>
              </div>
            )}

            {/* Selector de cuotas — visible solo al aprobar un anticipo aún abierto */}
            {!ESTADOS_BLOQUEADOS.includes(editando.estado) && nuevoEstado === "aprobada" && editando && (() => {
              const base = editando.cantidad;
              const { tasa, cuotaMonto: cuotaCobro, montoCobro: totalCobro } = calcularCobroAnticipo(base, numCuotas);
              const pctRecargo = Math.round(tasa * 100);
              return (
                <div className="bg-amber-950/30 border border-amber-500/30 rounded-xl p-4 space-y-3">
                  <p className="text-amber-300 text-xs font-bold uppercase tracking-wider">Descuento en planilla</p>
                  {/* Selector de cuotas */}
                  <div className="flex items-center gap-3">
                    <span className="text-white/50 text-sm shrink-0">Número de cuotas:</span>
                    <div className="flex gap-2">
                      {[1, 2, 3, 4].map(n => (
                        <button key={n} onClick={() => setNumCuotas(n)}
                          className={`w-9 h-9 rounded-lg text-sm font-bold border transition-all ${
                            numCuotas === n
                              ? "bg-amber-500 border-amber-400 text-black"
                              : "bg-white/5 border-white/10 text-white/50 hover:bg-white/10"
                          }`}>{n}</button>
                      ))}
                    </div>
                  </div>
                  {/* Desglose */}
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between text-white/50">
                      <span>Monto solicitado</span>
                      <span className="font-mono">Q{base.toLocaleString("es-GT")}</span>
                    </div>
                    <div className="flex justify-between text-white/50">
                      <span>Recargo ({pctRecargo}%: 10% la 1ª + 5% por cuota extra)</span>
                      <span className="font-mono">Q{(totalCobro - base).toLocaleString("es-GT", { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between text-amber-300 border-t border-amber-500/20 pt-1 mt-1">
                      <span className="font-semibold">Cada cuota ({numCuotas} {numCuotas === 1 ? "pago" : "pagos"})</span>
                      <span className="font-mono font-bold">Q{cuotaCobro.toLocaleString("es-GT", { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between text-amber-200 font-bold text-base">
                      <span>Total a descontar</span>
                      <span className="font-mono">Q{totalCobro.toLocaleString("es-GT", { minimumFractionDigits: 2 })}</span>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Observaciones */}
            <div>
              <label className="block text-xs text-white/40 uppercase tracking-wider mb-2">Observaciones</label>
              <textarea
                value={observacion}
                onChange={(e) => setObservacion(e.target.value)}
                placeholder="Notas sobre esta solicitud..."
                rows={3}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 focus:outline-none focus:border-primary/40 resize-none"
              />
            </div>

            <div className="space-y-3">
              {ESTADOS_BLOQUEADOS.includes(editando.estado) && esDirector && (editando.cuotasPagadas ?? 0) === 0 && (
                <button
                  onClick={() => setConfirmacion("cancelar")}
                  className="w-full py-2 rounded-xl bg-red-500/10 text-red-300 border border-red-500/30 text-sm font-medium hover:bg-red-500/20 transition-colors"
                >
                  Cancelar anticipo (solo director)
                </button>
              )}
              <div className="flex gap-3">
                <button
                  onClick={() => setEditando(null)}
                  className="flex-1 py-2 rounded-xl bg-white/5 text-white/50 text-sm hover:bg-white/10 transition-colors"
                >
                  Cerrar
                </button>
                <button
                  onClick={guardarCambio}
                  disabled={guardando}
                  className="flex-1 py-2 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  {guardando ? "Guardando..." : "Guardar cambios"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRMACIÓN: aprobar (queda fijo) o cancelar (solo director) */}
      {confirmacion && editando && (
        <div
          className="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setConfirmacion(null); }}
        >
          <div className="bg-[#0c1829] border border-white/10 rounded-2xl w-full max-w-sm p-6 space-y-4">
            {confirmacion === "aprobar" ? (
              <>
                <div className="flex items-center gap-2 text-amber-300">
                  <AlertTriangle className="w-5 h-5" />
                  <h3 className="font-bold">Confirmar aprobación</h3>
                </div>
                <p className="text-sm text-white/70">
                  Vas a aprobar este anticipo. Una vez aprobado, el número de cuotas y los montos quedan{" "}
                  <span className="text-white font-semibold">fijos</span> y no se podrán modificar después.
                </p>
                {(() => {
                  const { cuotaMonto, montoCobro } = calcularCobroAnticipo(editando.cantidad, numCuotas);
                  return (
                    <div className="bg-white/3 rounded-xl p-3 text-sm space-y-1">
                      <div className="flex justify-between text-white/60">
                        <span>Cuotas</span>
                        <span className="text-white">{numCuotas} × {fmtQ2(cuotaMonto)}</span>
                      </div>
                      <div className="flex justify-between text-white/60">
                        <span>Total a descontar</span>
                        <span className="text-amber-300 font-bold">{fmtQ2(montoCobro)}</span>
                      </div>
                    </div>
                  );
                })()}
              </>
            ) : (
              <>
                <div className="flex items-center gap-2 text-red-300">
                  <AlertTriangle className="w-5 h-5" />
                  <h3 className="font-bold">Cancelar anticipo</h3>
                </div>
                <p className="text-sm text-white/70">
                  Vas a cancelar (rechazar) este anticipo aprobado. Solo es posible porque todavía no se ha
                  descontado ninguna cuota. Esta acción no se puede deshacer.
                </p>
              </>
            )}
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmacion(null)}
                className="flex-1 py-2 rounded-xl bg-white/5 text-white/60 text-sm hover:bg-white/10 transition-colors"
              >
                Volver
              </button>
              <button
                disabled={guardando}
                onClick={() => {
                  if (confirmacion === "aprobar") {
                    actualizarEstado({ id: editando.id, estado: "aprobada", observaciones: observacion, num_cuotas: numCuotas });
                  } else {
                    actualizarEstado({ id: editando.id, estado: "rechazada", observaciones: observacion });
                  }
                  setConfirmacion(null);
                }}
                className={`flex-1 py-2 rounded-xl text-sm font-semibold disabled:opacity-50 transition-colors ${
                  confirmacion === "aprobar"
                    ? "bg-green-500 text-black hover:bg-green-400"
                    : "bg-red-500 text-white hover:bg-red-400"
                }`}
              >
                {confirmacion === "aprobar" ? "Sí, aprobar" : "Sí, cancelar"}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* MODAL NUEVO ANTICIPO MANUAL */}
      {modalNuevo && (
        <div
          className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setModalNuevo(false); }}
        >
          <div className="bg-[#0c1829] border border-white/10 rounded-2xl w-full max-w-md p-6 space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-white">Nuevo anticipo manual</h2>
                <p className="text-xs text-white/40 mt-0.5">Se registrará con origen "Manual" y estado "Pendiente"</p>
              </div>
              <button onClick={() => setModalNuevo(false)} className="text-white/30 hover:text-white text-xl leading-none">×</button>
            </div>

            <div className="space-y-3">
              {/* Colaborador — buscador */}
              <div>
                <label className="block text-xs text-white/40 uppercase tracking-wider mb-1.5">
                  Colaborador <span className="text-red-400">*</span>
                </label>

                {formEmpleadoId ? (
                  /* Colaborador seleccionado */
                  <div className="flex items-center gap-2 bg-primary/10 border border-primary/30 rounded-lg px-3 py-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">{formNombre}</p>
                      {formPuesto && <p className="text-xs text-white/40 truncate">{formPuesto}</p>}
                    </div>
                    <button
                      type="button"
                      onClick={limpiarSeleccionEmpleado}
                      className="text-white/30 hover:text-white text-lg leading-none shrink-0"
                      title="Cambiar colaborador"
                    >
                      ×
                    </button>
                  </div>
                ) : (
                  /* Campo de búsqueda */
                  <div className="relative">
                    <input
                      type="text"
                      value={formBusqueda}
                      onChange={(e) => { setFormBusqueda(e.target.value); setMostrarDropdown(true); }}
                      onFocus={() => setMostrarDropdown(true)}
                      onBlur={() => setTimeout(() => setMostrarDropdown(false), 150)}
                      placeholder="Buscar por nombre o DPI..."
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 focus:outline-none focus:border-primary/40"
                    />
                    {mostrarDropdown && empleadosFiltrados.length > 0 && (
                      <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-[#0d1f38] border border-white/10 rounded-lg shadow-xl overflow-hidden">
                        {empleadosFiltrados.map((emp) => (
                          <button
                            key={emp.id}
                            type="button"
                            onMouseDown={() => seleccionarEmpleado(emp)}
                            className="w-full text-left px-3 py-2.5 hover:bg-white/5 transition-colors border-b border-white/5 last:border-0"
                          >
                            <p className="text-sm text-white font-medium">{emp.nombreCompleto}</p>
                            <p className="text-xs text-white/40 mt-0.5">
                              {emp.puesto ?? "—"}
                              {emp.dpi ? ` · ${emp.dpi}` : ""}
                            </p>
                          </button>
                        ))}
                      </div>
                    )}
                    {mostrarDropdown && formBusqueda.length >= 1 && empleadosFiltrados.length === 0 && (
                      <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-[#0d1f38] border border-white/10 rounded-lg px-3 py-3 text-xs text-white/40">
                        Sin resultados para "{formBusqueda}"
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Panel de tope disponible (solo cuando hay colaborador seleccionado y tiene tope) */}
              {formEmpleadoId && limiteInfo?.tieneLimite && (
                <div className={`rounded-lg px-3 py-2.5 border text-xs flex items-center justify-between gap-2 ${
                  (limiteInfo.restante ?? 0) <= 0
                    ? "bg-red-400/5 border-red-400/20"
                    : "bg-primary/5 border-primary/20"
                }`}>
                  <div className="flex items-center gap-3">
                    <Wallet className={`w-3.5 h-3.5 shrink-0 ${(limiteInfo.restante ?? 0) <= 0 ? "text-red-400" : "text-primary"}`} />
                    <div>
                      <p className="text-white/70">
                        Tope: <span className="font-bold text-white">Q{(limiteInfo.limite ?? 0).toLocaleString("es-GT")}</span>
                        {" · "}Ya debe: <span className="text-yellow-400">Q{limiteInfo.solicitado.toLocaleString("es-GT")}</span>
                        {" · "}Disponible: <span className={`font-bold ${(limiteInfo.restante ?? 0) <= 0 ? "text-red-400" : "text-green-400"}`}>
                          Q{(limiteInfo.restante ?? 0).toLocaleString("es-GT")}
                        </span>
                      </p>
                      {limiteInfo.enRiesgo ? (
                        <p className="text-red-300 mt-0.5">
                          KPI en riesgo ({limiteInfo.kpiScore} pts) — sin anticipo hasta recuperar disciplina.
                        </p>
                      ) : limiteInfo.baseManual ? (
                        <p className="text-white/25 mt-0.5">Tope manual de la ficha (sin fecha de ingreso o sueldo para calcular liquidación).</p>
                      ) : (
                        <p className="text-white/25 mt-0.5">
                          30% de la liquidación acumulada (Q{(limiteInfo.liquidacionAcumulada ?? 0).toLocaleString("es-GT")})
                          {typeof limiteInfo.kpiScore === "number" ? ` × KPI ${limiteInfo.kpiScore}/100` : ""}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Advertencia si excede el límite */}
              {excedeLimite && limiteInfo && (
                <div className="bg-orange-400/5 border border-orange-400/20 rounded-lg px-3 py-2.5 flex items-start gap-2">
                  <AlertTriangle className="w-3.5 h-3.5 text-orange-400 shrink-0 mt-0.5" />
                  <div className="flex-1 text-xs">
                    <p className="text-orange-300 font-medium">El monto excede el saldo disponible</p>
                    <p className="text-white/40 mt-0.5">
                      Disponible: Q{(limiteInfo.restante ?? 0).toLocaleString("es-GT")} · Solicitado: Q{montoParsed.toLocaleString("es-GT")}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFormCantidad(String(limiteInfo.restante ?? 0))}
                    className="text-xs text-orange-400 hover:text-orange-300 whitespace-nowrap border border-orange-400/30 rounded px-2 py-1 transition-colors"
                  >
                    Ajustar a Q{(limiteInfo.restante ?? 0).toLocaleString("es-GT")}
                  </button>
                </div>
              )}

              {/* Anticipo extraordinario — solo el director puede saltar el tope */}
              {esDirector && hayRestriccionTope && (
                <button
                  type="button"
                  onClick={() => setFormExtraordinario((v) => !v)}
                  className={`w-full text-left rounded-lg px-3 py-2.5 border flex items-start gap-2 transition-colors ${
                    formExtraordinario
                      ? "bg-purple-400/10 border-purple-400/40"
                      : "bg-white/5 border-white/10 hover:border-white/20"
                  }`}
                >
                  <div className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                    formExtraordinario ? "bg-purple-400 border-purple-400" : "border-white/30"
                  }`}>
                    {formExtraordinario && <Check className="w-3 h-3 text-white" />}
                  </div>
                  <div className="flex-1 text-xs">
                    <p className={`font-medium ${formExtraordinario ? "text-purple-200" : "text-white/70"}`}>
                      Autorizar como anticipo extraordinario
                    </p>
                    <p className="text-white/40 mt-0.5">
                      Se salta el tope bajo tu responsabilidad como director. Queda registrado a tu nombre.
                    </p>
                  </div>
                </button>
              )}

              {/* Monto */}
              <div>
                <label className="block text-xs text-white/40 uppercase tracking-wider mb-1.5">
                  Monto (Q) <span className="text-red-400">*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  value={formCantidad}
                  onChange={(e) => setFormCantidad(e.target.value)}
                  placeholder="Ej: 500"
                  className={`w-full bg-white/5 border rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 focus:outline-none focus:border-primary/40 ${
                    excedeLimite ? "border-orange-400/40" : "border-white/10"
                  }`}
                />
              </div>

              {/* Puesto + DPI en fila */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-white/40 uppercase tracking-wider mb-1.5">Puesto</label>
                  <input
                    type="text"
                    value={formPuesto}
                    onChange={(e) => setFormPuesto(e.target.value)}
                    placeholder="Ej: Agente"
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 focus:outline-none focus:border-primary/40"
                  />
                </div>
                <div>
                  <label className="block text-xs text-white/40 uppercase tracking-wider mb-1.5">DPI</label>
                  <input
                    type="text"
                    value={formDpi}
                    onChange={(e) => setFormDpi(e.target.value)}
                    placeholder="No. DPI"
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 focus:outline-none focus:border-primary/40"
                  />
                </div>
              </div>

              {/* Teléfono */}
              <div>
                <label className="block text-xs text-white/40 uppercase tracking-wider mb-1.5">Teléfono</label>
                <input
                  type="text"
                  value={formTelefono}
                  onChange={(e) => setFormTelefono(e.target.value)}
                  placeholder="Ej: 50200000000"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 focus:outline-none focus:border-primary/40"
                />
              </div>

              {/* Observaciones */}
              <div>
                <label className="block text-xs text-white/40 uppercase tracking-wider mb-1.5">Observaciones</label>
                <textarea
                  value={formObservaciones}
                  onChange={(e) => setFormObservaciones(e.target.value)}
                  placeholder="Notas adicionales..."
                  rows={2}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 focus:outline-none focus:border-primary/40 resize-none"
                />
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setModalNuevo(false)}
                className="flex-1 py-2 rounded-xl bg-white/5 text-white/50 text-sm hover:bg-white/10 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => crearAnticipo()}
                disabled={creando || !formNombre.trim() || !formCantidad || parseFloat(formCantidad) <= 0}
                className="flex-1 py-2 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {creando ? "Guardando..." : "Registrar anticipo"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
