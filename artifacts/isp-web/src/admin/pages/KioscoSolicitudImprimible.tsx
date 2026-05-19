/**
 * KioscoSolicitudImprimible.tsx
 * Vista imprimible (formulario A4) de una solicitud de empleo.
 * Ruta: /admin/rrhh/kiosco-solicitudes/:id/imprimir
 *
 * El usuario presiona "Descargar PDF" → window.print() → "Guardar como PDF" del navegador.
 */
import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Printer, ArrowLeft } from "lucide-react";
import { getSessionToken } from "@/lib/httpClient";

const API = "/api";
const getSession = () => getSessionToken();

interface Detalle {
  id: number;
  nombre_completo: string;
  dpi: string | null;
  telefono: string | null;
  telefono_fijo?: string | null;
  correo: string | null;
  fecha_nacimiento: string | null;
  lugar_nacimiento?: string | null;
  genero: string | null;
  estado_civil: string | null;
  nit?: string | null;
  igss?: string | null;
  profesion?: string | null;
  direccion: string | null;
  municipio: string | null;
  departamento: string | null;
  tipo_vivienda?: string | null;
  tiempo_residencia?: string | null;
  renta_mensual?: string | null;
  nombre_padre: string | null;
  nombre_madre: string | null;
  nombre_conyuge?: string | null;
  num_dependientes: number;
  familiar_en_empresa: boolean;
  nombre_familiar_empresa: string | null;
  nombre_contacto_emergencia: string | null;
  telefono_emergencia: string | null;
  parentesco_emergencia?: string | null;
  estatura?: string | null;
  peso?: string | null;
  grado_estudios: string | null;
  facebook?: string | null;
  instagram?: string | null;
  experiencia_seguridad: boolean;
  anios_experiencia: number;
  empresa_anterior: string | null;
  tipos_seguridad?: string | null;
  servicio_militar?: string | null;
  rango_militar?: string | null;
  unidad_militar?: string | null;
  fue_policia?: string | null;
  habilidades?: string | null;
  tiene_licencia?: string | null;
  tipo_licencia?: string | null;
  vigencia_licencia?: string | null;
  tiene_vehiculo: boolean;
  licencia_armas: boolean;
  disp_rotativo?: string | null;
  disp_nocturno?: string | null;
  disp_fds?: string | null;
  disponible_exterior: boolean;
  disponibilidad_horario: string | null;
  puesto_solicitado: string | null;
  pretension_salarial: string | null;
  banco?: string | null;
  num_cuenta?: string | null;
  tipo_cuenta?: string | null;
  foto_url: string | null;
  dpi_frente_url: string | null;
  dpi_reverso_url: string | null;
  canal: string;
  estado: string;
  created_at: string;
  notas_reclutador: string | null;
  revisado_por: string | null;
  revisado_at: string | null;
}

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  try {
    // Para strings "YYYY-MM-DD" (date column de Postgres) construimos la fecha
    // como local para evitar el corrimiento de un día por zona horaria
    // (new Date("2004-08-31") se interpreta como UTC y en GT-6 muestra el 30).
    // Anclado a fin de string: sólo aplica a date-only ("YYYY-MM-DD"), no a
    // timestamps ISO completos como "2026-05-07T01:30:00.000Z".
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
    const d = m
      ? new Date(parseInt(m[1]), parseInt(m[2]) - 1, parseInt(m[3]))
      : new Date(iso);
    return d.toLocaleDateString("es-GT", { day: "2-digit", month: "long", year: "numeric" });
  } catch { return "—"; }
}

function fmtDateTime(iso: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("es-GT", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch { return "—"; }
}

function val(v: string | number | null | undefined): string {
  if (v === null || v === undefined || v === "") return "—";
  return String(v);
}

function siNo(v: boolean | string | null | undefined): string {
  if (v === true || v === "true" || v === "si" || v === "sí" || v === "Sí") return "Sí";
  if (v === false || v === "false" || v === "no" || v === "No") return "No";
  if (v === null || v === undefined || v === "") return "—";
  return String(v);
}

type SecureImageState = { src: string | null; ready: boolean };

/** Carga una imagen privada y devuelve un object URL + flag de "listo". */
function useSecureImage(url: string | null | undefined): SecureImageState {
  const [state, setState] = useState<SecureImageState>({ src: null, ready: !url });
  useEffect(() => {
    if (!url) { setState({ src: null, ready: true }); return; }
    if (url.startsWith("data:") || url.startsWith("http")) {
      setState({ src: url, ready: true });
      return;
    }
    let obj: string | null = null;
    let cancelled = false;
    setState({ src: null, ready: false });
    fetch(`${API}/storage${url}`, { headers: { "x-isp-session": getSession() } })
      .then(r => r.ok ? r.blob() : null)
      .then(blob => {
        if (cancelled) return;
        if (!blob) { setState({ src: null, ready: true }); return; }
        obj = URL.createObjectURL(blob);
        setState({ src: obj, ready: true });
      })
      .catch(() => { if (!cancelled) setState({ src: null, ready: true }); });
    return () => { cancelled = true; if (obj) URL.revokeObjectURL(obj); };
  }, [url]);
  return state;
}

export default function KioscoSolicitudImprimible() {
  const params = useParams();
  const id = params.id;

  const { data: d, isLoading, error } = useQuery<Detalle>({
    queryKey: ["kiosco-solicitud-detalle-print", id],
    queryFn: async () => {
      const r = await fetch(`${API}/solicitudes-empleo/${id}`, {
        headers: { "x-isp-session": getSession() },
      });
      if (!r.ok) throw new Error("No se pudo cargar la solicitud");
      return r.json();
    },
    enabled: !!id,
  });

  const foto        = useSecureImage(d?.foto_url);
  const dpiFrente   = useSecureImage(d?.dpi_frente_url);
  const dpiReverso  = useSecureImage(d?.dpi_reverso_url);

  const fotoSrc       = foto.src;
  const dpiFrenteSrc  = dpiFrente.src;
  const dpiReversoSrc = dpiReverso.src;

  const folio = useMemo(() => `SOL-${String(d?.id ?? 0).padStart(5, "0")}`, [d]);

  const sheetRef = useRef<HTMLDivElement | null>(null);
  const [printing, setPrinting] = useState(false);

  // Mientras esta pantalla esté montada, marcamos el body con `printing-solicitud`.
  // Todas las reglas `@media print` de esta vista (más abajo en <style>) están
  // limitadas con ese selector para que no se filtren a otras pantallas
  // imprimibles del sistema (planilla, custodias, rondas QR). Ver
  // `artifacts/isp-web/src/admin/pages/planilla/impresion/PRINT_CONVENTIONS.md`.
  useEffect(() => {
    document.body.classList.add("printing-solicitud");
    return () => { document.body.classList.remove("printing-solicitud"); };
  }, []);

  // Espera a que todas las <img> dentro de la hoja terminen de cargar (o fallen).
  // Tiene un timeout global para que el botón nunca quede "atascado" si una
  // imagen no responde por red lenta.
  const waitForImages = useCallback(async (timeoutMs = 5000) => {
    const root = sheetRef.current;
    if (!root) return;
    const imgs = Array.from(root.querySelectorAll("img"));
    const all = Promise.all(imgs.map(img => {
      if (img.complete) return Promise.resolve(); // ya cargó (con o sin error)
      return new Promise<void>(resolve => {
        const done = () => {
          img.removeEventListener("load", done);
          img.removeEventListener("error", done);
          resolve();
        };
        img.addEventListener("load", done);
        img.addEventListener("error", done);
      });
    }));
    const timeout = new Promise<void>(resolve => setTimeout(resolve, timeoutMs));
    await Promise.race([all, timeout]);
  }, []);

  const imagesReady = foto.ready && dpiFrente.ready && dpiReverso.ready;

  const handlePrint = useCallback(async () => {
    if (printing) return;
    setPrinting(true);
    try {
      await waitForImages();
      // Un frame extra para que el layout termine de calcularse con las imágenes ya decodificadas.
      await new Promise(r => requestAnimationFrame(() => r(null)));
      window.print();
    } finally {
      setPrinting(false);
    }
  }, [printing, waitForImages]);

  if (isLoading) {
    return <div className="p-10 text-center text-gray-600">Cargando solicitud…</div>;
  }
  if (error || !d) {
    return <div className="p-10 text-center text-red-600">No se pudo cargar la solicitud.</div>;
  }

  return (
    <div className="print-root bg-gray-200 min-h-screen print:bg-white">
      {/* Barra de acciones (no se imprime) */}
      <div className="no-print sticky top-0 z-50 bg-white border-b shadow-sm">
        <div className="max-w-[820px] mx-auto px-4 py-3 flex items-center justify-between">
          <button
            onClick={() => window.history.back()}
            className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft size={16} /> Volver
          </button>
          <div className="text-sm text-gray-500">
            Folio <span className="font-mono font-semibold text-gray-800">{folio}</span>
          </div>
          <button
            onClick={handlePrint}
            disabled={printing}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-wait text-white px-4 py-2 rounded-lg text-sm font-medium"
          >
            <Printer size={16} /> {printing ? "Preparando…" : (imagesReady ? "Descargar PDF" : "Cargando imágenes…")}
          </button>
        </div>
        <div className="max-w-[820px] mx-auto px-4 pb-2 text-xs text-gray-500">
          Sugerencia: en el diálogo de impresión seleccione <strong>“Guardar como PDF”</strong> como destino. Configure tamaño Carta y márgenes “Predeterminados”.
        </div>
      </div>

      {/* Hoja imprimible */}
      <div ref={sheetRef} className="print-sheet max-w-[820px] mx-auto bg-white shadow-md my-6 print:shadow-none print:my-0 print:max-w-full">
        <div className="hoja px-10 py-8 text-[11px] leading-snug text-gray-900">

          {/* ── MEMBRETE ── */}
          <header className="flex items-start gap-4 border-b-2 border-blue-900 pb-3">
            <img src="/logo-isp.png" alt="ISP" className="h-16 w-16 object-contain" />
            <div className="flex-1">
              <h1 className="text-[15px] font-bold text-blue-900 leading-tight">
                Investigaciones y Seguridad Profesional, S.A.
              </h1>
              <p className="text-[10px] text-gray-700">
                ISP — Servicios privados de seguridad y custodia
              </p>
              <p className="text-[10px] text-gray-600">
                www.ispsa.net
              </p>
            </div>
            <div className="text-right text-[10px] text-gray-700">
              <div className="font-mono font-semibold text-gray-900 text-[11px]">{folio}</div>
              <div>Recibida: {fmtDateTime(d.created_at)}</div>
              <div>Canal: {val(d.canal)}</div>
              <div>Estado: {val(d.estado)}</div>
            </div>
          </header>

          <h2 className="text-center text-[14px] font-bold text-blue-900 uppercase tracking-wider mt-4 mb-3">
            Solicitud de Empleo
          </h2>

          {/* ── ENCABEZADO CON FOTO ── */}
          <div className="flex gap-4 mb-4">
            <div className="w-28 h-32 border-2 border-gray-400 bg-gray-50 flex items-center justify-center overflow-hidden">
              {fotoSrc
                ? <img src={fotoSrc} alt="Aspirante" className="w-full h-full object-cover" />
                : <span className="text-[9px] text-gray-400 text-center">Fotografía<br/>del aspirante</span>}
            </div>
            <div className="flex-1 grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
              <Field label="Nombre completo" value={d.nombre_completo} span={2} />
              <Field label="DPI / CUI" value={d.dpi} />
              <Field label="Fecha de nacimiento" value={fmtDate(d.fecha_nacimiento)} />
              <Field label="Lugar de nacimiento" value={d.lugar_nacimiento} />
              <Field label="Edad" value={edadFrom(d.fecha_nacimiento)} />
              <Field label="Género" value={d.genero} />
              <Field label="Estado civil" value={d.estado_civil} />
              <Field label="NIT" value={d.nit} />
              <Field label="No. afiliación IGSS" value={d.igss} />
              <Field label="Profesión / oficio" value={d.profesion} />
            </div>
          </div>

          {/* ── 1. CONTACTO ── */}
          <Section title="1. Datos de Contacto">
            <Grid cols={2}>
              <Field label="Teléfono celular" value={d.telefono} />
              <Field label="Teléfono fijo" value={d.telefono_fijo} />
              <Field label="Correo electrónico" value={d.correo} span={2} />
              <Field label="Facebook" value={d.facebook} />
              <Field label="Instagram" value={d.instagram} />
            </Grid>
          </Section>

          {/* ── 2. DIRECCIÓN ── */}
          <Section title="2. Dirección">
            <Grid cols={2}>
              <Field label="Dirección completa" value={d.direccion} span={2} />
              <Field label="Municipio" value={d.municipio} />
              <Field label="Departamento" value={d.departamento} />
              <Field label="Tipo de vivienda" value={d.tipo_vivienda} />
              <Field label="Tiempo de residencia" value={d.tiempo_residencia} />
              <Field label="Renta mensual" value={d.renta_mensual ? `Q ${d.renta_mensual}` : null} />
            </Grid>
          </Section>

          {/* ── 3. FAMILIA ── */}
          <Section title="3. Datos Familiares">
            <Grid cols={2}>
              <Field label="Nombre del padre" value={d.nombre_padre} />
              <Field label="Nombre de la madre" value={d.nombre_madre} />
              <Field label="Cónyuge / pareja" value={d.nombre_conyuge} />
              <Field label="Personas dependientes" value={String(d.num_dependientes ?? 0)} />
              <Field label="¿Familiar trabaja en ISP?" value={d.familiar_en_empresa ? `Sí — ${d.nombre_familiar_empresa || ""}` : "No"} span={2} />
            </Grid>
          </Section>

          {/* ── 4. CONTACTO DE EMERGENCIA ── */}
          <Section title="4. Contacto de Emergencia">
            <Grid cols={3}>
              <Field label="Nombre" value={d.nombre_contacto_emergencia} />
              <Field label="Parentesco" value={d.parentesco_emergencia} />
              <Field label="Teléfono" value={d.telefono_emergencia} />
            </Grid>
          </Section>

          {/* ── 5. DATOS FÍSICOS ── */}
          <Section title="5. Datos Físicos">
            <Grid cols={2}>
              <Field label="Estatura" value={d.estatura ? `${d.estatura} m` : null} />
              <Field label="Peso" value={d.peso ? `${d.peso} kg` : null} />
            </Grid>
          </Section>

          {/* ── 6. EDUCACIÓN Y EXPERIENCIA ── */}
          <Section title="6. Educación y Experiencia">
            <Grid cols={2}>
              <Field label="Grado de estudios" value={d.grado_estudios} />
              <Field label="Habilidades / cursos" value={d.habilidades} />
              <Field label="¿Experiencia en seguridad?" value={d.experiencia_seguridad ? `Sí — ${d.anios_experiencia ?? 0} año(s)` : "No"} />
              <Field label="Empresa anterior" value={d.empresa_anterior} />
              <Field label="Tipos de seguridad" value={d.tipos_seguridad} span={2} />
            </Grid>
          </Section>

          {/* ── 7. ANTECEDENTES MILITARES / PNC ── */}
          <Section title="7. Antecedentes Militares / PNC">
            <Grid cols={2}>
              <Field label="¿Servicio militar?" value={siNo(d.servicio_militar)} />
              <Field label="¿Fue policía / PNC?" value={siNo(d.fue_policia)} />
              <Field label="Rango militar" value={d.rango_militar} />
              <Field label="Unidad militar" value={d.unidad_militar} />
            </Grid>
          </Section>

          {/* ── 8. LICENCIAS Y VEHÍCULO ── */}
          <Section title="8. Licencias y Vehículo">
            <Grid cols={2}>
              <Field label="¿Licencia de conducir?" value={siNo(d.tiene_licencia)} />
              <Field label="Tipo de licencia" value={d.tipo_licencia} />
              <Field label="Vigencia licencia" value={fmtDate(d.vigencia_licencia ?? null)} />
              <Field label="¿Vehículo propio?" value={d.tiene_vehiculo ? "Sí" : "No"} />
              <Field label="¿Licencia de portación de armas?" value={d.licencia_armas ? "Sí" : "No"} span={2} />
            </Grid>
          </Section>

          {/* ── 9. DISPONIBILIDAD ── */}
          <Section title="9. Disponibilidad">
            <Grid cols={2}>
              <Field label="Horario solicitado" value={d.disponibilidad_horario} />
              <Field label="¿Disponible fuera de la ciudad?" value={d.disponible_exterior ? "Sí" : "No"} />
              <Field label="¿Turnos rotativos?" value={siNo(d.disp_rotativo)} />
              <Field label="¿Turno nocturno?" value={siNo(d.disp_nocturno)} />
              <Field label="¿Fines de semana?" value={siNo(d.disp_fds)} />
            </Grid>
          </Section>

          {/* ── 10. PUESTO Y SALARIO ── */}
          <Section title="10. Puesto y Salario">
            <Grid cols={2}>
              <Field label="Puesto solicitado" value={d.puesto_solicitado} />
              <Field label="Pretensión salarial" value={d.pretension_salarial ? `Q ${parseFloat(d.pretension_salarial).toLocaleString("es-GT")}` : null} />
              <Field label="Banco" value={d.banco} />
              <Field label="No. de cuenta" value={d.num_cuenta} />
              <Field label="Tipo de cuenta" value={d.tipo_cuenta} />
            </Grid>
          </Section>

          {/* ── 11. DOCUMENTOS ── */}
          <Section title="11. Documentos — DPI">
            <div className="grid grid-cols-2 gap-3 mt-1">
              <DocImage label="DPI — Frente" src={dpiFrenteSrc} />
              <DocImage label="DPI — Reverso" src={dpiReversoSrc} />
            </div>
          </Section>

          {/* ── NOTAS DEL RECLUTADOR ── */}
          {(d.notas_reclutador || d.revisado_por) && (
            <Section title="Notas del Reclutador">
              {d.revisado_por && (
                <p className="text-[10px] text-gray-600 mb-1">
                  Revisado por <strong>{d.revisado_por}</strong> — {fmtDateTime(d.revisado_at)}
                </p>
              )}
              <p className="text-[11px] text-gray-800 border border-gray-300 rounded p-2 min-h-[2.5rem] whitespace-pre-wrap">
                {d.notas_reclutador || ""}
              </p>
            </Section>
          )}

          {/* ── DECLARACIÓN ── */}
          <div className="mt-5 border-t-2 border-gray-300 pt-3 text-[10px] text-gray-700 leading-relaxed text-justify">
            <p>
              Declaro bajo juramento que toda la información proporcionada en esta solicitud es verídica y
              completa. Autorizo a <strong>Investigaciones y Seguridad Profesional, S.A.</strong> a verificar
              los datos consignados, a realizar las investigaciones que considere necesarias para el proceso
              de selección, y al tratamiento de mis datos personales conforme a su política de privacidad.
              Comprendo que cualquier falsedad u omisión es causal de rechazo o despido inmediato.
            </p>
          </div>

          {/* ── FIRMAS ── */}
          <div className="grid grid-cols-2 gap-10 mt-12 mb-2">
            <SignatureBox label="Firma del aspirante" subtitle={d.nombre_completo} />
            <SignatureBox label="Firma RRHH — ISP" subtitle="Recibido y revisado" />
          </div>

          <div className="mt-6 text-center text-[9px] text-gray-500 border-t pt-2">
            Documento generado automáticamente por el sistema ISP — {folio} — Impreso: {new Date().toLocaleString("es-GT")}
          </div>
        </div>
      </div>

      <style>{`
        .hoja section, .hoja .signature-row, .hoja header { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        @media print {
          /* IMPORTANTE: todas las reglas están limitadas con
             body.printing-solicitud para no pisar otras vistas imprimibles
             (planilla, custodias, rondas QR). La clase se pone/quita arriba
             en un useEffect mientras esta pantalla está montada. */
          @page { size: Letter; margin: 12mm; }
          body.printing-solicitud .no-print { display: none !important; }
          body.printing-solicitud,
          html:has(body.printing-solicitud) {
            background: #fff !important;
            margin: 0 !important;
            padding: 0 !important;
            min-height: 0 !important;
            height: auto !important;
          }
          /* Neutralizamos el contenedor exterior: sin min-height de pantalla,
             sin fondos, sin márgenes que empujen contenido fuera de la primera página. */
          body.printing-solicitud .print-root {
            background: #fff !important;
            min-height: 0 !important;
            height: auto !important;
            margin: 0 !important;
            padding: 0 !important;
            display: block !important;
          }
          body.printing-solicitud .print-sheet {
            max-width: 100% !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            box-shadow: none !important;
          }
          body.printing-solicitud .hoja {
            padding: 0 !important;
            margin: 0 !important;
          }
          body.printing-solicitud .hoja section { break-inside: avoid; page-break-inside: avoid; }
          body.printing-solicitud .hoja img { break-inside: avoid; page-break-inside: avoid; }
          body.printing-solicitud .hoja header { break-inside: avoid; page-break-inside: avoid; break-after: avoid; page-break-after: avoid; }
          body.printing-solicitud * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        }
      `}</style>
    </div>
  );
}

/* ────────────────────── helpers ────────────────────── */

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-3 break-inside-avoid">
      <h3 className="text-[11px] font-bold text-white bg-blue-900 px-2 py-1 uppercase tracking-wide">
        {title}
      </h3>
      <div className="border border-t-0 border-blue-900 px-3 py-2">
        {children}
      </div>
    </section>
  );
}

function Grid({ cols, children }: { cols: 2 | 3; children: React.ReactNode }) {
  const c = cols === 3 ? "grid-cols-3" : "grid-cols-2";
  return <div className={`grid ${c} gap-x-4 gap-y-1`}>{children}</div>;
}

function Field({ label, value, span }: { label: string; value: string | null | undefined; span?: number }) {
  const colSpan = span === 2 ? "col-span-2" : span === 3 ? "col-span-3" : "";
  return (
    <div className={`${colSpan} border-b border-dotted border-gray-400 pb-0.5`}>
      <div className="text-[8.5px] uppercase tracking-wide text-gray-500">{label}</div>
      <div className="text-[11px] text-gray-900 min-h-[14px]">{val(value)}</div>
    </div>
  );
}

function DocImage({ label, src }: { label: string; src: string | null }) {
  return (
    <div>
      <div className="text-[9px] uppercase tracking-wide text-gray-600 mb-1">{label}</div>
      <div className="border-2 border-gray-400 bg-gray-50 aspect-[1.586/1] flex items-center justify-center overflow-hidden">
        {src
          ? <img src={src} alt={label} className="w-full h-full object-contain" />
          : <span className="text-[10px] text-gray-400">Sin imagen</span>}
      </div>
    </div>
  );
}

function SignatureBox({ label, subtitle }: { label: string; subtitle: string }) {
  return (
    <div className="text-center">
      <div className="border-b border-gray-700 h-12" />
      <div className="text-[10px] font-semibold text-gray-800 mt-1">{label}</div>
      <div className="text-[9px] text-gray-500">{subtitle}</div>
    </div>
  );
}

function edadFrom(iso: string | null): string {
  if (!iso) return "—";
  try {
    // Mismo tratamiento que fmtDate: parseamos "YYYY-MM-DD" como local.
    const mm = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
    const nac = mm
      ? new Date(parseInt(mm[1]), parseInt(mm[2]) - 1, parseInt(mm[3]))
      : new Date(iso);
    const hoy = new Date();
    let edad = hoy.getFullYear() - nac.getFullYear();
    const m = hoy.getMonth() - nac.getMonth();
    if (m < 0 || (m === 0 && hoy.getDate() < nac.getDate())) edad--;
    return `${edad} años`;
  } catch { return "—"; }
}
