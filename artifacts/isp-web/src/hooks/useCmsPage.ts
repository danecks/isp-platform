import { useQuery } from "@tanstack/react-query";

const API_BASE = "/api";

interface CmsPageData {
  content: Record<string, string>;
  seo_title?: string | null;
  seo_description?: string | null;
}

async function fetchCmsPage(pageKey: string): Promise<CmsPageData> {
  try {
    const res = await fetch(`${API_BASE}/cms/pages/${pageKey}`);
    if (!res.ok) return { content: {} };
    return res.json();
  } catch {
    return { content: {} };
  }
}

export function useCmsPage(pageKey: string) {
  const { data } = useQuery<CmsPageData>({
    queryKey: ["cms", pageKey],
    queryFn: () => fetchCmsPage(pageKey),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: false,
  });

  const content = data?.content ?? {};

  function c(key: string, fallback: string): string {
    const val = content[key];
    return val && val.trim() !== "" ? val : fallback;
  }

  return { c, content, seo: { title: data?.seo_title, description: data?.seo_description } };
}
