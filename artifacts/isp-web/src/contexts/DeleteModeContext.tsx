import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Trash2, X, AlertTriangle, Loader2, SendHorizontal } from "lucide-react";
import { useAuth } from "./AuthContext";

interface DeleteRequest {
  entidad: string;
  entidad_id: number;
  entidad_descripcion: string;
}

interface DeleteModeContextType {
  active: boolean;
  toggle: () => void;
  deactivate: () => void;
  requestDelete: (req: DeleteRequest) => void;
}

const DeleteModeContext = createContext<DeleteModeContextType | null>(null);

const getSession = () => sessionStorage.getItem("isp_admin_session_v2") || "";

const ENTIDAD_LABELS: Record<string, string> = {
  arma:              "Arma",
  vehiculo:          "Vehículo",
  empleado:          "Colaborador",
  cliente:           "Cliente",
  puesto:            "Puesto operativo",
  bodega_categoria:  "Categoría de bodega",
  bodega_articulo:   "Artículo de bodega",
  turno:             "Tipo de turno",
  incidencia:        "Incidencia",
};

const DELETE_MODE_KEY = "isp_delete_mode_active";

export function DeleteModeProvider({ children }: { children: ReactNode }) {
  const { currentUser } = useAuth();
  const [active, setActive] = useState(() => sessionStorage.getItem(DELETE_MODE_KEY) === "1");
  const [pending, setPending] = useState<DeleteRequest | null>(null);
  const [motivo, setMotivo] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedOk, setSavedOk] = useState(false);
  const [error, setError] = useState("");

  const toggle = useCallback(() => setActive(v => {
    const next = !v;
    if (next) sessionStorage.setItem(DELETE_MODE_KEY, "1");
    else sessionStorage.removeItem(DELETE_MODE_KEY);
    return next;
  }), []);

  const deactivate = useCallback(() => {
    sessionStorage.removeItem(DELETE_MODE_KEY);
    setActive(false);
  }, []);

  const requestDelete = useCallback((req: DeleteRequest) => {
    setMotivo("");
    setError("");
    setSavedOk(false);
    setPending(req);
  }, []);

  const closeModal = () => {
    setPending(null);
    setMotivo("");
    setError("");
    setSavedOk(false);
  };

  // ESC key closes delete mode
  useEffect(() => {
    if (!active) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (pending) closeModal();
        else setActive(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, pending]);

  async function submitRequest() {
    if (!pending) return;
    if (motivo.trim().length < 10) {
      setError("El motivo debe tener al menos 10 caracteres.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const base = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
      const r = await fetch(`${base}/api/solicitudes-eliminacion`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-isp-session": getSession() },
        body: JSON.stringify({
          entidad: pending.entidad,
          entidad_id: pending.entidad_id,
          entidad_descripcion: pending.entidad_descripcion,
          motivo: motivo.trim(),
          solicitante_username: currentUser?.username ?? "desconocido",
        }),
      });
      if (!r.ok) { const d = await r.json(); throw new Error(d.error || "Error al enviar solicitud"); }
      setSavedOk(true);
    } catch (e: any) {
      setError(e.message || "Error al enviar la solicitud");
    } finally {
      setSaving(false);
    }
  }

  return (
    <DeleteModeContext.Provider value={{ active, toggle, deactivate, requestDelete }}>
      {children}

      {/* ── Modal de solicitud de eliminación ── */}
      {pending && createPortal(
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 backdrop-blur-sm p-4"
          onClick={e => { if (e.target === e.currentTarget) closeModal(); }}
        >
          <div className="bg-gray-900 border border-red-500/30 rounded-2xl w-full max-w-md shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700/60">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-red-500/15 border border-red-500/25 rounded-xl flex items-center justify-center">
                  <Trash2 className="w-4 h-4 text-red-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">Solicitud de eliminación</p>
                  <p className="text-xs text-gray-400">{ENTIDAD_LABELS[pending.entidad] ?? pending.entidad}</p>
                </div>
              </div>
              <button onClick={closeModal} className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            {savedOk ? (
              /* ── Confirmación ── */
              <div className="p-6 text-center">
                <div className="w-12 h-12 bg-emerald-500/15 border border-emerald-500/25 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <SendHorizontal className="w-6 h-6 text-emerald-400" />
                </div>
                <p className="text-base font-semibold text-white mb-1">Solicitud enviada</p>
                <p className="text-sm text-gray-400 mb-6">
                  La solicitud ha sido registrada. Un administrador la revisará y tomará una decisión.
                </p>
                <button onClick={closeModal}
                  className="w-full py-2.5 bg-gray-700 hover:bg-gray-600 text-white text-sm font-medium rounded-lg transition-colors">
                  Cerrar
                </button>
              </div>
            ) : (
              /* ── Formulario ── */
              <div className="p-5 space-y-4">
                {/* Registro a eliminar */}
                <div className="bg-red-500/8 border border-red-500/20 rounded-lg px-4 py-3">
                  <p className="text-[10px] text-red-400/70 uppercase tracking-wider mb-1">Registro solicitado</p>
                  <p className="text-sm font-medium text-white break-words">{pending.entidad_descripcion}</p>
                </div>

                <div className="bg-amber-500/8 border border-amber-500/20 rounded-lg px-3 py-2.5 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-300/80">
                    Esta acción <strong>no elimina</strong> el registro directamente. Se crea una solicitud que debe ser aprobada por un administrador.
                  </p>
                </div>

                {/* Motivo */}
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">
                    Motivo de eliminación <span className="text-red-400">*</span>
                  </label>
                  <textarea
                    value={motivo}
                    onChange={e => { setMotivo(e.target.value); setError(""); }}
                    rows={3}
                    placeholder="Describe el motivo por el que se solicita la eliminación de este registro (mínimo 10 caracteres)..."
                    className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-red-500/60 resize-none"
                  />
                  {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
                </div>

                {/* Acciones */}
                <div className="flex gap-3 pt-1">
                  <button onClick={closeModal}
                    className="flex-1 py-2.5 text-sm text-gray-400 hover:text-white border border-gray-700 hover:border-gray-500 rounded-lg transition-colors">
                    Cancelar
                  </button>
                  <button onClick={submitRequest} disabled={saving || motivo.trim().length < 10}
                    className="flex-1 py-2.5 bg-red-600/80 hover:bg-red-600 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-40 flex items-center justify-center gap-2">
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <SendHorizontal className="w-4 h-4" />}
                    Enviar solicitud
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>,
        document.body
      )}
    </DeleteModeContext.Provider>
  );
}

export function useDeleteMode() {
  const ctx = useContext(DeleteModeContext);
  if (!ctx) {
    return {
      active: false,
      toggle: () => {},
      deactivate: () => {},
      requestDelete: (_req: DeleteRequest) => {},
    };
  }
  return ctx;
}
