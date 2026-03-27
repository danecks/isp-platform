import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AdminLayout } from "@/admin/layout/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { CMS_PAGES, type CmsPageSchema } from "@/lib/cmsSchema";
import {
  Globe,
  Save,
  Upload,
  FileEdit,
  CheckCircle2,
  Clock,
  ChevronRight,
  RefreshCcw,
  Info,
  Eye,
} from "lucide-react";

const API_BASE = "/api";

interface CmsAdminData {
  page_key: string;
  content: Record<string, string>;
  seo_title: string | null;
  seo_description: string | null;
  status: "draft" | "published";
  updated_by: string | null;
  updated_at: string | null;
}

interface PageListItem {
  page_key: string;
  status: "draft" | "published";
  updated_by: string | null;
  updated_at: string | null;
}

async function fetchAdminPage(key: string): Promise<CmsAdminData> {
  const res = await fetch(`${API_BASE}/cms/admin/pages/${key}`);
  if (!res.ok) throw new Error("Error al cargar página");
  return res.json();
}

async function fetchPageList(): Promise<PageListItem[]> {
  const res = await fetch(`${API_BASE}/cms/pages`);
  if (!res.ok) return [];
  return res.json();
}

async function saveDraft(key: string, body: object): Promise<void> {
  const res = await fetch(`${API_BASE}/cms/admin/pages/${key}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error("Error al guardar borrador");
}

async function publishPage(key: string, body: object): Promise<void> {
  const res = await fetch(`${API_BASE}/cms/admin/pages/${key}/publish`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error("Error al publicar página");
}

function StatusBadge({ status }: { status?: "draft" | "published" }) {
  if (status === "published") {
    return (
      <Badge className="bg-green-500/15 text-green-400 border-green-500/30 text-xs">
        <CheckCircle2 className="w-3 h-3 mr-1" /> Publicado
      </Badge>
    );
  }
  return (
    <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/30 text-xs">
      <Clock className="w-3 h-3 mr-1" /> Borrador
    </Badge>
  );
}

function formatDate(dt: string | null | undefined): string {
  if (!dt) return "—";
  try {
    return new Date(dt).toLocaleString("es-GT", {
      day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch {
    return dt;
  }
}

export default function CMS() {
  const { toast } = useToast();
  const { currentUser } = useAuth();
  const qc = useQueryClient();

  const [selectedKey, setSelectedKey] = useState<string>("_global");
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [seoTitle, setSeoTitle] = useState("");
  const [seoDesc, setSeoDesc] = useState("");
  const [isDirty, setIsDirty] = useState(false);

  const schema = CMS_PAGES.find((p) => p.pageKey === selectedKey);

  const { data: pageList = [], refetch: refetchList } = useQuery<PageListItem[]>({
    queryKey: ["cms-list"],
    queryFn: fetchPageList,
    staleTime: 30_000,
  });

  const {
    data: pageData,
    isLoading,
    refetch: refetchPage,
  } = useQuery<CmsAdminData>({
    queryKey: ["cms-admin", selectedKey],
    queryFn: () => fetchAdminPage(selectedKey),
    staleTime: 0,
  });

  useEffect(() => {
    if (pageData) {
      setFormValues(pageData.content ?? {});
      setSeoTitle(pageData.seo_title ?? "");
      setSeoDesc(pageData.seo_description ?? "");
      setIsDirty(false);
    }
  }, [pageData, selectedKey]);

  const mutDraft = useMutation({
    mutationFn: () =>
      saveDraft(selectedKey, {
        content: formValues,
        seo_title: seoTitle || null,
        seo_description: seoDesc || null,
        updated_by: currentUser?.username ?? "admin",
      }),
    onSuccess: () => {
      toast({ title: "Borrador guardado", description: "Los cambios fueron guardados como borrador." });
      setIsDirty(false);
      qc.invalidateQueries({ queryKey: ["cms-admin", selectedKey] });
      qc.invalidateQueries({ queryKey: ["cms-list"] });
      refetchList();
      refetchPage();
    },
    onError: () => {
      toast({ title: "Error", description: "No se pudo guardar el borrador.", variant: "destructive" });
    },
  });

  const mutPublish = useMutation({
    mutationFn: () =>
      publishPage(selectedKey, {
        content: formValues,
        seo_title: seoTitle || null,
        seo_description: seoDesc || null,
        updated_by: currentUser?.username ?? "admin",
      }),
    onSuccess: () => {
      toast({
        title: "Página publicada",
        description: `"${schema?.title}" está ahora visible en el sitio público.`,
      });
      setIsDirty(false);
      qc.invalidateQueries({ queryKey: ["cms", selectedKey] });
      qc.invalidateQueries({ queryKey: ["cms-admin", selectedKey] });
      qc.invalidateQueries({ queryKey: ["cms-list"] });
      refetchList();
      refetchPage();
    },
    onError: () => {
      toast({ title: "Error", description: "No se pudo publicar la página.", variant: "destructive" });
    },
  });

  const pageListStatus: Record<string, "draft" | "published"> = {};
  for (const p of pageList) pageListStatus[p.page_key] = p.status;

  function handleFieldChange(key: string, value: string) {
    setFormValues((prev) => ({ ...prev, [key]: value }));
    setIsDirty(true);
  }

  const isSaving = mutDraft.isPending || mutPublish.isPending;

  const publicPaths: Record<string, string> = {
    home: "/",
    nosotros: "/nosotros",
    servicios: "/servicios",
    "seguridad-fisica": "/servicios/seguridad-fisica",
    "custodia-transporte": "/servicios/custodia-transporte",
    sectores: "/sectores",
    reclutamiento: "/reclutamiento",
    "solicitar-servicio": "/solicitar-servicio",
    contacto: "/contacto",
    "acceso-clientes": "/acceso-clientes",
    _global: null as unknown as string,
  };

  return (
    <AdminLayout title="CMS — Gestión de Contenido Web">
      <div className="flex gap-0 h-full min-h-[calc(100vh-120px)]">
        {/* ── Sidebar de páginas ──────────────────────────────────────────── */}
        <aside className="w-64 shrink-0 border-r border-white/8 bg-[#060e1c] flex flex-col">
          <div className="px-4 py-4 border-b border-white/8">
            <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">Páginas del sitio</p>
          </div>
          <nav className="flex-1 overflow-y-auto py-2">
            {CMS_PAGES.map((page) => {
              const status = pageListStatus[page.pageKey];
              const isActive = selectedKey === page.pageKey;
              return (
                <button
                  key={page.pageKey}
                  onClick={() => {
                    if (isDirty && !confirm("Tiene cambios sin guardar. ¿Desea continuar sin guardar?")) return;
                    setSelectedKey(page.pageKey);
                    setIsDirty(false);
                  }}
                  className={`w-full flex items-center justify-between px-4 py-3 text-left transition-colors hover:bg-white/5 ${
                    isActive ? "bg-primary/10 border-r-2 border-primary" : ""
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Globe className={`w-4 h-4 shrink-0 ${isActive ? "text-primary" : "text-muted-foreground"}`} />
                    <span className={`text-sm truncate ${isActive ? "text-white font-medium" : "text-white/70"}`}>
                      {page.title}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0 ml-2">
                    {status === "published" ? (
                      <div className="w-2 h-2 rounded-full bg-green-500" title="Publicado" />
                    ) : status === "draft" ? (
                      <div className="w-2 h-2 rounded-full bg-amber-500" title="Borrador" />
                    ) : (
                      <div className="w-2 h-2 rounded-full bg-white/20" title="Sin contenido CMS" />
                    )}
                    {isActive && <ChevronRight className="w-3 h-3 text-primary" />}
                  </div>
                </button>
              );
            })}
          </nav>

          {/* Leyenda */}
          <div className="px-4 py-4 border-t border-white/8 space-y-1.5">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <div className="w-2 h-2 rounded-full bg-green-500" />
              <span>Publicado</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <div className="w-2 h-2 rounded-full bg-amber-500" />
              <span>Borrador guardado</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <div className="w-2 h-2 rounded-full bg-white/20" />
              <span>Usando texto por defecto</span>
            </div>
          </div>
        </aside>

        {/* ── Panel de edición ────────────────────────────────────────────── */}
        <main className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <RefreshCcw className="w-6 h-6 text-muted-foreground animate-spin" />
            </div>
          ) : schema ? (
            <>
              {/* Header */}
              <div className="sticky top-0 z-10 bg-[#060e1c] border-b border-white/8 px-6 py-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <FileEdit className="w-5 h-5 text-primary shrink-0" />
                  <div className="min-w-0">
                    <h2 className="font-bold text-white text-lg leading-tight">{schema.title}</h2>
                    {schema.description && (
                      <p className="text-xs text-muted-foreground truncate">{schema.description}</p>
                    )}
                  </div>
                  <StatusBadge status={pageData?.status} />
                  {isDirty && (
                    <Badge className="bg-blue-500/15 text-blue-400 border-blue-500/30 text-xs">
                      Sin guardar
                    </Badge>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {publicPaths[selectedKey] && (
                    <a
                      href={publicPaths[selectedKey]}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-white px-3 py-1.5 rounded-lg border border-white/10 hover:bg-white/5 transition"
                    >
                      <Eye className="w-3.5 h-3.5" /> Ver página
                    </a>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => mutDraft.mutate()}
                    disabled={isSaving || !isDirty}
                    className="h-9 border-white/15 text-white hover:bg-white/10"
                  >
                    <Save className="w-4 h-4 mr-1.5" />
                    {mutDraft.isPending ? "Guardando..." : "Guardar Borrador"}
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => mutPublish.mutate()}
                    disabled={isSaving}
                    className="h-9 bg-primary text-black hover:bg-primary/90 font-semibold"
                  >
                    <Upload className="w-4 h-4 mr-1.5" />
                    {mutPublish.isPending ? "Publicando..." : "Publicar"}
                  </Button>
                </div>
              </div>

              {/* Metadata */}
              {pageData?.updated_at && (
                <div className="px-6 pt-4 pb-0">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground bg-white/3 rounded-lg px-3 py-2 border border-white/5 w-fit">
                    <Info className="w-3.5 h-3.5" />
                    Última actualización por <span className="font-medium text-white/70">{pageData.updated_by ?? "—"}</span>
                    &nbsp;·&nbsp;{formatDate(pageData.updated_at)}
                  </div>
                </div>
              )}

              {/* SEO fields */}
              <div className="px-6 py-5 border-b border-white/8">
                <h3 className="text-xs uppercase tracking-widest text-primary font-semibold mb-4">
                  SEO (opcional)
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-medium text-white/60 block mb-1.5">Meta Título</label>
                    <Input
                      value={seoTitle}
                      onChange={(e) => { setSeoTitle(e.target.value); setIsDirty(true); }}
                      placeholder={`ISP, S.A. — ${schema.title}`}
                      className="h-9 text-sm bg-[#050d1a] border-white/10"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-white/60 block mb-1.5">Meta Descripción</label>
                    <Input
                      value={seoDesc}
                      onChange={(e) => { setSeoDesc(e.target.value); setIsDirty(true); }}
                      placeholder="Descripción para motores de búsqueda (160 caracteres)"
                      className="h-9 text-sm bg-[#050d1a] border-white/10"
                    />
                  </div>
                </div>
              </div>

              {/* Content sections */}
              <div className="px-6 py-6 space-y-8">
                {schema.sections.map((section) => (
                  <div key={section.sectionTitle}>
                    <div className="flex items-center gap-3 mb-4">
                      <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                        {section.sectionTitle}
                      </h3>
                      <div className="flex-1 h-px bg-white/8" />
                    </div>

                    <div className="space-y-4">
                      {section.fields.map((field) => (
                        <div key={field.key}>
                          <label className="text-xs font-medium text-white/60 block mb-1.5">
                            {field.label}
                            <span className="text-white/25 ml-2 font-normal">[{field.key}]</span>
                          </label>
                          {field.type === "textarea" ? (
                            <Textarea
                              value={formValues[field.key] ?? ""}
                              onChange={(e) => handleFieldChange(field.key, e.target.value)}
                              placeholder={field.placeholder}
                              className="min-h-[80px] text-sm bg-[#050d1a] border-white/10 resize-y"
                            />
                          ) : (
                            <Input
                              type={field.type}
                              value={formValues[field.key] ?? ""}
                              onChange={(e) => handleFieldChange(field.key, e.target.value)}
                              placeholder={field.placeholder}
                              className="h-9 text-sm bg-[#050d1a] border-white/10"
                            />
                          )}
                          {field.hint && (
                            <p className="text-xs text-muted-foreground mt-1">{field.hint}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Footer actions (duplicate for long pages) */}
              <div className="sticky bottom-0 bg-[#060e1c] border-t border-white/8 px-6 py-4 flex justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => mutDraft.mutate()}
                  disabled={isSaving || !isDirty}
                  className="h-9 border-white/15 text-white hover:bg-white/10"
                >
                  <Save className="w-4 h-4 mr-1.5" />
                  {mutDraft.isPending ? "Guardando..." : "Guardar Borrador"}
                </Button>
                <Button
                  size="sm"
                  onClick={() => mutPublish.mutate()}
                  disabled={isSaving}
                  className="h-9 bg-primary text-black hover:bg-primary/90 font-semibold"
                >
                  <Upload className="w-4 h-4 mr-1.5" />
                  {mutPublish.isPending ? "Publicando..." : "Publicar ahora"}
                </Button>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-64 text-muted-foreground">
              Seleccione una página para editar
            </div>
          )}
        </main>
      </div>
    </AdminLayout>
  );
}
