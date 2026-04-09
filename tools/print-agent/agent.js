#!/usr/bin/env node
/**
 * ISP Print Agent — v1.0
 * Servidor local de impresión silenciosa para carnets PVC
 * Puerto: 7821 (localhost only)
 *
 * Instalar: ejecutar ISP-PrintAgent.exe en la PC con la Canon TS702a
 * El sistema ISP detecta automáticamente si el agente está corriendo.
 */

const express = require("express");
const cors    = require("cors");
const os      = require("os");
const fs      = require("fs");
const path    = require("path");
const { execSync, exec, spawn } = require("child_process");

const PORT    = 7821;
const VERSION = "1.0.0";
const app     = express();

// ── Solo permitir conexiones desde el dominio ISP y localhost ──────────────
app.use(cors({
  origin: [
    "http://localhost",
    "http://localhost:3000",
    "http://localhost:5173",
    "https://isp.replit.app",
    /\.replit\.dev$/,
    /\.replit\.app$/,
    /ispsa\.net$/,
  ],
  methods: ["GET", "POST", "OPTIONS"],
}));

app.use(express.json({ limit: "5mb" }));

// ────────────────────────────────────────────────────────────────────────────
// UTILIDADES
// ────────────────────────────────────────────────────────────────────────────

/** Encuentra la ruta a Chrome o Edge en Windows */
function findBrowser() {
  const candidates = [
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    process.env.LOCALAPPDATA
      ? path.join(process.env.LOCALAPPDATA, "Google\\Chrome\\Application\\chrome.exe")
      : "",
    process.env.LOCALAPPDATA
      ? path.join(process.env.LOCALAPPDATA, "Microsoft\\Edge\\Application\\msedge.exe")
      : "",
  ].filter(Boolean);

  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

/** Lista las impresoras disponibles en Windows (PowerShell) */
function listPrinters() {
  try {
    const out = execSync(
      'powershell -NoProfile -Command "Get-Printer | Select-Object -ExpandProperty Name"',
      { encoding: "utf8", timeout: 5000 }
    );
    return out.trim().split(/\r?\n/).filter(Boolean);
  } catch {
    return [];
  }
}

/** Configura el papel de la impresora vía PowerShell (una sola vez) */
function setPaperSource(printerName) {
  const script = `
    $printer = Get-WmiObject -Query "SELECT * FROM Win32_Printer WHERE Name='${printerName.replace(/'/g, "\\'")}'"
    if ($printer) {
      $printer.PaperSource = 15
      $printer.Put()
      Write-Output "OK"
    } else {
      Write-Output "PRINTER_NOT_FOUND"
    }
  `.trim();
  try {
    const result = execSync(
      `powershell -NoProfile -Command "${script.replace(/\n/g, "; ")}"`,
      { encoding: "utf8", timeout: 5000 }
    );
    return result.trim();
  } catch (e) {
    return "PS_ERROR: " + e.message;
  }
}

/** Guarda HTML en un archivo temporal y devuelve la ruta */
function saveTemp(html) {
  const dir  = os.tmpdir();
  const file = path.join(dir, `isp-carnet-${Date.now()}.html`);
  fs.writeFileSync(file, html, "utf8");
  return file;
}

/** Limpia archivos temporales con más de 5 minutos */
function cleanOldTemps() {
  const dir = os.tmpdir();
  const now = Date.now();
  try {
    fs.readdirSync(dir)
      .filter(f => f.startsWith("isp-carnet-") && f.endsWith(".html"))
      .forEach(f => {
        const full = path.join(dir, f);
        try {
          const stat = fs.statSync(full);
          if (now - stat.mtimeMs > 5 * 60 * 1000) fs.unlinkSync(full);
        } catch {}
      });
  } catch {}
}

/**
 * Imprime el HTML usando Chrome/Edge con --kiosk-printing.
 * El HTML debe llamar window.print() en onload para que el
 * flag kiosk-printing lo dispare sin diálogo.
 */
function printWithBrowser(browserPath, htmlFile) {
  return new Promise((resolve, reject) => {
    const args = [
      "--headless=new",
      "--disable-gpu",
      "--no-sandbox",
      "--kiosk-printing",
      "--disable-popup-blocking",
      "--run-all-compositor-stages-before-draw",
      "--disable-extensions",
      "--no-first-run",
      "--no-default-browser-check",
      `file:///${htmlFile.replace(/\\/g, "/")}`,
    ];

    const proc = spawn(browserPath, args, {
      detached: false,
      stdio: "ignore",
      windowsHide: true,
    });

    const timer = setTimeout(() => {
      try { proc.kill(); } catch {}
      resolve("timeout");
    }, 15000);

    proc.on("close", (code) => {
      clearTimeout(timer);
      resolve(code);
    });

    proc.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

// ────────────────────────────────────────────────────────────────────────────
// RUTAS
// ────────────────────────────────────────────────────────────────────────────

/** GET /status — el sistema ISP llama esto para saber si el agente está activo */
app.get("/status", (req, res) => {
  const browser   = findBrowser();
  const printers  = listPrinters();
  const canonName = printers.find(p => /canon|ts702/i.test(p)) || null;

  res.json({
    ok:       true,
    version:  VERSION,
    hostname: os.hostname(),
    browser:  browser ? path.basename(browser) : null,
    printers,
    canon:    canonName,
  });
});

/**
 * POST /print — imprime un carnet
 *
 * Body:
 * {
 *   html: string        // HTML completo del carnet a imprimir
 *   printer?: string    // nombre de la impresora (opcional, usa la Canon si la detecta)
 *   setPaperSource?: boolean // configurar fuente de papel vía WMI antes de imprimir
 * }
 */
app.post("/print", async (req, res) => {
  const { html, printer, setPaperSource: doSetPaper } = req.body;

  if (!html || typeof html !== "string" || html.length < 10) {
    return res.status(400).json({ ok: false, error: "html_required" });
  }

  const browser = findBrowser();
  if (!browser) {
    return res.status(500).json({
      ok: false,
      error: "no_browser",
      message: "No se encontró Chrome o Edge instalado en esta PC.",
    });
  }

  // Configurar fuente de papel si se solicita (requiere PowerShell + permisos)
  if (doSetPaper && printer) {
    setPaperSource(printer);
  }

  // Asegura que el HTML tiene el script de auto-impresión
  let finalHtml = html;
  if (!finalHtml.includes("window.print")) {
    finalHtml = finalHtml.replace(
      "</body>",
      `<script>window.onload = function(){ window.print(); setTimeout(function(){ window.close(); }, 2000); };</script></body>`
    );
  }

  let tempFile;
  try {
    cleanOldTemps();
    tempFile = saveTemp(finalHtml);

    const code = await printWithBrowser(browser, tempFile);

    // Limpiar el archivo temporal (sin falla si ya no existe)
    try { fs.unlinkSync(tempFile); } catch {}

    return res.json({
      ok:      true,
      browser: path.basename(browser),
      code,
    });
  } catch (err) {
    if (tempFile) { try { fs.unlinkSync(tempFile); } catch {} }
    return res.status(500).json({
      ok:    false,
      error: "print_failed",
      message: err.message,
    });
  }
});

/** GET /printers — lista impresoras disponibles */
app.get("/printers", (req, res) => {
  res.json({ printers: listPrinters() });
});

/** OPTIONS preflight */
app.options("*", cors());

// ────────────────────────────────────────────────────────────────────────────
// INICIO
// ────────────────────────────────────────────────────────────────────────────
app.listen(PORT, "127.0.0.1", () => {
  const browser  = findBrowser();
  const printers = listPrinters();
  const canon    = printers.find(p => /canon|ts702/i.test(p));

  console.log("╔══════════════════════════════════════════════════════╗");
  console.log("║           ISP Print Agent  v" + VERSION + "                     ║");
  console.log("║  Investigaciones y Seguridad Profesional S.A.        ║");
  console.log("╠══════════════════════════════════════════════════════╣");
  console.log(`║  Puerto : http://127.0.0.1:${PORT}                    ║`);
  console.log(`║  Browser: ${(browser ? path.basename(browser) : "NO ENCONTRADO").padEnd(42)}║`);
  console.log(`║  Canon  : ${(canon || "No detectada").padEnd(42)}║`);
  console.log("╠══════════════════════════════════════════════════════╣");
  console.log("║  Minimiza esta ventana.  NO la cierres.              ║");
  console.log("║  El sistema ISP la usará para imprimir carnets.      ║");
  console.log("╚══════════════════════════════════════════════════════╝");

  if (!browser) {
    console.error("\n⚠  ADVERTENCIA: No se encontró Chrome ni Edge. La impresión fallará.");
    console.error("   Instala Google Chrome o Microsoft Edge en esta PC.\n");
  }
  if (!canon) {
    console.warn("\n⚠  ADVERTENCIA: No se detectó la Canon TS702a.");
    console.warn("   Verifica que la impresora esté conectada e instalada.\n");
  }
});
