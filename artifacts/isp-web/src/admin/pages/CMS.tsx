import { useState, useEffect, useRef, useCallback } from "react";
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
  ChevronDown,
  ChevronUp,
  Settings,
  Home,
  Shield,
  Truck,
  Building2,
  Users,
  Phone,
  UserCheck,
  ClipboardList,
  Key,
  Layers,
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

// ── Iconos por página ─────────────────────────────────────────────────────────
const PAGE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  _global:              Settings,
  home:                 Home,
  nosotros:             Building2,
  servicios:            Layers,
  "seguridad-fisica":   Shield,
  "custodia-transporte": Truck,
  sectores:             Users,
  reclutamiento:        UserCheck,
  "solicitar-servicio": ClipboardList,
  contacto:             Phone,
  "acceso-clientes":    Key,
};

// ── Categorías para el sidebar ────────────────────────────────────────────────
const SIDEBAR_GROUPS = [
  {
    label: "Elementos globales",
    keys: ["_global"],
  },
  {
    label: "Páginas principales",
    keys: ["home", "nosotros", "servicios"],
  },
  {
    label: "Servicios",
    keys: ["seguridad-fisica", "custodia-transporte", "sectores"],
  },
  {
    label: "Otras páginas",
    keys: ["reclutamiento", "solicitar-servicio", "contacto", "acceso-clientes"],
  },
];

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

// ── Sección colapsable ────────────────────────────────────────────────────────
function SectionBlock({
  sectionTitle,
  fieldCount,
  sectionId,
  children,
  defaultOpen = true,
}: {
  sectionTitle: string;
  fieldCount: number;
  sectionId: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div id={sectionId} className="border border-white/8 rounded-xl overflow-hidden">
      {/* Section header — clickable */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-3.5 bg-white/3 hover:bg-white/5 transition-colors text-left group"
      >
        <div className="flex items-center gap-3">
          <span className="text-sm font-bold text-white uppercase tracking-wider">
            {sectionTitle}
          </span>
          <span className="text-[10px] text-white/30 bg-white/5 border border-white/8 px-2 py-0.5 rounded-full">
            {fieldCount} {fieldCount === 1 ? "campo" : "campos"}
          </span>
        </div>
        {open
          ? <ChevronUp className="w-4 h-4 text-white/30 group-hover:text-white/60 transition-colors" />
          : <ChevronDown className="w-4 h-4 text-white/30 group-hover:text-white/60 transition-colors" />
        }
      </button>

      {/* Fields */}
      {open && (
        <div className="px-5 py-4 space-y-4">
          {children}
        </div>
      )}
    </div>
  );
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
  const [activeSection, setActiveSection] = useState<string>("");
  const mainRef = useRef<HTMLDivElement>(null);

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

  // Reset active section when page changes
  useEffect(() => {
    setActiveSection(schema?.sections[0]?.sectionTitle ?? "");
  }, [selectedKey, schema]);

  // Scroll to section
  const scrollToSection = useCallback((sectionTitle: string) => {
    const id = `section-${sectionTitle.replace(/\s+/g, "-").toLowerCase()}`;
    const el = document.getElementById(id);
    if (el && mainRef.current) {
      const top = el.offsetTop - 130;
      mainRef.current.scrollTo({ top, behavior: "smooth" });
    }
    setActiveSection(sectionTitle);
  }, []);

  // Track which section is visible on scroll
  useEffect(() => {
    const container = mainRef.current;
    if (!container || !schema) return;

    const onScroll = () => {
      const containerTop = container.scrollTop + 140;
      for (const section of [...schema.sections].reverse()) {
        const id = `section-${section.sectionTitle.replace(/\s+/g, "-").toLowerCase()}`;
        const el = document.getElementById(id);
        if (el && el.offsetTop <= containerTop) {
          setActiveSection(section.sectionTitle);
          return;
        }
      }
      setActiveSection(schema.sections[0]?.sectionTitle ?? "");
    };

    container.addEventListener("scroll", onScroll, { passive: true });
    return () => container.removeEventListener("scroll", onScroll);
  }, [schema, selectedKey]);

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

        {/* ── Sidebar ──────────────────────────────────────────────────────── */}
        <aside className="w-60 shrink-0 border-r border-white/8 bg-[#060e1c] flex flex-col">
          <div className="px-4 py-3.5 border-b border-white/8">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Gestión de contenido</p>
          </div>

          <nav className="flex-1 overflow-y-auto py-2">
            {SIDEBAR_GROUPS.map((group) => {
              const pages = CMS_PAGES.filter((p) => group.keys.includes(p.pageKey));
              if (pages.length === 0) return null;
              return (
                <div key={group.label} className="mb-1">
                  {/* Category label */}
                  <p className="px-4 pt-3 pb-1 text-[9px] uppercase tracking-widest text-white/25 font-bold">
                    {group.label}
                  </p>
                  {pages.map((page) => {
                    const status = pageListStatus[page.pageKey];
                    const isActive = selectedKey === page.pageKey;
                    const Icon = PAGE_ICONS[page.pageKey] ?? Globe;
                    return (
                      <button
                        key={page.pageKey}
                        onClick={() => {
                          if (isDirty && !confirm("Tiene cambios sin guardar. ¿Desea continuar sin guardar?")) return;
                          setSelectedKey(page.pageKey);
                          setIsDirty(false);
                        }}
                        className={`w-full flex items-center justify-between px-4 py-2.5 text-left transition-colors hover:bg-white/5 ${
                          isActive ? "bg-primary/10 border-r-2 border-primary" : ""
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <Icon className={`w-3.5 h-3.5 shrink-0 ${isActive ? "text-primary" : "text-white/30"}`} />
                          <span className={`text-xs truncate ${isActive ? "text-white font-medium" : "text-white/60"}`}>
                            {page.title}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0 ml-2">
                          {status === "published" ? (
                            <div className="w-1.5 h-1.5 rounded-full bg-green-500" title="Publicado" />
                          ) : status === "draft" ? (
                            <div className="w-1.5 h-1.5 rounded-full bg-amber-500" title="Borrador" />
                          ) : (
                            <div className="w-1.5 h-1.5 rounded-full bg-white/15" title="Sin contenido CMS" />
                          )}
                          {isActive && <ChevronRight className="w-3 h-3 text-primary" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </nav>

          {/* Leyenda */}
          <div className="px-4 py-3.5 border-t border-white/8 space-y-1.5">
            <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
              <div className="w-1.5 h-1.5 rounded-full bg-green-500" />Publicado
            </div>
            <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
              <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />Borrador guardado
            </div>
            <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
              <div className="w-1.5 h-1.5 rounded-full bg-white/15" />Texto por defecto
            </div>
          </div>
        </aside>

        {/* ── Panel de edición ─────────────────────────────────────────────── */}
        <main ref={mainRef} className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <RefreshCcw className="w-6 h-6 text-muted-foreground animate-spin" />
            </div>
          ) : schema ? (
            <>
              {/* ── Header ─────────────────────────────────────────────────── */}
              <div className="sticky top-0 z-10 bg-[#060e1c] border-b border-white/8">
                {/* Title row */}
                <div className="px-6 py-3.5 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    {(() => {
                      const Icon = PAGE_ICONS[selectedKey] ?? FileEdit;
                      return <Icon className="w-4 h-4 text-primary shrink-0" />;
                    })()}
                    <div className="min-w-0">
                      <h2 className="font-bold text-white text-base leading-tight">{schema.title}</h2>
                      {schema.description && (
                        <p className="text-[11px] text-muted-foreground truncate">{schema.description}</p>
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
                      className="h-8 border-white/15 text-white hover:bg-white/10 text-xs"
                    >
                      <Save className="w-3.5 h-3.5 mr-1.5" />
                      {mutDraft.isPending ? "Guardando..." : "Guardar borrador"}
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => mutPublish.mutate()}
                      disabled={isSaving}
                      className="h-8 bg-primary text-black hover:bg-primary/90 font-semibold text-xs"
                    >
                      <Upload className="w-3.5 h-3.5 mr-1.5" />
                      {mutPublish.isPending ? "Publicando..." : "Publicar"}
                    </Button>
                  </div>
                </div>

                {/* ── Section jump bar ───────────────────────────────────────── */}
                {schema.sections.length > 1 && (
                  <div className="flex items-center gap-1 px-6 pb-2.5 overflow-x-auto">
                    {schema.sections.map((section, idx) => {
                      const isActive = activeSection === section.sectionTitle;
                      return (
                        <button
                          key={section.sectionTitle}
                          onClick={() => scrollToSection(section.sectionTitle)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all shrink-0 ${
                            isActive
                              ? "bg-primary/20 border border-primary/40 text-primary"
                              : "bg-white/4 border border-white/8 text-white/50 hover:bg-white/8 hover:text-white/80"
                          }`}
                        >
                          <span className="w-4 h-4 rounded-full bg-white/10 flex items-center justify-center text-[9px] font-bold shrink-0">
                            {idx + 1}
                          </span>
                          {section.sectionTitle}
                          <span className="text-[9px] opacity-50">({section.fields.length})</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* ── Metadata info bar ─────────────────────────────────────── */}
              {pageData?.updated_at && (
                <div className="px-6 pt-4 pb-0">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground bg-white/3 rounded-lg px-3 py-2 border border-white/5 w-fit">
                    <Info className="w-3.5 h-3.5" />
                    Última actualización por{" "}
                    <span className="font-medium text-white/70">{pageData.updated_by ?? "—"}</span>
                    &nbsp;·&nbsp;{formatDate(pageData.updated_at)}
                  </div>
                </div>
              )}

              {/* ── SEO ──────────────────────────────────────────────────── */}
              <div className="px-6 pt-5 pb-4">
                <SectionBlock
                  sectionTitle="SEO"
                  fieldCount={2}
                  sectionId="section-seo"
                  defaultOpen={false}
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-medium text-white/60 block mb-1.5">
                        Meta Título <span className="text-white/25 font-normal">(opcional)</span>
                      </label>
                      <Input
                        value={seoTitle}
                        onChange={(e) => { setSeoTitle(e.target.value); setIsDirty(true); }}
                        placeholder={`ISP, S.A. — ${schema.title}`}
                        className="h-9 text-sm bg-[#050d1a] border-white/10"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-white/60 block mb-1.5">
                        Meta Descripción <span className="text-white/25 font-normal">(160 chars)</span>
                      </label>
                      <Input
                        value={seoDesc}
                        onChange={(e) => { setSeoDesc(e.target.value); setIsDirty(true); }}
                        placeholder="Descripción para motores de búsqueda"
                        className="h-9 text-sm bg-[#050d1a] border-white/10"
                      />
                    </div>
                  </div>
                </SectionBlock>
              </div>

              {/* ── Content sections ─────────────────────────────────────── */}
              <div className="px-6 pb-6 space-y-4">
                {schema.sections.map((section, idx) => {
                  const sectionId = `section-${section.sectionTitle.replace(/\s+/g, "-").toLowerCase()}`;
                  return (
                    <SectionBlock
                      key={section.sectionTitle}
                      sectionTitle={section.sectionTitle}
                      fieldCount={section.fields.length}
                      sectionId={sectionId}
                      defaultOpen={idx === 0}
                    >
                      {section.fields.map((field) => {
                        const MAX = field.type === "textarea" ? 1000 : 200;
                        const current = (formValues[field.key] ?? "").length;
                        const nearLimit = current >= Math.floor(MAX * 0.85);
                        const overLimit = current > MAX;
                        return (
                          <div key={field.key}>
                            <div className="flex items-center justify-between mb-1.5">
                              <label className="text-xs font-medium text-white/60">
                                {field.label}
                                <span className="text-white/20 ml-2 font-mono font-normal text-[10px]">[{field.key}]</span>
                              </label>
                              <span className={`text-[10px] font-mono tabular-nums ${overLimit ? "text-red-400" : nearLimit ? "text-yellow-400/80" : "text-white/20"}`}>
                                {current}/{MAX}
                              </span>
                            </div>
                            {field.type === "textarea" ? (
                              <Textarea
                                value={formValues[field.key] ?? ""}
                                onChange={(e) => {
                                  if (e.target.value.length <= MAX) handleFieldChange(field.key, e.target.value);
                                }}
                                placeholder={field.placeholder}
                                maxLength={MAX}
                                className={`min-h-[80px] text-sm bg-[#050d1a] border-white/10 resize-y ${overLimit ? "border-red-500/50" : ""}`}
                              />
                            ) : (
                              <Input
                                type={field.type}
                                value={formValues[field.key] ?? ""}
                                onChange={(e) => {
                                  if (e.target.value.length <= MAX) handleFieldChange(field.key, e.target.value);
                                }}
                                placeholder={field.placeholder}
                                maxLength={MAX}
                                className={`h-9 text-sm bg-[#050d1a] border-white/10 ${overLimit ? "border-red-500/50" : ""}`}
                              />
                            )}
                            {field.hint && (
                              <p className="text-xs text-muted-foreground mt-1">{field.hint}</p>
                            )}
                          </div>
                        );
                      })}
                    </SectionBlock>
                  );
                })}
              </div>

              {/* ── Footer actions ──────────────────────────────────────── */}
              <div className="sticky bottom-0 bg-[#060e1c] border-t border-white/8 px-6 py-3.5 flex justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => mutDraft.mutate()}
                  disabled={isSaving || !isDirty}
                  className="h-8 border-white/15 text-white hover:bg-white/10 text-xs"
                >
                  <Save className="w-3.5 h-3.5 mr-1.5" />
                  {mutDraft.isPending ? "Guardando..." : "Guardar borrador"}
                </Button>
                <Button
                  size="sm"
                  onClick={() => mutPublish.mutate()}
                  disabled={isSaving}
                  className="h-8 bg-primary text-black hover:bg-primary/90 font-semibold text-xs"
                >
                  <Upload className="w-3.5 h-3.5 mr-1.5" />
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
