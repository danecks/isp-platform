// Calibración de coordenadas de cheque. Permite al usuario ajustar
// ±mm en X/Y para que el texto caiga exactamente sobre los recuadros
// del cheque físico. Se persiste por (formato, banco) en localStorage.

export type FormatoCheque = "continuo" | "carta";

export interface CalibracionCheque {
  // Offsets globales en mm (aplicados a todos los campos)
  offsetX: number;
  offsetY: number;
  // Tamaño del cheque continuo (alto en mm). Carta ignora este campo.
  altoCheque: number;
  // Coordenadas de cada campo (mm desde borde superior izq del cheque)
  fechaX: number;
  fechaY: number;
  beneficiarioX: number;
  beneficiarioY: number;
  montoNumeroX: number;
  montoNumeroY: number;
  montoLetrasX: number;
  montoLetrasY: number;
}

export const CALIBRACION_DEFAULT: Record<FormatoCheque, CalibracionCheque> = {
  continuo: {
    offsetX: 0, offsetY: 0,
    altoCheque: 82,           // alto típico de cheque GT en papel continuo
    fechaX: 145, fechaY: 14,
    beneficiarioX: 38, beneficiarioY: 28,
    montoNumeroX: 145, montoNumeroY: 28,
    montoLetrasX: 38, montoLetrasY: 40,
  },
  carta: {
    offsetX: 0, offsetY: 0,
    altoCheque: 90,
    fechaX: 145, fechaY: 18,
    beneficiarioX: 38, beneficiarioY: 32,
    montoNumeroX: 145, montoNumeroY: 32,
    montoLetrasX: 38, montoLetrasY: 44,
  },
};

const STORAGE_KEY = "isp_calibracion_cheque_v1";

interface StorageShape {
  [bancoSlug: string]: {
    continuo?: Partial<CalibracionCheque>;
    carta?: Partial<CalibracionCheque>;
  };
}

function read(): StorageShape {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function write(data: StorageShape) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    /* ignore quota errors */
  }
}

export function slugBanco(banco: string): string {
  return banco.toLowerCase().normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "") || "generico";
}

export function getCalibracion(banco: string, formato: FormatoCheque): CalibracionCheque {
  const store = read();
  const saved = store[slugBanco(banco)]?.[formato] ?? {};
  return { ...CALIBRACION_DEFAULT[formato], ...saved };
}

export function saveCalibracion(banco: string, formato: FormatoCheque, cal: CalibracionCheque) {
  const store = read();
  const slug = slugBanco(banco);
  store[slug] = { ...(store[slug] ?? {}), [formato]: cal };
  write(store);
}
