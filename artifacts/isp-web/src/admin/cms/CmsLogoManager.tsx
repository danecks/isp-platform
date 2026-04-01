import { useState, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import {
  Plus,
  Trash2,
  Upload,
  ArrowUp,
  ArrowDown,
  ImageIcon,
  Save,
  RefreshCcw,
  CheckCircle2,
  Clock,
  Building2,
  Pencil,
} from "lucide-react";

import { logoSrc } from "@/lib/logoSrc";

const API_BASE = "/api";

export interface ClientLogo {
  id: string;
  name: string;
  path: string;
}

interface Props {
  pageKey: string;
  logos: ClientLogo[];
  sectionTitle: string;
  sectionSubtitle: string;
  status?: "draft" | "published";
  updatedBy?: string | null;
  updatedAt?: string | null;
  onSaved: () => void;
}

function generateId() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

async function requestUploadUrl(file: File): Promise<{ uploadURL: string; objectPath: string }> {
  const res = await fetch(`${API_BASE}/storage/uploads/request-url`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: file.name, size: file.size, contentType: file.type }),
  });
  if (!res.ok) throw new Error("No se pudo obtener URL de carga");
  return res.json();
}

async function uploadToGCS(uploadURL: string, file: File): Promise<void> {
  const res = await fetch(uploadURL, {
    method: "PUT",
    headers: { "Content-Type": file.type },
    body: file,
  });
  if (!res.ok) throw new Error("Error al subir imagen");
}

async function saveCmsPage(
  pageKey: string,
  content: Record<string, string>,
  updatedBy: string,
  publish: boolean
): Promise<void> {
  const endpoint = publish
    ? `${API_BASE}/cms/admin/pages/${pageKey}/publish`
    : `${API_BASE}/cms/admin/pages/${pageKey}`;
  const method = publish ? "POST" : "PUT";
  const res = await fetch(endpoint, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content, updated_by: updatedBy }),
  });
  if (!res.ok) throw new Error("Error al guardar");
}

function formatDate(dt: string | null | undefined): string {
  if (!dt) return "—";
  try {
    return new Date(dt).toLocaleString("es-GT", {
      day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch { return dt; }
}

export function CmsLogoManager({
  pageKey,
  logos: initialLogos,
  sectionTitle: initialTitle,
  sectionSubtitle: initialSubtitle,
  status,
  updatedBy,
  updatedAt,
  onSaved,
}: Props) {
  const { toast } = useToast();
  const { currentUser } = useAuth();
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editFileInputRef = useRef<HTMLInputElement>(null);

  const [logos, setLogos] = useState<ClientLogo[]>(initialLogos);
  const [sectionTitle, setSectionTitle] = useState(initialTitle);
  const [sectionSubtitle, setSectionSubtitle] = useState(initialSubtitle);
  const [isDirty, setIsDirty] = useState(false);

  // ── Add dialog state ──────────────────────────────────────────────────────
  const [addDialog, setAddDialog] = useState(false);
  const [newName, setNewName] = useState("");
  const [newFile, setNewFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string>("");
  const [uploading, setUploading] = useState(false);

  // ── Edit dialog state ─────────────────────────────────────────────────────
  const [editDialog, setEditDialog] = useState(false);
  const [editTarget, setEditTarget] = useState<ClientLogo | null>(null);
  const [editName, setEditName] = useState("");
  const [editFile, setEditFile] = useState<File | null>(null);
  const [editPreview, setEditPreview] = useState<string>("");
  const [editUploading, setEditUploading] = useState(false);

  function markDirty() { setIsDirty(true); }

  // ── Add dialog ────────────────────────────────────────────────────────────
  function openAddDialog() {
    setNewName("");
    setNewFile(null);
    setPreview("");
    setAddDialog(true);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "Formato inválido", description: "Solo se permiten imágenes (PNG, JPG, SVG, WebP)", variant: "destructive" });
      return;
    }
    setNewFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  }

  async function handleAddLogo() {
    if (!newName.trim()) {
      toast({ title: "Nombre requerido", description: "Ingrese el nombre de la empresa.", variant: "destructive" });
      return;
    }
    if (!newFile) {
      toast({ title: "Imagen requerida", description: "Seleccione una imagen para el logo.", variant: "destructive" });
      return;
    }

    setUploading(true);
    try {
      const { uploadURL, objectPath } = await requestUploadUrl(newFile);
      await uploadToGCS(uploadURL, newFile);

      const newLogo: ClientLogo = {
        id: generateId(),
        name: newName.trim(),
        path: objectPath,
      };
      setLogos((prev) => [...prev, newLogo]);
      setAddDialog(false);
      markDirty();
      toast({ title: "Logo agregado", description: `Logo de "${newLogo.name}" listo. Guarde o publique para que aparezca en el sitio.` });
    } catch (err: any) {
      toast({ title: "Error al subir", description: err.message ?? "Intente nuevamente.", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  }

  // ── Edit dialog ───────────────────────────────────────────────────────────
  function openEditDialog(logo: ClientLogo) {
    setEditTarget(logo);
    setEditName(logo.name);
    setEditFile(null);
    setEditPreview("");
    setEditDialog(true);
  }

  function handleEditFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "Formato inválido", description: "Solo se permiten imágenes (PNG, JPG, SVG, WebP)", variant: "destructive" });
      return;
    }
    setEditFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setEditPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  }

  async function handleSaveEdit() {
    if (!editTarget) return;
    if (!editName.trim()) {
      toast({ title: "Nombre requerido", description: "Ingrese el nombre de la empresa.", variant: "destructive" });
      return;
    }

    setEditUploading(true);
    try {
      let newPath = editTarget.path;

      if (editFile) {
        const { uploadURL, objectPath } = await requestUploadUrl(editFile);
        await uploadToGCS(uploadURL, editFile);
        newPath = objectPath;
      }

      setLogos((prev) =>
        prev.map((l) =>
          l.id === editTarget.id
            ? { ...l, name: editName.trim(), path: newPath }
            : l
        )
      );
      setEditDialog(false);
      markDirty();
      toast({
        title: "Logo actualizado",
        description: `"${editName.trim()}" listo. Publique para que los cambios aparezcan en el sitio.`,
      });
    } catch (err: any) {
      toast({ title: "Error al guardar", description: err.message ?? "Intente nuevamente.", variant: "destructive" });
    } finally {
      setEditUploading(false);
    }
  }

  // ── Delete / reorder ──────────────────────────────────────────────────────
  function handleDelete(id: string) {
    setLogos((prev) => prev.filter((l) => l.id !== id));
    markDirty();
  }

  function handleMoveUp(idx: number) {
    if (idx === 0) return;
    const next = [...logos];
    [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
    setLogos(next);
    markDirty();
  }

  function handleMoveDown(idx: number) {
    if (idx === logos.length - 1) return;
    const next = [...logos];
    [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
    setLogos(next);
    markDirty();
  }

  function buildContent(): Record<string, string> {
    return {
      section_title: sectionTitle,
      section_subtitle: sectionSubtitle,
      logos_json: JSON.stringify(logos),
    };
  }

  const mutSave = useMutation({
    mutationFn: (publish: boolean) =>
      saveCmsPage(pageKey, buildContent(), currentUser?.username ?? "admin", publish),
    onSuccess: (_, publish) => {
      setIsDirty(false);
      toast({
        title: publish ? "Logos publicados" : "Borrador guardado",
        description: publish
          ? "Los logos ya son visibles en el sitio público."
          : "Los cambios fueron guardados como borrador.",
      });
      qc.invalidateQueries({ queryKey: ["cms-admin", pageKey] });
      qc.invalidateQueries({ queryKey: ["cms-list"] });
      qc.invalidateQueries({ queryKey: ["cms", pageKey] });
      onSaved();
    },
    onError: () => {
      toast({ title: "Error", description: "No se pudo guardar.", variant: "destructive" });
    },
  });

  const isSaving = mutSave.isPending;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-[#060e1c] border-b border-white/8">
        <div className="px-6 py-3.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Building2 className="w-4 h-4 text-primary shrink-0" />
            <div>
              <h2 className="font-bold text-white text-base">Logos de Clientes</h2>
              <p className="text-[11px] text-muted-foreground">Banda de logos en la página principal</p>
            </div>
            {status === "published" ? (
              <Badge className="bg-green-500/15 text-green-400 border-green-500/30 text-xs">
                <CheckCircle2 className="w-3 h-3 mr-1" /> Publicado
              </Badge>
            ) : (
              <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/30 text-xs">
                <Clock className="w-3 h-3 mr-1" /> Borrador
              </Badge>
            )}
            {isDirty && (
              <Badge className="bg-blue-500/15 text-blue-400 border-blue-500/30 text-xs">Sin guardar</Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => mutSave.mutate(false)}
              disabled={isSaving || !isDirty}
              className="h-8 border-white/15 text-white hover:bg-white/10 text-xs"
            >
              <Save className="w-3.5 h-3.5 mr-1.5" />
              {isSaving ? "Guardando..." : "Guardar borrador"}
            </Button>
            <Button
              size="sm"
              onClick={() => mutSave.mutate(true)}
              disabled={isSaving}
              className="h-8 bg-primary text-black hover:bg-primary/90 font-semibold text-xs"
            >
              <Upload className="w-3.5 h-3.5 mr-1.5" />
              {isSaving ? "Publicando..." : "Publicar"}
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
        {/* Última actualización */}
        {updatedAt && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground bg-white/3 rounded-lg px-3 py-2 border border-white/5 w-fit">
            <RefreshCcw className="w-3.5 h-3.5" />
            Última actualización por <span className="font-medium text-white/70">{updatedBy ?? "—"}</span>
            &nbsp;·&nbsp;{formatDate(updatedAt)}
          </div>
        )}

        {/* Textos de la sección */}
        <div className="border border-white/8 rounded-xl overflow-hidden">
          <div className="px-5 py-3.5 bg-white/3 border-b border-white/8">
            <span className="text-sm font-bold text-white uppercase tracking-wider">Encabezado de la sección</span>
          </div>
          <div className="px-5 py-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-white/60 block mb-1.5">Título</label>
              <Input
                value={sectionTitle}
                onChange={(e) => { setSectionTitle(e.target.value); markDirty(); }}
                placeholder="Empresas que Confían en ISP, S.A."
                className="h-9 text-sm bg-[#050d1a] border-white/10"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-white/60 block mb-1.5">Subtítulo</label>
              <Input
                value={sectionSubtitle}
                onChange={(e) => { setSectionSubtitle(e.target.value); markDirty(); }}
                placeholder="Más de 50 empresas líderes en Guatemala"
                className="h-9 text-sm bg-[#050d1a] border-white/10"
              />
            </div>
          </div>
        </div>

        {/* Logos actuales */}
        <div className="border border-white/8 rounded-xl overflow-hidden">
          <div className="px-5 py-3.5 bg-white/3 border-b border-white/8 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-white uppercase tracking-wider">Logos</span>
              <span className="text-[10px] text-white/30 bg-white/5 border border-white/8 px-2 py-0.5 rounded-full">
                {logos.length} {logos.length === 1 ? "empresa" : "empresas"}
              </span>
            </div>
            <Button
              size="sm"
              onClick={openAddDialog}
              className="h-7 bg-primary/15 border border-primary/30 text-primary hover:bg-primary/25 text-xs font-medium px-3"
            >
              <Plus className="w-3.5 h-3.5 mr-1.5" /> Agregar logo
            </Button>
          </div>

          {logos.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <ImageIcon className="w-10 h-10 text-white/15 mx-auto mb-3" />
              <p className="text-sm text-white/40">No hay logos aún.</p>
              <p className="text-xs text-white/25 mt-1">Haga clic en "Agregar logo" para comenzar.</p>
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {logos.map((logo, idx) => (
                <div key={logo.id} className="flex items-center gap-4 px-5 py-3 hover:bg-white/3 transition-colors">
                  {/* Preview */}
                  <div className="w-16 h-10 rounded-lg bg-white/5 border border-white/8 flex items-center justify-center overflow-hidden shrink-0">
                    <img
                      src={logoSrc(logo.path)}
                      alt={logo.name}
                      className="max-w-full max-h-full object-contain"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                      }}
                    />
                  </div>

                  {/* Name */}
                  <span className="flex-1 text-sm text-white/80 font-medium truncate">{logo.name}</span>

                  {/* Controls */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => handleMoveUp(idx)}
                      disabled={idx === 0}
                      className="p-1.5 rounded hover:bg-white/8 text-white/30 hover:text-white/70 disabled:opacity-20 transition-colors"
                      title="Mover arriba"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleMoveDown(idx)}
                      disabled={idx === logos.length - 1}
                      className="p-1.5 rounded hover:bg-white/8 text-white/30 hover:text-white/70 disabled:opacity-20 transition-colors"
                      title="Mover abajo"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => openEditDialog(logo)}
                      className="p-1.5 rounded hover:bg-primary/15 text-white/30 hover:text-primary transition-colors"
                      title="Editar logo"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(logo.id)}
                      className="p-1.5 rounded hover:bg-red-500/15 text-white/30 hover:text-red-400 transition-colors"
                      title="Eliminar"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Preview visual */}
        {logos.length > 0 && (
          <div className="border border-white/8 rounded-xl overflow-hidden">
            <div className="px-5 py-3.5 bg-white/3 border-b border-white/8">
              <span className="text-sm font-bold text-white uppercase tracking-wider">Vista previa de la banda</span>
            </div>
            <div className="px-5 py-6 bg-[#050d1a]">
              <p className="text-[10px] text-white/30 text-center mb-4 uppercase tracking-widest">
                {sectionTitle || "Empresas que Confían en ISP, S.A."}
              </p>
              <div className="flex flex-wrap gap-4 items-center justify-center">
                {logos.map((logo) => (
                  <div
                    key={logo.id}
                    className="h-10 px-4 bg-white/5 border border-white/8 rounded-lg flex items-center justify-center"
                  >
                    <img
                      src={logoSrc(logo.path)}
                      alt={logo.name}
                      className="max-h-8 max-w-[100px] object-contain opacity-70"
                      onError={(e) => {
                        const el = e.target as HTMLImageElement;
                        el.style.display = "none";
                        (el.parentElement as HTMLElement).innerHTML = `<span class="text-xs text-white/40">${logo.name}</span>`;
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Sticky footer */}
      <div className="sticky bottom-0 bg-[#060e1c] border-t border-white/8 px-6 py-3.5 flex justify-end gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => mutSave.mutate(false)}
          disabled={isSaving || !isDirty}
          className="h-8 border-white/15 text-white hover:bg-white/10 text-xs"
        >
          <Save className="w-3.5 h-3.5 mr-1.5" />
          {isSaving ? "Guardando..." : "Guardar borrador"}
        </Button>
        <Button
          size="sm"
          onClick={() => mutSave.mutate(true)}
          disabled={isSaving}
          className="h-8 bg-primary text-black hover:bg-primary/90 font-semibold text-xs"
        >
          <Upload className="w-3.5 h-3.5 mr-1.5" />
          {isSaving ? "Publicando..." : "Publicar ahora"}
        </Button>
      </div>

      {/* ── Add Logo Dialog ────────────────────────────────────────────── */}
      {addDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="bg-[#07111f] border border-white/12 rounded-2xl w-full max-w-md mx-4 shadow-2xl">
            <div className="px-6 py-4 border-b border-white/8 flex items-center justify-between">
              <h3 className="font-bold text-white">Agregar logo de empresa</h3>
              <button
                onClick={() => setAddDialog(false)}
                className="text-white/40 hover:text-white transition-colors text-lg leading-none"
                aria-label="Cerrar"
              >
                ✕
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="text-xs font-medium text-white/60 block mb-1.5">Nombre de la empresa *</label>
                <Input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Ej: Banco Industrial"
                  className="h-9 text-sm bg-[#050d1a] border-white/10"
                  autoFocus
                />
              </div>

              <div>
                <label className="text-xs font-medium text-white/60 block mb-1.5">Imagen del logo *</label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />

                {preview ? (
                  <div className="relative group">
                    <div className="w-full h-28 bg-white rounded-xl flex items-center justify-center overflow-hidden border border-white/10">
                      <img src={preview} alt="preview" className="max-h-24 max-w-full object-contain" />
                    </div>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="absolute inset-0 rounded-xl bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-xs text-white font-medium"
                    >
                      Cambiar imagen
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full h-28 border-2 border-dashed border-white/15 rounded-xl flex flex-col items-center justify-center gap-2 hover:border-primary/50 hover:bg-primary/5 transition-colors"
                  >
                    <ImageIcon className="w-6 h-6 text-white/30" />
                    <span className="text-xs text-white/40">Clic para seleccionar imagen</span>
                    <span className="text-[10px] text-white/25">PNG, JPG, SVG, WebP — Recomendado: fondo blanco o transparente</span>
                  </button>
                )}
              </div>
            </div>

            <div className="px-6 pb-5 flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setAddDialog(false)}
                disabled={uploading}
                className="h-9 border-white/15 text-white hover:bg-white/10"
              >
                Cancelar
              </Button>
              <Button
                size="sm"
                onClick={handleAddLogo}
                disabled={uploading || !newName.trim() || !newFile}
                className="h-9 bg-primary text-black hover:bg-primary/90 font-semibold"
              >
                {uploading ? (
                  <><RefreshCcw className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Subiendo...</>
                ) : (
                  <><Plus className="w-3.5 h-3.5 mr-1.5" /> Agregar</>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit Logo Dialog ───────────────────────────────────────────── */}
      {editDialog && editTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="bg-[#07111f] border border-white/12 rounded-2xl w-full max-w-md mx-4 shadow-2xl">
            <div className="px-6 py-4 border-b border-white/8 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-white">Editar logo</h3>
                <p className="text-xs text-white/40 mt-0.5">Cambie el nombre o reemplace la imagen</p>
              </div>
              <button
                onClick={() => setEditDialog(false)}
                className="text-white/40 hover:text-white transition-colors text-lg leading-none"
                aria-label="Cerrar"
              >
                ✕
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              {/* Company name */}
              <div>
                <label className="text-xs font-medium text-white/60 block mb-1.5">Nombre de la empresa *</label>
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="h-9 text-sm bg-[#050d1a] border-white/10"
                  autoFocus
                />
              </div>

              {/* Image replacement */}
              <div>
                <label className="text-xs font-medium text-white/60 block mb-1.5">Imagen del logo</label>
                <input
                  ref={editFileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleEditFileChange}
                  className="hidden"
                />

                {editPreview ? (
                  /* New image selected */
                  <div className="relative group">
                    <div className="w-full h-28 bg-white rounded-xl flex items-center justify-center overflow-hidden border border-white/10">
                      <img src={editPreview} alt="nueva imagen" className="max-h-24 max-w-full object-contain" />
                    </div>
                    <button
                      onClick={() => editFileInputRef.current?.click()}
                      className="absolute inset-0 rounded-xl bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-xs text-white font-medium"
                    >
                      Cambiar imagen
                    </button>
                    <p className="text-[10px] text-green-400 mt-1.5 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Nueva imagen lista para subir
                    </p>
                  </div>
                ) : (
                  /* Show current logo + option to replace */
                  <div className="space-y-2">
                    <div className="w-full h-20 bg-white/8 border border-white/10 rounded-xl flex items-center justify-center gap-3 overflow-hidden">
                      <img
                        src={logoSrc(editTarget.path)}
                        alt={editTarget.name}
                        className="max-h-14 max-w-[120px] object-contain"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = "none";
                        }}
                      />
                      <span className="text-xs text-white/30">Logo actual</span>
                    </div>
                    <button
                      onClick={() => editFileInputRef.current?.click()}
                      className="w-full h-10 border border-dashed border-white/15 rounded-lg flex items-center justify-center gap-2 hover:border-primary/50 hover:bg-primary/5 transition-colors text-xs text-white/40 hover:text-primary"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      Reemplazar con nueva imagen
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="px-6 pb-5 flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditDialog(false)}
                disabled={editUploading}
                className="h-9 border-white/15 text-white hover:bg-white/10"
              >
                Cancelar
              </Button>
              <Button
                size="sm"
                onClick={handleSaveEdit}
                disabled={editUploading || !editName.trim()}
                className="h-9 bg-primary text-black hover:bg-primary/90 font-semibold"
              >
                {editUploading ? (
                  <><RefreshCcw className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Guardando...</>
                ) : (
                  <><Save className="w-3.5 h-3.5 mr-1.5" /> Guardar cambios</>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
