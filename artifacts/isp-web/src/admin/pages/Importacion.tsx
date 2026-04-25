import { useState, useRef, useCallback } from "react";
import { xlsxCompat as XLSX } from "@/lib/xlsxCompat";
import { useQuery } from "@tanstack/react-query";
import { AdminLayout } from "../layout/AdminLayout";
import {
  FileUp, Download, CheckCircle2, XCircle, AlertCircle,
  Loader2, ChevronRight, RotateCcw, Users, MapPin, Package,
  Wand2, HelpCircle, Shield, Database, RefreshCw, ToggleLeft, ToggleRight,
  FileSpreadsheet, BarChart3, Upload, X, Clock, ExternalLink,
} from "lucide-react";

const API_BASE = "/api";
const getSession = () => sessionStorage.getItem("isp_admin_session_v2") || "";

// ─── CSV Parser ──────────────────────────────────────────────────────────────
function parseCSV(text: string): Record<string, string>[] {
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  if (lines.length < 2) return [];

  const parseRow = (line: string): string[] => {
    const cells: string[] = [];
    let i = 0;
    while (i < line.length) {
      if (line[i] === '"') {
        i++;
        let cell = "";
        while (i < line.length) {
          if (line[i] === '"' && line[i + 1] === '"') { cell += '"'; i += 2; }
          else if (line[i] === '"') { i++; break; }
          else { cell += line[i]; i++; }
        }
        cells.push(cell);
        if (line[i] === ",") i++;
      } else {
        const end = line.indexOf(",", i);
        if (end === -1) { cells.push(line.slice(i)); i = line.length; }
        else { cells.push(line.slice(i, end)); i = end + 1; }
      }
    }
    return cells;
  };

  const headers = parseRow(lines[0]).map((h) => h.trim().toLowerCase().replace(/\s+/g, "_"));
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const cells = parseRow(line);
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => { row[h] = cells[idx] ?? ""; });
    rows.push(row);
  }
  return rows;
}

// ─── Template generator ──────────────────────────────────────────────────────
function downloadCSV(filename: string, headers: string[], example: string[]) {
  const bom = "\uFEFF";
  const content = bom + [headers.join(","), example.join(",")].join("\n");
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

// ─── Auto-prefix generator ────────────────────────────────────────────────────
function generatePrefix(nombre: string): string {
  return nombre
    .toUpperCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 6) || "ITEM";
}

function applyAutoPrefixes(
  rows: Record<string, string>[],
  nameField: string,
  prefixField: string,
): Record<string, string>[] {
  const usedPrefixes = new Map<string, number>();
  return rows.map((row) => {
    if (row[prefixField]) return row;
    const base = generatePrefix(row[nameField] || "ITEM");
    const count = (usedPrefixes.get(base) ?? 0) + 1;
    usedPrefixes.set(base, count);
    const prefix = count === 1 ? base : base.slice(0, 4) + String(count).padStart(2, "0");
    return { ...row, [prefixField]: prefix.slice(0, 6) };
  });
}

// Extrae el código generado por el backend del resultado de preview
function getServerGeneratedValue(
  resultados: RowResult[],
  rowIndex: number,
  field: string,
): string | undefined {
  const r = resultados.find((r) => r.fila === rowIndex + 2);
  return r?.datos?.[field];
}

// ─── Types ───────────────────────────────────────────────────────────────────
type RowResult = {
  fila: number;
  estado: "ok" | "error" | "omitido";
  mensaje?: string;
  datos?: Record<string, any>;
};
type ImportResult = {
  preview: boolean;
  exitosos: number;
  errores: number;
  omitidos: number;
  total: number;
  resultados: RowResult[];
};
type Step = "upload" | "preview" | "result";

// ─── ImporterTab ──────────────────────────────────────────────────────────────
interface AutoPrefixConfig {
  prefixField: string;
  nameField: string;
  label: string;
  /** Si true, el backend genera el código; el frontend no lo pre-genera */
  serverSide?: boolean;
}

interface ImporterTabProps {
  endpoint: string;
  templateHeaders: string[];
  templateExample: string[];
  templateFilename: string;
  columns: { key: string; label: string; required?: boolean }[];
  entityLabel: string;
  autoPrefix?: AutoPrefixConfig;
}

function ImporterTab({
  endpoint, templateHeaders, templateExample, templateFilename,
  columns, entityLabel, autoPrefix,
}: ImporterTabProps) {
  const [step, setStep] = useState<Step>("upload");
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [previewResult, setPreviewResult] = useState<ImportResult | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  // null = no decision yet | true = auto-generate | false = user will fix manually
  const [autoPrefixChoice, setAutoPrefixChoice] = useState<boolean | null>(null);
  const [prefixMissing, setPrefixMissing] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setStep("upload"); setRows([]); setPreviewResult(null); setImportResult(null);
    setAutoPrefixChoice(null); setPrefixMissing(false);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleFile = useCallback((file: File) => {
    if (!file.name.toLowerCase().endsWith(".csv")) {
      alert("Solo se aceptan archivos .csv");
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const parsed = parseCSV(text);
      if (parsed.length === 0) { alert("El archivo no tiene datos válidos"); return; }

      // Detect missing auto-prefix field
      if (autoPrefix) {
        const allEmpty = parsed.every((r) => !r[autoPrefix.prefixField]?.trim());
        setPrefixMissing(allEmpty);
        setAutoPrefixChoice(allEmpty ? null : false);
      }

      setRows(parsed);
      setStep("preview");
    };
    reader.readAsText(file, "UTF-8");
  }, [autoPrefix]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  // Resolve rows to send: apply auto-prefix client-side only when !serverSide
  const getEffectiveRows = () => {
    if (autoPrefix && autoPrefixChoice === true && prefixMissing && !autoPrefix.serverSide) {
      return applyAutoPrefixes(rows, autoPrefix.nameField, autoPrefix.prefixField);
    }
    return rows;
  };

  const runPreview = async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API_BASE}/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-isp-session": getSession() },
        body: JSON.stringify({ rows: getEffectiveRows(), preview: true }),
      });
      const data: ImportResult = await r.json();
      setPreviewResult(data);
    } finally { setLoading(false); }
  };

  const runImport = async () => {
    if (!confirm(`¿Confirmar importación de ${rows.length} registros? Esta acción no se puede deshacer.`)) return;
    setLoading(true);
    try {
      const r = await fetch(`${API_BASE}/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-isp-session": getSession() },
        body: JSON.stringify({ rows: getEffectiveRows(), preview: false }),
      });
      const data: ImportResult = await r.json();
      setImportResult(data);
      setStep("result");
    } finally { setLoading(false); }
  };

  // ── Step: Upload ─────────────────────────────────────────────────────────
  if (step === "upload") return (
    <div className="space-y-6">
      <div className="bg-white/[0.03] border border-white/10 rounded-xl p-5 space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-white/90 mb-2">Columnas del archivo CSV</h3>
          <div className="flex flex-wrap gap-2">
            {columns.map((c) => (
              <span key={c.key} className={`text-[11px] px-2 py-0.5 rounded-full border font-mono ${
                c.required
                  ? "bg-primary/10 text-primary border-primary/30"
                  : "bg-white/5 text-white/50 border-white/10"
              }`}>
                {c.key}{c.required ? " *" : ""}
              </span>
            ))}
          </div>
          <p className="text-[11px] text-white/40 mt-2">* columnas obligatorias</p>
        </div>
        <button
          onClick={() => downloadCSV(templateFilename, templateHeaders, templateExample)}
          className="flex items-center gap-2 text-xs text-primary hover:text-primary/80 transition-colors font-medium"
        >
          <Download className="w-3.5 h-3.5" />
          Descargar plantilla con ejemplo
        </button>
      </div>

      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${
          dragOver
            ? "border-primary bg-primary/5"
            : "border-white/15 hover:border-white/30 hover:bg-white/[0.02]"
        }`}
      >
        <FileUp className="w-8 h-8 text-white/30 mx-auto mb-3" />
        <p className="text-sm text-white/60">Arrastra tu archivo CSV aquí</p>
        <p className="text-xs text-white/30 mt-1">o haz clic para seleccionarlo</p>
        <input
          ref={fileRef}
          type="file"
          accept=".csv"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
        />
      </div>
    </div>
  );

  // ── Step: Preview ────────────────────────────────────────────────────────
  if (step === "preview") {
    const effectiveRows = getEffectiveRows();
    const csvKeys = Object.keys(rows[0] ?? {});
    const effectiveKeys = Object.keys(effectiveRows[0] ?? {});
    const visibleCols = columns.filter((c) =>
      csvKeys.includes(c.key) || effectiveKeys.includes(c.key)
    );
    const needsDecision = prefixMissing && autoPrefixChoice === null;

    return (
      <div className="space-y-4">
        {/* Auto-prefix prompt */}
        {autoPrefix && prefixMissing && autoPrefixChoice === null && (
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 space-y-3">
            <div className="flex items-start gap-3">
              <HelpCircle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-yellow-200">
                  El archivo no incluye la columna <code className="font-mono bg-yellow-400/10 px-1 rounded">{autoPrefix.prefixField}</code>
                </p>
                <p className="text-xs text-yellow-300/70 mt-1">
                  {autoPrefix.label} ¿Deseas que el sistema lo genere automáticamente desde el nombre del artículo?
                </p>
              </div>
            </div>
            <div className="flex gap-2 pl-8">
              <button
                onClick={() => setAutoPrefixChoice(true)}
                className="flex items-center gap-1.5 text-xs bg-primary text-black font-semibold px-3 py-1.5 rounded-lg hover:bg-primary/90 transition-colors"
              >
                <Wand2 className="w-3.5 h-3.5" />
                Sí, generar automáticamente
              </button>
              <button
                onClick={() => setAutoPrefixChoice(false)}
                className="text-xs bg-white/10 hover:bg-white/15 text-white/70 px-3 py-1.5 rounded-lg transition-colors"
              >
                No, lo completaré manualmente
              </button>
            </div>
          </div>
        )}

        {/* Auto-prefix confirmation badge */}
        {autoPrefix && autoPrefixChoice === true && prefixMissing && (
          <div className="flex items-center gap-2 bg-primary/10 border border-primary/20 rounded-xl px-4 py-2.5">
            <Wand2 className="w-4 h-4 text-primary flex-shrink-0" />
            <p className="text-xs text-primary/90">
              El sistema generará el código prefijo automáticamente desde el nombre de cada artículo.
            </p>
            <button
              onClick={() => { setAutoPrefixChoice(null); setPreviewResult(null); }}
              className="ml-auto text-[10px] text-white/30 hover:text-white/60 transition-colors underline"
            >
              cambiar
            </button>
          </div>
        )}

        {/* Manual fix notice */}
        {autoPrefix && autoPrefixChoice === false && prefixMissing && (
          <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5">
            <AlertCircle className="w-4 h-4 text-white/30 flex-shrink-0" />
            <p className="text-xs text-white/40">
              Las filas sin <code className="font-mono">codigo_prefijo</code> se marcarán como error.
              Puedes corregir el CSV y re-subirlo.
            </p>
            <button
              onClick={() => { setAutoPrefixChoice(null); setPreviewResult(null); }}
              className="ml-auto text-[10px] text-white/30 hover:text-white/60 transition-colors underline"
            >
              cambiar
            </button>
          </div>
        )}

        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-white/70">
              <span className="text-white font-medium">{rows.length}</span> registros detectados
            </p>
            {previewResult && (
              <p className="text-xs text-white/40 mt-0.5">
                {previewResult.exitosos} válidos · {previewResult.errores} con errores ·{" "}
                {previewResult.omitidos} ya existen
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={reset} className="text-xs text-white/40 hover:text-white/70 flex items-center gap-1">
              <RotateCcw className="w-3.5 h-3.5" /> Nuevo archivo
            </button>
            {!previewResult && !needsDecision && (
              <button
                onClick={runPreview}
                disabled={loading}
                className="flex items-center gap-1.5 text-xs bg-white/10 hover:bg-white/15 text-white px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ChevronRight className="w-3.5 h-3.5" />}
                Validar datos
              </button>
            )}
            {previewResult && previewResult.exitosos > 0 && !needsDecision && (
              <button
                onClick={runImport}
                disabled={loading}
                className="flex items-center gap-1.5 text-xs bg-primary text-black font-semibold px-3 py-1.5 rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileUp className="w-3.5 h-3.5" />}
                Importar {previewResult.exitosos} registros
              </button>
            )}
          </div>
        </div>

        {/* Preview table */}
        <div className="overflow-auto max-h-[450px] rounded-xl border border-white/10">
          <table className="w-full text-[12px]">
            <thead className="sticky top-0 bg-[#0f1117] z-10">
              <tr>
                <th className="text-left px-3 py-2 text-white/40 font-medium w-12">#</th>
                {previewResult && <th className="text-left px-3 py-2 text-white/40 font-medium w-20">Estado</th>}
                {visibleCols.map((c) => (
                  <th key={c.key} className="text-left px-3 py-2 text-white/40 font-medium whitespace-nowrap">
                    {c.label}
                    {autoPrefix && c.key === autoPrefix.prefixField && autoPrefixChoice === true && prefixMissing && (
                      <span className="ml-1 text-primary/60 text-[10px] font-normal">(auto)</span>
                    )}
                  </th>
                ))}
                {previewResult && <th className="text-left px-3 py-2 text-white/40 font-medium">Mensaje</th>}
              </tr>
            </thead>
            <tbody>
              {effectiveRows.slice(0, 200).map((row, i) => {
                const resultado = previewResult?.resultados.find((r) => r.fila === i + 2);
                const originalRow = rows[i];
                return (
                  <tr key={i} className={`border-t border-white/5 ${
                    resultado?.estado === "error" ? "bg-red-500/5" :
                    resultado?.estado === "omitido" ? "bg-yellow-500/5" : ""
                  }`}>
                    <td className="px-3 py-1.5 text-white/30">{i + 2}</td>
                    {previewResult && (
                      <td className="px-3 py-1.5">
                        {resultado?.estado === "ok" && <span className="text-green-400 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> ok</span>}
                        {resultado?.estado === "error" && <span className="text-red-400 flex items-center gap-1"><XCircle className="w-3 h-3" /> error</span>}
                        {resultado?.estado === "omitido" && <span className="text-yellow-400 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> existe</span>}
                      </td>
                    )}
                    {visibleCols.map((c) => {
                      const val = row[c.key];
                      const wasAutoGeneratedClient =
                        autoPrefix &&
                        c.key === autoPrefix.prefixField &&
                        !autoPrefix.serverSide &&
                        autoPrefixChoice === true &&
                        prefixMissing &&
                        !originalRow[c.key];
                      // Para serverSide: mostrar el valor que devolvió el backend en datos
                      const serverVal =
                        autoPrefix &&
                        c.key === autoPrefix.prefixField &&
                        autoPrefix.serverSide &&
                        autoPrefixChoice === true &&
                        prefixMissing &&
                        !originalRow[c.key] &&
                        previewResult
                          ? getServerGeneratedValue(previewResult.resultados, i, c.key)
                          : undefined;
                      const displayVal = serverVal || val;
                      const wasAutoGenerated = wasAutoGeneratedClient || !!serverVal;
                      return (
                        <td key={c.key} className={`px-3 py-1.5 ${
                          c.required && !displayVal ? "text-red-400" :
                          wasAutoGenerated ? "text-primary/80" :
                          "text-white/70"
                        }`}>
                          {displayVal
                            ? <>{displayVal}{wasAutoGenerated && <Wand2 className="w-2.5 h-2.5 inline ml-1 opacity-50" />}</>
                            : autoPrefixChoice === true && autoPrefix?.serverSide && !previewResult && !val
                              ? <span className="text-primary/40 italic text-[11px]">auto</span>
                              : <span className="text-white/20 italic">—</span>
                          }
                        </td>
                      );
                    })}
                    {previewResult && (
                      <td className="px-3 py-1.5 text-white/40 text-[11px] max-w-[200px]">
                        {resultado?.mensaje || ""}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
          {rows.length > 200 && (
            <p className="text-xs text-white/30 text-center py-2">
              Mostrando primeras 200 filas de {rows.length}
            </p>
          )}
        </div>
      </div>
    );
  }

  // ── Step: Result ─────────────────────────────────────────────────────────
  if (step === "result" && importResult) {
    const errorRows = importResult.resultados.filter((r) => r.estado === "error");
    const omitidoRows = importResult.resultados.filter((r) => r.estado === "omitido");

    return (
      <div className="space-y-5">
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Importados", value: importResult.exitosos, color: "text-green-400 bg-green-400/10 border-green-400/20" },
            { label: "Omitidos", value: importResult.omitidos, color: "text-yellow-400 bg-yellow-400/10 border-yellow-400/20" },
            { label: "Errores", value: importResult.errores, color: "text-red-400 bg-red-400/10 border-red-400/20" },
          ].map((c) => (
            <div key={c.label} className={`rounded-xl border p-4 text-center ${c.color}`}>
              <div className="text-2xl font-bold">{c.value}</div>
              <div className="text-xs mt-0.5 opacity-70">{c.label}</div>
            </div>
          ))}
        </div>

        {importResult.exitosos > 0 && (
          <div className="flex items-center gap-2 bg-green-400/10 border border-green-400/20 rounded-xl p-4">
            <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0" />
            <p className="text-sm text-green-300">
              {importResult.exitosos} {entityLabel} importados exitosamente.
              Ya están disponibles en el sistema.
            </p>
          </div>
        )}

        {errorRows.length > 0 && (
          <div>
            <h4 className="text-xs font-semibold text-red-400 mb-2">Filas con error</h4>
            <div className="space-y-1">
              {errorRows.map((r) => (
                <div key={r.fila} className="flex items-start gap-2 text-xs bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                  <XCircle className="w-3.5 h-3.5 text-red-400 flex-shrink-0 mt-0.5" />
                  <span className="text-white/50">Fila {r.fila}:</span>
                  <span className="text-red-300">{r.mensaje}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {omitidoRows.length > 0 && (
          <div>
            <h4 className="text-xs font-semibold text-yellow-400 mb-2">Filas omitidas (ya existen)</h4>
            <div className="space-y-1 max-h-40 overflow-auto">
              {omitidoRows.map((r) => (
                <div key={r.fila} className="flex items-start gap-2 text-xs bg-yellow-500/10 border border-yellow-500/20 rounded-lg px-3 py-2">
                  <AlertCircle className="w-3.5 h-3.5 text-yellow-400 flex-shrink-0 mt-0.5" />
                  <span className="text-white/50">Fila {r.fila}:</span>
                  <span className="text-yellow-300">{r.mensaje}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <button
          onClick={reset}
          className="flex items-center gap-2 text-sm text-white/50 hover:text-white transition-colors"
        >
          <RotateCcw className="w-4 h-4" /> Importar otro archivo
        </button>
      </div>
    );
  }

  return null;
}

// ─── LegacyImporterTab — importación desde sistema antiguo (Excel empl_*) ─────
type LegacyResult = {
  preview: boolean;
  exitosos: number;
  actualizados: number;
  errores: number;
  omitidos: number;
  total: number;
  resultados: RowResult[];
};

// rawKey = columna real del Excel del sistema antiguo (empl_*)
// Se usa como fallback antes de correr "Validar"
const PREVIEW_COLS = [
  { key: "nombre_completo",  rawKey: null,              label: "Nombre"   }, // via getPreviewName
  { key: "dpi",              rawKey: "empl_dpi",        label: "DPI"      },
  { key: "fecha_nacimiento", rawKey: "empl_fechanac",   label: "F. Nac.", isSerial: true },
  { key: "sexo",             rawKey: "empl_sexo",       label: "Sexo"     },
  { key: "estado_civil",     rawKey: "empl_estcivil",   label: "E. Civil" },
  { key: "forma_pago",       rawKey: "empl_formapago",  label: "Pago"     },
  { key: "banco",            rawKey: "ban_codigo",      label: "Banco"    },
  { key: "cuenta_bancaria",  rawKey: "empl_ctaban",     label: "Cuenta"   },
  { key: "estado_laboral",   rawKey: "empl_estatus",    label: "Estado"   },
];

function LegacyImporterTab() {
  const [step, setStep]           = useState<Step>("upload");
  const [rows, setRows]           = useState<Record<string, any>[]>([]);
  const [previewResult, setPreviewResult] = useState<LegacyResult | null>(null);
  const [importResult, setImportResult]   = useState<LegacyResult | null>(null);
  const [loading, setLoading]     = useState(false);
  const [dragOver, setDragOver]   = useState(false);
  const [actualizar, setActualizar] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setStep("upload"); setRows([]); setPreviewResult(null); setImportResult(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleFile = useCallback(async (file: File) => {
    const ext = file.name.toLowerCase();
    if (!ext.endsWith(".xlsx")) {
      alert("Solo se aceptan archivos .xlsx del sistema antiguo");
      return;
    }
    const readXlsxFile = (await import("read-excel-file/browser")).default;
    const rawRows = (await readXlsxFile(file) as unknown) as any[][];
    if (!rawRows || rawRows.length < 2) { alert("El archivo no tiene datos válidos"); return; }
    const headers = rawRows[0].map(String);
    const data: Record<string, any>[] = rawRows.slice(1).map(row => {
      const obj: Record<string, any> = {};
      headers.forEach((h: string, i: number) => {
        const val = row[i];
        obj[h] = val instanceof Date ? val.toISOString().slice(0, 10) : (val ?? null);
      });
      return obj;
    });
    if (data.length === 0) { alert("El archivo no tiene datos válidos"); return; }
    const keys = Object.keys(data[0]);
    if (!keys.includes("empl_papellido") && !keys.includes("empl_pnombre")) {
      alert("Este archivo no parece ser del sistema antiguo. Se esperan columnas como empl_pnombre, empl_papellido, etc.");
      return;
    }
    setRows(data);
    setStep("preview");
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const callEndpoint = async (preview: boolean): Promise<LegacyResult> => {
    const r = await fetch(`${API_BASE}/importacion/sistema-antiguo`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-isp-session": getSession() },
      body: JSON.stringify({ rows, preview, actualizar_existentes: actualizar }),
    });
    return r.json();
  };

  const runPreview = async () => {
    setLoading(true);
    try { setPreviewResult(await callEndpoint(true)); }
    finally { setLoading(false); }
  };

  const runImport = async () => {
    const accion = actualizar
      ? "importar y actualizar colaboradores existentes"
      : "importar colaboradores nuevos (los existentes se omiten)";
    if (!confirm(`¿Confirmar ${accion}? (${rows.length} registros del sistema antiguo)`)) return;
    setLoading(true);
    try {
      const data = await callEndpoint(false);
      setImportResult(data);
      setStep("result");
    } finally { setLoading(false); }
  };

  // Construir nombre para preview
  const getPreviewName = (row: Record<string, any>) => {
    const t = (v: any) => String(v ?? "").trim();
    return [t(row.empl_pnombre), t(row.empl_snombre), t(row.empl_papellido), t(row.empl_sapellido)]
      .filter(Boolean).join(" ");
  };

  // ── Step: Upload ───────────────────────────────────────────────────────────
  if (step === "upload") return (
    <div className="space-y-6">
      <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 space-y-2">
        <div className="flex items-center gap-2">
          <Database className="w-4 h-4 text-amber-400" />
          <span className="text-sm font-semibold text-amber-200">Importación desde Sistema Antiguo</span>
        </div>
        <p className="text-xs text-amber-200/70">
          Sube el archivo <code className="font-mono bg-amber-400/10 px-1 rounded">.xlsx</code> exportado del sistema anterior.
          El sistema mapea automáticamente los campos <code className="font-mono bg-amber-400/10 px-1 rounded">empl_*</code> a la nueva estructura
          e importa: nombre, DPI, datos personales, pago bancario, nivel educativo y más.
        </p>
        <div className="flex flex-wrap gap-2 pt-1">
          {["nombre_completo", "dpi", "fecha_nacimiento", "sexo", "estado_civil",
            "forma_pago", "banco", "cuenta_bancaria", "nit", "nivel_educativo",
            "condicion_laboral", "igss_numero", "direccion"].map(f => (
            <span key={f} className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/5 text-white/40 border border-white/10">{f}</span>
          ))}
        </div>
      </div>

      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors ${
          dragOver ? "border-amber-400 bg-amber-400/5" : "border-white/15 hover:border-white/30 hover:bg-white/[0.02]"
        }`}
      >
        <Database className="w-10 h-10 text-white/20 mx-auto mb-3" />
        <p className="text-sm text-white/60">Arrastra el archivo Excel del sistema antiguo aquí</p>
        <p className="text-xs text-white/30 mt-1">o haz clic para seleccionarlo · Acepta .xlsx</p>
        <input
          ref={fileRef}
          type="file"
          accept=".xlsx"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
        />
      </div>
    </div>
  );

  // ── Step: Preview ──────────────────────────────────────────────────────────
  if (step === "preview") return (
    <div className="space-y-4">
      {/* Toggle actualizar existentes */}
      <div className="bg-white/[0.03] border border-white/10 rounded-xl p-4 flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-white/90">Actualizar colaboradores existentes (DPI duplicado)</p>
          <p className="text-xs text-white/40 mt-0.5">
            {actualizar
              ? "Los colaboradores con DPI ya registrado serán actualizados con los datos del sistema antiguo."
              : "Los colaboradores con DPI ya registrado serán omitidos (no se modificará nada)."}
          </p>
        </div>
        <button
          onClick={() => { setActualizar(!actualizar); setPreviewResult(null); }}
          className="flex-shrink-0"
        >
          {actualizar
            ? <ToggleRight className="w-8 h-8 text-primary" />
            : <ToggleLeft  className="w-8 h-8 text-white/30" />}
        </button>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-white/70">
            <span className="text-white font-medium">{rows.length}</span> registros detectados en el archivo
          </p>
          {previewResult && (
            <p className="text-xs text-white/40 mt-0.5">
              {previewResult.exitosos} nuevos · {previewResult.actualizados} actualizarán ·{" "}
              {previewResult.omitidos} se omitirán · {previewResult.errores} con errores
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <button onClick={reset} className="text-xs text-white/40 hover:text-white/70 flex items-center gap-1">
            <RotateCcw className="w-3.5 h-3.5" /> Nuevo archivo
          </button>
          {!previewResult && (
            <button
              onClick={runPreview}
              disabled={loading}
              className="flex items-center gap-1.5 text-xs bg-white/10 hover:bg-white/15 text-white px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              Validar mapeo
            </button>
          )}
          {previewResult && (previewResult.exitosos + previewResult.actualizados) > 0 && (
            <button
              onClick={runImport}
              disabled={loading}
              className="flex items-center gap-1.5 text-xs bg-amber-500 text-black font-semibold px-3 py-1.5 rounded-lg hover:bg-amber-400 transition-colors disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileUp className="w-3.5 h-3.5" />}
              Importar {previewResult.exitosos + previewResult.actualizados} registros
            </button>
          )}
        </div>
      </div>

      <div className="overflow-auto max-h-[450px] rounded-xl border border-white/10">
        <table className="w-full text-[11px]">
          <thead className="sticky top-0 bg-[#0f1117] z-10">
            <tr>
              <th className="text-left px-3 py-2 text-white/40 font-medium w-10">#</th>
              {previewResult && <th className="text-left px-3 py-2 text-white/40 font-medium w-20">Estado</th>}
              {PREVIEW_COLS.map(c => (
                <th key={c.key} className="text-left px-3 py-2 text-white/40 font-medium whitespace-nowrap">{c.label}</th>
              ))}
              {previewResult && <th className="text-left px-3 py-2 text-white/40 font-medium">Nota</th>}
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 200).map((row, i) => {
              const res = previewResult?.resultados.find(r => r.fila === i + 2);
              const nombre = getPreviewName(row);
              return (
                <tr key={i} className={`border-t border-white/5 ${
                  res?.estado === "error"   ? "bg-red-500/5" :
                  res?.estado === "omitido" ? "bg-yellow-500/5" :
                  res?.mensaje?.includes("Actualizado") ? "bg-blue-500/5" : ""
                }`}>
                  <td className="px-3 py-1.5 text-white/30">{i + 2}</td>
                  {previewResult && (
                    <td className="px-3 py-1.5">
                      {res?.estado === "ok" && !res?.mensaje?.includes("Actualizado") &&
                        <span className="text-green-400 flex items-center gap-1"><CheckCircle2 className="w-3 h-3"/>nuevo</span>}
                      {res?.estado === "ok" && res?.mensaje?.includes("Actualizado") &&
                        <span className="text-blue-400 flex items-center gap-1"><RefreshCw className="w-3 h-3"/>upd</span>}
                      {res?.estado === "error" &&
                        <span className="text-red-400 flex items-center gap-1"><XCircle className="w-3 h-3"/>error</span>}
                      {res?.estado === "omitido" &&
                        <span className="text-yellow-400 flex items-center gap-1"><AlertCircle className="w-3 h-3"/>omit</span>}
                    </td>
                  )}
                  {PREVIEW_COLS.map(c => {
                    // 1) datos del servidor (post-Validar) → 2) raw Excel → 3) nombre construido
                    let raw = res?.datos?.[c.key]
                      ?? (c.rawKey ? row[c.rawKey] : null)
                      ?? (c.key === "nombre_completo" ? nombre : null);
                    // Convertir serial de Excel a fecha legible para mostrar en bruto
                    if (c.isSerial && raw && !String(raw).includes("-")) {
                      const n = Number(raw);
                      if (n > 1) {
                        const ms = Date.UTC(1899, 11, 30) + n * 86400000;
                        raw = new Date(ms).toISOString().slice(0, 10);
                      }
                    }
                    const val = raw != null && String(raw).trim() !== "" ? String(raw) : null;
                    return (
                      <td key={c.key} className="px-3 py-1.5 text-white/70 max-w-[140px] truncate">
                        {val ? val : <span className="text-white/20">—</span>}
                      </td>
                    );
                  })}
                  {previewResult && (
                    <td className="px-3 py-1.5 text-white/40 text-[10px] max-w-[180px] truncate"
                        title={res?.mensaje ?? ""}>
                      {res?.mensaje ?? ""}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
        {rows.length > 200 && (
          <p className="text-xs text-white/30 text-center py-2">Mostrando primeras 200 de {rows.length} filas</p>
        )}
      </div>
    </div>
  );

  // ── Step: Result ───────────────────────────────────────────────────────────
  if (step === "result" && importResult) {
    const errRows    = importResult.resultados.filter(r => r.estado === "error");
    const omitRows   = importResult.resultados.filter(r => r.estado === "omitido");
    const updRows    = importResult.resultados.filter(r => r.mensaje?.includes("Actualizado"));
    return (
      <div className="space-y-5">
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: "Nuevos",       value: importResult.exitosos,    color: "text-green-400 bg-green-400/10 border-green-400/20" },
            { label: "Actualizados", value: importResult.actualizados, color: "text-blue-400 bg-blue-400/10 border-blue-400/20" },
            { label: "Omitidos",     value: importResult.omitidos,    color: "text-yellow-400 bg-yellow-400/10 border-yellow-400/20" },
            { label: "Errores",      value: importResult.errores,     color: "text-red-400 bg-red-400/10 border-red-400/20" },
          ].map(c => (
            <div key={c.label} className={`rounded-xl border p-4 text-center ${c.color}`}>
              <div className="text-2xl font-bold">{c.value}</div>
              <div className="text-xs mt-0.5 opacity-70">{c.label}</div>
            </div>
          ))}
        </div>

        {(importResult.exitosos + importResult.actualizados) > 0 && (
          <div className="flex items-center gap-2 bg-green-400/10 border border-green-400/20 rounded-xl p-4">
            <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0" />
            <p className="text-sm text-green-300">
              {importResult.exitosos} colaboradores nuevos importados y {importResult.actualizados} actualizados.
              Ya están disponibles en el módulo de colaboradores.
            </p>
          </div>
        )}

        {updRows.length > 0 && (
          <div>
            <h4 className="text-xs font-semibold text-blue-400 mb-2">Colaboradores actualizados (DPI ya existía)</h4>
            <div className="space-y-1 max-h-48 overflow-auto">
              {updRows.map(r => (
                <div key={r.fila} className="flex items-start gap-2 text-xs bg-blue-500/10 border border-blue-500/20 rounded-lg px-3 py-1.5">
                  <RefreshCw className="w-3.5 h-3.5 text-blue-400 flex-shrink-0 mt-0.5" />
                  <span className="text-white/50">Fila {r.fila}:</span>
                  <span className="text-blue-300">{r.datos?.nombre_completo ?? ""}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {omitRows.length > 0 && (
          <div>
            <h4 className="text-xs font-semibold text-yellow-400 mb-2">Omitidos (DPI ya existe, no se actualizaron)</h4>
            <div className="space-y-1 max-h-48 overflow-auto">
              {omitRows.map(r => (
                <div key={r.fila} className="flex items-start gap-2 text-xs bg-yellow-500/10 border border-yellow-500/20 rounded-lg px-3 py-1.5">
                  <AlertCircle className="w-3.5 h-3.5 text-yellow-400 flex-shrink-0 mt-0.5" />
                  <span className="text-white/50">Fila {r.fila}:</span>
                  <span className="text-yellow-300 text-[10px]">{r.mensaje}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {errRows.length > 0 && (
          <div>
            <h4 className="text-xs font-semibold text-red-400 mb-2">Errores</h4>
            <div className="space-y-1 max-h-48 overflow-auto">
              {errRows.map(r => (
                <div key={r.fila} className="flex items-start gap-2 text-xs bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-1.5">
                  <XCircle className="w-3.5 h-3.5 text-red-400 flex-shrink-0 mt-0.5" />
                  <span className="text-white/50">Fila {r.fila}:</span>
                  <span className="text-red-300">{r.mensaje}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <button onClick={reset} className="flex items-center gap-2 text-sm text-white/50 hover:text-white transition-colors">
          <RotateCcw className="w-4 h-4" /> Importar otro archivo
        </button>
      </div>
    );
  }
  return null;
}

// ─── Definición de importadores ───────────────────────────────────────────────
const TABS = [
  {
    id: "colaboradores",
    label: "Colaboradores",
    icon: Users,
    entityLabel: "colaboradores",
    endpoint: "importacion/colaboradores",
    templateFilename: "plantilla_colaboradores.csv",
    templateHeaders: [
      "nombre_completo", "dpi", "telefono", "correo",
      "puesto", "area", "sede", "estado_laboral",
      "fecha_ingreso", "tipo_servicio", "notas",
    ],
    templateExample: [
      "Juan Carlos López", "1234567890123", "50212345678", "jlopez@ejemplo.com",
      "Agente de Seguridad", "Operaciones", "Central", "activo",
      "2023-01-15", "seguridad", "",
    ],
    columns: [
      { key: "nombre_completo", label: "Nombre completo", required: true },
      { key: "dpi", label: "DPI" },
      { key: "telefono", label: "Teléfono" },
      { key: "correo", label: "Correo" },
      { key: "puesto", label: "Puesto" },
      { key: "area", label: "Área" },
      { key: "sede", label: "Sede" },
      { key: "estado_laboral", label: "Estado" },
      { key: "fecha_ingreso", label: "Fecha ingreso" },
      { key: "tipo_servicio", label: "Tipo servicio" },
      { key: "notas", label: "Notas" },
    ],
    autoPrefix: undefined,
  },
  {
    id: "puestos",
    label: "Puestos Operativos",
    icon: MapPin,
    entityLabel: "puestos",
    endpoint: "importacion/puestos",
    templateFilename: "plantilla_puestos.csv",
    templateHeaders: [
      "nombre", "cliente_nombre", "turno", "horario",
      "jornada", "cantidad_contratada", "costo_hora", "notas",
    ],
    templateExample: [
      "Entrada Principal", "Banco de Guatemala", "día", "08:00-18:00",
      "10 horas", "1", "25.00", "",
    ],
    columns: [
      { key: "nombre", label: "Nombre del puesto", required: true },
      { key: "cliente_nombre", label: "Cliente", required: true },
      { key: "turno", label: "Turno" },
      { key: "horario", label: "Horario" },
      { key: "jornada", label: "Jornada" },
      { key: "cantidad_contratada", label: "Cantidad" },
      { key: "costo_hora", label: "Costo/hora" },
      { key: "notas", label: "Notas" },
    ],
    autoPrefix: undefined,
  },
  {
    id: "articulos",
    label: "Artículos de Bodega",
    icon: Package,
    entityLabel: "artículos",
    endpoint: "importacion/articulos",
    templateFilename: "plantilla_articulos_bodega.csv",
    templateHeaders: [
      "nombre", "codigo_prefijo", "categoria",
      "tipo_rastreo", "tipo_asignacion", "descripcion",
    ],
    templateExample: [
      "Linterna Táctica", "LNTRN", "Equipo Táctico",
      "seriado", "colaborador", "Linterna LED resistente al agua",
    ],
    columns: [
      { key: "nombre", label: "Nombre", required: true },
      { key: "codigo_prefijo", label: "Prefijo ISP", required: true },
      { key: "categoria", label: "Categoría" },
      { key: "tipo_rastreo", label: "Tipo rastreo" },
      { key: "tipo_asignacion", label: "Tipo asignación" },
      { key: "descripcion", label: "Descripción" },
    ],
    autoPrefix: {
      prefixField: "codigo_prefijo",
      nameField: "nombre",
      label: "El código prefijo se usa para identificar artículos (ej. LNTRN, RADIO, CASCO).",
    },
  },
  {
    id: "armas",
    label: "Armería",
    icon: Shield,
    entityLabel: "armas",
    endpoint: "importacion/armas",
    templateFilename: "plantilla_armeria.csv",
    templateHeaders: [
      "codigo", "tipo", "marca", "modelo", "calibre", "serie",
      "estado", "numero_tenencia", "fecha_vencimiento_tenencia", "observaciones",
    ],
    templateExample: [
      "", "pistola", "Glock", "17", "9mm", "GK17-SN-001",
      "activo", "TEN-2024-001", "2026-12-31", "",
    ],
    columns: [
      { key: "codigo", label: "Código ISP" },
      { key: "tipo", label: "Tipo", required: true },
      { key: "marca", label: "Marca" },
      { key: "modelo", label: "Modelo" },
      { key: "calibre", label: "Calibre" },
      { key: "serie", label: "No. serie" },
      { key: "estado", label: "Estado" },
      { key: "numero_tenencia", label: "No. tenencia" },
      { key: "fecha_vencimiento_tenencia", label: "Venc. tenencia" },
      { key: "observaciones", label: "Observaciones" },
    ],
    autoPrefix: {
      prefixField: "codigo",
      nameField: "tipo",
      label: "El código ISP identifica cada arma de forma única (ej. PIST-001, REVO-002). El sistema lo generará según el tipo de arma.",
      serverSide: true,
    },
  },
] as const;

// ─── LegacyClientesTab — importación de clientes desde sistema antiguo ────────
function LegacyClientesTab() {
  const [step, setStep]           = useState<Step>("upload");
  const [rows, setRows]           = useState<Record<string, any>[]>([]);
  const [previewResult, setPreviewResult] = useState<LegacyResult | null>(null);
  const [importResult, setImportResult]   = useState<LegacyResult | null>(null);
  const [loading, setLoading]     = useState(false);
  const [dragOver, setDragOver]   = useState(false);
  const [actualizar, setActualizar] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setStep("upload"); setRows([]); setPreviewResult(null); setImportResult(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleFile = useCallback(async (file: File) => {
    const ext = file.name.toLowerCase();
    if (!ext.endsWith(".xlsx")) {
      alert("Solo se aceptan archivos .xlsx"); return;
    }
    const readXlsxFile = (await import("read-excel-file/browser")).default;
    const rawRows = (await readXlsxFile(file) as unknown) as any[][];
    if (!rawRows || rawRows.length < 2) { alert("El archivo no tiene datos válidos"); return; }
    const headers = rawRows[0].map(String);
    const data: Record<string, any>[] = rawRows.slice(1).map(row => {
      const obj: Record<string, any> = {};
      headers.forEach((h: string, i: number) => {
        const val = row[i];
        obj[h] = val instanceof Date ? val.toISOString().slice(0, 10) : (val ?? null);
      });
      return obj;
    });
    if (data.length === 0) { alert("El archivo no tiene datos válidos"); return; }
    const keys = Object.keys(data[0]);
    if (!keys.includes("depto_nombre") && !keys.includes("depto_codigo")) {
      alert("Este archivo no parece ser el catálogo de clientes. Se esperan columnas depto_nombre y depto_codigo."); return;
    }
    setRows(data); setStep("preview");
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    const file = e.dataTransfer.files[0]; if (file) handleFile(file);
  }, [handleFile]);

  const call = async (preview: boolean): Promise<LegacyResult> => {
    const r = await fetch(`${API_BASE}/importacion/sistema-antiguo-clientes`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-isp-session": getSession() },
      body: JSON.stringify({ rows, preview, actualizar_existentes: actualizar }),
    });
    return r.json();
  };

  const runPreview = async () => { setLoading(true); try { setPreviewResult(await call(true)); } finally { setLoading(false); } };
  const runImport  = async () => {
    if (!confirm(`¿Confirmar importación de ${rows.length} clientes?`)) return;
    setLoading(true);
    try { setImportResult(await call(false)); setStep("result"); } finally { setLoading(false); }
  };

  if (step === "upload") return (
    <div className="space-y-6">
      <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 space-y-2">
        <div className="flex items-center gap-2">
          <Database className="w-4 h-4 text-amber-400" />
          <span className="text-sm font-semibold text-amber-200">Importar Clientes — Sistema Antiguo</span>
        </div>
        <p className="text-xs text-amber-200/70">
          Sube el archivo <code className="font-mono bg-amber-400/10 px-1 rounded">dbo_Deptos.xlsx</code>.
          El sistema importa cada departamento como un cliente, guardando su código para enlazar automáticamente los colaboradores.
        </p>
        <p className="text-[11px] text-amber-300/50 mt-1">
          Importa los clientes <strong>ANTES</strong> de los colaboradores para que el enlace sea automático.
        </p>
      </div>
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors ${
          dragOver ? "border-amber-400 bg-amber-400/5" : "border-white/15 hover:border-white/30 hover:bg-white/[0.02]"
        }`}
      >
        <Database className="w-10 h-10 text-white/20 mx-auto mb-3" />
        <p className="text-sm text-white/60">Arrastra el archivo de clientes aquí</p>
        <p className="text-xs text-white/30 mt-1">o haz clic · Acepta .xlsx</p>
        <input ref={fileRef} type="file" accept=".xlsx" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
      </div>
    </div>
  );

  if (step === "preview") return (
    <div className="space-y-4">
      <div className="bg-white/[0.03] border border-white/10 rounded-xl p-4 flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-white/90">Actualizar clientes existentes</p>
          <p className="text-xs text-white/40 mt-0.5">
            {actualizar ? "Los clientes con mismo nombre recibirán el código del sistema antiguo." : "Los clientes con mismo nombre serán omitidos."}
          </p>
        </div>
        <button onClick={() => { setActualizar(!actualizar); setPreviewResult(null); }} className="flex-shrink-0">
          {actualizar ? <ToggleRight className="w-8 h-8 text-primary" /> : <ToggleLeft className="w-8 h-8 text-white/30" />}
        </button>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-white/70"><span className="text-white font-medium">{rows.length}</span> clientes detectados</p>
          {previewResult && (
            <p className="text-xs text-white/40 mt-0.5">
              {previewResult.exitosos} nuevos · {previewResult.actualizados} actualizarán · {previewResult.omitidos} se omitirán · {previewResult.errores} errores
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <button onClick={reset} className="text-xs text-white/40 hover:text-white/70 flex items-center gap-1">
            <RotateCcw className="w-3.5 h-3.5" /> Nuevo archivo
          </button>
          {!previewResult && (
            <button onClick={runPreview} disabled={loading}
              className="flex items-center gap-1.5 text-xs bg-white/10 hover:bg-white/15 text-white px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50">
              {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              Validar
            </button>
          )}
          {previewResult && (previewResult.exitosos + previewResult.actualizados) > 0 && (
            <button onClick={runImport} disabled={loading}
              className="flex items-center gap-1.5 text-xs bg-amber-500 text-black font-semibold px-3 py-1.5 rounded-lg hover:bg-amber-400 transition-colors disabled:opacity-50">
              {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileUp className="w-3.5 h-3.5" />}
              Importar {previewResult.exitosos + previewResult.actualizados}
            </button>
          )}
        </div>
      </div>

      <div className="overflow-auto max-h-[400px] rounded-xl border border-white/10">
        <table className="w-full text-[12px]">
          <thead className="sticky top-0 bg-[#0f1117] z-10">
            <tr>
              <th className="text-left px-3 py-2 text-white/40 font-medium w-10">#</th>
              {previewResult && <th className="text-left px-3 py-2 text-white/40 font-medium w-20">Estado</th>}
              <th className="text-left px-3 py-2 text-white/40 font-medium">Código</th>
              <th className="text-left px-3 py-2 text-white/40 font-medium">Nombre del cliente</th>
              {previewResult && <th className="text-left px-3 py-2 text-white/40 font-medium">Nota</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              const res = previewResult?.resultados.find(r => r.fila === i + 2);
              return (
                <tr key={i} className={`border-t border-white/5 ${
                  res?.estado === "error" ? "bg-red-500/5" :
                  res?.estado === "omitido" ? "bg-yellow-500/5" :
                  res?.mensaje?.includes("Actualizado") ? "bg-blue-500/5" : ""
                }`}>
                  <td className="px-3 py-1.5 text-white/30">{i + 2}</td>
                  {previewResult && (
                    <td className="px-3 py-1.5">
                      {res?.estado === "ok" && !res?.mensaje?.includes("Actualizado") && <span className="text-green-400 flex items-center gap-1"><CheckCircle2 className="w-3 h-3"/>nuevo</span>}
                      {res?.estado === "ok" && res?.mensaje?.includes("Actualizado") && <span className="text-blue-400 flex items-center gap-1"><RefreshCw className="w-3 h-3"/>upd</span>}
                      {res?.estado === "error" && <span className="text-red-400 flex items-center gap-1"><XCircle className="w-3 h-3"/>error</span>}
                      {res?.estado === "omitido" && <span className="text-yellow-400 flex items-center gap-1"><AlertCircle className="w-3 h-3"/>omit</span>}
                    </td>
                  )}
                  <td className="px-3 py-1.5 text-primary/70 font-mono">{String(row.depto_codigo ?? "")}</td>
                  <td className="px-3 py-1.5 text-white/80">{String(row.depto_nombre ?? "")}</td>
                  {previewResult && <td className="px-3 py-1.5 text-white/40 text-[10px]" title={res?.mensaje ?? ""}>{res?.mensaje ?? ""}</td>}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );

  if (step === "result" && importResult) return (
    <div className="space-y-5">
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Nuevos",       value: importResult.exitosos,    color: "text-green-400 bg-green-400/10 border-green-400/20" },
          { label: "Actualizados", value: importResult.actualizados, color: "text-blue-400 bg-blue-400/10 border-blue-400/20" },
          { label: "Omitidos",     value: importResult.omitidos,    color: "text-yellow-400 bg-yellow-400/10 border-yellow-400/20" },
          { label: "Errores",      value: importResult.errores,     color: "text-red-400 bg-red-400/10 border-red-400/20" },
        ].map(c => (
          <div key={c.label} className={`rounded-xl border p-4 text-center ${c.color}`}>
            <div className="text-2xl font-bold">{c.value}</div>
            <div className="text-xs mt-0.5 opacity-70">{c.label}</div>
          </div>
        ))}
      </div>
      {(importResult.exitosos + importResult.actualizados) > 0 && (
        <div className="flex items-center gap-2 bg-green-400/10 border border-green-400/20 rounded-xl p-4">
          <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0" />
          <p className="text-sm text-green-300">
            {importResult.exitosos} clientes nuevos y {importResult.actualizados} actualizados.
            Ahora puedes importar los colaboradores — el enlace será automático.
          </p>
        </div>
      )}
      <button onClick={reset} className="flex items-center gap-2 text-sm text-white/50 hover:text-white transition-colors">
        <RotateCcw className="w-4 h-4" /> Importar otro archivo
      </button>
    </div>
  );
  return null;
}

// ─── VincularPanel — enlaza empleados con clientes después de importar ─────────
function VincularPanel() {
  const [loading, setLoading]   = useState(false);
  const [result, setResult]     = useState<any>(null);
  const [previewed, setPreviewed] = useState(false);

  const run = async (preview: boolean) => {
    setLoading(true);
    try {
      const r = await fetch(`${API_BASE}/importacion/sistema-antiguo-vincular`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-isp-session": getSession() },
        body: JSON.stringify({ preview }),
      });
      const data = await r.json();
      setResult(data);
      if (preview) setPreviewed(true);
    } finally { setLoading(false); }
  };

  return (
    <div className="bg-white/[0.02] border border-white/10 rounded-xl p-5 space-y-4">
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
          <ChevronRight className="w-4 h-4 text-primary" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-white/90">Paso final: Vincular colaboradores con clientes</p>
          <p className="text-xs text-white/40 mt-0.5">
            Conecta automáticamente cada colaborador importado con su cliente usando el código del sistema antiguo.
            Ejecuta esto después de haber importado tanto los clientes como los colaboradores.
          </p>
        </div>
      </div>

      {result && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-green-400/10 border border-green-400/20 rounded-xl p-3 text-center">
              <div className="text-xl font-bold text-green-400">{result.vinculados}</div>
              <div className="text-xs text-green-400/70 mt-0.5">{result.preview ? "se vincularán" : "vinculados"}</div>
            </div>
            <div className="bg-yellow-400/10 border border-yellow-400/20 rounded-xl p-3 text-center">
              <div className="text-xl font-bold text-yellow-400">{result.sin_match}</div>
              <div className="text-xs text-yellow-400/70 mt-0.5">sin match de cliente</div>
            </div>
          </div>
          {result.muestra?.length > 0 && (
            <div>
              <p className="text-[11px] text-white/40 mb-1">Muestra de vínculos{result.preview ? " (previsualización)" : " creados"}:</p>
              <div className="space-y-1 max-h-40 overflow-auto">
                {result.muestra.map((m: any, i: number) => (
                  <div key={i} className="flex items-center gap-2 text-[11px] text-white/60 bg-white/[0.02] rounded px-2 py-1">
                    <span className="text-white/80 truncate flex-1">{m.empleado}</span>
                    <ChevronRight className="w-3 h-3 text-white/20 flex-shrink-0" />
                    <span className="text-primary/80 truncate flex-1">{m.cliente}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {Object.keys(result.sin_match_codigos ?? {}).length > 0 && (
            <div>
              <p className="text-[11px] text-yellow-400/60 mb-1">Códigos sin cliente en el sistema:</p>
              <div className="flex flex-wrap gap-1">
                {Object.entries(result.sin_match_codigos).map(([k, v]) => (
                  <span key={k} className="text-[10px] font-mono bg-yellow-400/10 text-yellow-400/70 border border-yellow-400/20 px-2 py-0.5 rounded-full">
                    {k} ({v as number})
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={() => run(true)}
          disabled={loading}
          className="flex items-center gap-1.5 text-xs bg-white/10 hover:bg-white/15 text-white px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          Previsualizar vínculos
        </button>
        {previewed && result?.vinculados > 0 && (
          <button
            onClick={() => { if (confirm(`¿Vincular ${result.vinculados} colaboradores con sus clientes?`)) run(false); }}
            disabled={loading}
            className="flex items-center gap-1.5 text-xs bg-primary text-black font-semibold px-3 py-1.5 rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
            Ejecutar vinculación
          </button>
        )}
      </div>
    </div>
  );
}

// ─── CrearPuestosPanel — Paso 4: un puesto por colaborador con cliente ─────────
function CrearPuestosPanel() {
  const [loading, setLoading]     = useState(false);
  const [result, setResult]       = useState<any>(null);
  const [previewed, setPreviewed] = useState(false);

  const run = async (preview: boolean) => {
    setLoading(true);
    try {
      const r = await fetch(`${API_BASE}/importacion/crear-puestos-legacy`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-isp-session": getSession() },
        body: JSON.stringify({ preview }),
      });
      const data = await r.json();
      setResult(data);
      if (preview) setPreviewed(true);
    } finally { setLoading(false); }
  };

  return (
    <div className="bg-white/[0.02] border border-white/10 rounded-xl p-5 space-y-4">
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
          <ChevronRight className="w-4 h-4 text-primary" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-white/90">Paso final: Crear puestos por colaborador</p>
          <p className="text-xs text-white/40 mt-0.5">
            Por cada colaborador activo con cliente asignado, crea automáticamente "Puesto 1", "Puesto 2"…
            numerados por cliente. Podrás renombrarlos después desde la ficha de cada cliente.
          </p>
        </div>
      </div>

      {result && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-green-400/10 border border-green-400/20 rounded-xl p-3 text-center">
              <div className="text-xl font-bold text-green-400">{result.creados}</div>
              <div className="text-xs text-green-400/70 mt-0.5">{result.preview ? "se crearán" : "puestos creados"}</div>
            </div>
            <div className="bg-yellow-400/10 border border-yellow-400/20 rounded-xl p-3 text-center">
              <div className="text-xl font-bold text-yellow-400">{result.omitidos}</div>
              <div className="text-xs text-yellow-400/70 mt-0.5">ya tienen puesto</div>
            </div>
          </div>

          {result.muestra?.length > 0 && (
            <div>
              <p className="text-[11px] text-white/40 mb-1">
                Muestra {result.preview ? "(previsualización)" : "de puestos creados"}:
              </p>
              <div className="space-y-0.5 max-h-52 overflow-auto rounded-lg border border-white/10">
                {result.muestra.map((m: any, i: number) => (
                  <div key={i} className="flex items-center gap-2 text-[11px] px-2 py-1.5 border-b border-white/5 last:border-0">
                    <span className="text-primary/70 font-medium w-16 flex-shrink-0">{m.nombre}</span>
                    <ChevronRight className="w-3 h-3 text-white/20 flex-shrink-0" />
                    <span className="text-white/50 flex-shrink-0 max-w-[120px] truncate">{m.cliente_nombre}</span>
                    <span className="text-white/30 mx-1">·</span>
                    <span className="text-white/70 truncate">{m.empleado}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!result.preview && result.creados > 0 && (
            <div className="flex items-center gap-2 bg-green-400/10 border border-green-400/20 rounded-xl p-3">
              <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0" />
              <p className="text-xs text-green-300">
                {result.creados} puestos creados. Ahora puedes entrar a cada cliente para renombrarlos y asignarles turno.
              </p>
            </div>
          )}
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={() => run(true)}
          disabled={loading}
          className="flex items-center gap-1.5 text-xs bg-white/10 hover:bg-white/15 text-white px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          Previsualizar puestos
        </button>
        {previewed && result?.preview && result?.creados > 0 && (
          <button
            onClick={() => { if (confirm(`¿Crear ${result.creados} puestos operativos?`)) run(false); }}
            disabled={loading}
            className="flex items-center gap-1.5 text-xs bg-primary text-black font-semibold px-3 py-1.5 rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
            Crear {result.creados} puestos
          </button>
        )}
      </div>
    </div>
  );
}

// ─── DetalleLibSalTab ────────────────────────────────────────────────────────
// Importa dbo_DETALLELIBROSALARIOS → detalle_lib_sal (BONI desglosado)
interface DetalleLibSalRow {
  emp_nit?: string; pla_numero?: number; empl_numero: number;
  lbl_tpla?: string; lbl_ano: number; lbl_mes: number; lbl_pla: number;
  ORD?: number; EXT?: number; OTROS?: number; BONI?: number;
  IGSS?: number; OTROS_DESC?: number;
}

interface DetalleResumenPeriodo {
  lbl_ano: number; lbl_mes: number; lbl_pla: number;
  empleados: number; total_ordinario: number; total_bonificacion: number;
  total_devengado: number; total_liquido: number;
}

const MESES_DLS = ["","Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
const fmtQDLS = (n: number | string) => `Q${Number(n).toLocaleString("es-GT", { minimumFractionDigits: 2 })}`;

function DetalleLibSalTab() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [rows, setRows]       = useState<DetalleLibSalRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [dragging, setDragging] = useState(false);
  const [importing, setImporting] = useState(false);
  const [preview, setPreview] = useState<{
    total: number; empleados: number;
    periodos: { periodo: string; filas: number }[];
    muestra: { empl_numero: number; periodo: string; ordinario: number; bonificacion: number; igss: number; neto: number }[];
  } | null>(null);
  const [result, setResult] = useState<{ ok: boolean; insertadas: number; actualizadas: number; errores: number; total: number } | null>(null);
  const [materializing, setMaterializing] = useState(false);
  const [matResult, setMatResult] = useState<{
    ok: boolean; planillas_creadas: number; planillas_actualizadas: number;
    lineas_creadas: number; periodos_omitidos: number; total_periodos: number; errores: string[];
  } | null>(null);

  const { data: resumenData, refetch: refetchResumen } = useQuery<{ periodos: DetalleResumenPeriodo[] }>({
    queryKey: ["detalle-lib-sal-resumen"],
    queryFn: () => fetch(`${API_BASE}/libro-salarios/detalle/resumen`, { headers: { "x-isp-session": getSession() } }).then(r => r.json()),
  });
  const periodos = resumenData?.periodos ?? [];

  const parseFile = useCallback((file: File) => {
    setResult(null); setPreview(null);
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer);
        const wb = await XLSX.read(data, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const parsed = XLSX.utils.sheet_to_json<DetalleLibSalRow>(ws, { defval: 0 });
        setRows(parsed);
        setFileName(file.name);
      } catch {
        alert("No se pudo leer el archivo. Verifica que sea un Excel .xlsx válido.");
      }
    };
    reader.readAsArrayBuffer(file);
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) parseFile(file);
  }, [parseFile]);

  const doPreview = async () => {
    if (!rows.length) return;
    setImporting(true);
    try {
      const res = await fetch(`${API_BASE}/libro-salarios/importar-detalle`, {
        method: "POST",
        headers: { "x-isp-session": getSession(), "Content-Type": "application/json" },
        body: JSON.stringify({ rows, preview: true }),
      });
      const d = await res.json();
      setPreview(d);
    } catch { alert("Error de red"); }
    finally { setImporting(false); }
  };

  const doImport = async () => {
    if (!rows.length) return;
    setImporting(true);
    try {
      const res = await fetch(`${API_BASE}/libro-salarios/importar-detalle`, {
        method: "POST",
        headers: { "x-isp-session": getSession(), "Content-Type": "application/json" },
        body: JSON.stringify({ rows, preview: false }),
      });
      const d = await res.json();
      setResult(d);
      setRows([]); setFileName(""); setPreview(null);
      refetchResumen();
    } catch { alert("Error de red"); }
    finally { setImporting(false); }
  };

  const doMaterializar = async () => {
    setMaterializing(true);
    setMatResult(null);
    try {
      const res = await fetch(`${API_BASE}/libro-salarios/materializar-planillas`, {
        method: "POST",
        headers: { "x-isp-session": getSession(), "Content-Type": "application/json" },
        body: JSON.stringify({ fuente: "auto" }),
      });
      const d = await res.json();
      setMatResult(d);
    } catch { alert("Error de red al materializar"); }
    finally { setMaterializing(false); }
  };

  const empsCnt = rows.length > 0 ? new Set(rows.map(r => r.empl_numero)).size : 0;

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="flex items-center gap-2">
        <FileSpreadsheet className="w-4 h-4 text-blue-400" />
        <div>
          <p className="text-sm font-bold text-white">Detalle Nómina ODBC</p>
          <p className="text-[11px] text-white/40 mt-0.5">
            Importa <code className="text-blue-300/70">dbo_DETALLELIBROSALARIOS</code> — incluye bonificación incentivo desglosada por separado
          </p>
        </div>
        {periodos.length > 0 && (
          <span className="ml-auto text-[10px] text-blue-400/60 bg-blue-400/8 border border-blue-400/20 px-2 py-0.5 rounded-full flex items-center gap-1">
            <Database className="w-2.5 h-2.5" />
            {periodos.reduce((s,p) => s + Number(p.empleados), 0).toLocaleString()} registros en BD
          </span>
        )}
      </div>

      {/* Drop zone */}
      {rows.length === 0 && !result && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => fileRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-10 flex flex-col items-center gap-3 cursor-pointer transition-colors ${
            dragging ? "border-blue-400 bg-blue-400/5" : "border-white/10 hover:border-blue-400/40"
          }`}
        >
          <Upload className="w-8 h-8 text-white/20" />
          <p className="text-sm text-white/40">Arrastra el archivo <strong className="text-white/60">dbo_DETALLELIBROSALARIOS_*.xlsx</strong> aquí</p>
          <p className="text-xs text-white/25">o haz clic para buscar</p>
          <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={(e) => { if (e.target.files?.[0]) parseFile(e.target.files[0]); }} />
        </div>
      )}

      {/* Archivo cargado — preview */}
      {rows.length > 0 && !result && (
        <div className="space-y-4">
          <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl px-4 py-3 flex items-center gap-3">
            <FileSpreadsheet className="w-4 h-4 text-blue-400 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-white font-medium truncate">{fileName}</p>
              <p className="text-xs text-white/40">{rows.length.toLocaleString()} filas · {empsCnt.toLocaleString()} empleados únicos</p>
            </div>
            <button onClick={() => { setRows([]); setFileName(""); setPreview(null); }}
              className="text-white/30 hover:text-white/60 transition-colors ml-2">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Vista previa de columnas */}
          <div className="bg-[#0f1623] border border-white/10 rounded-xl p-4 space-y-2">
            <p className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-3">Columnas detectadas</p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {[
                ["empl_numero", "Número de empleado"],
                ["lbl_ano / lbl_mes / lbl_pla", "Año / Mes / Quincena"],
                ["ORD", "Salario ordinario"],
                ["EXT", "Horas extra"],
                ["OTROS", "Otros devengados"],
                ["BONI", "Bonificación incentivo ✓"],
                ["IGSS", "IGSS trabajador"],
                ["OTROS_DESC", "Otras deducciones"],
              ].map(([col, desc]) => (
                <div key={col} className="flex items-center gap-2">
                  <code className="text-blue-300/70 bg-blue-500/10 px-1.5 py-0.5 rounded text-[10px]">{col}</code>
                  <span className="text-white/40">{desc}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Preview resultado */}
          {preview && (
            <div className="bg-[#0f1623] border border-blue-500/20 rounded-xl p-4 space-y-3">
              <p className="text-xs font-semibold text-blue-300/70 uppercase tracking-wider">Vista previa</p>
              <div className="flex gap-4 text-sm flex-wrap">
                <span className="text-gray-400">Filas: <span className="text-white font-bold">{preview.total.toLocaleString()}</span></span>
                <span className="text-gray-400">Empleados: <span className="text-white font-bold">{preview.empleados.toLocaleString()}</span></span>
                <span className="text-gray-400">Períodos: <span className="text-white font-bold">{preview.periodos.length}</span></span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {preview.periodos.map(p => (
                  <span key={p.periodo} className="text-[10px] bg-blue-500/10 border border-blue-500/20 text-blue-300 px-2 py-0.5 rounded-full">
                    {p.periodo} ({p.filas})
                  </span>
                ))}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-white/30 text-left border-b border-white/10">
                      <th className="pb-1.5 pr-4">Empl.</th>
                      <th className="pb-1.5 pr-4">Período</th>
                      <th className="pb-1.5 pr-4 text-right">Ordinario</th>
                      <th className="pb-1.5 pr-4 text-right">BONI</th>
                      <th className="pb-1.5 pr-4 text-right">IGSS</th>
                      <th className="pb-1.5 text-right">Neto</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {preview.muestra.map((m, i) => (
                      <tr key={i} className="text-white/60">
                        <td className="py-1 pr-4">{m.empl_numero}</td>
                        <td className="py-1 pr-4">{m.periodo}</td>
                        <td className="py-1 pr-4 text-right">{fmtQDLS(m.ordinario)}</td>
                        <td className="py-1 pr-4 text-right text-blue-300">{fmtQDLS(m.bonificacion)}</td>
                        <td className="py-1 pr-4 text-right text-red-300">{fmtQDLS(m.igss)}</td>
                        <td className="py-1 text-right text-yellow-300 font-semibold">{fmtQDLS(m.neto)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="flex gap-3 flex-wrap">
            <button
              onClick={doPreview}
              disabled={importing}
              className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white/70 hover:text-white hover:border-white/20 transition-colors disabled:opacity-50"
            >
              {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              Vista previa
            </button>
            <button
              onClick={doImport}
              disabled={importing}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-semibold text-white transition-colors disabled:opacity-50"
            >
              {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              Importar {rows.length.toLocaleString()} filas
            </button>
          </div>
        </div>
      )}

      {/* Resultado */}
      {result && (
        <div className={`flex items-start gap-3 rounded-xl px-4 py-3 border ${result.ok ? "bg-emerald-500/8 border-emerald-500/20" : "bg-red-500/8 border-red-500/20"}`}>
          {result.ok ? <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" /> : <XCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />}
          <div className="text-sm space-y-0.5">
            <p className="text-white font-medium">{result.ok ? "Importación completada" : "Error en importación"}</p>
            <p className="text-white/50 text-xs">
              {result.insertadas} nuevas · {result.actualizadas} actualizadas · {result.errores} errores · {result.total} total
            </p>
          </div>
          <button onClick={() => setResult(null)} className="ml-auto text-white/30 hover:text-white/60"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Resumen de BD */}
      {periodos.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="h-px flex-1 bg-white/10" />
            <span className="text-[11px] text-white/30 font-medium px-2">DATOS EN BASE DE DATOS</span>
            <div className="h-px flex-1 bg-white/10" />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-white/30 text-left border-b border-white/10">
                  <th className="pb-2 pr-4">Período</th>
                  <th className="pb-2 pr-4 text-right">Empleados</th>
                  <th className="pb-2 pr-4 text-right">Ordinario</th>
                  <th className="pb-2 pr-4 text-right">Bonificación</th>
                  <th className="pb-2 pr-4 text-right">Total Dev.</th>
                  <th className="pb-2 text-right">Total Líquido</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {periodos.map((p, i) => (
                  <tr key={i} className="text-white/60">
                    <td className="py-1.5 pr-4 font-medium text-white/80">
                      {MESES_DLS[p.lbl_mes]} {p.lbl_ano} Q{p.lbl_pla}
                    </td>
                    <td className="py-1.5 pr-4 text-right">{Number(p.empleados).toLocaleString()}</td>
                    <td className="py-1.5 pr-4 text-right">{fmtQDLS(p.total_ordinario)}</td>
                    <td className="py-1.5 pr-4 text-right text-blue-300">{fmtQDLS(p.total_bonificacion)}</td>
                    <td className="py-1.5 pr-4 text-right">{fmtQDLS(p.total_devengado)}</td>
                    <td className="py-1.5 text-right text-yellow-300 font-semibold">{fmtQDLS(p.total_liquido)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Materializar en Planillas */}
      {periodos.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="h-px flex-1 bg-white/10" />
            <span className="text-[11px] text-white/30 font-medium px-2">MATERIALIZAR EN PLANILLAS</span>
            <div className="h-px flex-1 bg-white/10" />
          </div>

          <div className="bg-[#0f1623] border border-yellow-500/20 rounded-xl p-4 space-y-3">
            <p className="text-xs text-white/50">
              Convierte los datos importados en planillas cerradas del sistema. Solo se crea una planilla por período — si ya existe una real (generada desde pre-planilla), no se sobreescribe.
            </p>

            <button
              onClick={doMaterializar}
              disabled={materializing}
              className="flex items-center gap-2 px-4 py-2 bg-yellow-500 hover:bg-yellow-400 text-black rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
            >
              {materializing
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Materializando períodos…</>
                : <><Wand2 className="w-4 h-4" /> Materializar Histórico en Planillas</>
              }
            </button>

            {matResult && (
              <div className={`flex items-start gap-3 rounded-xl px-4 py-3 border ${matResult.ok ? "bg-emerald-500/8 border-emerald-500/20" : "bg-amber-500/8 border-amber-500/20"}`}>
                {matResult.ok
                  ? <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  : <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                }
                <div className="text-xs space-y-1 flex-1">
                  <p className="text-white font-medium">
                    {matResult.planillas_creadas} planillas creadas · {matResult.planillas_actualizadas} actualizadas · {matResult.lineas_creadas.toLocaleString()} líneas
                  </p>
                  <p className="text-white/40">
                    {matResult.periodos_omitidos} períodos omitidos (planillas reales existentes) · {matResult.total_periodos} períodos procesados en total
                  </p>
                  {matResult.errores.length > 0 && (
                    <div className="mt-1 space-y-0.5">
                      {matResult.errores.map((e, i) => (
                        <p key={i} className="text-red-300 font-mono text-[10px]">{e}</p>
                      ))}
                    </div>
                  )}
                </div>
                <button onClick={() => setMatResult(null)} className="text-white/30 hover:text-white/60">
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Ayuda */}
      {periodos.length === 0 && rows.length === 0 && !result && (
        <div className="bg-white/[0.02] border border-white/10 rounded-xl p-4 space-y-1.5">
          <p className="text-xs font-semibold text-white/50">¿Por qué usar este archivo?</p>
          <ul className="space-y-1 text-xs text-white/35 list-disc list-inside">
            <li>Tiene la bonificación incentivo (<code className="text-blue-300/70">BONI</code>) separada del salario ordinario</li>
            <li>Cubre desde Mayo 2025 — más historial que el archivo anterior</li>
            <li>Una vez importado, el Libro de Salarios lo usará automáticamente</li>
            <li>Las filas duplicadas se actualizan sin error</li>
          </ul>
        </div>
      )}
    </div>
  );
}

const LEGACY_TAB_ID          = "sistema-antiguo";
const LEGACY_CLIENTES_TAB_ID = "sistema-antiguo-clientes";
const LIBRO_SAL_TAB_ID          = "libro-salarios";
const DEV_EMP_TAB_ID            = "devengados-empleado";
const DETALLE_LIB_SAL_TAB_ID    = "detalle-lib-sal";
const DETALLE_PREST_TAB_ID      = "detalle-prestaciones";
const DIGECAM_TAB_ID            = "digecam-armas";
const ALMACEN_TAB_ID            = "almacen-inventario";
const CARGA_MAESTRA_TAB_ID      = "carga-maestra";
const PLANTILLA_TURNOS_TAB_ID   = "plantilla-turnos";

// ─── LibroSalariosTab ─────────────────────────────────────────────────────────
const MESES_LS = ["","Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];

interface LibSalRow {
  emp_nit?: string; pla_numero?: number; empl_numero: number;
  lbl_tpla?: string; lbl_ano: number; lbl_mes: number; lbl_pla: number;
  lbl_dt?: number; lbl_dsigss?: number; lbl_dsemp?: number;
  lbl_faltas?: number; lbl_dvac?: number; lbl_hrses?: number;
  lbl_hrsed?: number; lbl_hrst?: number;
  lbl_tdev?: number; lbl_tdes?: number; lbl_liquido?: number;
  lbl_bono14?: number; lbl_aguinaldo?: number; lbl_vacaciones?: number;
  lbl_indem?: number; lbl_ordinario?: number;
  depto_codigo?: string; lbl_dsep?: number; lbl_dasu?: number; lbl_dsigssa?: number;
}

interface ResumenPeriodoLS {
  lbl_ano: string; lbl_mes: string; lbl_pla: string;
  empleados: string; total_ordinario: string; total_devengado: string; total_liquido: string;
}

function LibroSalariosTab() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<LibSalRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [dragging, setDragging] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ preview: boolean; total: number; insertadas: number; actualizadas: number; errores: number } | null>(null);
  const [formatoDetectado, setFormatoDetectado] = useState<"historial" | "detalle" | "desconocido" | null>(null);

  const { data: resumenData, refetch: refetchResumen } = useQuery<{ periodos: ResumenPeriodoLS[] }>({
    queryKey: ["lib-sal-resumen"],
    queryFn: () => fetch(`${API_BASE}/igss/lib-sal/resumen`, { headers: { "x-isp-session": getSession() } }).then(r => r.json()),
  });
  const periodos = resumenData?.periodos ?? [];

  const parseFile = useCallback((file: File) => {
    setResult(null);
    setFormatoDetectado(null);
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer);
        const wb = await XLSX.read(data, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: 0 });
        // Detectar formato por las columnas de la primera fila
        const firstKeys = rawRows.length > 0 ? Object.keys(rawRows[0]).map(k => k.trim().toLowerCase()) : [];
        const esDetalle  = firstKeys.includes("ord") || firstKeys.includes("boni");
        const esHistorial = firstKeys.includes("lbl_ordinario") || firstKeys.includes("lbl_tdev") || firstKeys.includes("lbl_liquido");
        setFormatoDetectado(esDetalle ? "detalle" : esHistorial ? "historial" : "desconocido");
        // Normalizar a minúsculas
        const normalized = rawRows.map((row) => {
          const out: Record<string, unknown> = {};
          for (const key of Object.keys(row)) {
            out[key.trim().toLowerCase()] = row[key];
          }
          return out as unknown as LibSalRow;
        });
        setRows(normalized);
        setFileName(file.name);
      } catch {
        alert("No se pudo leer el archivo. Verifica que sea un Excel .xlsx válido.");
      }
    };
    reader.readAsArrayBuffer(file);
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) parseFile(file);
  }, [parseFile]);

  const doImport = async (preview: boolean) => {
    if (rows.length === 0) return;
    setImporting(true);
    try {
      const res = await fetch(`${API_BASE}/igss/importar-lib-sal`, {
        method: "POST",
        headers: { "x-isp-session": getSession(), "Content-Type": "application/json" },
        body: JSON.stringify({ rows, preview }),
      });
      const d = await res.json();
      setResult(d);
      if (!preview) { setRows([]); setFileName(""); refetchResumen(); }
    } catch {
      alert("Error de red al importar");
    } finally {
      setImporting(false);
    }
  };

  const empsCnt = rows.length > 0 ? new Set(rows.map(r => r.empl_numero)).size : 0;
  const periodoMin = rows.length > 0 ? rows.reduce((m, r) => r.lbl_ano * 100 + r.lbl_mes < m ? r.lbl_ano * 100 + r.lbl_mes : m, 999999) : null;
  const periodoMax = rows.length > 0 ? rows.reduce((m, r) => r.lbl_ano * 100 + r.lbl_mes > m ? r.lbl_ano * 100 + r.lbl_mes : m, 0) : null;
  const fmtP = (n: number | null) => n ? `${MESES_LS[n % 100] ?? n % 100} ${Math.floor(n / 100)}` : "";

  // Diagnóstico: ¿tienen valores reales los campos clave?
  const algunoConLiquido = rows.length > 0 && rows.some(r => Number((r as any).lbl_liquido) > 0);
  const esFormatoDetalle = formatoDetectado === "detalle";

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
        <div>
          <p className="text-sm font-bold text-white">Libro de Salarios ODBC</p>
          <p className="text-[11px] text-white/40 mt-0.5">Importa el archivo dbo_LibSal_*.xlsx exportado del sistema anterior</p>
        </div>
        {periodos.length > 0 && (
          <span className="ml-auto text-[10px] text-emerald-400/60 bg-emerald-400/8 border border-emerald-400/20 px-2 py-0.5 rounded-full flex items-center gap-1">
            <Database className="w-2.5 h-2.5" />{periodos.reduce((s, p) => s + Number(p.empleados), 0).toLocaleString()} registros en BD
          </span>
        )}
      </div>

      {/* Drop zone */}
      {rows.length === 0 && !result && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => fileRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-12 flex flex-col items-center justify-center gap-3 cursor-pointer transition-all ${dragging ? "border-emerald-400/60 bg-emerald-400/5" : "border-white/10 hover:border-white/20 bg-white/2"}`}
        >
          <Upload className={`w-9 h-9 ${dragging ? "text-emerald-400" : "text-white/20"}`} />
          <div className="text-center">
            <p className="text-sm text-white/50">Arrastra el Excel aquí o haz clic para seleccionar</p>
            <p className="text-[10px] text-white/25 mt-1">dbo_LibSal_*.xlsx exportado del sistema ODBC</p>
          </div>
          <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={e => { const f = e.target.files?.[0]; if (f) parseFile(f); }} className="hidden" />
        </div>
      )}

      {/* Preview del archivo cargado */}
      {rows.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
              <span className="text-sm text-white font-semibold">{fileName}</span>
              <span className="text-[10px] text-white/40 bg-white/5 px-2 py-0.5 rounded-full">{rows.length.toLocaleString()} filas</span>
              <span className="text-[10px] text-emerald-400/60 bg-emerald-400/8 px-2 py-0.5 rounded-full">{empsCnt} empleados</span>
              {periodoMin && <span className="text-[10px] text-white/30 bg-white/5 px-2 py-0.5 rounded-full">{fmtP(periodoMin)} → {fmtP(periodoMax)}</span>}
            </div>
            <button onClick={() => { setRows([]); setFileName(""); setResult(null); }} className="text-[10px] text-white/30 hover:text-white/60 flex items-center gap-1 transition-colors">
              <X className="w-3 h-3" /> Quitar
            </button>
          </div>

          {/* Diagnóstico de formato */}
          {esFormatoDetalle ? (
            <div className="flex items-start gap-2 bg-amber-500/8 border border-amber-500/20 rounded-lg px-3 py-3">
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div className="text-xs text-amber-300 space-y-1">
                <p className="font-semibold">Este es el archivo de Detalle de Nómina, no el Libro de Salarios.</p>
                <p className="text-amber-300/70">
                  Tiene columnas <code className="text-amber-200/80">ORD</code>, <code className="text-amber-200/80">BONI</code>, <code className="text-amber-200/80">IGSS</code>…
                  Ve a la pestaña <strong>"Detalle Nómina ODBC"</strong> para importarlo correctamente.
                </p>
              </div>
            </div>
          ) : algunoConLiquido ? (
            <div className="flex items-center gap-2 bg-emerald-500/8 border border-emerald-500/20 rounded-lg px-3 py-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <p className="text-xs text-emerald-300">Formato correcto — columnas <code className="text-emerald-200/80">LBL_LIQUIDO</code>, <code className="text-emerald-200/80">LBL_ORDINARIO</code> detectadas con valores.</p>
            </div>
          ) : (
            <div className="flex items-center gap-2 bg-red-500/8 border border-red-500/20 rounded-lg px-3 py-2">
              <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
              <p className="text-xs text-red-300">
                Los montos aparecen en cero — verifica que el Excel tenga columnas <code className="text-red-200/80">LBL_LIQUIDO</code>, <code className="text-red-200/80">LBL_ORDINARIO</code>, etc.
              </p>
            </div>
          )}

          <div className="overflow-x-auto rounded-lg border border-white/8">
            <table className="w-full text-[10px]">
              <thead>
                <tr className="bg-white/5 text-white/40 border-b border-white/8">
                  {["Cód.", "Año", "Mes", "Q", "Ordinario", "Devengado", "Descuentos", "Líquido", "Bono14", "Aguinaldo"].map(h => (
                    <th key={h} className={`px-2 py-1.5 font-medium ${["Ordinario","Devengado","Descuentos","Líquido","Bono14","Aguinaldo"].includes(h) ? "text-right" : "text-left"}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 15).map((r, i) => {
                  const fmtNum = (v: unknown) => {
                    const n = Number(v);
                    return isNaN(n) ? <span className="text-white/20">—</span> : n.toLocaleString("es-GT", { minimumFractionDigits: 2 });
                  };
                  return (
                    <tr key={i} className="border-b border-white/5 hover:bg-white/3 transition-colors">
                      <td className="px-2 py-1.5 font-mono text-white/60">{r.empl_numero}</td>
                      <td className="px-2 py-1.5 text-white/50">{r.lbl_ano}</td>
                      <td className="px-2 py-1.5 text-white/50">{MESES_LS[r.lbl_mes] ?? r.lbl_mes}</td>
                      <td className="px-2 py-1.5 text-white/40">Q{r.lbl_pla}</td>
                      <td className="px-2 py-1.5 text-right text-white/60">{fmtNum(r.lbl_ordinario)}</td>
                      <td className="px-2 py-1.5 text-right text-white/60">{fmtNum(r.lbl_tdev)}</td>
                      <td className="px-2 py-1.5 text-right text-red-400/60">{fmtNum(r.lbl_tdes)}</td>
                      <td className="px-2 py-1.5 text-right text-emerald-400/80 font-semibold">{fmtNum(r.lbl_liquido)}</td>
                      <td className="px-2 py-1.5 text-right text-blue-300/60">{fmtNum(r.lbl_bono14)}</td>
                      <td className="px-2 py-1.5 text-right text-purple-300/60">{fmtNum(r.lbl_aguinaldo)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {rows.length > 15 && (
              <p className="text-center text-[9px] text-white/20 py-1.5 border-t border-white/5">
                Mostrando 15 de {rows.length.toLocaleString()} filas
              </p>
            )}
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <button onClick={() => doImport(false)} disabled={importing || esFormatoDetalle}
              title={esFormatoDetalle ? "Archivo incorrecto — usa la pestaña Detalle Nómina ODBC" : undefined}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-30 disabled:cursor-not-allowed text-white text-xs font-semibold rounded-xl transition-all">
              {importing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Database className="w-3.5 h-3.5" />}
              Importar {rows.length.toLocaleString()} registros
            </button>
            <button onClick={() => doImport(true)} disabled={importing || esFormatoDetalle}
              title={esFormatoDetalle ? "Archivo incorrecto — usa la pestaña Detalle Nómina ODBC" : undefined}
              className="flex items-center gap-2 px-3 py-2 bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed text-white/50 hover:text-white text-xs rounded-xl border border-white/10 transition-all">
              <CheckCircle2 className="w-3.5 h-3.5" /> Previsualizar sin guardar
            </button>
          </div>
        </div>
      )}

      {/* Resultado */}
      {result && (
        <div className={`rounded-xl border p-4 space-y-3 ${result.errores > 0 ? "bg-amber-500/5 border-amber-500/20" : "bg-emerald-500/5 border-emerald-500/20"}`}>
          <div className="flex items-center gap-2">
            {result.errores === 0 ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <AlertCircle className="w-4 h-4 text-amber-400" />}
            <p className="text-sm font-semibold text-white">{result.preview ? "Previsualización" : "Importación completada"}</p>
          </div>
          <div className="grid grid-cols-4 gap-3 text-center">
            <div className="bg-white/5 rounded-lg py-2 px-1"><p className="text-[10px] text-white/30">Total</p><p className="text-lg font-bold text-white">{result.total.toLocaleString()}</p></div>
            <div className="bg-emerald-400/10 rounded-lg py-2 px-1"><p className="text-[10px] text-emerald-300/50">{result.preview ? "Válidos" : "Nuevos"}</p><p className="text-lg font-bold text-emerald-300">{result.insertadas.toLocaleString()}</p></div>
            {!result.preview && <div className="bg-blue-400/10 rounded-lg py-2 px-1"><p className="text-[10px] text-blue-300/50">Actualizados</p><p className="text-lg font-bold text-blue-300">{result.actualizadas.toLocaleString()}</p></div>}
            <div className={`${result.errores > 0 ? "bg-red-400/10" : "bg-white/5"} rounded-lg py-2 px-1`}><p className="text-[10px] text-red-300/50">Errores</p><p className={`text-lg font-bold ${result.errores > 0 ? "text-red-300" : "text-white/30"}`}>{result.errores}</p></div>
          </div>
          {!result.preview && result.errores === 0 && (
            <button onClick={() => { setResult(null); }} className="w-full text-[10px] text-white/30 hover:text-white/60 transition-colors">
              Importar otro archivo
            </button>
          )}
        </div>
      )}

      {/* Historial en BD */}
      {periodos.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-3.5 h-3.5 text-white/30" />
            <p className="text-[10px] text-white/30 uppercase tracking-widest">Períodos en base de datos</p>
          </div>
          <div className="overflow-x-auto rounded-lg border border-white/8">
            <table className="w-full text-[10px]">
              <thead>
                <tr className="bg-white/5 text-white/40 border-b border-white/8">
                  {["Período","Empleados","Ordinario","Devengado","Líquido"].map(h => (
                    <th key={h} className={`px-3 py-2 font-medium ${h === "Período" ? "text-left" : "text-right"}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {periodos.map((p, i) => (
                  <tr key={i} className="border-b border-white/5 hover:bg-white/3 transition-colors">
                    <td className="px-3 py-2 font-semibold text-white/70">
                      {MESES_LS[Number(p.lbl_mes)] ?? p.lbl_mes} {p.lbl_ano}
                      <span className="ml-1 text-[9px] text-white/25">Q{p.lbl_pla}</span>
                    </td>
                    <td className="px-3 py-2 text-right text-white/50">{Number(p.empleados).toLocaleString()}</td>
                    <td className="px-3 py-2 text-right text-white/50">Q {Number(p.total_ordinario).toLocaleString("es-GT", { minimumFractionDigits: 2 })}</td>
                    <td className="px-3 py-2 text-right text-white/50">Q {Number(p.total_devengado).toLocaleString("es-GT", { minimumFractionDigits: 2 })}</td>
                    <td className="px-3 py-2 text-right text-emerald-400/70 font-semibold">Q {Number(p.total_liquido).toLocaleString("es-GT", { minimumFractionDigits: 2 })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── DevengadosEmpleadoTab ────────────────────────────────────────────────────
interface DevPlaRow { emp_nit?: string; empl_numero: number; pla_numero: number; dev_codigo: string; dev_monto: number; }
interface DevResumen { total_empleados: string; con_sueldo: string; con_bon_incentivo: string; con_bon1: string; con_bon2: string; avg_sueldo: string; }

function DevengadosEmpleadoTab() {
  const fileRef  = useRef<HTMLInputElement>(null);
  const [rows, setRows]       = useState<DevPlaRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult]   = useState<{ actualizados?: number; sinVinculo?: number; total?: number; preview?: boolean; muestra?: any[] } | null>(null);
  const [previewed, setPreviewed] = useState(false);

  const { data: resumen, refetch: refetchResumen } = useQuery<DevResumen>({
    queryKey: ["igss-devengados-resumen"],
    queryFn: () => fetch(`${API_BASE}/igss/devengados/resumen`, { headers: { "x-isp-session": getSession() } }).then((r) => r.json()),
  });

  const parseFile = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      const buf = new Uint8Array(e.target?.result as ArrayBuffer);
      const wb = await XLSX.read(buf, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json<DevPlaRow>(ws, { defval: 0 });
      setRows(data);
      setResult(null);
      setPreviewed(false);
    };
    reader.readAsArrayBuffer(file);
  }, []);

  const onDrop = useCallback((ev: React.DragEvent) => {
    ev.preventDefault();
    const f = ev.dataTransfer.files[0];
    if (f) parseFile(f);
  }, [parseFile]);

  async function run(preview: boolean) {
    if (!rows.length) return;
    setLoading(true);
    try {
      const r = await fetch(`${API_BASE}/igss/importar-devengados`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-isp-session": getSession() },
        body: JSON.stringify({ rows, preview }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "Error");
      setResult(d);
      if (preview) setPreviewed(true);
      else { setPreviewed(false); refetchResumen(); }
    } catch (e: any) {
      setResult({ actualizados: -1 });
    } finally {
      setLoading(false);
    }
  }

  const fmtQ = (n: string | null) => n ? "Q" + Number(n).toLocaleString("es-GT", { minimumFractionDigits: 2 }) : "—";

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <p className="text-sm font-semibold text-white">Salarios y Bonificaciones por Empleado</p>
        <p className="text-xs text-white/40">
          Importa el archivo <span className="text-white/60 font-mono">dbo_DevPlaEmp.xlsx</span> del sistema anterior.
          Actualiza <strong className="text-white/70">sueldo base</strong>, <strong className="text-white/70">bonificación incentivo</strong> y bonificaciones adicionales en la ficha de cada colaborador.
          También alimenta el cálculo de planillas.
        </p>
      </div>

      {/* Estado actual en el sistema */}
      {resumen && (
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: "Con sueldo base", value: resumen.con_sueldo + " / " + resumen.total_empleados, color: "text-white" },
            { label: "Con bon. incentivo", value: resumen.con_bon_incentivo, color: "text-emerald-400" },
            { label: "Sueldo promedio", value: fmtQ(resumen.avg_sueldo), color: "text-primary" },
          ].map((k) => (
            <div key={k.label} className="bg-white/[0.03] border border-white/8 rounded-xl p-3 text-center">
              <p className="text-[10px] text-white/30 mb-0.5">{k.label}</p>
              <p className={`text-sm font-bold ${k.color}`}>{k.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Upload */}
      <div
        onDrop={onDrop} onDragOver={(e) => e.preventDefault()}
        onClick={() => fileRef.current?.click()}
        className="border-2 border-dashed border-white/15 hover:border-emerald-400/40 rounded-xl p-8 text-center cursor-pointer transition-colors group"
      >
        <Upload className="w-8 h-8 text-white/20 group-hover:text-emerald-400/60 mx-auto mb-2 transition-colors" />
        <p className="text-sm text-white/40 group-hover:text-white/60 transition-colors">
          {rows.length > 0 ? `${rows.length} filas cargadas — haz clic para cambiar el archivo` : "Arrastra el archivo dbo_DevPlaEmp.xlsx aquí o haz clic"}
        </p>
        <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) parseFile(f); }} />
      </div>

      {/* Preview */}
      {rows.length > 0 && (
        <div>
          <p className="text-xs text-white/40 mb-2">Vista previa — primeras 6 filas cargadas:</p>
          <div className="overflow-x-auto rounded-xl border border-white/8">
            <table className="w-full text-[11px]">
              <thead className="bg-white/[0.04] text-white/40">
                <tr>
                  {["empl_numero","pla_numero","dev_codigo","dev_monto"].map((h) => (
                    <th key={h} className="px-3 py-2 text-left font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 6).map((r, i) => (
                  <tr key={i} className="border-t border-white/5">
                    <td className="px-3 py-1.5 text-white/70">{r.empl_numero}</td>
                    <td className="px-3 py-1.5 text-white/50">Q{r.pla_numero}</td>
                    <td className="px-3 py-1.5 font-mono text-primary/70">{r.dev_codigo}</td>
                    <td className="px-3 py-1.5 text-right text-white/70">Q{Number(r.dev_monto).toLocaleString("es-GT", { minimumFractionDigits: 2 })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Resultado */}
      {result && !result.preview && (
        <div className={`flex items-start gap-2.5 rounded-xl p-3 border text-xs ${
          (result.actualizados ?? 0) >= 0
            ? "bg-emerald-400/10 border-emerald-400/20 text-emerald-300"
            : "bg-red-400/10 border-red-400/20 text-red-300"
        }`}>
          <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
          <div>
            <strong>{result.actualizados}</strong> colaboradores actualizados · <strong>{result.sinVinculo}</strong> sin vínculo en el sistema (de {result.total} en el archivo).
          </div>
        </div>
      )}
      {result?.preview && result.muestra && (
        <div className="space-y-2">
          <p className="text-xs text-white/40">Previsualización — muestra de {result.total} empleados:</p>
          <div className="overflow-x-auto rounded-xl border border-white/8">
            <table className="w-full text-[11px]">
              <thead className="bg-white/[0.04] text-white/40">
                <tr>
                  {["empl_numero","Sueldo base","Bon. Incentivo","Bon. 1","Bon. 2"].map((h) => (
                    <th key={h} className="px-3 py-2 text-left font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.muestra.map((m: any, i: number) => (
                  <tr key={i} className="border-t border-white/5">
                    <td className="px-3 py-1.5 text-white/70">{m.empl_numero}</td>
                    <td className="px-3 py-1.5">{m.sueldo_base ? "Q"+Number(m.sueldo_base).toLocaleString("es-GT",{minimumFractionDigits:2}) : "—"}</td>
                    <td className="px-3 py-1.5 text-emerald-400">{m.bonificacion_incentivo ? "Q"+Number(m.bonificacion_incentivo).toLocaleString("es-GT",{minimumFractionDigits:2}) : "—"}</td>
                    <td className="px-3 py-1.5">{m.bonificacion_1 ? "Q"+m.bonificacion_1 : "—"}</td>
                    <td className="px-3 py-1.5">{m.bonificacion_2 ? "Q"+m.bonificacion_2 : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Botones */}
      {rows.length > 0 && (
        <div className="flex gap-2">
          <button
            onClick={() => run(true)} disabled={loading}
            className="flex items-center gap-1.5 text-xs bg-white/10 hover:bg-white/15 text-white px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            Previsualizar
          </button>
          {previewed && (
            <button
              onClick={() => run(false)} disabled={loading}
              className="flex items-center gap-1.5 text-xs bg-emerald-500 hover:bg-emerald-400 text-white px-4 py-1.5 rounded-lg font-semibold transition-colors disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
              Importar a fichas de empleados
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── DetallePrestacionesTab ───────────────────────────────────────────────────
interface DPRow {
  empl_numero: number; pre_ano: number; pre_mes: number; pla_numero: number; dias_lab: number;
  pro_bono14: number; pro_aguinaldo: number; pro_vacaciones: number; pro_indemnizacion: number;
  base_bono14: number; base_aguinaldo: number; base_vacas: number; base_indem: number;
}

function DetallePrestacionesTab() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<DPRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [dragging, setDragging] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ total: number; insertadas: number; actualizadas: number; errores: number } | null>(null);

  const { data: resumenBD } = useQuery<{ resumen: { empleados: string; bono14: string; aguinaldo: string; vacaciones: string; indem: string; filas: string } }>({
    queryKey: ["dprest-resumen"],
    queryFn: () => fetch(`${API_BASE}/prestaciones/resumen-odbc`, { headers: { "x-isp-session": getSession() } }).then(r => r.json()),
    staleTime: 30_000,
  });
  const totBD = resumenBD?.resumen;

  const parseFile = useCallback((file: File) => {
    setResult(null);
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer);
        const wb = await XLSX.read(data, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: 0 });
        const parsed: DPRow[] = raw.map((r) => ({
          empl_numero:       Number(r.empl_numero ?? 0),
          pre_ano:           Number(r.pre_ano ?? 0),
          pre_mes:           Number(r.pre_mes ?? 0),
          pla_numero:        Number(r.pla_numero ?? 1),
          dias_lab:          Number(r.dias_lab ?? 0),
          pro_bono14:        Number(r.pro_bono14 ?? 0),
          pro_aguinaldo:     Number(r.pro_aguinaldo ?? 0),
          pro_vacaciones:    Number(r.pro_vacaciones ?? 0),
          pro_indemnizacion: Number(r.pro_indemnizacion ?? 0),
          base_bono14:       Number(r.base_bono14 ?? 0),
          base_aguinaldo:    Number(r.base_aguinaldo ?? 0),
          base_vacas:        Number(r.base_vacas ?? 0),
          base_indem:        Number(r.base_indem ?? 0),
        })).filter(r => r.empl_numero > 0 && r.pre_ano > 2000);
        setRows(parsed);
        setFileName(file.name);
      } catch {
        alert("No se pudo leer el archivo.");
      }
    };
    reader.readAsArrayBuffer(file);
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) parseFile(file);
  }, [parseFile]);

  const doImport = async () => {
    if (!rows.length) return;
    setImporting(true);
    try {
      const CHUNK = 500;
      let insertadas = 0; let actualizadas = 0; let errores = 0;
      for (let i = 0; i < rows.length; i += CHUNK) {
        const chunk = rows.slice(i, i + CHUNK);
        const r = await fetch(`${API_BASE}/prestaciones/importar-detalle-odbc`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-isp-session": getSession() },
          body: JSON.stringify({ rows: chunk }),
        });
        const d = await r.json();
        insertadas  += d.insertadas  ?? 0;
        actualizadas += d.actualizadas ?? 0;
        errores     += d.errores      ?? 0;
      }
      setResult({ total: rows.length, insertadas, actualizadas, errores });
    } catch (err) {
      alert("Error al importar: " + String(err));
    } finally {
      setImporting(false);
    }
  };

  const fmtQ = (v: number) => `Q${v.toLocaleString("es-GT", { minimumFractionDigits: 2 })}`;
  const MESES = ["","Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];

  const totalBono14 = rows.reduce((s,r) => s + r.pro_bono14, 0);
  const totalAgu    = rows.reduce((s,r) => s + r.pro_aguinaldo, 0);
  const totalVac    = rows.reduce((s,r) => s + r.pro_vacaciones, 0);
  const totalInd    = rows.reduce((s,r) => s + r.pro_indemnizacion, 0);
  const empleadosArchivo = new Set(rows.map(r => r.empl_numero)).size;

  return (
    <div className="space-y-6">
      {/* Header + badge BD */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold text-white">Detalle Prestaciones ODBC</h2>
          <p className="text-xs text-white/40 mt-0.5">Importa <code>dbo_DetallePrestaciones*.xlsx</code> — provisiones por colaborador: Bono14, Aguinaldo, Vacaciones, Indemnización</p>
        </div>
        {totBD && Number(totBD.filas) > 0 && (
          <div className="flex items-center gap-2 bg-teal-500/10 border border-teal-500/20 rounded-xl px-3 py-1.5 shrink-0">
            <CheckCircle2 className="w-3.5 h-3.5 text-teal-400" />
            <span className="text-xs text-teal-300 font-medium">{Number(totBD.empleados).toLocaleString()} colaboradores en BD</span>
          </div>
        )}
      </div>

      {/* Contexto de ciclos */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Bono14 2025", desc: "Jul 2024 – Jun 2025", badge: "Ya pagado", color: "emerald" },
          { label: "Aguinaldo 2025", desc: "Dic 2024 – Nov 2025", badge: "Ya pagado", color: "emerald" },
          { label: "Bono14 2026", desc: "Jul 2025 – Jun 2026", badge: "Acumulando", color: "blue" },
          { label: "Aguinaldo 2026", desc: "Dic 2025 – Nov 2026", badge: "Acumulando", color: "blue" },
        ].map(c => (
          <div key={c.label} className={`bg-${c.color}-500/5 border border-${c.color}-500/15 rounded-xl p-3`}>
            <p className="text-xs font-semibold text-white">{c.label}</p>
            <p className="text-[10px] text-white/40 mt-0.5">{c.desc}</p>
            <span className={`inline-flex mt-1.5 text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-${c.color}-500/15 text-${c.color}-300`}>{c.badge}</span>
          </div>
        ))}
      </div>

      {/* Drop zone */}
      {!rows.length ? (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => fileRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-10 flex flex-col items-center gap-3 cursor-pointer transition-all ${
            dragging ? "border-teal-400/60 bg-teal-500/8" : "border-white/15 hover:border-teal-400/40 hover:bg-white/2"
          }`}
        >
          <FileSpreadsheet className="w-10 h-10 text-teal-400/50" />
          <p className="text-sm text-white/50">Arrastra <code className="text-teal-300/80">dbo_DetallePrestaciones*.xlsx</code> aquí</p>
          <p className="text-xs text-white/25">o haz clic para seleccionar</p>
          <input ref={fileRef} type="file" accept=".xlsx" className="hidden" onChange={(e) => e.target.files?.[0] && parseFile(e.target.files[0])} />
        </div>
      ) : (
        <div className="space-y-4">
          {/* File info */}
          <div className="flex items-center justify-between bg-white/3 border border-white/8 rounded-xl px-4 py-3">
            <div className="flex items-center gap-3">
              <FileSpreadsheet className="w-5 h-5 text-teal-400" />
              <div>
                <p className="text-sm font-medium text-white">{fileName}</p>
                <p className="text-xs text-white/40">{rows.length.toLocaleString()} filas · {empleadosArchivo} colaboradores</p>
              </div>
            </div>
            <button onClick={() => { setRows([]); setFileName(""); setResult(null); }} className="flex items-center gap-1 text-xs text-white/30 hover:text-red-400 transition-colors">
              <X className="w-3 h-3" /> Quitar
            </button>
          </div>

          {/* Resumen de totales del archivo */}
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: "Bono 14 acumulado", val: totalBono14, color: "blue" },
              { label: "Aguinaldo acumulado", val: totalAgu, color: "purple" },
              { label: "Vacaciones acumuladas", val: totalVac, color: "emerald" },
              { label: "Indemnización acumulada", val: totalInd, color: "amber" },
            ].map(c => (
              <div key={c.label} className={`bg-${c.color}-500/5 border border-${c.color}-500/15 rounded-xl p-3`}>
                <p className="text-[10px] text-white/40">{c.label}</p>
                <p className={`text-sm font-bold text-${c.color}-300 mt-0.5`}>{fmtQ(c.val)}</p>
              </div>
            ))}
          </div>

          {/* Preview table */}
          <div className="overflow-x-auto rounded-lg border border-white/8">
            <table className="w-full text-[10px]">
              <thead>
                <tr className="bg-white/5 text-white/40 border-b border-white/8">
                  {["Cód.", "Año", "Mes", "Q", "Días", "Bono14", "Aguinaldo", "Vacaciones", "Indem", "Base Sal."].map(h => (
                    <th key={h} className={`px-2 py-1.5 font-medium ${["Bono14","Aguinaldo","Vacaciones","Indem","Base Sal."].includes(h) ? "text-right" : "text-left"}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 20).map((r, i) => (
                  <tr key={i} className="border-b border-white/5 hover:bg-white/3">
                    <td className="px-2 py-1.5 font-mono text-white/60">{r.empl_numero}</td>
                    <td className="px-2 py-1.5 text-white/50">{r.pre_ano}</td>
                    <td className="px-2 py-1.5 text-white/50">{MESES[r.pre_mes] ?? r.pre_mes}</td>
                    <td className="px-2 py-1.5 text-white/40">Q{r.pla_numero}</td>
                    <td className="px-2 py-1.5 text-white/40">{r.dias_lab}</td>
                    <td className="px-2 py-1.5 text-right text-blue-300/70">{fmtQ(r.pro_bono14)}</td>
                    <td className="px-2 py-1.5 text-right text-purple-300/70">{fmtQ(r.pro_aguinaldo)}</td>
                    <td className="px-2 py-1.5 text-right text-emerald-300/70">{fmtQ(r.pro_vacaciones)}</td>
                    <td className="px-2 py-1.5 text-right text-amber-300/70">{fmtQ(r.pro_indemnizacion)}</td>
                    <td className="px-2 py-1.5 text-right text-white/50">{fmtQ(r.base_bono14)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length > 20 && (
              <p className="text-center text-[9px] text-white/20 py-1.5 border-t border-white/5">
                Mostrando 20 de {rows.length.toLocaleString()} filas
              </p>
            )}
          </div>

          {/* Botón importar */}
          <button onClick={doImport} disabled={importing}
            className="flex items-center gap-2 px-4 py-2 bg-teal-500 hover:bg-teal-400 disabled:opacity-50 text-white text-xs font-semibold rounded-xl transition-all">
            {importing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Database className="w-3.5 h-3.5" />}
            Importar {rows.length.toLocaleString()} registros
          </button>
        </div>
      )}

      {/* Resultado */}
      {result && (
        <div className={`rounded-xl border p-4 ${result.errores > 0 ? "bg-amber-500/5 border-amber-500/20" : "bg-teal-500/5 border-teal-500/20"}`}>
          <div className="flex items-center gap-2 mb-3">
            {result.errores === 0 ? <CheckCircle2 className="w-4 h-4 text-teal-400" /> : <AlertCircle className="w-4 h-4 text-amber-400" />}
            <p className="text-sm font-semibold text-white">Importación completada</p>
          </div>
          <div className="grid grid-cols-4 gap-3 text-xs">
            {[
              { label: "Total", val: result.total, color: "white/60" },
              { label: "Nuevas", val: result.insertadas, color: "teal-300" },
              { label: "Actualizadas", val: result.actualizadas, color: "blue-300" },
              { label: "Errores", val: result.errores, color: result.errores > 0 ? "red-300" : "white/30" },
            ].map(s => (
              <div key={s.label} className="bg-white/3 rounded-lg p-2">
                <p className="text-white/40">{s.label}</p>
                <p className={`text-lg font-bold text-${s.color}`}>{s.val.toLocaleString()}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-white/40 mt-3">
            Ya podés ver los acumulados de Bono14, Aguinaldo, Vacaciones e Indemnización por colaborador en la sección de <strong className="text-white/60">Prestaciones Laborales</strong>.
          </p>
        </div>
      )}
    </div>
  );
}

// ─── AlmacenTab — importación de inventario de almacén desde Excel ────────────
interface ItemAlmacen {
  categoria: string;
  descripcion: string;
  talla: string | null;
  stock_bodega: number;
  stock_lavanderia: number;
  precio: number;
}
interface AlmacenResult {
  insertados: number; actualizados: number; total_errores: number;
  errores: string[]; categorias: Record<string, number>; preview: boolean;
}

function parseAlmacenSheet(sheet: any[][]): ItemAlmacen[] {
  const items: ItemAlmacen[] = [];
  let categoriaActual = "GENERAL";

  for (let i = 0; i < sheet.length; i++) {
    const row = sheet[i];
    if (!row || row.length === 0) continue;

    const celA = String(row[0] ?? "").trim();
    const celB = String(row[1] ?? "").trim();
    const celC = String(row[2] ?? "").trim();
    const celD = String(row[3] ?? "").trim();
    const celE = String(row[4] ?? "").trim();

    // Detectar cabecera de categoría: fila donde col A tiene texto pero col B/C/D están vacíos o también texto
    // y no tiene números en D/E
    const dNum = parseFloat(celD.replace(/,/g, ""));
    const eNum = parseFloat(celE.replace(/,/g, ""));
    const dIsNum = !isNaN(dNum) && celD !== "";
    const eIsNum = !isNaN(eNum) && celE !== "";

    // Si la fila tiene texto largo en col A y las columnas numéricas están vacías → categoría
    if (celA.length > 2 && !celB && !dIsNum && !eIsNum && celA === celA.toUpperCase()) {
      categoriaActual = celA;
      continue;
    }
    // Otro indicador de categoría: col A vacía, col B es texto mayúscula sin números
    if (!celA && celB.length > 3 && celB === celB.toUpperCase() && !dIsNum) {
      categoriaActual = celB;
      continue;
    }

    // Fila de item: necesita al menos descripción + cantidad en bodega
    let descripcion = "";
    let talla: string | null = null;
    let stockBodega = 0;
    let stockLav = 0;
    let precio = 0;

    // Detectar si col A es número de orden (fila de item numerada)
    const aNum = parseFloat(celA);
    if (!isNaN(aNum) && celA !== "") {
      descripcion = celB;
      // Check if celC is a talla (text like S, M, L, XL, XXL, XXXL, or number 37-43)
      const tallaPattern = /^(XS|S|M|L|XL|XXL|XXXL|3X|4X|\d{2})$/i;
      if (celC && tallaPattern.test(celC)) {
        talla = celC.toUpperCase();
        stockBodega = parseInt(celD.replace(/,/g, "")) || 0;
        stockLav    = parseInt(celE.replace(/,/g, "")) || 0;
        const celF  = String(row[5] ?? "").trim();
        precio = parseFloat(celF.replace(/[^0-9.]/g, "")) || 0;
      } else {
        stockBodega = parseInt(celC.replace(/,/g, "")) || 0;
        stockLav    = parseInt(celD.replace(/,/g, "")) || 0;
        precio      = parseFloat(celE.replace(/[^0-9.]/g, "")) || 0;
      }
    } else if (celA.length > 1 && (dIsNum || eIsNum)) {
      // Col A es descripción directamente
      descripcion = celA;
      const tallaPattern = /^(XS|S|M|L|XL|XXL|XXXL|3X|4X|\d{2})$/i;
      if (celB && tallaPattern.test(celB)) {
        talla = celB.toUpperCase();
        stockBodega = parseInt(celC.replace(/,/g, "")) || 0;
        stockLav    = parseInt(celD.replace(/,/g, "")) || 0;
        precio      = parseFloat(celE.replace(/[^0-9.]/g, "")) || 0;
      } else {
        stockBodega = parseInt(celC.replace(/,/g, "")) || parseInt(celD.replace(/,/g, "")) || 0;
        stockLav    = parseInt(celE.replace(/,/g, "")) || 0;
      }
    } else if (celB.length > 1 && (dIsNum || eIsNum)) {
      descripcion = celB;
      const tallaPattern = /^(XS|S|M|L|XL|XXL|XXXL|3X|4X|\d{2})$/i;
      if (celC && tallaPattern.test(celC)) {
        talla = celC.toUpperCase();
        stockBodega = parseInt(celD.replace(/,/g, "")) || 0;
        stockLav    = parseInt(celE.replace(/,/g, "")) || 0;
        const celF  = String(row[5] ?? "").trim();
        precio = parseFloat(celF.replace(/[^0-9.]/g, "")) || 0;
      } else {
        stockBodega = parseInt(celD.replace(/,/g, "")) || 0;
        stockLav    = parseInt(celE.replace(/,/g, "")) || 0;
      }
    }

    if (!descripcion || descripcion.length < 2) continue;
    if (stockBodega === 0 && stockLav === 0) continue;

    items.push({ categoria: categoriaActual, descripcion, talla, stock_bodega: stockBodega, stock_lavanderia: stockLav, precio });
  }

  return items;
}

function AlmacenTab() {
  const [step, setStep]         = useState<"upload" | "preview" | "result">("upload");
  const [items, setItems]       = useState<ItemAlmacen[]>([]);
  const [fileName, setFileName] = useState("");
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading]   = useState(false);
  const [result, setResult]     = useState<AlmacenResult | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const API = `${API_BASE}`;

  const reset = () => { setStep("upload"); setItems([]); setFileName(""); setResult(null); };

  const processFile = (file: File) => {
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer);
        const wb   = await XLSX.read(data, { type: "array" });
        // Tomar la primera hoja del libro
        const ws   = wb.Sheets[wb.SheetNames[0]];
        const raw  = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, defval: "" });
        const parsed = parseAlmacenSheet(raw as any[][]);
        setItems(parsed);
        setStep("preview");
      } catch (err) {
        alert("Error al leer el archivo. Asegúrate de que sea un .xlsx o .xls válido.");
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  };

  const handleImport = async (previewOnly: boolean) => {
    setLoading(true);
    try {
      const r = await fetch(`${API}/bodega/importar-inventario`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items, preview: previewOnly }),
      });
      const data = await r.json();
      setResult({ ...data, preview: previewOnly });
      if (!previewOnly) setStep("result");
    } catch (err) {
      alert("Error al comunicarse con el servidor.");
    } finally {
      setLoading(false);
    }
  };

  const categorias = items.reduce((acc, it) => {
    acc[it.categoria] = (acc[it.categoria] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  if (step === "upload") return (
    <div className="space-y-6">
      <div className="bg-teal-500/10 border border-teal-500/20 rounded-xl p-4">
        <p className="text-sm text-teal-300 font-medium mb-1">Inventario de Almacén · Excel</p>
        <p className="text-xs text-white/50">
          Sube el archivo <code className="font-mono bg-white/5 px-1 rounded">.xlsx</code> del inventario mensual.
          El sistema detecta categorías, artículos, tallas y stock (bodega + lavandería).
        </p>
      </div>

      <div
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileRef.current?.click()}
        className={`border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all ${
          dragging ? "border-teal-500/60 bg-teal-500/10" : "border-white/10 hover:border-teal-500/30 hover:bg-white/2"
        }`}
      >
        <Package className="w-12 h-12 mx-auto mb-4 text-white/20" />
        <p className="text-white/50 text-sm">Arrastra el archivo de inventario o haz clic para seleccionarlo</p>
        <p className="text-white/25 text-xs mt-1">INVENTARIO_DE_ALMACEN_*.xlsx</p>
        <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden"
          onChange={e => e.target.files?.[0] && processFile(e.target.files[0])} />
      </div>
    </div>
  );

  if (step === "preview") return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-white">{fileName}</h3>
          <p className="text-xs text-white/40 mt-0.5">{items.length} artículos detectados en {Object.keys(categorias).length} categorías</p>
        </div>
        <button onClick={reset} className="text-xs text-white/40 hover:text-white/60 flex items-center gap-1">
          <RotateCcw className="w-3.5 h-3.5" /> Cambiar archivo
        </button>
      </div>

      {/* Resumen por categoría */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
        {Object.entries(categorias).map(([cat, count]) => (
          <div key={cat} className="bg-teal-500/8 border border-teal-500/20 rounded-lg px-3 py-2">
            <p className="text-teal-300 text-xs font-semibold truncate">{cat}</p>
            <p className="text-white/50 text-xs mt-0.5">{count} artículo{count !== 1 ? "s" : ""}</p>
          </div>
        ))}
      </div>

      {/* Tabla de preview */}
      <div className="bg-white/3 border border-white/8 rounded-xl overflow-hidden">
        <div className="overflow-x-auto max-h-80">
          <table className="w-full text-xs">
            <thead className="bg-white/5 sticky top-0">
              <tr>
                <th className="text-left px-3 py-2 text-white/50">Categoría</th>
                <th className="text-left px-3 py-2 text-white/50">Descripción</th>
                <th className="text-left px-3 py-2 text-white/50">Talla</th>
                <th className="text-right px-3 py-2 text-white/50">Bodega</th>
                <th className="text-right px-3 py-2 text-white/50">Lavandería</th>
                <th className="text-right px-3 py-2 text-white/50">Precio</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {items.map((it, i) => (
                <tr key={i} className="hover:bg-white/3 transition-colors">
                  <td className="px-3 py-1.5 text-teal-400/70 font-medium">{it.categoria}</td>
                  <td className="px-3 py-1.5 text-white/80">{it.descripcion}</td>
                  <td className="px-3 py-1.5 text-white/50">{it.talla || "—"}</td>
                  <td className="px-3 py-1.5 text-right text-blue-300 font-mono">{it.stock_bodega}</td>
                  <td className="px-3 py-1.5 text-right text-purple-300 font-mono">{it.stock_lavanderia}</td>
                  <td className="px-3 py-1.5 text-right text-white/30 font-mono">{it.precio ? `Q${it.precio}` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex gap-3">
        <button onClick={() => handleImport(true)} disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 rounded-lg text-sm transition-colors disabled:opacity-50">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <BarChart3 className="w-4 h-4" />}
          Validar (sin guardar)
        </button>
        <button onClick={() => handleImport(false)} disabled={loading || items.length === 0}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-teal-600 hover:bg-teal-500 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
          Importar {items.length} artículos
        </button>
      </div>

      {result?.preview && (
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 text-sm text-blue-300">
          Vista previa: {result.total_errores === 0
            ? `Todo correcto. ${items.length} artículos listos para importar.`
            : `${result.total_errores} errores detectados.`}
          {result.errores.slice(0, 3).map((e, i) => <p key={i} className="text-xs text-red-400 mt-1">{e}</p>)}
        </div>
      )}
    </div>
  );

  if (step === "result" && result) return (
    <div className="space-y-6">
      <div className={`rounded-xl p-5 border ${result.total_errores === 0 ? "bg-emerald-500/10 border-emerald-500/20" : "bg-amber-500/10 border-amber-500/20"}`}>
        <div className="flex items-center gap-3 mb-3">
          {result.total_errores === 0
            ? <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            : <AlertCircle className="w-5 h-5 text-amber-400" />}
          <p className="font-semibold text-white">Importación completada</p>
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="bg-white/5 rounded-lg p-3">
            <p className="text-white/40 text-xs">Nuevos</p>
            <p className="text-2xl font-bold text-emerald-400">{result.insertados}</p>
          </div>
          <div className="bg-white/5 rounded-lg p-3">
            <p className="text-white/40 text-xs">Actualizados</p>
            <p className="text-2xl font-bold text-blue-400">{result.actualizados}</p>
          </div>
        </div>
        {result.errores.length > 0 && (
          <div className="mt-3 space-y-1">
            {result.errores.map((e, i) => <p key={i} className="text-xs text-red-400">{e}</p>)}
          </div>
        )}
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
        {Object.entries(result.categorias).map(([cat, count]) => (
          <div key={cat} className="bg-teal-500/8 border border-teal-500/20 rounded-lg px-3 py-2">
            <p className="text-teal-300 text-xs font-semibold truncate">{cat}</p>
            <p className="text-white/50 text-xs">{count} importados</p>
          </div>
        ))}
      </div>
      <button onClick={reset} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm bg-white/10 hover:bg-white/15 text-white/60">
        <RotateCcw className="w-4 h-4" /> Nueva importación
      </button>
    </div>
  );

  return null;
}

// ─── DiGECAMTab — importación de armas desde archivo DIGECAM (.xls) ───────────
interface ArmaDigecam {
  tipo: string; marca: string; modelo: string; calibre: string; serie: string;
  numero_tenencia: string; numero_carnet: string;
  fecha_emision: string | null; fecha_vencimiento: string | null;
  ubicacion: string; observaciones: string; estado: string;
}
interface DiGECAMResult {
  insertadas: number; actualizadas: number; con_puesto: number; total_errores: number;
  errores: string[]; categorias: Record<string, number>; preview: boolean;
}

function excelDateToISO(v: any): string | null {
  if (!v) return null;
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  const n = Number(v);
  if (!isFinite(n) || n < 1) return null;
  const ms = Math.round((n - 25569) * 86400 * 1000);
  return new Date(ms).toISOString().slice(0, 10);
}

function parseDigecamSheet(
  data: any[][], headerRow: number, estado: string,
  opts: { hasCarnet?: boolean; hasEmision?: boolean; hasVencimiento?: boolean;
          hasUbicacion?: boolean; hasDireccion?: boolean;
          extraFn?: (row: any[]) => string }
): ArmaDigecam[] {
  const results: ArmaDigecam[] = [];
  for (let i = headerRow + 1; i < data.length; i++) {
    const row = data[i];
    const tipo = typeof row[1] === "string" ? row[1].trim() : "";
    if (!tipo || tipo.length < 2) continue;
    if (typeof row[0] !== "number") continue;

    const serie     = String(row[5] ?? "").trim();
    const tenencia  = String(row[6] ?? "").trim();
    const carnet    = opts.hasCarnet    ? String(row[7]  ?? "").trim() : "";
    const fEmision  = opts.hasEmision   ? excelDateToISO(row[opts.hasCarnet ? 8 : 7]) : null;
    const fVenc     = opts.hasVencimiento ? excelDateToISO(row[opts.hasCarnet ? 9 : (opts.hasEmision ? 8 : 7)]) : null;
    const ubicacion = opts.hasUbicacion ? String(row[opts.hasCarnet ? 10 : 7] ?? "").trim() : "";
    const obs       = opts.extraFn ? opts.extraFn(row) : (opts.hasDireccion ? String(row[11] ?? "").trim() : "");

    results.push({
      tipo: tipo.toLowerCase(), marca: String(row[2] ?? "").trim(),
      modelo: String(row[3] ?? "").trim(), calibre: String(row[4] ?? "").trim(),
      serie, numero_tenencia: tenencia, numero_carnet: carnet,
      fecha_emision: fEmision, fecha_vencimiento: fVenc,
      ubicacion, observaciones: obs, estado,
    });
  }
  return results;
}

const ESTADO_LABEL: Record<string, string> = {
  activo: "En Servicio", bodega: "En Bodega", mal_estado: "Mal Estado",
  robado: "Robadas", consignado: "Consignadas", reparacion: "Reparación",
};
const ESTADO_COLOR: Record<string, string> = {
  activo: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  bodega: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  mal_estado: "bg-orange-500/20 text-orange-300 border-orange-500/30",
  robado: "bg-red-500/20 text-red-300 border-red-500/30",
  consignado: "bg-purple-500/20 text-purple-300 border-purple-500/30",
  reparacion: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
};

function DiGECAMTab() {
  const [step, setStep]             = useState<"upload" | "preview" | "result">("upload");
  const [armas, setArmas]           = useState<ArmaDigecam[]>([]);
  const [fileName, setFileName]     = useState("");
  const [loading, setLoading]       = useState(false);
  const [dragOver, setDragOver]     = useState(false);
  const [previewResult, setPreviewResult] = useState<DiGECAMResult | null>(null);
  const [importResult, setImportResult]   = useState<DiGECAMResult | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setStep("upload"); setArmas([]); setFileName("");
    setPreviewResult(null); setImportResult(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleFile = useCallback(async (file: File) => {
    const ext = file.name.toLowerCase();
    if (!ext.endsWith(".xlsx")) {
      alert("Solo se aceptan archivos .xlsx del DIGECAM"); return;
    }
    try {
      const buf = await file.arrayBuffer();
      const wb = await XLSX.read(buf, { type: "array", cellDates: false });

      const SHEET_CONFIG = [
        { name: "ARMAS EN SERVICIO",  headerRow: 12, estado: "activo",
          opts: { hasCarnet: true, hasEmision: true, hasVencimiento: true, hasUbicacion: true, hasDireccion: true } },
        { name: "ARMAS EN BODEGA",    headerRow: 12, estado: "bodega",
          opts: { hasCarnet: true, hasEmision: true, hasVencimiento: true, hasUbicacion: true } },
        { name: "ARMAS EN MAL ESTADO", headerRow: 17, estado: "mal_estado",
          opts: { hasUbicacion: true } },
        { name: "ARMAS ROBADAS",      headerRow: 14, estado: "robado",
          opts: { extraFn: (row: any[]) => [
            row[7] ? `Fecha robo: ${excelDateToISO(row[7]) ?? row[7]}` : "",
            row[8] ? `Denuncia PNC: ${row[8]}`      : "",
            row[9] ? `Fecha denuncia: ${excelDateToISO(row[9]) ?? row[9]}` : "",
            row[10] ? `Expediente: ${row[10]}`      : "",
          ].filter(Boolean).join(" | ") } },
        { name: "ARMAS CONSIGNADAS",  headerRow: 11, estado: "consignado",
          opts: { extraFn: (row: any[]) => [
            row[7] ? `Consignada: ${excelDateToISO(row[7]) ?? row[7]}` : "",
            row[8] ? `Causa: ${row[8]}` : "",
          ].filter(Boolean).join(" | ") } },
        { name: "ARMAS REPARACION",   headerRow: 14, estado: "reparacion", opts: {} },
      ];

      const all: ArmaDigecam[] = [];
      for (const sc of SHEET_CONFIG) {
        const ws = wb.Sheets[sc.name];
        if (!ws) continue;
        const data = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, defval: "" });
        const parsed = parseDigecamSheet(data, sc.headerRow, sc.estado, sc.opts);
        all.push(...parsed);
      }

      if (all.length === 0) {
        alert("No se encontraron armas válidas en el archivo. ¿Es el archivo correcto del DIGECAM?");
        return;
      }
      setArmas(all); setFileName(file.name); setStep("preview");
    } catch (e: any) {
      alert(`Error al leer el archivo: ${e.message}`);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    const file = e.dataTransfer.files[0]; if (file) handleFile(file);
  }, [handleFile]);

  const call = async (preview: boolean): Promise<DiGECAMResult> => {
    const r = await fetch(`${API_BASE}/armeria/importar-digecam`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-isp-session": getSession() },
      body: JSON.stringify({ armas, preview }),
    });
    if (!r.ok) { const e = await r.json(); throw new Error(e.error || "Error"); }
    return r.json();
  };

  const runPreview = async () => {
    setLoading(true);
    try { setPreviewResult(await call(true)); }
    catch (e: any) { alert(e.message); }
    finally { setLoading(false); }
  };
  const runImport = async () => {
    if (!confirm(`¿Confirmar importación de ${armas.length} armas desde DIGECAM?`)) return;
    setLoading(true);
    try { setImportResult(await call(false)); setStep("result"); }
    catch (e: any) { alert(e.message); }
    finally { setLoading(false); }
  };

  // Conteo por estado
  const byEstado = armas.reduce<Record<string, number>>((acc, a) => {
    acc[a.estado] = (acc[a.estado] || 0) + 1; return acc;
  }, {});

  if (step === "upload") return (
    <div className="space-y-6">
      <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 space-y-2">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-red-400" />
          <span className="text-sm font-semibold text-red-200">Importar Inventario DIGECAM</span>
        </div>
        <p className="text-xs text-red-200/70">
          Sube el archivo <code className="font-mono bg-red-400/10 px-1 rounded">.xls</code> del DIGECAM (Registro de Armas de Fuego).
          El sistema procesa las 6 hojas automáticamente y clasifica cada arma según su estado.
        </p>
        <p className="text-[11px] text-red-300/50">
          Las armas se identifican por número de serie o tenencia. Las existentes se actualizan, las nuevas se insertan.
        </p>
      </div>
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors ${
          dragOver ? "border-red-400 bg-red-400/5" : "border-white/15 hover:border-red-400/40 hover:bg-white/[0.02]"
        }`}
      >
        <Shield className="w-10 h-10 text-white/20 mx-auto mb-3" />
        <p className="text-sm text-white/60">Arrastra el archivo DIGECAM aquí</p>
        <p className="text-xs text-white/30 mt-1">o haz clic · Acepta .xls y .xlsx</p>
        <input ref={fileRef} type="file" accept=".xls,.xlsx" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
      </div>
    </div>
  );

  if (step === "preview") return (
    <div className="space-y-4">
      <div className="bg-white/[0.03] border border-white/10 rounded-xl p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-white/90 flex items-center gap-2">
              <Shield className="w-4 h-4 text-red-400" />
              {armas.length} armas detectadas en <code className="text-xs bg-white/10 px-1.5 py-0.5 rounded font-mono">{fileName}</code>
            </p>
          </div>
          <button onClick={reset} className="text-xs text-white/30 hover:text-white/60 flex items-center gap-1">
            <RotateCcw className="w-3 h-3" /> Cambiar archivo
          </button>
        </div>
        <div className="flex flex-wrap gap-2 mt-3">
          {Object.entries(byEstado).map(([estado, cnt]) => (
            <span key={estado} className={`text-xs px-2 py-0.5 rounded border font-medium ${ESTADO_COLOR[estado] || "bg-white/10 text-white/50 border-white/20"}`}>
              {cnt} {ESTADO_LABEL[estado] || estado}
            </span>
          ))}
        </div>
      </div>

      {previewResult && (
        <div className="bg-white/[0.03] border border-white/10 rounded-xl p-4 space-y-2">
          <p className="text-xs font-semibold text-white/60 uppercase tracking-wide">Resultado de validación</p>
          <div className="flex flex-wrap gap-3 text-sm">
            <span className="text-emerald-400"><span className="font-bold">{previewResult.insertadas}</span> nuevas</span>
            <span className="text-blue-400"><span className="font-bold">{previewResult.actualizadas}</span> actualizarán</span>
            {previewResult.total_errores > 0 && (
              <span className="text-red-400"><span className="font-bold">{previewResult.total_errores}</span> errores</span>
            )}
          </div>
          {previewResult.errores.length > 0 && (
            <div className="mt-2 text-[11px] text-red-300/70 space-y-0.5 max-h-24 overflow-y-auto">
              {previewResult.errores.map((e, i) => <p key={i}>{e}</p>)}
            </div>
          )}
        </div>
      )}

      {/* Preview table (first 10 rows) */}
      <div className="bg-white/[0.02] border border-white/10 rounded-xl overflow-hidden">
        <div className="px-4 py-2 border-b border-white/10">
          <p className="text-xs text-white/40">Muestra — primeras 10 armas</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="border-b border-white/10 text-white/40">
                <th className="px-3 py-2 text-left">Estado</th>
                <th className="px-3 py-2 text-left">Tipo</th>
                <th className="px-3 py-2 text-left">Marca / Modelo</th>
                <th className="px-3 py-2 text-left">Calibre</th>
                <th className="px-3 py-2 text-left">Serie</th>
                <th className="px-3 py-2 text-left">No. Tenencia</th>
                <th className="px-3 py-2 text-left">Ubicación</th>
                <th className="px-3 py-2 text-left">Venc.</th>
              </tr>
            </thead>
            <tbody>
              {armas.slice(0, 10).map((a, i) => (
                <tr key={i} className="border-b border-white/5 hover:bg-white/[0.02]">
                  <td className="px-3 py-1.5">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded border ${ESTADO_COLOR[a.estado] || "bg-white/10 text-white/50 border-white/20"}`}>
                      {ESTADO_LABEL[a.estado] || a.estado}
                    </span>
                  </td>
                  <td className="px-3 py-1.5 capitalize text-white/80">{a.tipo}</td>
                  <td className="px-3 py-1.5 text-white/60">{a.marca} {a.modelo}</td>
                  <td className="px-3 py-1.5 text-white/50">{a.calibre}</td>
                  <td className="px-3 py-1.5 font-mono text-white/70">{a.serie || "—"}</td>
                  <td className="px-3 py-1.5 font-mono text-white/50">{a.numero_tenencia || "—"}</td>
                  <td className="px-3 py-1.5 text-white/50 max-w-[160px] truncate">{a.ubicacion || "—"}</td>
                  <td className="px-3 py-1.5 text-white/40">{a.fecha_vencimiento || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {armas.length > 10 && (
          <p className="px-4 py-2 text-[11px] text-white/30 border-t border-white/10">
            ... y {armas.length - 10} armas más
          </p>
        )}
      </div>

      <div className="flex gap-3 justify-end">
        <button onClick={runPreview} disabled={loading}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm bg-white/10 hover:bg-white/15 text-white/80 disabled:opacity-50">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          Validar (sin guardar)
        </button>
        <button onClick={runImport} disabled={loading}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm bg-red-500/80 hover:bg-red-500 text-white disabled:opacity-50">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
          Importar {armas.length} armas
        </button>
      </div>
    </div>
  );

  if (step === "result" && importResult) return (
    <div className="space-y-4">
      <div className={`rounded-xl p-4 border ${importResult.total_errores === 0 ? "bg-emerald-500/10 border-emerald-500/30" : "bg-orange-500/10 border-orange-500/30"}`}>
        <div className="flex items-center gap-2 mb-3">
          {importResult.total_errores === 0
            ? <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            : <AlertCircle className="w-5 h-5 text-orange-400" />}
          <span className="font-semibold text-white">Importación completada</span>
        </div>
        <div className="grid grid-cols-4 gap-4 text-center">
          <div>
            <p className="text-2xl font-bold text-emerald-400">{importResult.insertadas}</p>
            <p className="text-xs text-white/40 mt-0.5">Armas nuevas</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-blue-400">{importResult.actualizadas}</p>
            <p className="text-xs text-white/40 mt-0.5">Actualizadas</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-purple-400">{importResult.con_puesto ?? 0}</p>
            <p className="text-xs text-white/40 mt-0.5">Con puesto asignado</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-red-400">{importResult.total_errores}</p>
            <p className="text-xs text-white/40 mt-0.5">Errores</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 mt-3">
          {Object.entries(importResult.categorias).map(([estado, cnt]) => (
            <span key={estado} className={`text-xs px-2 py-0.5 rounded border ${ESTADO_COLOR[estado] || "bg-white/10 text-white/50 border-white/20"}`}>
              {cnt} {ESTADO_LABEL[estado] || estado}
            </span>
          ))}
        </div>
      </div>
      {importResult.errores.length > 0 && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
          <p className="text-xs font-semibold text-red-300 mb-2">Errores ({importResult.total_errores})</p>
          <div className="space-y-0.5 max-h-40 overflow-y-auto text-[11px] text-red-300/70">
            {importResult.errores.map((e, i) => <p key={i}>{e}</p>)}
          </div>
        </div>
      )}
      <div className="flex justify-end">
        <button onClick={reset} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm bg-white/10 hover:bg-white/15 text-white/60">
          <RotateCcw className="w-4 h-4" /> Nueva importación
        </button>
      </div>
    </div>
  );

  return null;
}

// ─── CargaMaestraTab ──────────────────────────────────────────────────────────
type CargaMaestraStep = "upload" | "previewing" | "preview_result" | "importing" | "done";

interface SheetResult {
  hoja: string;
  total: number;
  exitosos: number;
  errores: number;
  omitidos: number;
  detalle: { fila: number; estado: "ok" | "error" | "omitido"; mensaje?: string }[];
}

interface MaestroResult {
  preview: boolean;
  total: number;
  exitosos: number;
  errores: number;
  omitidos: number;
  hojas: SheetResult[];
}

const TEMPLATE_FILENAME = "ISP_PlantillaMaestra_CargaInicial.xlsx";

function SheetResultRow({ r }: { r: SheetResult }) {
  const [open, setOpen] = useState(false);
  const errores = r.detalle.filter(d => d.estado === "error");
  const color = r.errores > 0 ? "text-orange-400" : r.exitosos === 0 ? "text-white/30" : "text-emerald-400";
  return (
    <div className="border border-white/10 rounded-lg overflow-hidden">
      <button
        onClick={() => errores.length > 0 && setOpen(!open)}
        className={`w-full flex items-center gap-3 px-4 py-3 text-left text-sm hover:bg-white/5 ${errores.length > 0 ? "cursor-pointer" : "cursor-default"}`}
      >
        <span className="flex-1 font-medium text-white/80">{r.hoja}</span>
        <span className="text-emerald-400 text-xs w-20 text-right">{r.exitosos} ok</span>
        <span className="text-orange-400 text-xs w-20 text-right">{r.errores > 0 ? `${r.errores} errores` : ""}</span>
        <span className="text-white/30 text-xs w-24 text-right">{r.omitidos > 0 ? `${r.omitidos} omitidos` : ""}</span>
        <span className={`text-xs w-16 text-right ${color}`}>{r.total} total</span>
        {errores.length > 0 && <span className="text-white/30 text-xs">{open ? "▲" : "▼"}</span>}
      </button>
      {open && errores.length > 0 && (
        <div className="px-4 pb-3 space-y-1 bg-orange-500/5 border-t border-white/10">
          {errores.map((e, i) => (
            <p key={i} className="text-[11px] text-orange-300/80">Fila {e.fila}: {e.mensaje}</p>
          ))}
        </div>
      )}
    </div>
  );
}

function CargaMaestraTab() {
  const [step, setStep] = useState<CargaMaestraStep>("upload");
  const [sheets, setSheets] = useState<Record<string, Record<string, any>[]>>({});
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [previewResult, setPreviewResult] = useState<MaestroResult | null>(null);
  const [importResult, setImportResult] = useState<MaestroResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setStep("upload"); setSheets({}); setSheetNames([]);
    setPreviewResult(null); setImportResult(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleFile = useCallback(async (file: File) => {
    if (!file.name.toLowerCase().endsWith(".xlsx")) {
      alert("Solo se aceptan archivos .xlsx"); return;
    }
    const buf = await file.arrayBuffer();
    const wb = await XLSX.read(buf, { type: "array" });
    const parsedSheets: Record<string, Record<string, any>[]> = {};
    wb.SheetNames.forEach(name => {
      if (name === "INSTRUCCIONES") return;
      const json = XLSX.utils.sheet_to_json<Record<string, any>>(
        wb.Sheets[name], { defval: "" }
      );
      const normalized = json.map(row => {
        const out: Record<string, any> = {};
        for (const [k, v] of Object.entries(row)) {
          const key = k.trim().toLowerCase().replace(/\s+/g, "_");
          out[key] = v instanceof Date ? v.toISOString().slice(0, 10) : v;
        }
        return out;
      });
      const nonEmpty = normalized.filter(row =>
        Object.values(row).some(v => String(v ?? "").trim() !== "")
      );
      if (nonEmpty.length > 0) parsedSheets[name] = nonEmpty;
    });
    setSheets(parsedSheets);
    setSheetNames(Object.keys(parsedSheets));
    setStep("previewing");
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const callEndpoint = async (preview: boolean): Promise<MaestroResult> => {
    const r = await fetch(`${API_BASE}/importacion/maestro`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-isp-session": getSession() },
      body: JSON.stringify({ sheets, preview }),
    });
    if (!r.ok) {
      const msg = await r.text();
      throw new Error(msg || `Error ${r.status}`);
    }
    return r.json();
  };

  const runPreview = async () => {
    setLoading(true);
    try {
      const res = await callEndpoint(true);
      setPreviewResult(res);
      setStep("preview_result");
    } catch (e: any) {
      alert(`Error al validar: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const runImport = async () => {
    if (!confirm("¿Confirmar la importación definitiva? Esta acción no se puede deshacer.")) return;
    setStep("importing"); setLoading(true);
    try {
      const res = await callEndpoint(false);
      setImportResult(res);
      setStep("done");
    } catch (e: any) {
      alert(`Error en la importación: ${e.message}`);
      setStep("preview_result");
    } finally {
      setLoading(false);
    }
  };

  // ── Upload ──────────────────────────────────────────────────────────────────
  if (step === "upload") return (
    <div className="space-y-6">
      <div className="bg-indigo-500/10 border border-indigo-500/30 rounded-xl p-5 space-y-3">
        <div className="flex items-start gap-3">
          <Database className="w-5 h-5 text-indigo-400 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-indigo-300">Carga Maestra Inicial</p>
            <p className="text-xs text-white/50 mt-1">
              Carga todos los datos históricos de la empresa en una sola operación: clientes, puestos,
              colaboradores, armería, vehículos, bodega, anticipos, historial de prestaciones, usuarios e IGSS.
              El sistema detecta duplicados automáticamente.
            </p>
          </div>
        </div>
        <ol className="text-xs text-white/40 list-decimal list-inside space-y-1 pl-2">
          <li>Descarga la plantilla maestra y llena las hojas con los datos de tu empresa</li>
          <li>Respeta el orden indicado en la hoja INSTRUCCIONES</li>
          <li>Sube el archivo aquí, valida y luego confirma la importación definitiva</li>
        </ol>
        <a
          href={`/ISP_PlantillaMaestra_CargaInicial.xlsx`}
          download={TEMPLATE_FILENAME}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm bg-indigo-600/80 hover:bg-indigo-600 text-white font-medium transition-colors"
        >
          <Download className="w-4 h-4" />
          Descargar Plantilla Maestra (.xlsx)
        </a>
      </div>

      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${
          dragOver ? "border-indigo-400 bg-indigo-500/10" : "border-white/20 hover:border-indigo-400/50"
        }`}
      >
        <FileUp className="w-10 h-10 text-indigo-400/60 mx-auto mb-3" />
        <p className="text-sm text-white/60">Arrastra la Plantilla Maestra aquí o haz clic para seleccionar</p>
        <p className="text-xs text-white/30 mt-1">Formato: .xlsx</p>
        <input ref={fileRef} type="file" accept=".xlsx" className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
      </div>
    </div>
  );

  // ── Previewing ──────────────────────────────────────────────────────────────
  if (step === "previewing") return (
    <div className="space-y-4">
      <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
        <p className="text-sm font-semibold text-blue-300 mb-1">Archivo cargado correctamente</p>
        <p className="text-xs text-white/40">Se detectaron <strong className="text-white/70">{sheetNames.length} hojas</strong> con datos.</p>
        <div className="flex flex-wrap gap-2 mt-3">
          {sheetNames.map(n => (
            <span key={n} className="text-xs px-2 py-0.5 rounded border bg-blue-500/10 text-blue-300/80 border-blue-500/20">
              {n} ({(sheets[n] ?? []).length} filas)
            </span>
          ))}
        </div>
      </div>
      <div className="flex gap-3">
        <button onClick={reset} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm bg-white/10 hover:bg-white/15 text-white/60">
          <RotateCcw className="w-4 h-4" /> Cambiar archivo
        </button>
        <button
          onClick={runPreview}
          disabled={loading}
          className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm bg-blue-600/80 hover:bg-blue-600 text-white font-medium disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
          Validar datos (sin importar)
        </button>
      </div>
    </div>
  );

  // ── Preview Result ──────────────────────────────────────────────────────────
  if (step === "preview_result" && previewResult) return (
    <div className="space-y-5">
      <div className={`rounded-xl p-4 border ${previewResult.errores === 0
        ? "bg-emerald-500/10 border-emerald-500/30"
        : "bg-orange-500/10 border-orange-500/30"}`}>
        <div className="flex items-center gap-2 mb-3">
          {previewResult.errores === 0
            ? <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            : <AlertCircle className="w-5 h-5 text-orange-400" />}
          <span className="font-semibold text-white">
            {previewResult.errores === 0 ? "Todo listo para importar" : "Hay errores — revisa antes de importar"}
          </span>
        </div>
        <div className="grid grid-cols-4 gap-4 text-center">
          <div><p className="text-2xl font-bold text-white/80">{previewResult.total}</p><p className="text-xs text-white/40">Registros</p></div>
          <div><p className="text-2xl font-bold text-emerald-400">{previewResult.exitosos}</p><p className="text-xs text-white/40">Se importarán</p></div>
          <div><p className="text-2xl font-bold text-orange-400">{previewResult.errores}</p><p className="text-xs text-white/40">Con error</p></div>
          <div><p className="text-2xl font-bold text-white/30">{previewResult.omitidos}</p><p className="text-xs text-white/40">Ya existen</p></div>
        </div>
      </div>

      <div className="space-y-2">
        {previewResult.hojas.filter(h => h.total > 0).map(h => (
          <SheetResultRow key={h.hoja} r={h} />
        ))}
      </div>

      <div className="flex gap-3">
        <button onClick={reset} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm bg-white/10 hover:bg-white/15 text-white/60">
          <RotateCcw className="w-4 h-4" /> Cambiar archivo
        </button>
        <button
          onClick={runImport}
          disabled={loading || previewResult.exitosos === 0}
          className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm bg-indigo-600/80 hover:bg-indigo-600 text-white font-medium disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
          Importar {previewResult.exitosos} registros definitivamente
        </button>
      </div>
    </div>
  );

  // ── Importing spinner ───────────────────────────────────────────────────────
  if (step === "importing") return (
    <div className="flex flex-col items-center justify-center py-16 gap-4">
      <Loader2 className="w-10 h-10 text-indigo-400 animate-spin" />
      <p className="text-sm text-white/50">Importando datos... esto puede tardar unos segundos.</p>
    </div>
  );

  // ── Done ────────────────────────────────────────────────────────────────────
  if (step === "done" && importResult) return (
    <div className="space-y-5">
      <div className={`rounded-xl p-4 border ${importResult.errores === 0
        ? "bg-emerald-500/10 border-emerald-500/30"
        : "bg-orange-500/10 border-orange-500/30"}`}>
        <div className="flex items-center gap-2 mb-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          <span className="font-semibold text-white">Importación completada</span>
        </div>
        <div className="grid grid-cols-4 gap-4 text-center">
          <div><p className="text-2xl font-bold text-white/80">{importResult.total}</p><p className="text-xs text-white/40">Registros</p></div>
          <div><p className="text-2xl font-bold text-emerald-400">{importResult.exitosos}</p><p className="text-xs text-white/40">Importados</p></div>
          <div><p className="text-2xl font-bold text-orange-400">{importResult.errores}</p><p className="text-xs text-white/40">Con error</p></div>
          <div><p className="text-2xl font-bold text-white/30">{importResult.omitidos}</p><p className="text-xs text-white/40">Omitidos</p></div>
        </div>
      </div>

      <div className="space-y-2">
        {importResult.hojas.filter(h => h.total > 0).map(h => (
          <SheetResultRow key={h.hoja} r={h} />
        ))}
      </div>

      <button onClick={reset} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm bg-white/10 hover:bg-white/15 text-white/60">
        <RotateCcw className="w-4 h-4" /> Nueva importación
      </button>
    </div>
  );

  return null;
}

// ─── PlantillaTurnosTab ───────────────────────────────────────────────────────
// Carga masiva de edición de slots desde el CSV exportado por el reporte
// "Plantilla de Turnos Vigente". Solo MODIFICA slots existentes (match por
// "ID Slot"). NO crea, NO elimina, NO cambia titular.
const NOMBRE_DIA_FULL = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

type CambioCampoUI = { campo: string; antes: any; despues: any };
type FilaPreviewUI = {
  fila: number;
  slot_id: number;
  puesto_id: number;
  contexto: {
    cliente_nombre: string | null;
    sede_nombre: string | null;
    puesto_nombre: string;
    slot_numero: number | null;
    titular_nombre: string | null;
  };
  antes: Record<string, any>;
  despues: Record<string, any>;
  cambios: CambioCampoUI[];
};

type FilaConflictoUI = {
  fila: number;
  slot_id: number;
  contexto: { cliente_nombre: string | null; puesto_nombre: string; slot_numero: number | null };
  descargado: string;
  modificado: string;
};

type PreviewResp = {
  total_filas: number;
  filas_a_actualizar: FilaPreviewUI[];
  filas_sin_cambios: { fila: number; slot_id: number }[];
  filas_con_error: { fila: number; slot_id_raw: string; errores: string[] }[];
  filas_con_conflicto: FilaConflictoUI[];
  filas_ignoradas: number;
};

function MiniGrid({ longitud_ciclo, dias_trabajo, dias_medio_turno }: {
  longitud_ciclo: number; dias_trabajo: number[]; dias_medio_turno: number[];
}) {
  const trabajo = new Set(dias_trabajo.map(Number));
  const medio = new Set(dias_medio_turno.map(Number));
  const sems = Math.max(1, Math.ceil(longitud_ciclo / 7));
  const cells: { dia: number; tipo: "T" | "M" | "D" | "" }[][] = [];
  for (let s = 0; s < sems; s++) {
    const row: { dia: number; tipo: "T" | "M" | "D" | "" }[] = [];
    for (let i = 0; i < 7; i++) {
      const dia = s * 7 + i + 1;
      if (dia > longitud_ciclo) row.push({ dia, tipo: "" });
      else if (medio.has(dia)) row.push({ dia, tipo: "M" });
      else if (trabajo.has(dia)) row.push({ dia, tipo: "T" });
      else row.push({ dia, tipo: "D" });
    }
    cells.push(row);
  }
  return (
    <div className="inline-block">
      <div className="grid grid-cols-7 gap-[2px]">
        {NOMBRE_DIA_FULL.map((d) => (
          <div key={d} className="w-6 text-[8px] text-center text-white/30 uppercase">{d.slice(0, 1)}</div>
        ))}
      </div>
      {cells.map((row, ri) => (
        <div key={ri} className="grid grid-cols-7 gap-[2px] mt-[2px]">
          {row.map((c, ci) => {
            const cls =
              c.tipo === "T" ? "bg-emerald-500/70 text-white"
              : c.tipo === "M" ? "bg-amber-500/70 text-black"
              : c.tipo === "D" ? "bg-white/10 text-white/40"
              : "bg-transparent text-transparent";
            return (
              <div
                key={ci}
                title={c.tipo ? `Día ${c.dia} · ${c.tipo === "T" ? "Trabaja" : c.tipo === "M" ? "Medio" : "Descansa"}` : ""}
                className={`w-6 h-5 rounded-[3px] text-[8px] flex items-center justify-center font-bold ${cls}`}
              >
                {c.tipo}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function fmtVal(v: any): string {
  if (v === null || v === undefined || v === "") return "—";
  if (Array.isArray(v)) return v.length === 0 ? "[]" : v.join(", ");
  return String(v);
}

function PlantillaTurnosTab() {
  const [step, setStep] = useState<"upload" | "preview" | "result">("upload");
  const [rows, setRows] = useState<Record<string, any>[]>([]);
  const [fileName, setFileName] = useState("");
  const [previewResult, setPreviewResult] = useState<PreviewResp | null>(null);
  const [importResult, setImportResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const fileRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setStep("upload"); setRows([]); setFileName("");
    setPreviewResult(null); setImportResult(null); setExpanded(new Set());
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleFile = useCallback(async (file: File) => {
    const ext = file.name.toLowerCase();
    let data: Record<string, any>[] = [];
    try {
      if (ext.endsWith(".csv")) {
        const text = await file.text();
        const cleaned = text.replace(/^\uFEFF/, "");
        // Parser CSV simple con soporte de comillas dobles
        const lines: string[][] = [];
        let cur: string[] = [];
        let cell = "";
        let inQ = false;
        for (let i = 0; i < cleaned.length; i++) {
          const ch = cleaned[i];
          if (inQ) {
            if (ch === '"') {
              if (cleaned[i + 1] === '"') { cell += '"'; i++; }
              else inQ = false;
            } else cell += ch;
          } else {
            if (ch === '"') inQ = true;
            else if (ch === ",") { cur.push(cell); cell = ""; }
            else if (ch === "\n") { cur.push(cell); lines.push(cur); cur = []; cell = ""; }
            else if (ch === "\r") { /* skip */ }
            else cell += ch;
          }
        }
        if (cell.length > 0 || cur.length > 0) { cur.push(cell); lines.push(cur); }
        if (lines.length < 2) { alert("El archivo CSV no tiene datos."); return; }
        const headers = lines[0].map((s) => s.trim());
        data = lines.slice(1).filter((r) => r.some((c) => String(c).trim() !== "")).map((r) => {
          const obj: Record<string, any> = {};
          headers.forEach((h, i) => { obj[h] = r[i] ?? ""; });
          return obj;
        });
      } else if (ext.endsWith(".xlsx") || ext.endsWith(".xls")) {
        const buf = await file.arrayBuffer();
        const wb = XLSX.read(buf, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        data = XLSX.utils.sheet_to_json(ws, { defval: "", raw: false }) as Record<string, any>[];
      } else {
        alert("Solo se aceptan archivos .csv o .xlsx (descargados del reporte de Plantilla de Turnos)."); return;
      }
    } catch (e: any) {
      alert("No se pudo leer el archivo: " + (e?.message || "error desconocido")); return;
    }

    if (data.length === 0) { alert("El archivo no tiene filas con datos."); return; }
    const keys = Object.keys(data[0]);
    if (!keys.includes("ID Slot")) {
      alert(
        "Este archivo no parece ser la Plantilla de Turnos exportada del reporte. " +
        "Falta la columna \"ID Slot\".\n\nDescargá la plantilla desde:\nReportes → Plantilla de Turnos Vigente → Exportar CSV."
      );
      return;
    }

    // Warning si falta el sello de concurrencia (CSV viejo): se permite la carga
    // pero sin lock optimista. El usuario asume el riesgo de pisar cambios paralelos.
    if (!keys.includes("_actualizado_ts")) {
      const cont = window.confirm(
        'Este archivo no incluye la columna oculta "_actualizado_ts" (es una plantilla de versión anterior).\n\n' +
        "Si continuás, se aplicarán los cambios SIN protección de concurrencia: si otra persona modificó algún slot después de que descargaste el archivo, esos cambios podrían pisarse.\n\n" +
        "Recomendado: cancelá, re-descargá la plantilla actual desde Reportes → Plantilla de Turnos Vigente y volvé a aplicar tus ediciones.\n\n" +
        "¿Continuar de todas formas?"
      );
      if (!cont) return;
    }

    setRows(data); setFileName(file.name);
    setLoading(true);
    try {
      const r = await fetch(`${API_BASE}/importacion/plantilla-turnos/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-isp-session": getSession() },
        body: JSON.stringify({ rows: data }),
      });
      const json = await r.json();
      if (!r.ok) { alert(json?.error || "Error al validar la plantilla"); return; }
      setPreviewResult(json as PreviewResp);
      setStep("preview");
    } catch (e: any) {
      alert("Error al subir la plantilla: " + (e?.message || "error desconocido"));
    } finally {
      setLoading(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    const file = e.dataTransfer.files[0]; if (file) handleFile(file);
  }, [handleFile]);

  const aplicar = async () => {
    if (!previewResult || previewResult.filas_a_actualizar.length === 0) return;
    if (previewResult.filas_con_error.length > 0) {
      alert("Hay filas con error. Corregilas en el archivo y volvé a subirlo antes de aplicar.");
      return;
    }
    if ((previewResult.filas_con_conflicto?.length ?? 0) > 0) {
      alert("Hay conflictos: otros usuarios modificaron algunos slots después de tu descarga. Re-descargá la plantilla y volvé a aplicar tus cambios sobre la versión actualizada.");
      return;
    }
    if (!confirm(`¿Confirmás aplicar ${previewResult.filas_a_actualizar.length} cambio(s) en la plantilla de turnos? Esta acción modifica los slots seleccionados de forma transaccional.`)) return;
    setLoading(true);
    try {
      const r = await fetch(`${API_BASE}/importacion/plantilla-turnos/aplicar`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-isp-session": getSession() },
        body: JSON.stringify({ rows }),
      });
      const json = await r.json();
      if (!r.ok) {
        if (Array.isArray(json?.filas_con_conflicto) && previewResult) {
          // El servidor detectó conflictos en el último momento (alguien tocó la BD entre preview y aplicar).
          // Actualizamos el preview con los conflictos para que el usuario los vea.
          setPreviewResult({ ...previewResult, filas_con_conflicto: json.filas_con_conflicto });
        }
        alert(json?.error || "Error al aplicar los cambios");
        return;
      }
      setImportResult(json);
      setStep("result");
    } catch (e: any) {
      alert("Error al aplicar: " + (e?.message || "error desconocido"));
    } finally {
      setLoading(false);
    }
  };

  // ── UI ──
  if (step === "upload") return (
    <div className="space-y-6">
      <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4 space-y-2">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-blue-400" />
          <span className="text-sm font-semibold text-blue-200">Plantilla de Turnos — carga masiva de edición</span>
        </div>
        <p className="text-xs text-blue-200/70">
          Subí el archivo <code className="font-mono bg-blue-400/10 px-1 rounded">plantilla-turnos-YYYY-MM-DD.csv</code> (o <code className="font-mono bg-blue-400/10 px-1 rounded">.xlsx</code>) descargado desde el reporte y editado en Excel.
          Esta carga <strong className="text-blue-200">solo modifica slots existentes</strong> (matchea por <code className="font-mono bg-blue-400/10 px-1 rounded">ID Slot</code>).
        </p>
        <ul className="text-[11px] text-blue-200/60 list-disc list-inside space-y-1 pt-1">
          <li>Se pueden editar: <strong>patrones T/M/D</strong>, <strong>S{`{1..4}`}-Hora</strong>, <strong>Horas Turno</strong>, <strong>Longitud Ciclo</strong>, <strong>Fecha Inicio Ciclo</strong>, <strong>Notas</strong>.</li>
          <li>NO se crean slots nuevos, NO se eliminan slots, NO se cambia el titular desde acá.</li>
          <li>Filas sin <code className="font-mono">ID Slot</code> se ignoran. Filas con error bloquean la aplicación hasta que las corrijas.</li>
        </ul>
      </div>

      <div className="flex gap-3">
        <a
          href="/admin/reportes/plantilla-turnos"
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm bg-blue-500/15 hover:bg-blue-500/25 text-blue-300 border border-blue-500/30"
        >
          <Download className="w-4 h-4" />
          Descargar plantilla actual
          <ExternalLink className="w-3 h-3 opacity-60" />
        </a>
      </div>

      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors ${
          dragOver ? "border-blue-400 bg-blue-500/5" : "border-white/15 hover:border-white/25 bg-white/[0.02]"
        }`}
      >
        <Upload className="w-10 h-10 mx-auto text-white/30 mb-3" />
        <p className="text-sm text-white/60">
          Arrastrá el archivo de plantilla acá
          <br />
          <span className="text-xs text-white/40">o hacé clic para seleccionar (.csv o .xlsx)</span>
        </p>
        <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-sm text-white/60">
          <Loader2 className="w-4 h-4 animate-spin" /> Validando plantilla…
        </div>
      )}
    </div>
  );

  if (step === "preview" && previewResult) {
    const pr = previewResult;
    const sinCambiosOk = pr.filas_a_actualizar.length === 0 && pr.filas_con_error.length === 0 && (pr.filas_con_conflicto?.length ?? 0) === 0;
    return (
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-white/50">
            <FileSpreadsheet className="w-4 h-4 text-blue-400" />
            <span className="font-mono">{fileName}</span>
            <span className="text-white/30">·</span>
            <span>{pr.total_filas} fila(s) leída(s)</span>
          </div>
          <button onClick={reset} className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70">
            <X className="w-3.5 h-3.5" /> Cancelar y subir otro
          </button>
        </div>

        <div className="grid grid-cols-5 gap-3">
          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-emerald-400">{pr.filas_a_actualizar.length}</p>
            <p className="text-[11px] text-white/50 mt-1">A actualizar</p>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-white/60">{pr.filas_sin_cambios.length}</p>
            <p className="text-[11px] text-white/50 mt-1">Sin cambios</p>
          </div>
          <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-orange-400">{pr.filas_con_error.length}</p>
            <p className="text-[11px] text-white/50 mt-1">Con error</p>
          </div>
          <div className="bg-rose-500/10 border border-rose-500/30 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-rose-400">{pr.filas_con_conflicto?.length ?? 0}</p>
            <p className="text-[11px] text-white/50 mt-1">Conflictos</p>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-white/40">{pr.filas_ignoradas}</p>
            <p className="text-[11px] text-white/50 mt-1">Ignoradas (sin ID Slot)</p>
          </div>
        </div>

        {pr.filas_con_error.length > 0 && (
          <div className="bg-orange-500/10 border border-orange-500/30 rounded-xl p-4 space-y-2">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-orange-400" />
              <span className="text-sm font-semibold text-orange-200">Errores que bloquean la aplicación</span>
            </div>
            <div className="max-h-64 overflow-y-auto space-y-1">
              {pr.filas_con_error.map((e, i) => (
                <div key={i} className="text-xs text-orange-200/80 font-mono bg-orange-500/5 px-2 py-1.5 rounded">
                  <span className="text-orange-300/60">Fila {e.fila}</span>
                  {e.slot_id_raw && <span className="text-orange-300/60"> · slot {e.slot_id_raw}</span>}
                  <span className="text-orange-300/40"> · </span>
                  <span>{e.errores.join(" / ")}</span>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-orange-200/60 pt-1">Corregí estas filas en el archivo y volvé a subirlo.</p>
          </div>
        )}

        {(pr.filas_con_conflicto?.length ?? 0) > 0 && (
          <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-4 space-y-2">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400" />
              <span className="text-sm font-semibold text-rose-200">
                Conflictos de concurrencia ({pr.filas_con_conflicto.length})
              </span>
            </div>
            <p className="text-[11px] text-rose-200/70">
              Estos slots fueron modificados por otra persona después de que descargaste la plantilla.
              Para no pisar esos cambios, re-descargá la plantilla, aplicá tus cambios sobre la versión actualizada y volvé a subir.
            </p>
            <div className="max-h-64 overflow-y-auto space-y-1">
              {pr.filas_con_conflicto.map((c, i) => (
                <div key={i} className="text-xs text-rose-200/80 bg-rose-500/5 px-2 py-1.5 rounded">
                  <div>
                    <span className="text-rose-300/60 font-mono">Fila {c.fila} · slot {c.slot_id}</span>
                    <span className="text-rose-300/40"> · </span>
                    <span>{c.contexto.cliente_nombre || "Sin cliente"} — {c.contexto.puesto_nombre}{c.contexto.slot_numero != null ? " (slot " + c.contexto.slot_numero + ")" : ""}</span>
                  </div>
                  <div className="text-[10px] text-rose-200/50 font-mono mt-0.5">
                    Descargado: {new Date(c.descargado).toLocaleString("es-GT")} · Modificado en BD: {new Date(c.modificado).toLocaleString("es-GT")}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {pr.filas_a_actualizar.length > 0 && (
          <div className="bg-white/[0.02] border border-white/10 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2 bg-white/[0.03] border-b border-white/10">
              <span className="text-xs font-semibold text-white/70">Cambios a aplicar ({pr.filas_a_actualizar.length})</span>
              <div className="flex gap-2 text-[10px]">
                <button
                  onClick={() => setExpanded(new Set(pr.filas_a_actualizar.map((f) => f.slot_id)))}
                  className="text-white/40 hover:text-white/70"
                >Expandir todos</button>
                <span className="text-white/20">·</span>
                <button onClick={() => setExpanded(new Set())} className="text-white/40 hover:text-white/70">Colapsar</button>
              </div>
            </div>
            <div className="divide-y divide-white/5 max-h-[600px] overflow-y-auto">
              {pr.filas_a_actualizar.map((f) => {
                const isOpen = expanded.has(f.slot_id);
                return (
                  <div key={f.slot_id} className="px-4 py-3">
                    <button
                      onClick={() => {
                        setExpanded((prev) => {
                          const n = new Set(prev);
                          if (n.has(f.slot_id)) n.delete(f.slot_id); else n.add(f.slot_id);
                          return n;
                        });
                      }}
                      className="w-full flex items-center justify-between text-left gap-3 hover:bg-white/[0.02] -mx-2 px-2 py-1 rounded"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-white/85 truncate">
                          {f.contexto.cliente_nombre || "Sin cliente"} <span className="text-white/30">·</span>{" "}
                          {f.contexto.puesto_nombre}
                          {f.contexto.slot_numero != null && (
                            <span className="text-white/40"> · Slot {f.contexto.slot_numero}</span>
                          )}
                        </div>
                        <div className="text-[11px] text-white/40 truncate">
                          {f.contexto.titular_nombre || "(Vacante)"} · {f.cambios.length} cambio{f.cambios.length === 1 ? "" : "s"}: {f.cambios.map((c) => c.campo).join(", ")}
                        </div>
                      </div>
                      <ChevronRight className={`w-4 h-4 text-white/40 transition-transform ${isOpen ? "rotate-90" : ""}`} />
                    </button>
                    {isOpen && (
                      <div className="mt-3 grid grid-cols-2 gap-4 pl-2">
                        <div className="bg-white/[0.02] border border-white/10 rounded-lg p-3">
                          <div className="text-[10px] text-white/40 uppercase mb-2">Antes</div>
                          <MiniGrid
                            longitud_ciclo={f.antes.longitud_ciclo}
                            dias_trabajo={f.antes.dias_trabajo}
                            dias_medio_turno={f.antes.dias_medio_turno}
                          />
                          <div className="text-[10px] text-white/50 mt-2 space-y-0.5 font-mono">
                            <div>HT: {f.antes.horas_turno}h · LC: {f.antes.longitud_ciclo}d</div>
                            <div>Hora: {f.antes.hora_entrada || "—"}{f.antes.hora_entrada_por_semana ? ` (×sem: ${(f.antes.hora_entrada_por_semana || []).join("/")})` : ""}</div>
                            <div>FIC: {f.antes.fecha_inicio_ciclo || "—"}</div>
                          </div>
                        </div>
                        <div className="bg-emerald-500/[0.04] border border-emerald-500/30 rounded-lg p-3">
                          <div className="text-[10px] text-emerald-300 uppercase mb-2">Después</div>
                          <MiniGrid
                            longitud_ciclo={f.despues.longitud_ciclo}
                            dias_trabajo={f.despues.dias_trabajo}
                            dias_medio_turno={f.despues.dias_medio_turno}
                          />
                          <div className="text-[10px] text-emerald-200/80 mt-2 space-y-0.5 font-mono">
                            <div>HT: {f.despues.horas_turno}h · LC: {f.despues.longitud_ciclo}d</div>
                            <div>Hora: {f.despues.hora_entrada || "—"}{f.despues.hora_entrada_por_semana ? ` (×sem: ${(f.despues.hora_entrada_por_semana || []).join("/")})` : ""}</div>
                            <div>FIC: {f.despues.fecha_inicio_ciclo || "—"}</div>
                          </div>
                        </div>
                        <div className="col-span-2 bg-white/[0.01] border border-white/10 rounded-lg p-2">
                          <div className="text-[10px] text-white/40 uppercase mb-1">Diferencias</div>
                          <table className="w-full text-[11px]">
                            <thead>
                              <tr className="text-white/30">
                                <th className="text-left font-normal pr-3 py-0.5">Campo</th>
                                <th className="text-left font-normal pr-3 py-0.5">Antes</th>
                                <th className="text-left font-normal py-0.5">Después</th>
                              </tr>
                            </thead>
                            <tbody>
                              {f.cambios.map((c, ci) => (
                                <tr key={ci} className="text-white/70">
                                  <td className="pr-3 py-0.5 font-medium">{c.campo}</td>
                                  <td className="pr-3 py-0.5 font-mono text-white/40">{fmtVal(c.antes)}</td>
                                  <td className="py-0.5 font-mono text-emerald-300/80">{fmtVal(c.despues)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {sinCambiosOk && (
          <div className="bg-white/5 border border-white/10 rounded-xl p-6 text-center">
            <CheckCircle2 className="w-8 h-8 text-white/40 mx-auto mb-2" />
            <p className="text-sm text-white/60">No hay cambios para aplicar.</p>
            <p className="text-xs text-white/40 mt-1">El contenido del archivo coincide con el sistema actual.</p>
          </div>
        )}

        <div className="flex items-center justify-between pt-2">
          <button onClick={reset} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm bg-white/5 hover:bg-white/10 text-white/60">
            <RotateCcw className="w-4 h-4" /> Subir otro archivo
          </button>
          <button
            onClick={aplicar}
            disabled={loading || pr.filas_a_actualizar.length === 0 || pr.filas_con_error.length > 0 || (pr.filas_con_conflicto?.length ?? 0) > 0}
            className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold bg-emerald-500 hover:bg-emerald-400 text-black disabled:bg-white/5 disabled:text-white/30 disabled:cursor-not-allowed"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            Aplicar {pr.filas_a_actualizar.length} cambio{pr.filas_a_actualizar.length === 1 ? "" : "s"}
          </button>
        </div>
      </div>
    );
  }

  if (step === "result" && importResult) {
    return (
      <div className="space-y-5">
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-5 space-y-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            <span className="font-semibold text-white">Cambios aplicados con éxito</span>
          </div>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold text-emerald-400">{importResult.actualizados ?? 0}</p>
              <p className="text-xs text-white/50 mt-1">Slots actualizados</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-white/60">{importResult.sin_cambios ?? 0}</p>
              <p className="text-xs text-white/50 mt-1">Sin cambios</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-white/40">{importResult.ignorados ?? 0}</p>
              <p className="text-xs text-white/50 mt-1">Ignorados</p>
            </div>
          </div>
        </div>

        {Array.isArray(importResult.detalle) && importResult.detalle.length > 0 && (
          <div className="bg-white/[0.02] border border-white/10 rounded-xl overflow-hidden">
            <div className="px-4 py-2 bg-white/[0.03] border-b border-white/10 text-xs font-semibold text-white/70">
              Detalle ({importResult.detalle.length})
            </div>
            <div className="divide-y divide-white/5 max-h-96 overflow-y-auto">
              {importResult.detalle.map((d: any, i: number) => (
                <div key={i} className="px-4 py-2 text-xs text-white/70">
                  <span className="text-white/40">slot {d.slot_id}</span>
                  <span className="text-white/30"> · </span>
                  {d.cliente || "Sin cliente"}
                  <span className="text-white/30"> · </span>
                  {d.puesto}
                  {d.slot_numero != null && <span className="text-white/40"> #{d.slot_numero}</span>}
                  <span className="text-white/30"> · </span>
                  <span className="text-emerald-300/80">{d.cambios} cambio{d.cambios === 1 ? "" : "s"}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <button onClick={reset} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm bg-white/10 hover:bg-white/15 text-white/60">
          <RotateCcw className="w-4 h-4" /> Nueva carga
        </button>
      </div>
    );
  }

  return null;
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function Importacion() {
  const [activeTab, setActiveTab] = useState<string>(TABS[0].id);
  const tab = TABS.find((t) => t.id === activeTab);
  const isLegacyEmpl    = activeTab === LEGACY_TAB_ID;
  const isLegacyClients = activeTab === LEGACY_CLIENTES_TAB_ID;
  const isLibroSal           = activeTab === LIBRO_SAL_TAB_ID;
  const isDevEmp             = activeTab === DEV_EMP_TAB_ID;
  const isDetalleLibSal      = activeTab === DETALLE_LIB_SAL_TAB_ID;
  const isDetallePrestaciones = activeTab === DETALLE_PREST_TAB_ID;
  const isDigecam            = activeTab === DIGECAM_TAB_ID;
  const isAlmacen            = activeTab === ALMACEN_TAB_ID;
  const isCargaMaestra       = activeTab === CARGA_MAESTRA_TAB_ID;
  const isPlantillaTurnos    = activeTab === PLANTILLA_TURNOS_TAB_ID;
  const isAnySA              = isLegacyEmpl || isLegacyClients;

  return (
    <AdminLayout title="Importar Datos">
      <div className="max-w-5xl mx-auto space-y-6">

        <div>
          <h1 className="text-xl font-semibold text-white">Importación Masiva de Datos</h1>
          <p className="text-sm text-white/50 mt-1">
            Carga datos desde CSV para el sistema nuevo, o importa directamente desde los archivos Excel del sistema anterior.
          </p>
        </div>

        {!isAnySA && !isLibroSal && !isDevEmp && !isDetallePrestaciones && !isDigecam && !isAlmacen && !isCargaMaestra && !isPlantillaTurnos && (
          <div className="flex items-center gap-0 bg-white/[0.02] border border-white/10 rounded-xl p-4">
            {[
              { n: 1, label: "Descarga la plantilla" },
              { n: 2, label: "Llena con tus datos" },
              { n: 3, label: "Sube el CSV" },
              { n: 4, label: "Valida y confirma" },
            ].map((s, i) => (
              <div key={s.n} className="flex items-center flex-1">
                <div className="flex items-center gap-2 flex-1">
                  <div className="w-6 h-6 rounded-full bg-primary/20 text-primary text-[11px] font-bold flex items-center justify-center flex-shrink-0">
                    {s.n}
                  </div>
                  <span className="text-xs text-white/50">{s.label}</span>
                </div>
                {i < 3 && <ChevronRight className="w-3.5 h-3.5 text-white/20 flex-shrink-0" />}
              </div>
            ))}
          </div>
        )}

        {/* Guía del flujo para migración del sistema antiguo */}
        {isAnySA && (
          <div className="flex items-center gap-0 bg-amber-500/[0.07] border border-amber-500/20 rounded-xl p-4">
            {[
              { n: 1, label: "Importar Clientes",      tab: LEGACY_CLIENTES_TAB_ID },
              { n: 2, label: "Importar Colaboradores", tab: LEGACY_TAB_ID },
              { n: 3, label: "Vincular",               tab: null },
              { n: 4, label: "Crear puestos",          tab: null },
            ].map((s, i) => (
              <div key={s.n} className="flex items-center flex-1">
                <div className="flex items-center gap-2 flex-1">
                  <div className={`w-6 h-6 rounded-full text-[11px] font-bold flex items-center justify-center flex-shrink-0 ${
                    activeTab === s.tab ? "bg-amber-400 text-black" : "bg-amber-400/20 text-amber-400"
                  }`}>{s.n}</div>
                  <span className={`text-xs ${activeTab === s.tab ? "text-amber-300" : "text-white/40"}`}>{s.label}</span>
                </div>
                {i < 3 && <ChevronRight className="w-3.5 h-3.5 text-amber-400/30 flex-shrink-0" />}
              </div>
            ))}
          </div>
        )}

        <div className="bg-white/[0.03] border border-white/10 rounded-xl overflow-hidden">
          <div className="flex border-b border-white/10 overflow-x-auto">
            {TABS.map((t) => {
              const Icon = t.icon;
              const active = t.id === activeTab;
              return (
                <button
                  key={t.id}
                  onClick={() => setActiveTab(t.id)}
                  className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                    active
                      ? "border-primary text-primary"
                      : "border-transparent text-white/40 hover:text-white/70"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {t.label}
                </button>
              );
            })}
            {/* Libro de Salarios */}
            <button
              onClick={() => setActiveTab(LIBRO_SAL_TAB_ID)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                isLibroSal
                  ? "border-emerald-400 text-emerald-400"
                  : "border-transparent text-white/40 hover:text-emerald-400/60"
              }`}
            >
              <FileSpreadsheet className="w-4 h-4" />
              Libro de Salarios
            </button>
            {/* Salarios y Bonificaciones */}
            <button
              onClick={() => setActiveTab(DEV_EMP_TAB_ID)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                isDevEmp
                  ? "border-emerald-400 text-emerald-400"
                  : "border-transparent text-white/40 hover:text-emerald-400/60"
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              Salarios y Bonificaciones
            </button>
            {/* Detalle Libro de Salarios (nuevo archivo ODBC con BONI separado) */}
            <button
              onClick={() => setActiveTab(DETALLE_LIB_SAL_TAB_ID)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                isDetalleLibSal
                  ? "border-blue-400 text-blue-400"
                  : "border-transparent text-white/40 hover:text-blue-400/60"
              }`}
            >
              <FileSpreadsheet className="w-4 h-4" />
              Detalle Nómina ODBC
            </button>
            {/* Detalle Prestaciones ODBC */}
            <button
              onClick={() => setActiveTab(DETALLE_PREST_TAB_ID)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                isDetallePrestaciones
                  ? "border-teal-400 text-teal-400"
                  : "border-transparent text-white/40 hover:text-teal-400/60"
              }`}
            >
              <FileSpreadsheet className="w-4 h-4" />
              Prestaciones ODBC
            </button>
            {/* DIGECAM — Armería */}
            <div className="w-px bg-white/10 self-stretch mx-1" />
            <button
              onClick={() => setActiveTab(DIGECAM_TAB_ID)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                isDigecam
                  ? "border-red-400 text-red-400"
                  : "border-transparent text-white/40 hover:text-red-400/60"
              }`}
            >
              <Shield className="w-4 h-4" />
              DIGECAM · Armas
            </button>
            {/* Almacén · Inventario */}
            <button
              onClick={() => setActiveTab(ALMACEN_TAB_ID)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                isAlmacen
                  ? "border-teal-400 text-teal-400"
                  : "border-transparent text-white/40 hover:text-teal-400/60"
              }`}
            >
              <Package className="w-4 h-4" />
              Almacén · Stock
            </button>
            {/* Separador visual */}
            <div className="w-px bg-white/10 self-stretch mx-1" />
            {/* Plantilla de Turnos — re-importación de edición */}
            <button
              onClick={() => setActiveTab(PLANTILLA_TURNOS_TAB_ID)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                isPlantillaTurnos
                  ? "border-blue-400 text-blue-400"
                  : "border-transparent text-white/40 hover:text-blue-400/60"
              }`}
            >
              <Clock className="w-4 h-4" />
              Plantilla de Turnos
            </button>
            {/* Separador visual */}
            <div className="w-px bg-white/10 self-stretch mx-1" />
            {/* Carga Maestra */}
            <button
              onClick={() => setActiveTab(CARGA_MAESTRA_TAB_ID)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                isCargaMaestra
                  ? "border-indigo-400 text-indigo-400"
                  : "border-transparent text-white/40 hover:text-indigo-400/60"
              }`}
            >
              <Database className="w-4 h-4" />
              Carga Maestra
            </button>
            {/* Separador visual */}
            <div className="w-px bg-white/10 self-stretch mx-1" />
            {/* SA — Clientes */}
            <button
              onClick={() => setActiveTab(LEGACY_CLIENTES_TAB_ID)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                isLegacyClients
                  ? "border-amber-400 text-amber-400"
                  : "border-transparent text-white/40 hover:text-amber-400/60"
              }`}
            >
              <Database className="w-4 h-4" />
              SA · Clientes
            </button>
            {/* SA — Colaboradores */}
            <button
              onClick={() => setActiveTab(LEGACY_TAB_ID)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                isLegacyEmpl
                  ? "border-amber-400 text-amber-400"
                  : "border-transparent text-white/40 hover:text-amber-400/60"
              }`}
            >
              <Database className="w-4 h-4" />
              SA · Colaboradores
            </button>
          </div>

          <div className="p-6 space-y-6">
            {isLibroSal            ? <LibroSalariosTab         key={LIBRO_SAL_TAB_ID} />         :
             isDevEmp              ? <DevengadosEmpleadoTab   key={DEV_EMP_TAB_ID} />           :
             isDetalleLibSal       ? <DetalleLibSalTab        key={DETALLE_LIB_SAL_TAB_ID} />   :
             isDetallePrestaciones ? <DetallePrestacionesTab  key={DETALLE_PREST_TAB_ID} />      :
             isDigecam             ? <DiGECAMTab              key={DIGECAM_TAB_ID} />            :
             isAlmacen             ? <AlmacenTab              key={ALMACEN_TAB_ID} />            :
             isCargaMaestra        ? <CargaMaestraTab         key={CARGA_MAESTRA_TAB_ID} />      :
             isPlantillaTurnos     ? <PlantillaTurnosTab      key={PLANTILLA_TURNOS_TAB_ID} />   :
             isLegacyEmpl    ? <LegacyImporterTab     key={LEGACY_TAB_ID} />       :
             isLegacyClients ? <LegacyClientesTab     key={LEGACY_CLIENTES_TAB_ID} /> :
             tab             ? (
              <ImporterTab
                key={activeTab}
                endpoint={tab.endpoint}
                templateHeaders={[...tab.templateHeaders]}
                templateExample={[...tab.templateExample]}
                templateFilename={tab.templateFilename}
                columns={[...tab.columns]}
                entityLabel={tab.entityLabel}
                autoPrefix={tab.autoPrefix}
              />
            ) : null}

            {/* Paneles de vinculación y creación de puestos — solo en pestañas SA */}
            {isAnySA && (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <div className="h-px flex-1 bg-white/10" />
                  <span className="text-[11px] text-white/30 font-medium px-2">PASO 3 · VINCULACIÓN</span>
                  <div className="h-px flex-1 bg-white/10" />
                </div>
                <VincularPanel />

                <div className="flex items-center gap-2">
                  <div className="h-px flex-1 bg-white/10" />
                  <span className="text-[11px] text-white/30 font-medium px-2">PASO 4 · CREAR PUESTOS</span>
                  <div className="h-px flex-1 bg-white/10" />
                </div>
                <CrearPuestosPanel />
              </div>
            )}
          </div>
        </div>

        <div className="bg-white/[0.02] border border-white/10 rounded-xl p-4 space-y-2">
          <h4 className="text-xs font-semibold text-white/60">Consejos para la migración</h4>
          <ul className="space-y-1 text-xs text-white/40 list-disc list-inside">
            <li>Comienza importando los <strong className="text-white/60">colaboradores</strong> antes de los puestos.</li>
            <li>Los registros duplicados (mismo DPI o nombre) se omiten automáticamente sin error.</li>
            <li>Puedes corregir las filas con error y re-subir solo esas filas.</li>
            <li>Las fechas se aceptan en formato <code className="text-primary/70">YYYY-MM-DD</code> o <code className="text-primary/70">DD/MM/YYYY</code>.</li>
            <li>Los estados válidos para colaboradores: <code className="text-primary/70">activo</code>, <code className="text-primary/70">inactivo</code>, <code className="text-primary/70">suspendido</code>.</li>
            <li>Los turnos válidos para puestos: <code className="text-primary/70">día</code>, <code className="text-primary/70">noche</code>, <code className="text-primary/70">mixto</code>.</li>
          </ul>
        </div>

      </div>
    </AdminLayout>
  );
}
