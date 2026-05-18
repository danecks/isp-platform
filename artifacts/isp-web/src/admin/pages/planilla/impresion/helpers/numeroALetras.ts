// Convierte un número a su representación en letras (español Guatemala)
// para usar en cheques. Ej: 2500.50 → "DOS MIL QUINIENTOS QUETZALES CON 50/100"

const UNIDADES = [
  "", "UNO", "DOS", "TRES", "CUATRO", "CINCO", "SEIS", "SIETE", "OCHO", "NUEVE",
  "DIEZ", "ONCE", "DOCE", "TRECE", "CATORCE", "QUINCE", "DIECISÉIS",
  "DIECISIETE", "DIECIOCHO", "DIECINUEVE", "VEINTE",
];
const DECENAS = [
  "", "", "VEINTI", "TREINTA", "CUARENTA", "CINCUENTA",
  "SESENTA", "SETENTA", "OCHENTA", "NOVENTA",
];
const CENTENAS = [
  "", "CIENTO", "DOSCIENTOS", "TRESCIENTOS", "CUATROCIENTOS", "QUINIENTOS",
  "SEISCIENTOS", "SETECIENTOS", "OCHOCIENTOS", "NOVECIENTOS",
];

function decenasAletras(n: number): string {
  if (n <= 20) return UNIDADES[n];
  if (n < 30) return n === 20 ? "VEINTE" : `VEINTI${UNIDADES[n - 20]}`;
  const d = Math.floor(n / 10);
  const u = n % 10;
  return u === 0 ? DECENAS[d] : `${DECENAS[d]} Y ${UNIDADES[u]}`;
}

function centenasAletras(n: number): string {
  if (n === 100) return "CIEN";
  const c = Math.floor(n / 100);
  const r = n % 100;
  const cent = CENTENAS[c];
  return r === 0 ? cent : `${cent} ${decenasAletras(r)}`;
}

function milesAletras(n: number): string {
  if (n < 1000) return centenasAletras(n);
  const miles = Math.floor(n / 1000);
  const resto = n % 1000;
  const prefijo = miles === 1 ? "MIL" : `${centenasAletras(miles)} MIL`;
  return resto === 0 ? prefijo : `${prefijo} ${centenasAletras(resto)}`;
}

function millonesAletras(n: number): string {
  if (n < 1_000_000) return milesAletras(n);
  const millones = Math.floor(n / 1_000_000);
  const resto = n % 1_000_000;
  const prefijo = millones === 1 ? "UN MILLÓN" : `${milesAletras(millones)} MILLONES`;
  return resto === 0 ? prefijo : `${prefijo} ${milesAletras(resto)}`;
}

// Apocopa "uno" → "un" cuando va seguido del sustantivo masculino "quetzal(es)".
// Regla del español: "veintiún quetzales", "ciento un quetzales", "mil un quetzales".
function apocopar(s: string): string {
  return s
    .replace(/VEINTIUNO$/, "VEINTIÚN")
    .replace(/(^|\s)UNO$/, "$1UN");
}

export function numeroALetrasGT(monto: number | string): string {
  const n = typeof monto === "string" ? parseFloat(monto) : monto;
  if (isNaN(n) || n < 0) return "";
  let entero = Math.floor(n);
  let centavos = Math.round((n - entero) * 100);
  // Carry: si decimales redondean a 100, sumamos al entero.
  if (centavos === 100) { entero += 1; centavos = 0; }
  const centavosStr = String(centavos).padStart(2, "0");
  if (entero === 0) return `CERO QUETZALES CON ${centavosStr}/100`;
  if (entero === 1) return `UN QUETZAL CON ${centavosStr}/100`;
  const palabras = apocopar(millonesAletras(entero).trim().replace(/\s+/g, " "));
  return `${palabras} QUETZALES CON ${centavosStr}/100`;
}
