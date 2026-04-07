import { useState, useRef, useCallback } from "react";
import { AdminLayout } from "../layout/AdminLayout";
import {
  FileUp, Download, CheckCircle2, XCircle, AlertCircle,
  Loader2, ChevronRight, RotateCcw, Users, MapPin, Package,
  Wand2, HelpCircle, Shield, Database, RefreshCw, ToggleLeft, ToggleRight,
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
    if (!ext.endsWith(".xlsx") && !ext.endsWith(".xls")) {
      alert("Solo se aceptan archivos .xlsx o .xls del sistema antiguo");
      return;
    }
    const buf = await file.arrayBuffer();
    const XLSX = await import("xlsx");
    const wb = XLSX.read(buf, { type: "array" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const data: Record<string, any>[] = XLSX.utils.sheet_to_json(ws, { defval: null });
    if (data.length === 0) { alert("El archivo no tiene datos válidos"); return; }
    // Detectar que tiene columnas del sistema antiguo
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
        <p className="text-xs text-white/30 mt-1">o haz clic para seleccionarlo · Acepta .xlsx y .xls</p>
        <input
          ref={fileRef}
          type="file"
          accept=".xlsx,.xls"
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
    if (!ext.endsWith(".xlsx") && !ext.endsWith(".xls")) {
      alert("Solo se aceptan archivos .xlsx o .xls"); return;
    }
    const buf = await file.arrayBuffer();
    const XLSX = await import("xlsx");
    const wb = XLSX.read(buf, { type: "array" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const data: Record<string, any>[] = XLSX.utils.sheet_to_json(ws, { defval: null });
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
        <p className="text-xs text-white/30 mt-1">o haz clic · Acepta .xlsx y .xls</p>
        <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden"
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

const LEGACY_TAB_ID          = "sistema-antiguo";
const LEGACY_CLIENTES_TAB_ID = "sistema-antiguo-clientes";

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function Importacion() {
  const [activeTab, setActiveTab] = useState<string>(TABS[0].id);
  const tab = TABS.find((t) => t.id === activeTab);
  const isLegacyEmpl    = activeTab === LEGACY_TAB_ID;
  const isLegacyClients = activeTab === LEGACY_CLIENTES_TAB_ID;
  const isAnySA         = isLegacyEmpl || isLegacyClients;

  return (
    <AdminLayout title="Importar Datos">
      <div className="max-w-5xl mx-auto space-y-6">

        <div>
          <h1 className="text-xl font-semibold text-white">Importación Masiva de Datos</h1>
          <p className="text-sm text-white/50 mt-1">
            Carga datos desde CSV para el sistema nuevo, o importa directamente desde los archivos Excel del sistema anterior.
          </p>
        </div>

        {!isAnySA && (
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
            {isLegacyEmpl    ? <LegacyImporterTab  key={LEGACY_TAB_ID} />          :
             isLegacyClients ? <LegacyClientesTab  key={LEGACY_CLIENTES_TAB_ID} /> :
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
