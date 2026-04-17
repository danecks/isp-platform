import React, { useState, useEffect } from "react";
import { Menu, X, ArrowRight } from "lucide-react";

export function Mision() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="bg-black text-white h-screen w-full overflow-y-scroll snap-y snap-mandatory font-sans overflow-x-hidden selection:bg-red-500 selection:text-white">
      {/* NAVBAR */}
      <nav className="fixed top-0 w-full z-50 py-6 px-6 lg:px-12 flex justify-between items-center mix-blend-difference">
        <div className="text-2xl font-[800] tracking-widest uppercase">ISP</div>
        
        <div className="hidden lg:flex items-center gap-8 text-xs font-[800] tracking-widest uppercase">
          <a href="#" className="hover:text-gray-400 transition-colors">Nosotros</a>
          <a href="#" className="hover:text-gray-400 transition-colors">Misiones</a>
          <a href="#" className="hover:text-gray-400 transition-colors">Cobertura</a>
          <a href="#" className="hover:text-gray-400 transition-colors">Reclutamiento</a>
          <a href="#" className="hover:text-gray-400 transition-colors">Contacto</a>
          <a href="#" className="border border-white px-4 py-2 hover:bg-white hover:text-black transition-colors">Portal Clientes</a>
        </div>

        <button className="lg:hidden z-50" onClick={() => setMenuOpen(!menuOpen)}>
          {menuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </nav>

      {/* MOBILE MENU */}
      <div className={`fixed inset-0 bg-black z-40 flex flex-col justify-center items-center gap-8 transition-opacity duration-300 ${menuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
        <a href="#" className="text-2xl font-[800] tracking-widest uppercase hover:text-red-500 transition-colors">Nosotros</a>
        <a href="#" className="text-2xl font-[800] tracking-widest uppercase hover:text-red-500 transition-colors">Misiones</a>
        <a href="#" className="text-2xl font-[800] tracking-widest uppercase hover:text-red-500 transition-colors">Cobertura</a>
        <a href="#" className="text-2xl font-[800] tracking-widest uppercase hover:text-red-500 transition-colors">Reclutamiento</a>
        <a href="#" className="text-2xl font-[800] tracking-widest uppercase hover:text-red-500 transition-colors">Contacto</a>
      </div>

      {/* HERO */}
      <section className="h-screen w-full relative snap-start flex flex-col justify-end pb-24 px-6 lg:px-12">
        <div className="absolute inset-0 z-0">
          <img src="/__mockup/images/mision-hero.png" alt="Hero Security" className="w-full h-full object-cover opacity-60" />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />
        </div>
        <div className="relative z-10 flex justify-between items-end w-full">
          <div>
            <h2 className="text-sm font-[500] tracking-[0.2em] mb-4 text-gray-300">ISP, S.A. — DESDE 2009</h2>
            <h1 className="text-5xl md:text-7xl lg:text-8xl font-[800] tracking-[-0.02em] uppercase leading-none mb-4 max-w-4xl">
              Protegemos<br />Lo Que Importa
            </h1>
            <p className="text-lg md:text-xl text-gray-300 font-light max-w-xl">Operaciones de seguridad privada en Guatemala.</p>
          </div>
        </div>
        <div className="absolute bottom-12 right-6 lg:right-12 z-10">
          <button className="flex items-center gap-4 text-sm font-[800] tracking-widest uppercase hover:text-red-500 transition-colors">
            Solicitar Servicio <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </section>

      {/* MISIÓN 01 */}
      <section className="h-screen w-full relative snap-start flex flex-col justify-end pb-24 px-6 lg:px-12">
        <div className="absolute inset-0 z-0">
          <img src="/__mockup/images/mision-01.png" alt="Seguridad Física" className="w-full h-full object-cover opacity-60" />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />
        </div>
        <div className="relative z-10 flex justify-between items-end w-full">
          <div>
            <h2 className="text-sm font-[500] tracking-[0.2em] mb-4 text-gray-300">MISIÓN 01 / SEGURIDAD FÍSICA</h2>
            <h1 className="text-5xl md:text-7xl lg:text-8xl font-[800] tracking-[-0.02em] uppercase leading-none mb-4">
              Protección<br />Perimetral
            </h1>
            <p className="text-lg md:text-xl text-gray-300 font-light max-w-xl">Guardias profesionales bajo rigor táctico para corporativos e industrias.</p>
          </div>
        </div>
        <div className="absolute bottom-12 right-6 lg:right-12 z-10">
          <button className="flex items-center gap-4 text-sm font-[800] tracking-widest uppercase hover:text-red-500 transition-colors">
            Ver Detalles <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </section>

      {/* MISIÓN 02 */}
      <section className="h-screen w-full relative snap-start flex flex-col justify-end pb-24 px-6 lg:px-12">
        <div className="absolute inset-0 z-0">
          <img src="/__mockup/images/mision-02.png" alt="Custodia Transporte" className="w-full h-full object-cover opacity-60" />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />
        </div>
        <div className="relative z-10 flex justify-between items-end w-full">
          <div>
            <h2 className="text-sm font-[500] tracking-[0.2em] mb-4 text-gray-300">MISIÓN 02 / CUSTODIA DE TRANSPORTE</h2>
            <h1 className="text-5xl md:text-7xl lg:text-8xl font-[800] tracking-[-0.02em] uppercase leading-none mb-4">
              Transporte<br />Blindado
            </h1>
            <p className="text-lg md:text-xl text-gray-300 font-light max-w-xl">Aseguramiento de mercancías críticas con vehículos y personal especializado.</p>
          </div>
        </div>
        <div className="absolute bottom-12 right-6 lg:right-12 z-10">
          <button className="flex items-center gap-4 text-sm font-[800] tracking-widest uppercase hover:text-red-500 transition-colors">
            Ver Detalles <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </section>

      {/* MISIÓN 03 */}
      <section className="h-screen w-full relative snap-start flex flex-col justify-end pb-24 px-6 lg:px-12">
        <div className="absolute inset-0 z-0">
          <img src="/__mockup/images/mision-03.png" alt="Operaciones Móviles" className="w-full h-full object-cover opacity-60" />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />
        </div>
        <div className="relative z-10 flex justify-between items-end w-full">
          <div>
            <h2 className="text-sm font-[500] tracking-[0.2em] mb-4 text-gray-300">MISIÓN 03 / OPERACIONES MÓVILES</h2>
            <h1 className="text-5xl md:text-7xl lg:text-8xl font-[800] tracking-[-0.02em] uppercase leading-none mb-4">
              Patrullaje<br />Táctico
            </h1>
            <p className="text-lg md:text-xl text-gray-300 font-light max-w-xl">Reacción inmediata y motorizada para intervenir ante cualquier señal de riesgo.</p>
          </div>
        </div>
        <div className="absolute bottom-12 right-6 lg:right-12 z-10">
          <button className="flex items-center gap-4 text-sm font-[800] tracking-widest uppercase hover:text-red-500 transition-colors">
            Ver Detalles <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </section>

      {/* MISIÓN 04 */}
      <section className="h-screen w-full relative snap-start flex flex-col justify-end pb-24 px-6 lg:px-12">
        <div className="absolute inset-0 z-0">
          <img src="/__mockup/images/mision-04.png" alt="Monitoreo" className="w-full h-full object-cover opacity-60" />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />
        </div>
        <div className="relative z-10 flex justify-between items-end w-full">
          <div>
            <h2 className="text-sm font-[500] tracking-[0.2em] mb-4 text-gray-300">MISIÓN 04 / MONITOREO 24/7</h2>
            <h1 className="text-5xl md:text-7xl lg:text-8xl font-[800] tracking-[-0.02em] uppercase leading-none mb-4">
              Vigilancia<br />Electrónica
            </h1>
            <p className="text-lg md:text-xl text-gray-300 font-light max-w-xl">Supervisión remota continua con conexión directa a autoridades.</p>
          </div>
        </div>
        <div className="absolute bottom-12 right-6 lg:right-12 z-10">
          <button className="flex items-center gap-4 text-sm font-[800] tracking-widest uppercase hover:text-red-500 transition-colors">
            Ver Detalles <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </section>

      {/* MÉTRICAS */}
      <section className="h-screen w-full bg-black snap-start flex items-center justify-center px-6 lg:px-12 relative">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-16 md:gap-32 text-center">
          <div>
            <div className="text-7xl md:text-9xl font-[800] tracking-[-0.02em] uppercase leading-none mb-2">+800</div>
            <div className="text-sm font-[800] tracking-widest uppercase text-gray-400">AGENTES ACTIVOS</div>
          </div>
          <div>
            <div className="text-7xl md:text-9xl font-[800] tracking-[-0.02em] uppercase leading-none mb-2">24/7</div>
            <div className="text-sm font-[800] tracking-widest uppercase text-gray-400">OPERACIÓN CONTINUA</div>
          </div>
          <div>
            <div className="text-7xl md:text-9xl font-[800] tracking-[-0.02em] uppercase leading-none mb-2">15+</div>
            <div className="text-sm font-[800] tracking-widest uppercase text-gray-400">AÑOS DE EXPERIENCIA</div>
          </div>
          <div>
            <div className="text-7xl md:text-9xl font-[800] tracking-[-0.02em] uppercase leading-none mb-2">100%</div>
            <div className="text-sm font-[800] tracking-widest uppercase text-gray-400">COBERTURA NACIONAL</div>
          </div>
        </div>
      </section>

      {/* SECTORES */}
      <section className="h-screen w-full bg-black snap-start flex items-center px-6 lg:px-12 relative overflow-hidden">
        <div className="absolute top-1/4 right-0 w-1/2 h-1/2 opacity-5 pointer-events-none">
          <Shield className="w-full h-full" />
        </div>
        <div className="w-full max-w-5xl">
          <h2 className="text-sm font-[500] tracking-[0.2em] mb-12 text-gray-400">SECTORES ATENDIDOS</h2>
          <div className="flex flex-col">
            <div className="border-t border-white/10 py-6 text-3xl md:text-5xl font-[800] tracking-[-0.02em] uppercase hover:pl-8 hover:text-white text-gray-500 transition-all cursor-pointer">BANCARIO Y FINANCIERO</div>
            <div className="border-t border-white/10 py-6 text-3xl md:text-5xl font-[800] tracking-[-0.02em] uppercase hover:pl-8 hover:text-white text-gray-500 transition-all cursor-pointer">INDUSTRIAL</div>
            <div className="border-t border-white/10 py-6 text-3xl md:text-5xl font-[800] tracking-[-0.02em] uppercase hover:pl-8 hover:text-white text-gray-500 transition-all cursor-pointer">COMERCIAL</div>
            <div className="border-t border-white/10 py-6 text-3xl md:text-5xl font-[800] tracking-[-0.02em] uppercase hover:pl-8 hover:text-white text-gray-500 transition-all cursor-pointer">GOBIERNO</div>
            <div className="border-t border-b border-white/10 py-6 text-3xl md:text-5xl font-[800] tracking-[-0.02em] uppercase hover:pl-8 hover:text-white text-gray-500 transition-all cursor-pointer">RESIDENCIAL ALTO PERFIL</div>
          </div>
        </div>
      </section>

      {/* CONFIANZA / LOGOS */}
      <section className="h-[50vh] w-full bg-black snap-start flex flex-col justify-center px-6 lg:px-12 border-t border-white/5">
        <h2 className="text-sm font-[500] tracking-[0.2em] mb-12 text-center text-gray-400">CON LA CONFIANZA DE</h2>
        <div className="flex flex-wrap justify-center items-center gap-12 lg:gap-24 opacity-40 grayscale hover:grayscale-0 hover:opacity-100 transition-all duration-700">
          <div className="text-xl md:text-2xl font-[800] tracking-widest uppercase">CORP. AGRÍCOLA</div>
          <div className="text-xl md:text-2xl font-[800] tracking-widest uppercase">BANCO NACIONAL</div>
          <div className="text-xl md:text-2xl font-[800] tracking-widest uppercase">LOGÍSTICA GLOBAL</div>
          <div className="text-xl md:text-2xl font-[800] tracking-widest uppercase">CEMENTOS DEL NORTE</div>
        </div>
      </section>

      {/* CTA FINAL & FOOTER */}
      <section className="h-[50vh] w-full relative snap-start flex flex-col justify-end bg-black">
        <div className="absolute inset-0 z-0">
          <img src="/__mockup/images/mision-01.png" alt="CTA" className="w-full h-full object-cover opacity-30" />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/80 to-black/30" />
        </div>
        
        <div className="relative z-10 flex flex-col items-center justify-center h-full text-center px-6">
          <h1 className="text-4xl md:text-6xl font-[800] tracking-[-0.02em] uppercase mb-8">¿Listo para proteger tu operación?</h1>
          <button className="border-2 border-white px-12 py-4 text-sm font-[800] tracking-widest uppercase hover:bg-white hover:text-black transition-colors">
            Contactar
          </button>
        </div>

        {/* FOOTER */}
        <footer className="relative z-10 bg-black pt-16 pb-8 border-t border-white/10 w-full px-6 lg:px-12">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-16">
            <div>
              <h4 className="text-xs font-[800] tracking-[0.2em] text-gray-500 mb-4">NAVEGACIÓN</h4>
              <ul className="flex flex-col gap-2 text-xs font-[500] tracking-widest text-gray-300 uppercase">
                <li><a href="#" className="hover:text-white">Inicio</a></li>
                <li><a href="#" className="hover:text-white">Nosotros</a></li>
                <li><a href="#" className="hover:text-white">Reclutamiento</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-xs font-[800] tracking-[0.2em] text-gray-500 mb-4">SERVICIOS</h4>
              <ul className="flex flex-col gap-2 text-xs font-[500] tracking-widest text-gray-300 uppercase">
                <li><a href="#" className="hover:text-white">Física</a></li>
                <li><a href="#" className="hover:text-white">Custodia</a></li>
                <li><a href="#" className="hover:text-white">Móviles</a></li>
                <li><a href="#" className="hover:text-white">Monitoreo</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-xs font-[800] tracking-[0.2em] text-gray-500 mb-4">EMPRESA</h4>
              <ul className="flex flex-col gap-2 text-xs font-[500] tracking-widest text-gray-300 uppercase">
                <li><a href="#" className="hover:text-white">Políticas</a></li>
                <li><a href="#" className="hover:text-white">Privacidad</a></li>
                <li><a href="#" className="hover:text-white">Portal</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-xs font-[800] tracking-[0.2em] text-gray-500 mb-4">CONTACTO</h4>
              <ul className="flex flex-col gap-2 text-xs font-[500] tracking-widest text-gray-300 uppercase">
                <li><a href="#" className="hover:text-white">+502 2200-0000</a></li>
                <li><a href="#" className="hover:text-white">INFO@ISPSA.COM.GT</a></li>
              </ul>
            </div>
          </div>
          <div className="flex flex-col md:flex-row justify-between items-center text-xs font-[500] tracking-widest text-gray-600 uppercase border-t border-white/10 pt-8">
            <p>ISP, S.A. © {new Date().getFullYear()}</p>
            <p>GUATEMALA</p>
          </div>
        </footer>
      </section>
    </div>
  );
}
