import { getSessionToken } from "@/lib/httpClient";

export async function apiFetch(url: string, opts: RequestInit = {}) {
  const res = await fetch(`/api${url}`, {
    ...opts,
    headers: {
      "x-isp-session": getSessionToken(),
      "Content-Type": "application/json",
      ...(opts.headers ?? {}),
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error ?? res.statusText);
  }
  return res.json();
}

const fmt = new Intl.NumberFormat("es-GT", { style: "currency", currency: "GTQ" });
export const fmtNum = (v: string | number) => fmt.format(parseFloat(String(v)));
export const fmtDate = (d: string | null | undefined) => {
  if (!d) return "—";
  const s = d.length <= 10 ? d + "T00:00:00Z" : d;
  const dt = new Date(s);
  return isNaN(dt.getTime()) ? "—" : dt.toLocaleDateString("es-GT");
};

export const TIPO_LABEL: Record<string, string> = {
  bono14: "Bono 14",
  aguinaldo: "Aguinaldo",
};

export const ESTADO_COLOR: Record<string, string> = {
  borrador: "bg-gray-500/20 text-gray-300 border-gray-500/30",
  aprobada: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  completada: "bg-green-500/20 text-green-300 border-green-500/30",
  anulada: "bg-red-500/20 text-red-300 border-red-500/30",
};

export const PAGO_COLOR: Record<string, string> = {
  pendiente: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
  pagado: "bg-green-500/20 text-green-300 border-green-500/30",
};
