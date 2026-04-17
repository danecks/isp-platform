import { useEffect, useState } from "react";
import { 
  Shield, Activity, Server, Radio, Crosshair, 
  MapPin, Clock, Lock, CheckCircle2, ChevronRight, 
  Terminal, ShieldAlert, Fingerprint, Database, Zap
} from "lucide-react";

export function Operacional() {
  const [time, setTime] = useState(new Date().toLocaleTimeString());
  const [activeAgents, setActiveAgents] = useState(842);
  const [incidents, setIncidents] = useState(3);
  const [units, setUnits] = useState(22);

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date().toLocaleTimeString());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Simulate fluctuating data
  useEffect(() => {
    const dataTimer = setInterval(() => {
      if (Math.random() > 0.7) setActiveAgents(prev => prev + (Math.random() > 0.5 ? 1 : -1));
      if (Math.random() > 0.95) setIncidents(prev => prev + 1);
      if (Math.random() > 0.8) setUnits(prev => prev + (Math.random() > 0.5 ? 1 : -1));
    }, 3000);
    return () => clearInterval(dataTimer);
  }, []);

  return (
    <div className="min-h-screen bg-[#0a0e1a] text-slate-300 font-sans selection:bg-[#00ff9d] selection:text-[#0a0e1a] overflow-x-hidden">
      
      {/* GLOBAL NOISE & SCANLINE */}
      <div className="fixed inset-0 pointer-events-none opacity-[0.03] z-50" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 200 200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noiseFilter\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.65\' numOctaves=\'3\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noiseFilter)\'/%3E%3C/svg%3E")' }}></div>
      <div className="fixed inset-0 pointer-events-none border-t border-[#00ff9d]/10 w-full h-[1px] animate-[scanline_8s_linear_infinite] z-50 shadow-[0_0_10px_#00ff9d]"></div>

      {/* NAVBAR */}
      <nav className="fixed top-0 w-full border-b border-[#00ff9d]/20 bg-[#0a0e1a]/80 backdrop-blur-md z-40">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded border border-[#00ff9d] bg-[#00ff9d]/10 flex items-center justify-center">
              <Shield className="w-5 h-5 text-[#00ff9d]" />
            </div>
            <span className="font-bold tracking-widest text-white">ISP<span className="text-[#00ff9d]">_SA</span></span>
          </div>
          
          <div className="hidden md:flex items-center gap-6 text-sm font-mono text-slate-400">
            <a href="#" className="hover:text-[#00ff9d] transition-colors">/INICIO</a>
            <a href="#" className="hover:text-[#00ff9d] transition-colors">/NOSOTROS</a>
            <a href="#" className="hover:text-[#00ff9d] transition-colors">/SERVICIOS</a>
            <a href="#" className="hover:text-[#00ff9d] transition-colors">/SECTORES</a>
            <a href="#" className="hover:text-[#00ff9d] transition-colors">/RECLUTAMIENTO</a>
            <a href="#" className="hover:text-[#00ff9d] transition-colors">/CONTACTO</a>
          </div>

          <div className="flex items-center gap-4">
            <button className="hidden sm:flex text-sm font-mono text-slate-400 hover:text-[#00d4ff] border border-transparent hover:border-[#00d4ff]/30 px-3 py-1.5 rounded transition-all">
              [PORTAL_CLIENTES]
            </button>
            <button className="bg-[#00ff9d] text-[#0a0e1a] font-mono text-sm px-4 py-2 font-bold hover:bg-[#00ff9d]/80 hover:shadow-[0_0_15px_rgba(0,255,157,0.4)] transition-all flex items-center gap-2">
              <Zap className="w-4 h-4" />
              SOLICITAR_REQ
            </button>
          </div>
        </div>
      </nav>

      {/* HERO SECTION */}
      <section className="pt-28 pb-16 min-h-[90vh] flex flex-col justify-center relative">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#00ff9d]/5 rounded-full blur-[120px] pointer-events-none"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-[#00d4ff]/5 rounded-full blur-[120px] pointer-events-none"></div>

        <div className="max-w-7xl mx-auto px-4 w-full grid grid-cols-1 lg:grid-cols-12 gap-12 items-center relative z-10">
          
          {/* Left Content */}
          <div className="lg:col-span-5 flex flex-col items-start">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded border border-[#ff6b35]/30 bg-[#ff6b35]/10 text-[#ff6b35] font-mono text-xs mb-8">
              <span className="w-2 h-2 rounded-full bg-[#ff6b35] animate-pulse"></span>
              CERTIFICACIÓN_GT_ACTIVA
            </div>

            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white leading-tight mb-6 tracking-tight">
              INFRAESTRUCTURA TÁCTICA <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00ff9d] to-[#00d4ff]">
                DE PROTECCIÓN.
              </span>
            </h1>

            <p className="text-slate-400 text-lg leading-relaxed mb-10 border-l-2 border-[#00ff9d]/30 pl-4">
              Despliegue operativo a nivel nacional. Seguridad física, custodia en ruta y monitoreo avanzado para operaciones de alto riesgo.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
              <button className="bg-[#00ff9d] text-[#0a0e1a] font-mono text-sm px-6 py-3 font-bold hover:shadow-[0_0_20px_rgba(0,255,157,0.3)] transition-all flex items-center justify-center gap-2">
                <Crosshair className="w-4 h-4" /> INICIAR_EVALUACIÓN
              </button>
              <button className="border border-[#00d4ff]/30 text-[#00d4ff] bg-[#00d4ff]/5 font-mono text-sm px-6 py-3 font-bold hover:bg-[#00d4ff]/10 transition-all flex items-center justify-center gap-2">
                <Terminal className="w-4 h-4" /> /WHATSAPP_DIR
              </button>
            </div>
          </div>

          {/* Right Dashboard Mockup */}
          <div className="lg:col-span-7 relative w-full h-[500px] border border-[#00ff9d]/20 bg-[#0f172a]/50 backdrop-blur-sm p-4 rounded-lg flex flex-col font-mono text-xs">
            {/* Window Controls */}
            <div className="flex items-center justify-between border-b border-[#00ff9d]/20 pb-3 mb-4">
              <div className="flex gap-2">
                <div className="w-3 h-3 rounded-full bg-slate-700"></div>
                <div className="w-3 h-3 rounded-full bg-slate-700"></div>
                <div className="w-3 h-3 rounded-full bg-[#ff6b35] animate-pulse"></div>
              </div>
              <div className="text-[#00ff9d] flex items-center gap-2">
                <Activity className="w-4 h-4" />
                <span className="animate-pulse">● OPERATIVO</span>
              </div>
              <div className="text-slate-500">SYS_TIME: {time}</div>
            </div>

            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="border border-slate-800 bg-slate-900/50 p-3 rounded">
                <div className="text-slate-500 mb-1">AGENTES_ACTIVOS</div>
                <div className="text-2xl text-[#00ff9d]">{activeAgents}</div>
              </div>
              <div className="border border-slate-800 bg-slate-900/50 p-3 rounded">
                <div className="text-slate-500 mb-1">UNIDADES_EN_RUTA</div>
                <div className="text-2xl text-[#00d4ff]">{units}</div>
              </div>
              <div className="border border-[#ff6b35]/30 bg-[#ff6b35]/5 p-3 rounded">
                <div className="text-[#ff6b35] mb-1">INCIDENCIAS_HOY</div>
                <div className="text-2xl text-[#ff6b35]">{incidents}</div>
              </div>
            </div>

            {/* Map Area */}
            <div className="flex-1 border border-slate-800 bg-[#050810] rounded relative overflow-hidden flex items-center justify-center">
              <div className="absolute inset-0" style={{ backgroundImage: 'linear-gradient(rgba(0, 255, 157, 0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(0, 255, 157, 0.05) 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>
              
              {/* Abstract Map SVG */}
              <svg viewBox="0 0 400 400" className="w-full h-full opacity-30 stroke-[#00ff9d] fill-none stroke-1" style={{ strokeDasharray: '4 4' }}>
                <path d="M 150 100 L 250 80 L 300 150 L 280 250 L 200 350 L 120 300 L 80 200 Z" />
              </svg>

              {/* Pulsing Dots */}
              <div className="absolute top-[30%] left-[40%] w-2 h-2 bg-[#00ff9d] rounded-full shadow-[0_0_10px_#00ff9d] animate-ping"></div>
              <div className="absolute top-[45%] left-[55%] w-2 h-2 bg-[#00ff9d] rounded-full shadow-[0_0_10px_#00ff9d] animate-ping" style={{ animationDelay: '0.5s' }}></div>
              <div className="absolute top-[60%] left-[35%] w-2 h-2 bg-[#ff6b35] rounded-full shadow-[0_0_10px_#ff6b35] animate-ping" style={{ animationDelay: '1s' }}></div>
              <div className="absolute top-[25%] left-[60%] w-2 h-2 bg-[#00d4ff] rounded-full shadow-[0_0_10px_#00d4ff] animate-ping" style={{ animationDelay: '1.5s' }}></div>
              
              {/* Scanline local */}
              <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-[#00ff9d]/50 to-transparent animate-[scanline_3s_linear_infinite]"></div>
            </div>

            {/* Ticker */}
            <div className="mt-4 pt-3 border-t border-slate-800 flex items-center gap-3 overflow-hidden text-slate-400">
              <span className="text-[#00d4ff]">LOG_STREAM:</span>
              <span className="truncate">» {time} - Unidad 04 en posición. » {time} - Relevo turno A completado. » Puesto 412 reporta sin novedad...</span>
            </div>
          </div>

        </div>
      </section>

      {/* STATS BAR */}
      <section className="border-y border-slate-800 bg-[#0f172a]/30 font-mono py-8 relative z-20">
        <div className="max-w-7xl mx-auto px-4 grid grid-cols-2 md:grid-cols-4 gap-8 text-center divide-x divide-slate-800">
          <div>
            <div className="text-3xl text-white mb-2">{activeAgents}</div>
            <div className="text-xs text-slate-500 uppercase">Fuerza_Activa</div>
          </div>
          <div>
            <div className="text-3xl text-white mb-2">24/7</div>
            <div className="text-xs text-slate-500 uppercase">Respuesta_Ops</div>
          </div>
          <div>
            <div className="text-3xl text-white mb-2">100%</div>
            <div className="text-xs text-slate-500 uppercase">Cobertura_Nacional</div>
          </div>
          <div>
            <div className="text-3xl text-white mb-2">15+</div>
            <div className="text-xs text-slate-500 uppercase">Años_Data</div>
          </div>
        </div>
      </section>

      {/* SERVICIOS / MODULES */}
      <section className="py-24 relative">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex flex-col items-start mb-16">
            <div className="text-[#00d4ff] font-mono text-sm mb-2">/ SYS_MODULES</div>
            <h2 className="text-3xl md:text-4xl font-bold text-white">Vectores de Operación</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { id: 'MOD-01', title: 'Seguridad Física', icon: Shield, color: '#00ff9d', desc: 'Despliegue de personal armado/desarmado en instalaciones.' },
              { id: 'MOD-02', title: 'Custodia Transporte', icon: Server, color: '#ff6b35', desc: 'Escolta táctica para protección de activos en ruta.' },
              { id: 'MOD-03', title: 'Operaciones Móviles', icon: Crosshair, color: '#00d4ff', desc: 'Unidades de reacción rápida y patrullaje preventivo.' },
              { id: 'MOD-04', title: 'Monitoreo 24/7', icon: Radio, color: '#a78bfa', desc: 'Centro de control (C4) con vigilancia ininterrumpida.' }
            ].map((mod, i) => (
              <div key={i} className="group relative bg-[#0f172a]/50 border border-slate-800 hover:border-slate-600 p-6 transition-all duration-300">
                {/* Corner accents */}
                <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-slate-500 group-hover:border-white transition-colors"></div>
                <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-slate-500 group-hover:border-white transition-colors"></div>
                
                <div className="flex justify-between items-start mb-6">
                  <div className={`p-2 rounded bg-opacity-10`} style={{ backgroundColor: `${mod.color}15`, color: mod.color }}>
                    <mod.icon className="w-5 h-5" />
                  </div>
                  <span className="font-mono text-xs text-slate-500">{mod.id}</span>
                </div>
                <h3 className="text-lg font-bold text-white mb-3 group-hover:text-[#00ff9d] transition-colors">{mod.title}</h3>
                <p className="text-sm text-slate-400 mb-6">{mod.desc}</p>
                <div className="font-mono text-xs text-[#00d4ff] flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  MOUNT_MODULE <ChevronRight className="w-3 h-3" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SECTORS / TAGS */}
      <section className="py-16 bg-[#050810] border-y border-slate-800">
        <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row items-center gap-8">
          <div className="font-mono text-sm text-slate-500 whitespace-nowrap">TARGET_ENVIRONMENTS:</div>
          <div className="flex flex-wrap gap-3">
            {['BANCARIO', 'INDUSTRIAL', 'COMERCIAL', 'RESIDENCIAL', 'GOBIERNO'].map((sector, i) => (
              <div key={i} className="px-4 py-2 border border-slate-700 bg-slate-900 text-slate-300 font-mono text-xs hover:border-[#00ff9d] hover:text-[#00ff9d] cursor-default transition-colors">
                [{sector}]
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* POR QUÉ ISP / TERMINAL */}
      <section className="py-24">
        <div className="max-w-7xl mx-auto px-4 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          
          <div className="font-mono bg-[#050810] border border-slate-800 p-6 rounded relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-slate-500 to-transparent"></div>
            <div className="text-slate-500 text-xs mb-4">root@isp-core:~# ./analyze_capabilities.sh</div>
            
            <div className="space-y-4">
              <div className="flex gap-4">
                <div className="text-[#00ff9d]">[{time}]</div>
                <div>
                  <span className="text-white font-bold">» AGENTES_CERTIFICADOS</span>
                  <p className="text-slate-400 text-sm mt-1">Personal con polígrafo, antecedentes y entrenamiento balístico.</p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="text-[#00ff9d]">[{time}]</div>
                <div>
                  <span className="text-[#00d4ff] font-bold">» TECNOLOGÍA_PROPIA</span>
                  <p className="text-slate-400 text-sm mt-1">Sistemas de fichaje QR y dashboard de control operativo en tiempo real.</p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="text-[#00ff9d]">[{time}]</div>
                <div>
                  <span className="text-[#ff6b35] font-bold">» RESPUESTA_TÁCTICA</span>
                  <p className="text-slate-400 text-sm mt-1">Protocolos de escalamiento inmediato y unidades de reacción rápida.</p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="text-[#00ff9d]">[{time}]</div>
                <div>
                  <span className="text-white font-bold">» CONTROL_AUDITABLE</span>
                  <p className="text-slate-400 text-sm mt-1">Trazabilidad completa de rondas y relevos para el cliente.</p>
                </div>
              </div>
              <div className="text-[#00ff9d] animate-pulse">_</div>
            </div>
          </div>

          <div>
            <div className="text-[#ff6b35] font-mono text-sm mb-2">/ CORE_ADVANTAGES</div>
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">Arquitectura de Control Total.</h2>
            <p className="text-slate-400 leading-relaxed mb-8">
              No proveemos guardias, instalamos un sistema operativo de seguridad. Nuestro personal funciona como el hardware, respaldado por un software de supervisión continua y protocolos rígidos.
            </p>
            <button className="text-white border-b border-[#00ff9d] pb-1 font-mono text-sm hover:text-[#00ff9d] transition-colors">
              VER_ESPECIFICACIONES_TÉCNICAS
            </button>
          </div>

        </div>
      </section>

      {/* CLIENT LOGOS */}
      <section className="py-16 border-y border-slate-800 bg-[#0f172a]/20">
        <div className="max-w-7xl mx-auto px-4">
          <div className="font-mono text-xs text-slate-500 text-center mb-8">NODOS_PROTEGIDOS_ACTUALMENTE:</div>
          <div className="flex flex-wrap justify-center items-center gap-8 md:gap-16 opacity-50 grayscale hover:grayscale-0 hover:opacity-100 transition-all duration-500">
            {/* Fictional Logos */}
            <div className="font-bold text-xl tracking-tighter flex items-center gap-2 text-white"><Database className="w-5 h-5"/> Banco Industrial</div>
            <div className="font-bold text-xl tracking-tighter flex items-center gap-2 text-white"><Fingerprint className="w-5 h-5"/> Cementos Progreso</div>
            <div className="font-bold text-xl tracking-tighter flex items-center gap-2 text-white"><Server className="w-5 h-5"/> DataCenter GT</div>
            <div className="font-bold text-xl tracking-tighter flex items-center gap-2 text-white"><Lock className="w-5 h-5"/> Logística Sur</div>
            <div className="font-bold text-xl tracking-tighter flex items-center gap-2 text-white"><ShieldAlert className="w-5 h-5"/> Corp Agrícola</div>
          </div>
        </div>
      </section>

      {/* TESTIMONIAL / LOG ENTRY */}
      <section className="py-24">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <div className="inline-block border border-slate-700 bg-slate-900/50 p-8 rounded relative">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-[#0a0e1a] px-4 text-xs font-mono text-[#00d4ff]">
              LOG_ENTRY: CLIENTE_VALIDACIÓN
            </div>
            <p className="text-lg text-slate-300 mb-6 italic">
              "Desde que migramos nuestra seguridad a la red de ISP, tenemos visibilidad en tiempo real de cada puesto. La reducción de incidencias en nuestras plantas ha sido drástica."
            </p>
            <div className="font-mono text-sm text-white font-bold">GERENTE DE OPERACIONES</div>
            <div className="font-mono text-xs text-slate-500">Multinacional Industrial, Guatemala</div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 relative overflow-hidden bg-[#00ff9d] text-[#0a0e1a]">
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'linear-gradient(#000 1px, transparent 1px), linear-gradient(90deg, #000 1px, transparent 1px)', backgroundSize: '40px 40px' }}></div>
        
        <div className="max-w-4xl mx-auto px-4 text-center relative z-10">
          <h2 className="text-4xl md:text-5xl font-bold mb-6 tracking-tight">¿LISTO PARA ASEGURAR SU OPERACIÓN?</h2>
          <p className="text-lg mb-10 opacity-80 font-medium max-w-2xl mx-auto">
            Inicie el protocolo de evaluación. Nuestro equipo táctico diseñará una matriz de cobertura específica para su entorno.
          </p>
          <button className="bg-[#0a0e1a] text-[#00ff9d] font-mono px-8 py-4 font-bold text-lg hover:shadow-[0_0_30px_rgba(10,14,26,0.5)] transition-all">
            SOLICITAR_AUDITORÍA_DE_SEGURIDAD
          </button>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="bg-[#050810] border-t border-slate-800 pt-16 pb-8 font-mono text-sm">
        <div className="max-w-7xl mx-auto px-4 grid grid-cols-1 md:grid-cols-4 gap-8 mb-12">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Shield className="w-5 h-5 text-[#00ff9d]" />
              <span className="font-bold tracking-widest text-white">ISP<span className="text-[#00ff9d]">_SA</span></span>
            </div>
            <p className="text-slate-500 mb-4">Infraestructura táctica de protección a nivel nacional.</p>
          </div>
          
          <div>
            <div className="text-white font-bold mb-4">/ COMUNICACIÓN</div>
            <ul className="space-y-2 text-slate-500">
              <li>+502 2200-0000</li>
              <li>ops@ispsa.com.gt</li>
              <li>Ciudad de Guatemala</li>
            </ul>
          </div>

          <div>
            <div className="text-white font-bold mb-4">/ MÓDULOS</div>
            <ul className="space-y-2 text-slate-500">
              <li><a href="#" className="hover:text-[#00ff9d]">Seguridad Física</a></li>
              <li><a href="#" className="hover:text-[#00ff9d]">Custodia en Ruta</a></li>
              <li><a href="#" className="hover:text-[#00ff9d]">Ops. Móviles</a></li>
            </ul>
          </div>

          <div>
            <div className="text-white font-bold mb-4">/ SISTEMA</div>
            <ul className="space-y-2 text-slate-500">
              <li><a href="#" className="hover:text-[#00d4ff]">[PORTAL CLIENTES]</a></li>
              <li><a href="#" className="hover:text-[#00ff9d]">Reclutamiento</a></li>
            </ul>
          </div>
        </div>
        
        <div className="max-w-7xl mx-auto px-4 pt-8 border-t border-slate-800 flex flex-col md:flex-row items-center justify-between text-slate-600 text-xs">
          <div>© {new Date().getFullYear()} Investigaciones y Seguridad Profesional, S.A.</div>
          <div className="flex gap-4 mt-4 md:mt-0">
            <span>SYS_STATUS: ONLINE</span>
            <span>ENCRYPTION: ACTIVE</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
