export function logoSrc(path: string): string {
  if (!path) return "";
  if (path.startsWith("/images/")) return path;
  return `/api/storage${path}`;
}
