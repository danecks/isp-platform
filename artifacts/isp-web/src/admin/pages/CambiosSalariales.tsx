import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AdminLayout } from "../layout/AdminLayout";
import { useToast } from "@/hooks/use-toast";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "") + "/api";
const getSession = () => sessionStorage.getItem("isp_admin_session_v2") || "";
const hdr = () => ({ "x-isp-session": getSession(), "Content-Type": "application/json" });

function fmtQ(n: number | null | undefined) {
  if (n == null) return "—";
  return "Q" + Number(n).toLocaleString("es-GT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtFecha(d: string) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("es-GT", { year: "numeric", month: "short", day: "numeric" });
}

type CambioSalarial = {
  id: number;
  empleado_nombre: string;
  puesto_nombre: string;
  cliente_nombre: string;
  fecha: string;
  salario_actual: number;
  salario_puesto: number;
  diferencia: number;
  tipo_impacto: "aumento" | "disminucion";
  estado: "pendiente_rrhh" | "aprobado" | "rechazado" | "modificado";
  valor_aprobado: number | null;
  rrhh_notas: string | null;
  rrhh_usuario: string | null;
  rrhh_resuelto_at: string | null;
  operacion_usuario: string | null;
  tipo_movimiento: string | null;
  created_at: string;
};

type ResolverPayload = {
  estado: "aprobado" | "rechazado" | "modificado";
  valor_aprobado?: number;
  notas: string;
  usuario: string;
};

const ESTADO_LABEL: Record<string, { label: string; cls: string }> = {
  pendiente_rrhh: { label: "Pendiente RRHH", cls: "bg-amber-100 text-amber-800 border border-amber-300" },
  aprobado:       { label: "Aprobado",        cls: "bg-green-100 text-green-800 border border-green-300" },
  rechazado:      { label: "Rechazado",        cls: "bg-red-100 text-red-800 border border-red-300" },
  modificado:     { label: "Modificado",       cls: "bg-blue-100 text-blue-800 border border-blue-300" },
};

const IMPACTO_LABEL: Record<string, { label: string; cls: string }> = {
  aumento:     { label: "↑ Aumento",    cls: "text-green-700 font-semibold" },
  disminucion: { label: "↓ Disminución", cls: "text-red-700 font-semibold" },
};

type ModalState = {
  cambio: CambioSalarial;
  accion: "aprobado" | "rechazado" | "modificado" | null;
  notas: string;
  valorMod: string;
};

export default function CambiosSalariales() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [filtroEstado, setFiltroEstado] = useState("pendiente_rrhh");
  const [modal, setModal] = useState<ModalState | null>(null);

  const session = (() => { try { return JSON.parse(getSession()); } catch { return null; } })();
  const usuarioActual: string = session?.nombre ?? session?.username ?? "rrhh";

  const { data: cambios = [], isLoading } = useQuery<CambioSalarial[]>({
    queryKey: ["cambios-salariales", filtroEstado],
    queryFn: async () => {
      const url = `${API_BASE}/cambios-salariales?${filtroEstado ? `estado=${filtroEstado}` : ""}`;
      const r = await fetch(url, { headers: hdr() });
      if (!r.ok) throw new Error("Error al cargar cambios salariales");
      return r.json();
    },
  });

  const { data: badge } = useQuery<{ total: number }>({
    queryKey: ["cambios-salariales-pendientes"],
    queryFn: async () => {
      const r = await fetch(`${API_BASE}/cambios-salariales/pendientes/count`, { headers: hdr() });
      if (!r.ok) return { total: 0 };
      return r.json();
    },
    refetchInterval: 30000,
  });

  const resolver = useMutation({
    mutationFn: async ({ id, payload }: { id: number; payload: ResolverPayload }) => {
      const r = await fetch(`${API_BASE}/cambios-salariales/${id}/resolver`, {
        method: "PATCH",
        headers: hdr(),
        body: JSON.stringify(payload),
      });
      if (!r.ok) { const e = await r.json(); throw new Error(e.error ?? "Error"); }
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cambios-salariales"] });
      qc.invalidateQueries({ queryKey: ["cambios-salariales-pendientes"] });
      setModal(null);
      toast({ title: "Decisión registrada" });
    },
    onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });

  function abrirModal(cambio: CambioSalarial) {
    setModal({ cambio, accion: null, notas: "", valorMod: "" });
  }

  function confirmar() {
    if (!modal || !modal.accion) return;
    if (modal.accion === "modificado" && (!modal.valorMod || isNaN(Number(modal.valorMod)))) {
      toast({ title: "Ingresa el valor salarial aprobado", variant: "destructive" });
      return;
    }
    resolver.mutate({
      id: modal.cambio.id,
      payload: {
        estado: modal.accion,
        valor_aprobado: modal.accion === "modificado" ? Number(modal.valorMod) : undefined,
        notas: modal.notas,
        usuario: usuarioActual,
      },
    });
  }

  return (
    <AdminLayout title="Cambios Salariales">
      <div className="space-y-4">

        {/* Cabecera */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Control de Cambios Salariales</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Movimientos operativos que implican diferencia salarial — requieren autorización RRHH.
            </p>
          </div>
          {(badge?.total ?? 0) > 0 && (
            <span className="inline-flex items-center gap-1.5 bg-amber-500 text-white text-sm font-semibold px-3 py-1 rounded-full">
              <span className="w-2 h-2 rounded-full bg-white/70 animate-pulse inline-block" />
              {badge!.total} pendiente{badge!.total !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        {/* Filtro de estado */}
        <div className="flex gap-2 flex-wrap">
          {[
            { v: "pendiente_rrhh", l: "Pendientes" },
            { v: "aprobado",       l: "Aprobados" },
            { v: "rechazado",      l: "Rechazados" },
            { v: "modificado",     l: "Modificados" },
            { v: "",               l: "Todos" },
          ].map(({ v, l }) => (
            <button
              key={v}
              onClick={() => setFiltroEstado(v)}
              class={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                filtroEstado === v
                  ? "bg-gray-900 text-white border-gray-900"
                  : "bg-white text-gray-600 border-gray-300 hover:border-gray-400"
              }`}
            >
              {l}
            </button>
          ))}
        </div>

        {/* Tabla */}
        {isLoading ? (
          <div className="text-center py-12 text-gray-400">Cargando...</div>
        ) : cambios.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <div className="text-4xl mb-2">✅</div>
            <div className="font-medium">Sin cambios en esta categoría</div>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 uppercase text-xs tracking-wide">
                <tr>
                  <th className="px-4 py-3 text-left">Colaborador</th>
                  <th className="px-4 py-3 text-left">Puesto / Cliente</th>
                  <th className="px-4 py-3 text-left">Fecha</th>
                  <th className="px-4 py-3 text-right">Salario actual</th>
                  <th className="px-4 py-3 text-right">Salario puesto</th>
                  <th className="px-4 py-3 text-right">Diferencia</th>
                  <th className="px-4 py-3 text-center">Impacto</th>
                  <th className="px-4 py-3 text-center">Estado</th>
                  <th className="px-4 py-3 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {cambios.map((c) => {
                  const est = ESTADO_LABEL[c.estado] ?? { label: c.estado, cls: "" };
                  const imp = IMPACTO_LABEL[c.tipo_impacto] ?? { label: c.tipo_impacto, cls: "" };
                  return (
                    <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 font-medium text-gray-900">{c.empleado_nombre}</td>
                      <td className="px-4 py-3 text-gray-600">
                        <div>{c.puesto_nombre}</div>
                        <div className="text-xs text-gray-400">{c.cliente_nombre}</div>
                      </td>
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{fmtFecha(c.fecha)}</td>
                      <td className="px-4 py-3 text-right text-gray-700">{fmtQ(c.salario_actual)}</td>
                      <td className="px-4 py-3 text-right text-gray-700">{fmtQ(c.salario_puesto)}</td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-800">{fmtQ(c.diferencia)}</td>
                      <td className="px-4 py-3 text-center">
                        <span class={imp.cls}>{imp.label}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span class={`inline-block text-xs px-2 py-0.5 rounded-full ${est.cls}`}>
                          {est.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {c.estado === "pendiente_rrhh" ? (
                          <button
                            onClick={() => abrirModal(c)}
                            className="px-3 py-1 rounded-lg bg-gray-900 text-white text-xs font-medium hover:bg-gray-700 transition-colors"
                          >
                            Resolver
                          </button>
                        ) : (
                          <button
                            onClick={() => abrirModal(c)}
                            className="px-3 py-1 rounded-lg bg-gray-100 text-gray-600 text-xs font-medium hover:bg-gray-200 transition-colors"
                          >
                            Ver detalle
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal de resolución */}
      {modal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="px-6 pt-6 pb-4 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-900">Cambio salarial — {modal.cambio.empleado_nombre}</h3>
              <p className="text-sm text-gray-500 mt-0.5">{modal.cambio.puesto_nombre} · {modal.cambio.cliente_nombre}</p>
            </div>

            <div className="px-6 py-4 space-y-4">
              {/* Resumen */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-gray-50 rounded-xl p-3 text-center">
                  <div className="text-xs text-gray-500 mb-1">Salario actual</div>
                  <div className="font-bold text-gray-900">{fmtQ(modal.cambio.salario_actual)}</div>
                </div>
                <div className="bg-gray-50 rounded-xl p-3 text-center">
                  <div className="text-xs text-gray-500 mb-1">Salario puesto</div>
                  <div className="font-bold text-gray-900">{fmtQ(modal.cambio.salario_puesto)}</div>
                </div>
                <div class={`rounded-xl p-3 text-center ${modal.cambio.tipo_impacto === "aumento" ? "bg-green-50" : "bg-red-50"}`}>
                  <div className="text-xs text-gray-500 mb-1">Diferencia</div>
                  <div class={`font-bold ${modal.cambio.tipo_impacto === "aumento" ? "text-green-700" : "text-red-700"}`}>
                    {modal.cambio.tipo_impacto === "aumento" ? "+" : "-"}{fmtQ(modal.cambio.diferencia)}
                  </div>
                </div>
              </div>

              {/* Metadatos */}
              <div className="text-xs text-gray-500 space-y-0.5">
                <div>Fecha de movimiento: <span className="font-medium text-gray-700">{fmtFecha(modal.cambio.fecha)}</span></div>
                <div>Tipo de movimiento: <span className="font-medium text-gray-700">{modal.cambio.tipo_movimiento ?? "—"}</span></div>
                <div>Registrado por: <span className="font-medium text-gray-700">{modal.cambio.operacion_usuario ?? "—"}</span></div>
              </div>

              {/* Resolución previa */}
              {modal.cambio.estado !== "pendiente_rrhh" && (
                <div className="rounded-xl bg-blue-50 border border-blue-100 p-3 space-y-1 text-sm">
                  <div className="font-medium text-blue-800">Resolución RRHH</div>
                  <div className="text-blue-700">
                    Estado: <strong>{ESTADO_LABEL[modal.cambio.estado]?.label}</strong>
                  </div>
                  {modal.cambio.valor_aprobado != null && (
                    <div className="text-blue-700">Valor aprobado: <strong>{fmtQ(modal.cambio.valor_aprobado)}</strong></div>
                  )}
                  {modal.cambio.rrhh_notas && (
                    <div className="text-blue-600">Notas: {modal.cambio.rrhh_notas}</div>
                  )}
                  <div className="text-xs text-blue-500">
                    {modal.cambio.rrhh_usuario} · {modal.cambio.rrhh_resuelto_at ? fmtFecha(modal.cambio.rrhh_resuelto_at) : ""}
                  </div>
                </div>
              )}

              {/* Acciones (solo si pendiente) */}
              {modal.cambio.estado === "pendiente_rrhh" && (
                <>
                  <div>
                    <div className="text-sm font-medium text-gray-700 mb-2">Decisión</div>
                    <div className="flex gap-2">
                      {(["aprobado", "rechazado", "modificado"] as const).map((a) => (
                        <button
                          key={a}
                          onClick={() => setModal((m) => m ? { ...m, accion: a } : m)}
                          class={`flex-1 py-2 rounded-xl text-sm font-medium border transition-all ${
                            modal.accion === a
                              ? a === "aprobado"  ? "bg-green-600 text-white border-green-600"
                              : a === "rechazado" ? "bg-red-600 text-white border-red-600"
                              :                    "bg-blue-600 text-white border-blue-600"
                              : "bg-white text-gray-600 border-gray-300 hover:border-gray-400"
                          }`}
                        >
                          {a === "aprobado" ? "Aprobar" : a === "rechazado" ? "Rechazar" : "Modificar"}
                        </button>
                      ))}
                    </div>
                  </div>

                  {modal.accion === "modificado" && (
                    <div>
                      <label className="text-sm font-medium text-gray-700 block mb-1">Valor salarial aprobado (Q)</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={modal.valorMod}
                        onInput={(e) => setModal((m) => m ? { ...m, valorMod: (e.target as HTMLInputElement).value } : m)}
                        className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
                        placeholder="Ej: 3500.00"
                      />
                    </div>
                  )}

                  <div>
                    <label className="text-sm font-medium text-gray-700 block mb-1">Notas RRHH (opcional)</label>
                    <textarea
                      rows={2}
                      value={modal.notas}
                      onInput={(e) => setModal((m) => m ? { ...m, notas: (e.target as HTMLTextAreaElement).value } : m)}
                      className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400 resize-none"
                      placeholder="Justificación o condiciones especiales..."
                    />
                  </div>
                </>
              )}
            </div>

            <div className="px-6 pb-6 flex gap-3 justify-end">
              <button
                onClick={() => setModal(null)}
                className="px-4 py-2 rounded-xl border border-gray-300 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cerrar
              </button>
              {modal.cambio.estado === "pendiente_rrhh" && (
                <button
                  onClick={confirmar}
                  disabled={!modal.accion || resolver.isPending}
                  className="px-5 py-2 rounded-xl bg-gray-900 text-white text-sm font-medium hover:bg-gray-700 disabled:opacity-40 transition-colors"
                >
                  {resolver.isPending ? "Guardando..." : "Confirmar decisión"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
