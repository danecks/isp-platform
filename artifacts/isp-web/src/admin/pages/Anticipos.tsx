import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { AdminLayout } from "../layout/AdminLayout";
import { StatusBadge } from "../components/StatusBadge";
import { anticiposApi, type Anticipo } from "@/lib/api";
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
  const [editando, setEditando] = useState<Anticipo | null>(null);
  const [nuevoEstado, setNuevoEstado] = useState<string>("");
  const [observacion, setObservacion] = useState<string>("");

  const [modalNuevo, setModalNuevo] = useState(false);
  const [formNombre, setFormNombre] = useState("");
  const [formCantidad, setFormCantidad] = useState("");
  const [formPuesto, setFormPuesto] = useState("");
  const [formDpi, setFormDpi] = useState("");
  const [formTelefono, setFormTelefono] = useState("");
  const [formObservaciones, setFormObservaciones] = useState("");

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

  const { mutate: actualizarEstado, isPending: guardando } = useMutation({
    mutationFn: ({ id, estado, observaciones }: { id: number; estado: string; observaciones?: string }) =>
      anticiposApi.update(id, { estado, observaciones }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["anticipos"] });
      setEditando(null);
      toast({ title: "Estado actualizado", description: "La solicitud fue actualizada." });
    },
    onError: () => toast({ title: "Error", description: "No se pudo actualizar.", variant: "destructive" }),
  });

  const { mutate: crearAnticipo, isPending: creando } = useMutation({
    mutationFn: () =>
      anticiposApi.create({
        nombre: formNombre.trim(),
        cantidad: parseFloat(formCantidad),
        puesto: formPuesto.trim() || undefined,
        dpi: formDpi.trim() || undefined,
        telefono: formTelefono.trim() || undefined,
        observaciones: formObservaciones.trim() || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["anticipos"] });
      setModalNuevo(false);
      setFormNombre(""); setFormCantidad(""); setFormPuesto("");
      setFormDpi(""); setFormTelefono(""); setFormObservaciones("");
      toast({ title: "Anticipo creado", description: "El anticipo manual fue registrado." });
    },
    onError: () => toast({ title: "Error", description: "No se pudo crear el anticipo.", variant: "destructive" }),
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
  }

  function guardarCambio() {
    if (!editando) return;
    actualizarEstado({ id: editando.id, estado: nuevoEstado, observaciones: observacion });
  }

  const urlExport = anticiposApi.exportCsv(
    filtroEstado !== "todos" ? { estado: filtroEstado } : undefined
  );

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
              <a
                href={urlExport}
                download
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary text-xs font-medium transition-colors border border-primary/20"
              >
                <Download className="w-3.5 h-3.5" />
                Exportar CSV
              </a>
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
                    <th className="text-right px-4 py-3 font-medium">Monto</th>
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
          <div className="bg-[#0c1829] border border-white/10 rounded-2xl w-full max-w-md p-6 space-y-5">
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
                <span className="text-white/40">Monto</span>
                <span className="text-white font-bold text-lg">{fmtQ(editando.cantidad)}</span>
              </div>
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

            {/* Cambiar estado */}
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

            <div className="flex gap-3">
              <button
                onClick={() => setEditando(null)}
                className="flex-1 py-2 rounded-xl bg-white/5 text-white/50 text-sm hover:bg-white/10 transition-colors"
              >
                Cancelar
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
      )}
      {/* MODAL NUEVO ANTICIPO MANUAL */}
      {modalNuevo && (
        <div
          className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setModalNuevo(false); }}
        >
          <div className="bg-[#0c1829] border border-white/10 rounded-2xl w-full max-w-md p-6 space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-white">Nuevo anticipo manual</h2>
                <p className="text-xs text-white/40 mt-0.5">Se registrará con origen "Manual" y estado "Pendiente"</p>
              </div>
              <button onClick={() => setModalNuevo(false)} className="text-white/30 hover:text-white text-xl leading-none">×</button>
            </div>

            <div className="space-y-3">
              {/* Nombre */}
              <div>
                <label className="block text-xs text-white/40 uppercase tracking-wider mb-1.5">
                  Colaborador <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={formNombre}
                  onChange={(e) => setFormNombre(e.target.value)}
                  placeholder="Nombre completo del colaborador"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 focus:outline-none focus:border-primary/40"
                />
              </div>

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
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 focus:outline-none focus:border-primary/40"
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
