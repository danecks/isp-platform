import { useEffect, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { BookOpen, FileText, Loader2, AlertCircle, Search } from "lucide-react";
import { AdminLayout } from "@/admin/layout/AdminLayout";

interface DocItem {
  slug: string;
  title: string;
  order: number;
}

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";

// Header de sesión admin para todos los fetches del archivo.
const sessionHeader = () => ({ "x-isp-session": sessionStorage.getItem("isp_admin_session_v2") || "" });

export default function Documentacion() {
  const [items, setItems] = useState<DocItem[]>([]);
  const [activeSlug, setActiveSlug] = useState<string | null>(null);
  const [content, setContent] = useState<string>("");
  const [loadingList, setLoadingList] = useState(true);
  const [loadingDoc, setLoadingDoc] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  // Cargar lista de documentos
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingList(true);
      setError(null);
      try {
        const res = await fetch(`${API_BASE}/api/docs`, { credentials: "include", headers: sessionHeader() });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as { items: DocItem[] };
        if (cancelled) return;
        setItems(data.items);
        // Seleccionar el primero por defecto (README si existe, si no el de menor orden)
        if (data.items.length > 0) {
          const readme = data.items.find((i) => i.slug.toLowerCase() === "readme");
          setActiveSlug((readme ?? data.items[0]).slug);
        }
      } catch (e) {
        if (!cancelled) setError(`No se pudo cargar la lista de documentos: ${String(e)}`);
      } finally {
        if (!cancelled) setLoadingList(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Cargar contenido del documento activo
  useEffect(() => {
    if (!activeSlug) return;
    let cancelled = false;
    (async () => {
      setLoadingDoc(true);
      setError(null);
      try {
        const res = await fetch(`${API_BASE}/api/docs/${activeSlug}`, { credentials: "include", headers: sessionHeader() });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const text = await res.text();
        if (!cancelled) setContent(text);
      } catch (e) {
        if (!cancelled) {
          setContent("");
          setError(`No se pudo cargar el documento: ${String(e)}`);
        }
      } finally {
        if (!cancelled) setLoadingDoc(false);
      }
    })();
    return () => { cancelled = true; };
  }, [activeSlug]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((i) => i.title.toLowerCase().includes(q) || i.slug.toLowerCase().includes(q));
  }, [items, search]);

  const activeItem = items.find((i) => i.slug === activeSlug) ?? null;

  return (
    <AdminLayout title="Documentación">
      <div className="flex flex-col lg:flex-row gap-4 h-[calc(100vh-9rem)]">
        {/* Sidebar de documentos */}
        <aside className="lg:w-72 lg:flex-shrink-0 bg-[#0c1628] border border-white/5 rounded-xl flex flex-col">
          <div className="p-4 border-b border-white/5">
            <div className="flex items-center gap-2 mb-3">
              <BookOpen className="w-4 h-4 text-primary" />
              <h2 className="text-sm font-bold text-white">Documentos</h2>
            </div>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-white/30 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar..."
                className="w-full bg-white/5 border border-white/10 rounded-md pl-8 pr-2 py-1.5 text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-primary/50"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-2">
            {loadingList && (
              <div className="flex items-center gap-2 px-3 py-4 text-xs text-white/50">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Cargando...
              </div>
            )}
            {!loadingList && filtered.length === 0 && (
              <div className="px-3 py-4 text-xs text-white/40">Sin resultados.</div>
            )}
            {filtered.map((item) => (
              <button
                key={item.slug}
                onClick={() => setActiveSlug(item.slug)}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-xs text-left mb-0.5 transition-colors ${
                  activeSlug === item.slug
                    ? "bg-primary/15 text-primary border border-primary/25"
                    : "text-white/70 hover:text-white hover:bg-white/5 border border-transparent"
                }`}
              >
                <FileText className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="truncate">{item.title}</span>
              </button>
            ))}
          </div>
        </aside>

        {/* Visor del documento */}
        <main className="flex-1 bg-[#0c1628] border border-white/5 rounded-xl overflow-hidden flex flex-col">
          {activeItem && (
            <div className="px-6 py-3 border-b border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-primary" />
                <h1 className="text-sm font-bold text-white">{activeItem.title}</h1>
              </div>
              <span className="text-[10px] text-white/30 font-mono">{activeItem.slug}.md</span>
            </div>
          )}

          <div className="flex-1 overflow-y-auto px-6 py-6">
            {loadingDoc && (
              <div className="flex items-center justify-center gap-2 py-12 text-sm text-white/40">
                <Loader2 className="w-4 h-4 animate-spin" /> Cargando documento...
              </div>
            )}
            {error && !loadingDoc && (
              <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/25 rounded-md p-3 text-sm text-red-300">
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}
            {!loadingDoc && !error && (
              <article className="prose prose-invert prose-sm max-w-none
                prose-headings:text-white prose-headings:font-bold
                prose-h1:text-2xl prose-h1:border-b prose-h1:border-white/10 prose-h1:pb-2 prose-h1:mb-4
                prose-h2:text-xl prose-h2:mt-8 prose-h2:mb-3 prose-h2:text-primary
                prose-h3:text-base prose-h3:mt-6 prose-h3:mb-2
                prose-p:text-white/80 prose-p:leading-relaxed
                prose-strong:text-white
                prose-a:text-primary prose-a:no-underline hover:prose-a:underline
                prose-code:text-amber-300 prose-code:bg-white/5 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-xs prose-code:before:content-none prose-code:after:content-none
                prose-pre:bg-[#050d1a] prose-pre:border prose-pre:border-white/10
                prose-ul:text-white/80 prose-ol:text-white/80
                prose-li:marker:text-primary/60
                prose-blockquote:border-l-primary prose-blockquote:bg-white/5 prose-blockquote:text-white/70 prose-blockquote:not-italic
                prose-table:text-xs
                prose-thead:border-b prose-thead:border-white/15
                prose-th:text-white prose-th:font-bold prose-th:px-3 prose-th:py-2 prose-th:text-left
                prose-td:px-3 prose-td:py-1.5 prose-td:text-white/70 prose-td:border-b prose-td:border-white/5
                prose-hr:border-white/10
              ">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
              </article>
            )}
          </div>
        </main>
      </div>
    </AdminLayout>
  );
}
