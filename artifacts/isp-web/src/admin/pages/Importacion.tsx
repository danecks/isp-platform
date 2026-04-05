import { useState, useRef, useCallback } from "react";
import { AdminLayout } from "../layout/AdminLayout";
import {
  FileUp, Download, CheckCircle2, XCircle, AlertCircle,
  Loader2, ChevronRight, RotateCcw, Users, MapPin, Package,
  Wand2, HelpCircle, Shield,
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

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function Importacion() {
  const [activeTab, setActiveTab] = useState<string>(TABS[0].id);
  const tab = TABS.find((t) => t.id === activeTab)!;

  return (
    <AdminLayout title="Importar Datos">
      <div className="max-w-4xl mx-auto space-y-6">

        <div>
          <h1 className="text-xl font-semibold text-white">Importación Masiva de Datos</h1>
          <p className="text-sm text-white/50 mt-1">
            Carga tus datos desde archivos CSV exportados de tu sistema actual.
            El sistema valida cada fila antes de importar y reporta errores detalladamente.
          </p>
        </div>

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

        <div className="bg-white/[0.03] border border-white/10 rounded-xl overflow-hidden">
          <div className="flex border-b border-white/10">
            {TABS.map((t) => {
              const Icon = t.icon;
              const active = t.id === activeTab;
              return (
                <button
                  key={t.id}
                  onClick={() => setActiveTab(t.id)}
                  className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
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
          </div>

          <div className="p-6">
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
