/**
 * CerrarTareaModal — Cierre de tarea con evidencia real
 *
 * CAMPOS OBLIGATORIOS:
 *   - comentario (texto libre, mínimo 10 caracteres)
 *   - foto (imagen, máx 5 MB)
 *
 * PERMISOS:
 *   - Solo supervisor y admin pueden cerrar tareas
 *   - Se valida en cliente y en servidor
 *
 * A-06: La foto se sube a GCS vía URL presignada. Solo se guarda la URL en la DB,
 * no el contenido base64.
 */

import { useState, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  X, CheckCircle, Upload, Camera, AlertTriangle,
  FileText, User, Calendar, Clock, Loader2
} from "lucide-react";
import { tareasApi, type Tarea } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

interface Props {
  tarea: Tarea;
  onClose: () => void;
  onCerrada: (tareaActualizada: Tarea) => void;
}

const PRIORIDAD_COLOR: Record<string, string> = {
  alta: "text-red-400 bg-red-500/10 border-red-500/20",
  media: "text-yellow-400 bg-yellow-500/10 border-yellow-500/20",
  baja: "text-green-400 bg-green-500/10 border-green-500/20",
};

const ESTADO_COLOR: Record<string, string> = {
  pendiente: "text-yellow-400",
  en_proceso: "text-blue-400",
  completada: "text-green-400",
  cancelada: "text-white/30",
};

const MAX_FOTO_BYTES = 5 * 1024 * 1024; // 5 MB (GCS no tiene la limitación de la DB)

const getSession = () => sessionStorage.getItem("isp_admin_session_v2") || "";
const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

/**
 * Sube un archivo a GCS vía presigned URL en dos pasos:
 * 1. Solicita URL presignada al servidor
 * 2. Sube el archivo directamente a GCS
 * Devuelve el objectPath para usar como fotoUrl en la API.
 */
async function uploadFotoGCS(file: File): Promise<string> {
  // Paso 1: solicitar URL presignada
  const urlRes = await fetch(`${BASE}/api/storage/uploads/request-url`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-isp-session": getSession(),
    },
    body: JSON.stringify({
      name: file.name,
      size: file.size,
      contentType: file.type,
    }),
  });
  if (!urlRes.ok) {
    const err = await urlRes.json().catch(() => ({}));
    throw new Error(err.error ?? "No se pudo obtener la URL de carga");
  }
  const { uploadURL, objectPath } = await urlRes.json();

  // Paso 2: subir el archivo directo a GCS
  const gcsRes = await fetch(uploadURL, {
    method: "PUT",
    headers: { "Content-Type": file.type },
    body: file,
  });
  if (!gcsRes.ok) {
    throw new Error("Error al subir la foto al almacenamiento");
  }

  // objectPath es la ruta para servir desde la API: /objects/uploads/<uuid>
  return `${BASE}/api/storage${objectPath}`;
}

export default function CerrarTareaModal({ tarea, onClose, onCerrada }: Props) {
  const { currentUser: user } = useAuth();
  const [comentario, setComentario] = useState("");
  const [fotoPreview, setFotoPreview] = useState<string | null>(null);
  const [fotoFile, setFotoFile] = useState<File | null>(null);
  const [fotoNombre, setFotoNombre] = useState<string>("");
  const [errors, setErrors] = useState<{ comentario?: string; foto?: string; general?: string }>({});
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<"idle" | "uploading" | "done">("idle");
  const [exito, setExito] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Verificar permiso — solo supervisor y admin
  const tienePermiso = user && ["supervisor", "admin"].includes(user.rol ?? "");

  const handleFotoChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_FOTO_BYTES) {
      setErrors((prev) => ({ ...prev, foto: `La imagen supera el tamaño máximo (5 MB). Tamaño: ${(file.size / 1024 / 1024).toFixed(1)} MB` }));
      e.target.value = "";
      return;
    }

    if (!file.type.startsWith("image/")) {
      setErrors((prev) => ({ ...prev, foto: "Solo se permiten archivos de imagen (JPG, PNG, WEBP)" }));
      e.target.value = "";
      return;
    }

    setErrors((prev) => ({ ...prev, foto: undefined }));
    setFotoNombre(file.name);
    setFotoFile(file);

    // Vista previa usando Object URL (no base64 — no carga la RAM)
    const previewUrl = URL.createObjectURL(file);
    setFotoPreview(previewUrl);
  }, []);

  const limpiarFoto = useCallback(() => {
    if (fotoPreview) URL.revokeObjectURL(fotoPreview);
    setFotoPreview(null);
    setFotoFile(null);
    setFotoNombre("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [fotoPreview]);

  const validate = () => {
    const errs: typeof errors = {};
    if (!comentario.trim() || comentario.trim().length < 10) {
      errs.comentario = "El comentario debe tener al menos 10 caracteres";
    }
    if (!fotoFile) {
      errs.foto = "La foto de evidencia es obligatoria";
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    if (!tienePermiso) {
      setErrors({ general: "No tiene permiso para cerrar tareas" });
      return;
    }

    setLoading(true);
    setErrors({});
    setUploadProgress("uploading");

    try {
      // A-06: Subir foto a GCS primero — no guardar base64 en la DB
      const fotoUrl = await uploadFotoGCS(fotoFile!);
      setUploadProgress("done");

      const result = await tareasApi.cerrar(tarea.id, {
        supervisorNombre: user?.nombre ?? "Supervisor",
        supervisorId: user?.id,
        rolSupervisor: user?.rol ?? "supervisor",
        comentario: comentario.trim(),
        fotoUrl,
        canal: "admin",
      });

      setExito(true);
      setTimeout(() => {
        onCerrada(result.tarea);
        onClose();
      }, 1800);
    } catch (err: any) {
      setUploadProgress("idle");
      setErrors({ general: err.message ?? "Error al cerrar la tarea" });
    } finally {
      setLoading(false);
    }
  };

  const fmtFecha = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString("es-GT", { day: "2-digit", month: "short", year: "numeric" });
  };

  const modal = (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="relative z-10 w-full max-w-lg bg-[#0a1525] border border-green-500/25 rounded-2xl shadow-2xl shadow-green-500/5 flex flex-col max-h-[90vh] overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-green-500/15 border border-green-500/25 flex items-center justify-center">
              <CheckCircle className="w-4 h-4 text-green-400" />
            </div>
            <div>
              <p className="text-sm font-bold text-white">Cerrar Tarea con Evidencia</p>
              <p className="text-[10px] text-white/35">Foto + comentario obligatorios</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/30 hover:text-white/70 transition-colors p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Contenido scrollable */}
        <div className="overflow-y-auto flex-1">
          <div className="px-6 py-5 space-y-5">

            {/* Sin permiso */}
            {!tienePermiso && (
              <div className="flex items-start gap-3 bg-red-500/8 border border-red-500/20 rounded-xl p-3">
                <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
                <p className="text-xs text-red-300">
                  Solo <strong>supervisores</strong> y <strong>administradores</strong> pueden cerrar tareas con evidencia. Su rol actual ({user?.rol}) no tiene este permiso.
                </p>
              </div>
            )}

            {/* Detalle de la tarea */}
            <div className="bg-white/3 border border-white/6 rounded-xl p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <p className="text-[10px] text-white/35 mb-1 font-mono">{tarea.id}</p>
                  <p className="text-sm font-semibold text-white leading-tight">{tarea.titulo}</p>
                  {tarea.descripcion && (
                    <p className="text-[11px] text-white/45 mt-1 leading-relaxed">{tarea.descripcion}</p>
                  )}
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded border font-medium shrink-0 ${PRIORIDAD_COLOR[tarea.prioridad] ?? "text-white/40 bg-white/5 border-white/10"}`}>
                  {tarea.prioridad}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/5">
                <div className="flex items-center gap-2">
                  <User className="w-3 h-3 text-white/30" />
                  <span className="text-[11px] text-white/50">{tarea.asignado ?? "Sin asignar"}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="w-3 h-3 text-white/30" />
                  <span className="text-[11px] text-white/50">{fmtFecha(tarea.createdAt)}</span>
                </div>
                {tarea.incidenciaId && (
                  <div className="flex items-center gap-2 col-span-2">
                    <FileText className="w-3 h-3 text-red-400/60" />
                    <span className="text-[11px] text-red-400/70 font-mono">{tarea.incidenciaId}</span>
                  </div>
                )}
                <div className="flex items-center gap-2 col-span-2">
                  <Clock className="w-3 h-3 text-white/30" />
                  <span className={`text-[11px] font-medium ${ESTADO_COLOR[tarea.estado] ?? "text-white/50"}`}>
                    Estado actual: {tarea.estado.replace("_", " ")}
                  </span>
                </div>
              </div>
            </div>

            {/* Supervisor (read-only) */}
            <div>
              <label className="block text-[11px] text-white/50 mb-1.5 font-medium">
                Supervisor que cierra
              </label>
              <div className="flex items-center gap-2 bg-white/4 border border-white/8 rounded-lg px-3 py-2.5">
                <User className="w-3.5 h-3.5 text-white/30" />
                <span className="text-sm text-white/80">{user?.nombre ?? "—"}</span>
                <span className="ml-auto text-[10px] text-white/30 bg-white/5 px-2 py-0.5 rounded-full">{user?.rol}</span>
              </div>
            </div>

            {/* Foto de evidencia */}
            <div>
              <label className="block text-[11px] text-white/50 mb-1.5 font-medium">
                Foto de evidencia <span className="text-red-400">*</span>
              </label>

              {fotoPreview ? (
                <div className="relative rounded-xl overflow-hidden border border-white/10">
                  <img
                    src={fotoPreview}
                    alt="Evidencia"
                    className="w-full max-h-48 object-cover"
                  />
                  <button
                    onClick={limpiarFoto}
                    className="absolute top-2 right-2 bg-black/60 text-white/70 hover:text-white rounded-full p-1 transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent px-3 py-2">
                    <p className="text-[10px] text-white/60 truncate">{fotoNombre}</p>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className={`w-full border-2 border-dashed rounded-xl p-6 flex flex-col items-center gap-2 transition-all cursor-pointer ${
                    errors.foto
                      ? "border-red-500/40 bg-red-500/5 hover:bg-red-500/8"
                      : "border-white/10 bg-white/2 hover:bg-white/4 hover:border-white/20"
                  }`}
                >
                  <Camera className="w-6 h-6 text-white/30" />
                  <div className="text-center">
                    <p className="text-xs text-white/50 font-medium">Cargar foto de evidencia</p>
                    <p className="text-[10px] text-white/25 mt-0.5">JPG, PNG, WEBP — máx. 5 MB</p>
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px] text-primary/70 bg-primary/8 border border-primary/15 px-3 py-1 rounded-full">
                    <Upload className="w-3 h-3" />
                    Seleccionar imagen
                  </div>
                </button>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFotoChange}
              />

              {errors.foto && (
                <p className="text-[10px] text-red-400 mt-1.5 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  {errors.foto}
                </p>
              )}

              {/* Indicador de subida */}
              {uploadProgress === "uploading" && (
                <div className="mt-2 flex items-center gap-2 text-[11px] text-primary/80 bg-primary/8 border border-primary/15 rounded-lg px-3 py-2">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Subiendo foto al almacenamiento seguro…
                </div>
              )}
              {uploadProgress === "done" && (
                <div className="mt-2 flex items-center gap-2 text-[11px] text-emerald-400/80 bg-emerald-400/8 border border-emerald-400/20 rounded-lg px-3 py-2">
                  <CheckCircle className="w-3 h-3" />
                  Foto cargada correctamente
                </div>
              )}
            </div>

            {/* Comentario de cierre */}
            <div>
              <label className="block text-[11px] text-white/50 mb-1.5 font-medium">
                Comentario de cierre <span className="text-red-400">*</span>
              </label>
              <textarea
                value={comentario}
                onChange={(e) => {
                  setComentario(e.target.value);
                  if (errors.comentario) setErrors((p) => ({ ...p, comentario: undefined }));
                }}
                rows={4}
                placeholder="Describa qué se realizó, el estado final de la situación y cualquier observación relevante..."
                className={`w-full rounded-lg px-3 py-2.5 text-sm text-white bg-white/4 border outline-none transition-all resize-none placeholder-white/20 ${
                  errors.comentario
                    ? "border-red-500/40 focus:border-red-500/60"
                    : "border-white/8 focus:border-primary/40 focus:bg-white/5"
                }`}
              />
              <div className="flex items-center justify-between mt-1">
                {errors.comentario ? (
                  <p className="text-[10px] text-red-400 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    {errors.comentario}
                  </p>
                ) : (
                  <span />
                )}
                <span className={`text-[10px] ${comentario.length < 10 ? "text-white/20" : "text-white/40"}`}>
                  {comentario.length} caracteres
                </span>
              </div>
            </div>

            {/* Error general */}
            {errors.general && (
              <div className="flex items-start gap-2 bg-red-500/8 border border-red-500/20 rounded-lg px-3 py-2.5">
                <AlertTriangle className="w-3.5 h-3.5 text-red-400 mt-0.5 shrink-0" />
                <p className="text-xs text-red-300">{errors.general}</p>
              </div>
            )}

            {/* Éxito */}
            {exito && (
              <div className="flex items-center gap-2 bg-green-500/10 border border-green-500/25 rounded-lg px-3 py-3">
                <CheckCircle className="w-4 h-4 text-green-400 shrink-0" />
                <p className="text-sm text-green-300 font-medium">¡Tarea cerrada con evidencia exitosamente!</p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/6 flex items-center gap-3">
          <button
            onClick={onClose}
            disabled={loading || exito}
            className="flex-1 py-2.5 text-sm text-white/50 bg-white/4 hover:bg-white/6 border border-white/8 rounded-xl transition-all disabled:opacity-40"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading || exito || !tienePermiso}
            className="flex-1 py-2.5 text-sm font-bold text-black bg-green-400 hover:bg-green-300 rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {uploadProgress === "uploading" ? "Subiendo foto…" : "Guardando…"}
              </>
            ) : exito ? (
              <>
                <CheckCircle className="w-4 h-4" />
                ¡Cerrada!
              </>
            ) : (
              <>
                <CheckCircle className="w-4 h-4" />
                Cerrar con Evidencia
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
