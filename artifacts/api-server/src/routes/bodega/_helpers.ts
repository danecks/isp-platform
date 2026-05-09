
// ─── helpers ──────────────────────────────────────────────────────────────────
export function getUser(req: any): string {
  try { return JSON.parse(req.headers["x-isp-session"] || "{}").username ?? "sistema"; } catch { return "sistema"; }
}

