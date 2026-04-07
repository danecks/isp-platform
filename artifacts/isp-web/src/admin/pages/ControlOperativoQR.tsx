import { useState, useRef } from "react";
import { AdminLayout } from "../layout/AdminLayout";
import {
  QrCode, MapPin, CreditCard, Users, Printer, Download,
  ChevronLeft, Shield, Activity, Search, CheckCircle, BarChart2,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import FichajeQR from "./FichajeQR";
import RondasQR from "./RondasQR";
import EstadisticasRondas from "./EstadisticasRondas";

function getSession() {
  return sessionStorage.getItem("isp_admin_session_v2") || "";
}

// ── Tab: Carnets ─────────────────────────────────────────────────────────────

interface Agente {
  employee_id: number;
  nombre_completo: string;
  cargo: string | null;
  foto_url: string | null;
  qr_token: string | null;
  token_id: number | null;
  puesto_nombre: string | null;
  numero_empleado?: string | null;
}

function CarnetPreview({ agente, style = "portrait" }: { agente: Partial<Agente> & { nombre_completo: string }; style?: "portrait" | "landscape" }) {
  const nombre = agente.nombre_completo;
  const cargo = agente.cargo ?? "Agente de Seguridad";
  const numero = agente.numero_empleado ?? "—";
  const puesto = agente.puesto_nombre ?? "—";

  return (
    <div
      className="relative bg-gradient-to-br from-slate-900 to-slate-800 rounded-lg overflow-hidden shadow-xl border border-white/10 select-none"
      style={{ width: 243, height: 153, fontFamily: "system-ui, sans-serif" }}
    >
      {/* Franja superior con logo */}
      <div className="absolute top-0 left-0 right-0 h-8 bg-gradient-to-r from-blue-700 to-blue-900 flex items-center px-3 gap-2">
        <Shield className="w-4 h-4 text-white/90 shrink-0" />
        <span className="text-white font-bold text-[9px] tracking-widest uppercase">ISP — Seguridad Profesional</span>
      </div>

      {/* Foto placeholder */}
      <div className="absolute left-3 top-10 w-16 h-20 rounded-md bg-white/5 border border-white/10 flex items-center justify-center overflow-hidden">
        {agente.foto_url
          ? <img src={agente.foto_url} alt="" className="w-full h-full object-cover" />
          : <Users className="w-8 h-8 text-white/20" />
        }
      </div>

      {/* Datos del colaborador */}
      <div className="absolute left-22 top-10 right-3" style={{ left: 86 }}>
        <p className="text-white font-bold text-[10px] leading-tight mt-0.5">{nombre}</p>
        <p className="text-blue-300 text-[8px] mt-0.5 font-semibold uppercase tracking-wide">{cargo}</p>
        <div className="mt-2 space-y-0.5">
          <p className="text-white/50 text-[7px]">
            <span className="text-white/30">No. Empleado</span> <span className="text-white/80 font-semibold">{numero}</span>
          </p>
          <p className="text-white/50 text-[7px]">
            <span className="text-white/30">Puesto</span> <span className="text-white/70">{puesto}</span>
          </p>
        </div>
      </div>

      {/* QR placeholder */}
      <div className="absolute bottom-2 right-2 w-14 h-14 bg-white rounded-md flex items-center justify-center">
        <QrCode className="w-10 h-10 text-slate-900" />
      </div>

      {/* Línea inferior */}
      <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-gradient-to-r from-blue-600 to-blue-400" />

      {/* Número en la franja inferior */}
      <div className="absolute bottom-2 left-3">
        <p className="text-white/30 text-[6px] uppercase tracking-widest">ID de colaborador</p>
        <p className="text-white/60 text-[8px] font-mono">{numero}</p>
      </div>
    </div>
  );
}

function TabCarnets() {
  const [busqueda, setBusqueda] = useState("");
  const [seleccionados, setSeleccionados] = useState<Set<number>>(new Set());
  const printRef = useRef<HTMLDivElement>(null);

  const { data: agentes = [], isLoading } = useQuery<Agente[]>({
    queryKey: ["agentes-tokens-carnets"],
    queryFn: async () => {
      const r = await fetch("/api/agente/tokens", { headers: { "x-isp-session": getSession() } });
      return r.ok ? r.json() : [];
    },
  });

  const filtrados = agentes.filter(a =>
    a.nombre_completo.toLowerCase().includes(busqueda.toLowerCase()) ||
    (a.cargo ?? "").toLowerCase().includes(busqueda.toLowerCase()) ||
    (a.puesto_nombre ?? "").toLowerCase().includes(busqueda.toLowerCase())
  );

  function toggleSeleccion(id: number) {
    setSeleccionados(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function seleccionarTodos() {
    setSeleccionados(new Set(filtrados.map(a => a.employee_id)));
  }

  function deseleccionarTodos() { setSeleccionados(new Set()); }

  function imprimirSeleccionados() {
    const seleccionadosList = agentes.filter(a => seleccionados.has(a.employee_id));
    if (seleccionadosList.length === 0) return;

    const win = window.open("", "_blank");
    if (!win) return;

    win.document.write(`<!DOCTYPE html><html><head>
      <meta charset="utf-8"/>
      <title>Carnets ISP</title>
      <style>
        * { margin:0; padding:0; box-sizing:border-box; }
        body { background:#fff; font-family:system-ui,sans-serif; }
        .pagina { display:flex; flex-wrap:wrap; gap:8mm; padding:10mm; }
        .carnet {
          width:85.6mm; height:54mm;
          background:linear-gradient(135deg,#0f172a,#1e293b);
          border-radius:3mm; overflow:hidden;
          page-break-inside:avoid;
          position:relative;
          color:white;
          box-shadow:0 2px 4px rgba(0,0,0,0.3);
        }
        .franja-top {
          position:absolute; top:0; left:0; right:0; height:10mm;
          background:linear-gradient(90deg,#1d4ed8,#1e40af);
          display:flex; align-items:center; padding:0 4mm; gap:2mm;
        }
        .franja-top .titulo { font-size:5pt; font-weight:700; letter-spacing:0.1em; text-transform:uppercase; color:rgba(255,255,255,0.9); }
        .foto {
          position:absolute; left:4mm; top:12mm;
          width:20mm; height:26mm;
          background:rgba(255,255,255,0.05);
          border:0.5mm solid rgba(255,255,255,0.1);
          border-radius:1mm;
          display:flex; align-items:center; justify-content:center;
          font-size:8pt; color:rgba(255,255,255,0.2);
          overflow:hidden;
        }
        .foto img { width:100%; height:100%; object-fit:cover; }
        .datos { position:absolute; left:26mm; top:12mm; right:18mm; }
        .nombre { font-size:6.5pt; font-weight:700; line-height:1.2; color:white; }
        .cargo { font-size:5pt; color:#93c5fd; font-weight:600; text-transform:uppercase; letter-spacing:0.05em; margin-top:1mm; }
        .campo { font-size:4.5pt; color:rgba(255,255,255,0.5); margin-top:1.5mm; }
        .campo span { color:rgba(255,255,255,0.85); font-weight:600; }
        .qr-box {
          position:absolute; right:3mm; bottom:5mm;
          width:14mm; height:14mm;
          background:white; border-radius:1mm;
          display:flex; align-items:center; justify-content:center;
          font-size:5pt; color:#0f172a; text-align:center;
        }
        .franja-bot { position:absolute; bottom:0; left:0; right:0; height:2mm; background:linear-gradient(90deg,#2563eb,#60a5fa); }
        .id-label { position:absolute; bottom:3mm; left:4mm; }
        .id-label .lbl { font-size:4pt; text-transform:uppercase; letter-spacing:0.1em; color:rgba(255,255,255,0.25); }
        .id-label .val { font-size:5pt; font-family:monospace; color:rgba(255,255,255,0.6); }
        @media print { body { margin:0; } }
      </style>
    </head><body><div class="pagina">`);

    for (const a of seleccionadosList) {
      win.document.write(`
        <div class="carnet">
          <div class="franja-top"><span class="titulo">ISP — Investigaciones y Seguridad Profesional</span></div>
          <div class="foto">${a.foto_url ? `<img src="${a.foto_url}" />` : "Foto"}</div>
          <div class="datos">
            <div class="nombre">${a.nombre_completo}</div>
            <div class="cargo">${a.cargo ?? "Agente de Seguridad"}</div>
            <div class="campo">No. Empleado <span>${a.numero_empleado ?? "—"}</span></div>
            <div class="campo">Puesto <span>${a.puesto_nombre ?? "—"}</span></div>
          </div>
          <div class="qr-box">QR</div>
          <div class="id-label"><div class="lbl">ID colaborador</div><div class="val">${a.numero_empleado ?? "—"}</div></div>
          <div class="franja-bot"></div>
        </div>
      `);
    }

    win.document.write(`</div></body></html>`);
    win.document.close();
    win.onload = () => { win.print(); };
  }

  return (
    <div>
      {/* Aviso de diseño provisional */}
      <div className="mb-5 bg-amber-500/8 border border-amber-500/20 rounded-xl p-4 flex gap-3">
        <div className="w-5 h-5 rounded-full bg-amber-500/20 border border-amber-500/30 flex items-center justify-center shrink-0 mt-0.5">
          <span className="text-amber-400 text-xs font-bold">!</span>
        </div>
        <div>
          <p className="text-amber-300/80 text-sm font-semibold mb-0.5">Diseño de carnet provisional</p>
          <p className="text-amber-200/50 text-xs">Este es un ejemplo para revisar el layout. Los datos que aparecerán en el carnet definitivo (logo, campos, colores, tipo de impresora) se definen por separado.</p>
        </div>
      </div>

      {/* Ejemplo de carnet */}
      <div className="mb-6">
        <p className="text-white/40 text-xs font-semibold uppercase tracking-wide mb-3">Vista previa del carnet</p>
        <div className="flex gap-6 items-start flex-wrap">
          <div>
            <CarnetPreview agente={{
              nombre_completo: "Juan Carlos Pérez López",
              cargo: "Agente de Seguridad",
              numero_empleado: "ISP-0042",
              puesto_nombre: "Banco Central — Lobby Principal",
              foto_url: null,
            }} />
            <p className="text-white/25 text-xs mt-2 text-center">Anverso</p>
          </div>
        </div>
      </div>

      {/* Selector de colaboradores */}
      <div className="bg-white/3 border border-white/8 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <p className="text-white/60 text-sm font-semibold">
            Seleccionar colaboradores para imprimir
          </p>
          <div className="flex items-center gap-2">
            <button onClick={seleccionarTodos} className="px-3 py-1.5 text-xs bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-white/60 transition-colors">
              Todos
            </button>
            <button onClick={deseleccionarTodos} className="px-3 py-1.5 text-xs bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-white/60 transition-colors">
              Ninguno
            </button>
            <button
              onClick={imprimirSeleccionados}
              disabled={seleccionados.size === 0}
              className="flex items-center gap-1.5 px-4 py-1.5 text-xs bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 text-blue-300 rounded-lg font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <Printer className="w-3.5 h-3.5" />
              Imprimir {seleccionados.size > 0 ? `(${seleccionados.size})` : ""}
            </button>
          </div>
        </div>

        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
          <input value={busqueda} onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre, No. empleado o cargo..."
            className="w-full pl-9 pr-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-white/30 outline-none" />
        </div>

        {isLoading
          ? <p className="text-white/30 text-sm text-center py-6">Cargando colaboradores...</p>
          : (
            <div className="space-y-1 max-h-96 overflow-y-auto">
              {filtrados.map(a => (
                <label key={a.employee_id}
                  className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-colors ${
                    seleccionados.has(a.employee_id) ? "bg-blue-600/10 border border-blue-500/20" : "border border-transparent hover:bg-white/3"
                  }`}>
                  <div onClick={() => toggleSeleccion(a.employee_id)}
                    className={`w-4 h-4 rounded border transition-colors flex items-center justify-center ${
                      seleccionados.has(a.employee_id) ? "bg-blue-600/40 border-blue-500/60" : "border-white/20"
                    }`}>
                    {seleccionados.has(a.employee_id) && <CheckCircle className="w-4 h-4 text-blue-400" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white font-semibold truncate">{a.nombre_completo}</p>
                    <p className="text-xs text-white/40 truncate">{a.cargo ?? "—"} · {a.puesto_nombre ?? "Sin puesto"}</p>
                  </div>
                  <div className={`text-xs px-2 py-0.5 rounded-full border ${
                    a.token_id ? "bg-green-500/10 border-green-500/20 text-green-400" : "bg-white/5 border-white/10 text-white/25"
                  }`}>
                    {a.token_id ? "Con QR" : "Sin QR"}
                  </div>
                </label>
              ))}
              {filtrados.length === 0 && (
                <p className="text-white/30 text-sm text-center py-8">Sin resultados</p>
              )}
            </div>
          )}
      </div>
    </div>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────

type Tab = "fichaje" | "rondas" | "estadisticas" | "carnets";

export default function ControlOperativoQR() {
  const [tab, setTab] = useState<Tab>("fichaje");

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: "fichaje",      label: "Fichaje & Control",    icon: <QrCode className="w-4 h-4" /> },
    { key: "rondas",       label: "Rondas de Patrullaje", icon: <MapPin className="w-4 h-4" /> },
    { key: "estadisticas", label: "Estadísticas",         icon: <BarChart2 className="w-4 h-4" /> },
    { key: "carnets",      label: "Carnets",              icon: <CreditCard className="w-4 h-4" /> },
  ];

  return (
    <AdminLayout>
      <div className="p-6 max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center shrink-0">
            <Activity className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <h1 className="text-white font-bold text-xl">Control Operativo QR</h1>
            <p className="text-white/40 text-sm">Fichaje de agentes, rondas de patrullaje y carnets</p>
          </div>
        </div>

        {/* Tab bar principal */}
        <div className="flex gap-2 mb-6 border-b border-white/8 pb-0">
          {tabs.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-t-xl border-b-2 transition-colors ${
                tab === t.key
                  ? "border-blue-500 text-blue-300 bg-blue-600/10"
                  : "border-transparent text-white/40 hover:text-white/70 hover:bg-white/3"
              }`}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {/* Contenido */}
        {tab === "fichaje"      && <FichajeQR />}
        {tab === "rondas"       && <RondasQR />}
        {tab === "estadisticas" && <EstadisticasRondas />}
        {tab === "carnets"      && <TabCarnets />}
      </div>
    </AdminLayout>
  );
}
