/**
 * PLANTILLAS DE CONTRATO — Editor para Admin
 *
 * Permite editar el texto del Contrato Individual de Trabajo (inicial y
 * post-prueba) sin tocar código. Cada vez que se guarda se crea una nueva
 * versión y se marca como activa.
 *
 * Variables se insertan con el formato {{nombre}}; al imprimir el PDF se
 * sustituyen por los datos del empleado/patrono.
 */

import { useEffect, useMemo, useState } from "react";
import { AdminLayout } from "@/admin/layout/AdminLayout";
import {
  Save,
  RotateCcw,
  Eye,
  ChevronUp,
  ChevronDown,
  Trash2,
  Plus,
  History,
  CheckCircle2,
  AlertCircle,
  Copy,
  FileText,
} from "lucide-react";
import { generarContratoLaboral } from "@/lib/pdfRrhh";

const API = "/api";
const getSession = () => sessionStorage.getItem("isp_admin_session_v2") || "";
const h = () => ({ "x-isp-session": getSession(), "Content-Type": "application/json" });

type Tipo = "inicial" | "post_prueba";

interface Clausula {
  numero: string;
  titulo: string;
  contenido: string;
}
interface Plantilla {
  id: number;
  tipo: string;
  version: number;
  activa: boolean;
  titulo: string;
  subtitulo: string | null;
  encabezado: string;
  clausulas: Clausula[];
  cierre: string;
  notas: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}
interface Variable {
  clave: string;
  descripcion: string;
  ejemplo: string;
}

export default function PlantillasContrato() {
  const [tipo, setTipo] = useState<Tipo>("inicial");
  const [plantilla, setPlantilla] = useState<Plantilla | null>(null);
  const [variables, setVariables] = useState<Variable[]>([]);
  const [versiones, setVersiones] = useState<Plantilla[]>([]);
  const [verHistorial, setVerHistorial] = useState(false);
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [msg, setMsg] = useState<{ tipo: "ok" | "err"; texto: string } | null>(null);

  const cargar = async (t: Tipo) => {
    setLoading(true);
    try {
      const r = await fetch(`${API}/plantillas-contrato/${t}/activa`, { headers: h() });
      if (!r.ok) throw new Error(await r.text());
      const data: Plantilla = await r.json();
      setPlantilla(data);
    } catch (e) {
      setMsg({ tipo: "err", texto: `Error al cargar: ${(e as Error).message}` });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargar(tipo);
  }, [tipo]);

  useEffect(() => {
    fetch(`${API}/plantillas-contrato/variables`, { headers: h() })
      .then((r) => r.json())
      .then((d) => setVariables(d.variables ?? []))
      .catch(() => {});
  }, []);

  const cargarHistorial = async () => {
    try {
      const r = await fetch(`${API}/plantillas-contrato/${tipo}/versiones`, { headers: h() });
      if (!r.ok) throw new Error(await r.text());
      const d = await r.json();
      setVersiones(d.versiones ?? []);
      setVerHistorial(true);
    } catch (e) {
      setMsg({ tipo: "err", texto: `Error al cargar historial: ${(e as Error).message}` });
    }
  };

  const guardar = async () => {
    if (!plantilla) return;
    setGuardando(true);
    setMsg(null);
    try {
      const r = await fetch(`${API}/plantillas-contrato/${tipo}`, {
        method: "PUT",
        headers: h(),
        body: JSON.stringify({
          titulo: plantilla.titulo,
          subtitulo: plantilla.subtitulo,
          encabezado: plantilla.encabezado,
          clausulas: plantilla.clausulas,
          cierre: plantilla.cierre,
          notas: plantilla.notas,
        }),
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error(err.error ?? `HTTP ${r.status}`);
      }
      const nueva: Plantilla = await r.json();
      setPlantilla(nueva);
      setMsg({ tipo: "ok", texto: `Guardado como versión ${nueva.version}` });
    } catch (e) {
      setMsg({ tipo: "err", texto: `Error al guardar: ${(e as Error).message}` });
    } finally {
      setGuardando(false);
    }
  };

  const restaurarDefault = async () => {
    if (!confirm("¿Restaurar la plantilla original? Esto creará una nueva versión con el texto base.")) return;
    setGuardando(true);
    try {
      const r = await fetch(`${API}/plantillas-contrato/${tipo}/reset-default`, {
        method: "POST",
        headers: h(),
      });
      if (!r.ok) throw new Error(await r.text());
      const nueva: Plantilla = await r.json();
      setPlantilla(nueva);
      setMsg({ tipo: "ok", texto: `Restaurada al default (versión ${nueva.version})` });
    } catch (e) {
      setMsg({ tipo: "err", texto: `Error: ${(e as Error).message}` });
    } finally {
      setGuardando(false);
    }
  };

  const restaurarVersion = async (version: number) => {
    if (!confirm(`¿Activar la versión ${version}? La activa actual quedará en historial.`)) return;
    try {
      const r = await fetch(`${API}/plantillas-contrato/${tipo}/restaurar/${version}`, {
        method: "POST",
        headers: h(),
      });
      if (!r.ok) throw new Error(await r.text());
      await cargar(tipo);
      setVerHistorial(false);
      setMsg({ tipo: "ok", texto: `Versión ${version} activada` });
    } catch (e) {
      setMsg({ tipo: "err", texto: `Error: ${(e as Error).message}` });
    }
  };

  const vistaPrevia = async () => {
    if (!plantilla) return;
    // Primero hay que GUARDAR, porque el PDF lee del API. Aviso al usuario.
    if (!confirm(
      "La vista previa usará la última versión GUARDADA. Si hiciste cambios, primero guarda. ¿Continuar generando PDF de demo?",
    )) return;
    try {
      await generarContratoLaboral({
        empleado_nombre: "Juan Carlos Pérez López",
        empleado_dpi: "1234567890101",
        empleado_estado_civil: "soltero",
        empleado_direccion: "5a Avenida 10-25 Zona 1, Guatemala",
        empleado_telefono: "5555-1234",
        empleado_nit: "12345678",
        empleado_igss: "123456789",
        fecha_inicio: new Date().toISOString().slice(0, 10),
        puesto: "Banco Industrial Z10",
        tipo_personal: "guardia",
        sueldo_base: 3500,
        jornada: "mixta",
        dia_descanso: "domingo",
        tipo_contrato: tipo,
      });
    } catch (e) {
      setMsg({ tipo: "err", texto: `Error en vista previa: ${(e as Error).message}` });
    }
  };

  const copiarVar = (clave: string) => {
    navigator.clipboard.writeText(`{{${clave}}}`).then(
      () => setMsg({ tipo: "ok", texto: `{{${clave}}} copiado al portapapeles` }),
      () => setMsg({ tipo: "err", texto: "No se pudo copiar" }),
    );
  };

  // ── Operaciones sobre cláusulas ──────────────────────────────────────────
  const updateClausula = (i: number, patch: Partial<Clausula>) => {
    if (!plantilla) return;
    const arr = plantilla.clausulas.slice();
    arr[i] = { ...arr[i], ...patch };
    setPlantilla({ ...plantilla, clausulas: arr });
  };
  const moverClausula = (i: number, delta: number) => {
    if (!plantilla) return;
    const j = i + delta;
    if (j < 0 || j >= plantilla.clausulas.length) return;
    const arr = plantilla.clausulas.slice();
    [arr[i], arr[j]] = [arr[j], arr[i]];
    setPlantilla({ ...plantilla, clausulas: arr });
  };
  const eliminarClausula = (i: number) => {
    if (!plantilla) return;
    if (!confirm(`¿Eliminar la cláusula "${plantilla.clausulas[i].titulo}"?`)) return;
    const arr = plantilla.clausulas.slice();
    arr.splice(i, 1);
    setPlantilla({ ...plantilla, clausulas: arr });
  };
  const agregarClausula = () => {
    if (!plantilla) return;
    const arr = plantilla.clausulas.slice();
    arr.push({ numero: "NUEVA", titulo: "Nueva cláusula", contenido: "Texto..." });
    setPlantilla({ ...plantilla, clausulas: arr });
  };

  return (
    <AdminLayout>
      <div className="p-6 max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <FileText className="w-6 h-6 text-amber-400" />
            <div>
              <h1 className="text-2xl font-bold text-slate-100">Plantillas de Contrato Laboral</h1>
              <p className="text-sm text-slate-400">
                Edita el texto del contrato sin tocar código. Cada cambio crea una nueva versión.
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={vistaPrevia}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700/60 hover:bg-slate-600 text-slate-100 border border-slate-600 rounded text-sm transition"
            >
              <Eye className="w-4 h-4" /> Vista previa
            </button>
            <button
              onClick={cargarHistorial}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700/60 hover:bg-slate-600 text-slate-100 border border-slate-600 rounded text-sm transition"
            >
              <History className="w-4 h-4" /> Versiones
            </button>
            <button
              onClick={restaurarDefault}
              disabled={guardando}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded text-sm transition disabled:opacity-40"
            >
              <RotateCcw className="w-4 h-4" /> Restaurar original
            </button>
            <button
              onClick={guardar}
              disabled={guardando || !plantilla}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-600 disabled:text-slate-400 text-white rounded text-sm font-semibold shadow transition"
            >
              <Save className="w-4 h-4" /> {guardando ? "Guardando..." : "Guardar nueva versión"}
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-4 border-b border-slate-700">
          {(["inicial", "post_prueba"] as Tipo[]).map((t) => (
            <button
              key={t}
              onClick={() => setTipo(t)}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition ${
                tipo === t ? "border-amber-400 text-amber-300" : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              {t === "inicial" ? "Inicial (con período de prueba)" : "Post-prueba (indefinido)"}
            </button>
          ))}
        </div>

        {msg && (
          <div
            className={`mb-3 px-3 py-2 rounded flex items-center gap-2 text-sm ${
              msg.tipo === "ok" ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"
            }`}
          >
            {msg.tipo === "ok" ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            {msg.texto}
            <button onClick={() => setMsg(null)} className="ml-auto text-xs opacity-60 hover:opacity-100">
              ✕
            </button>
          </div>
        )}

        {loading || !plantilla ? (
          <div className="p-8 text-center text-gray-500">Cargando plantilla...</div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-4">
            {/* Editor */}
            <div className="space-y-4">
              <div className="text-xs text-slate-300 bg-slate-800/60 border border-slate-700 px-3 py-2 rounded">
                Versión activa: <strong>v{plantilla.version}</strong> · creada por{" "}
                {plantilla.createdBy ?? "—"} el{" "}
                {new Date(plantilla.createdAt).toLocaleString("es-GT")}
              </div>

              <Bloque label="Título">
                <input
                  type="text"
                  value={plantilla.titulo}
                  onChange={(e) => setPlantilla({ ...plantilla, titulo: e.target.value })}
                  className="w-full border rounded px-3 py-2 bg-white text-gray-900 placeholder-gray-400"
                />
              </Bloque>

              <Bloque label="Subtítulo">
                <input
                  type="text"
                  value={plantilla.subtitulo ?? ""}
                  onChange={(e) => setPlantilla({ ...plantilla, subtitulo: e.target.value })}
                  className="w-full border rounded px-3 py-2 bg-white text-gray-900 placeholder-gray-400"
                />
              </Bloque>

              <Bloque label="Encabezado (comparecientes)" hint="Párrafo introductorio con datos de las partes.">
                <textarea
                  value={plantilla.encabezado}
                  onChange={(e) => setPlantilla({ ...plantilla, encabezado: e.target.value })}
                  rows={8}
                  className="w-full border rounded px-3 py-2 font-mono text-xs bg-white text-gray-900 placeholder-gray-400"
                />
              </Bloque>

              {/* Cláusulas */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="font-semibold text-slate-100">Cláusulas ({plantilla.clausulas.length})</h2>
                  <button
                    onClick={agregarClausula}
                    className="flex items-center gap-1 text-sm text-amber-300 hover:text-amber-200 hover:underline"
                  >
                    <Plus className="w-4 h-4" /> Agregar cláusula
                  </button>
                </div>
                {plantilla.clausulas.map((cl, i) => (
                  <div key={i} className="border rounded p-3 bg-white">
                    <div className="flex items-center gap-2 mb-2">
                      <input
                        type="text"
                        value={cl.numero}
                        onChange={(e) => updateClausula(i, { numero: e.target.value })}
                        placeholder="PRIMERA"
                        className="border rounded px-2 py-1 w-28 text-sm font-bold bg-white text-gray-900 placeholder-gray-400"
                      />
                      <input
                        type="text"
                        value={cl.titulo}
                        onChange={(e) => updateClausula(i, { titulo: e.target.value })}
                        placeholder="Título de la cláusula"
                        className="flex-1 border rounded px-2 py-1 text-sm font-semibold bg-white text-gray-900 placeholder-gray-400"
                      />
                      <button
                        onClick={() => moverClausula(i, -1)}
                        disabled={i === 0}
                        className="p-1 hover:bg-gray-100 rounded disabled:opacity-30"
                        title="Subir"
                      >
                        <ChevronUp className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => moverClausula(i, 1)}
                        disabled={i === plantilla.clausulas.length - 1}
                        className="p-1 hover:bg-gray-100 rounded disabled:opacity-30"
                        title="Bajar"
                      >
                        <ChevronDown className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => eliminarClausula(i)}
                        className="p-1 hover:bg-red-50 text-red-600 rounded"
                        title="Eliminar"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <textarea
                      value={cl.contenido}
                      onChange={(e) => updateClausula(i, { contenido: e.target.value })}
                      rows={Math.min(20, Math.max(4, cl.contenido.split("\n").length + 1))}
                      className="w-full border rounded px-3 py-2 font-mono text-xs bg-white text-gray-900 placeholder-gray-400"
                      placeholder="Contenido de la cláusula. Usa {{variable}} para insertar datos."
                    />
                  </div>
                ))}
              </div>

              <Bloque label="Cierre" hint='Texto antes de las firmas (ej: "LEÍDO QUE FUE...")'>
                <textarea
                  value={plantilla.cierre}
                  onChange={(e) => setPlantilla({ ...plantilla, cierre: e.target.value })}
                  rows={4}
                  className="w-full border rounded px-3 py-2 font-mono text-xs bg-white text-gray-900 placeholder-gray-400"
                />
              </Bloque>

              <Bloque label="Notas internas (no aparecen en el PDF)">
                <textarea
                  value={plantilla.notas ?? ""}
                  onChange={(e) => setPlantilla({ ...plantilla, notas: e.target.value })}
                  rows={2}
                  className="w-full border rounded px-3 py-2 text-xs bg-white text-gray-900 placeholder-gray-400"
                  placeholder="Ej: Cambio solicitado por gerencia el ..."
                />
              </Bloque>
            </div>

            {/* Panel lateral de variables */}
            <aside className="lg:sticky lg:top-4 self-start">
              <div className="border border-slate-700 rounded bg-slate-800/60 p-3">
                <h3 className="font-semibold text-sm mb-2 text-slate-100">Variables disponibles</h3>
                <p className="text-xs text-slate-400 mb-3">
                  Clic para copiar. Pégala dentro de cualquier texto.
                </p>
                <div className="space-y-1 max-h-[600px] overflow-auto pr-1">
                  {variables.map((v) => (
                    <button
                      key={v.clave}
                      onClick={() => copiarVar(v.clave)}
                      className="w-full text-left px-2 py-1 hover:bg-slate-700 rounded text-xs flex items-start gap-1 group transition"
                      title={v.descripcion + " — ej: " + v.ejemplo}
                    >
                      <Copy className="w-3 h-3 mt-0.5 text-slate-500 group-hover:text-amber-300 flex-shrink-0" />
                      <code className="text-amber-300 font-mono">{`{{${v.clave}}}`}</code>
                    </button>
                  ))}
                </div>
              </div>
              <div className="border border-amber-500/30 rounded bg-amber-500/10 p-3 mt-3 text-xs text-amber-200">
                <strong>Tip:</strong> Para texto en negrita, envuelve un párrafo completo entre{" "}
                <code className="bg-slate-900/60 px-1 rounded">**asteriscos**</code>. Separa párrafos con
                líneas en blanco.
              </div>
            </aside>
          </div>
        )}

        {/* Modal de versiones */}
        {verHistorial && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg max-w-2xl w-full max-h-[80vh] overflow-auto">
              <div className="sticky top-0 bg-white border-b px-4 py-3 flex justify-between items-center">
                <h2 className="font-bold">Historial de versiones — {tipo}</h2>
                <button onClick={() => setVerHistorial(false)} className="text-gray-500 hover:text-gray-800">
                  ✕
                </button>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs">
                  <tr>
                    <th className="px-3 py-2 text-left">Versión</th>
                    <th className="px-3 py-2 text-left">Fecha</th>
                    <th className="px-3 py-2 text-left">Por</th>
                    <th className="px-3 py-2 text-left">Estado</th>
                    <th className="px-3 py-2 text-left">Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {versiones.map((v) => (
                    <tr key={v.id} className="border-t">
                      <td className="px-3 py-2 font-mono">v{v.version}</td>
                      <td className="px-3 py-2">{new Date(v.createdAt).toLocaleString("es-GT")}</td>
                      <td className="px-3 py-2">{v.createdBy ?? "—"}</td>
                      <td className="px-3 py-2">
                        {v.activa ? (
                          <span className="text-green-700 font-semibold">Activa</span>
                        ) : (
                          <span className="text-gray-500">Histórica</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {!v.activa && (
                          <button
                            onClick={() => restaurarVersion(v.version)}
                            className="text-blue-600 hover:underline text-xs"
                          >
                            Activar
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}

function Bloque({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-semibold text-gray-700 mb-1">{label}</label>
      {hint && <p className="text-xs text-gray-500 mb-1">{hint}</p>}
      {children}
    </div>
  );
}
