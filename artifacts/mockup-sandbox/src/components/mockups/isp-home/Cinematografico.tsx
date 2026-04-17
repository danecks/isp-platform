import React, { useEffect, useState } from "react";
import { Link } from "wouter";
import { 
  ArrowRight, Shield, Truck, Crosshair, MonitorPlay, 
  ChevronRight, Building2, Briefcase, Landmark, Home, 
  Factory, Quote, Phone, Mail, MapPin, Menu, X
} from "lucide-react";

export function Cinematografico() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div className="min-h-screen bg-[#f8f6f0] text-[#1c1b18] font-sans overflow-x-hidden selection:bg-[#9a7e3d] selection:text-white">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;0,800;1,400&family=Inter:wght@300;400;500;600&display=swap');
        .font-serif { font-family: 'Playfair Display', serif; }
        .font-sans { font-family: 'Inter', sans-serif; }
        .text-charcoal { color: #1c1b18; }
        .bg-charcoal { background-color: #1c1b18; }
        .text-cream { color: #f8f6f0; }
        .bg-cream { background-color: #f8f6f0; }
        .text-deepgold { color: #9a7e3d; }
        .bg-deepgold { background-color: #9a7e3d; }
      `}</style>

      {/* NAVBAR */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${scrolled ? 'bg-charcoal/95 backdrop-blur-md py-4' : 'bg-transparent py-6'}`}>
        <div className="max-w-7xl mx-auto px-6 lg:px-12 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield className={`w-8 h-8 ${scrolled ? 'text-deepgold' : 'text-white'}`} />
            <span className={`font-serif font-bold text-2xl tracking-widest ${scrolled ? 'text-white' : 'text-white'}`}>ISP, S.A.</span>
          </div>

          <div className="hidden lg:flex items-center gap-8">
            {['Inicio', 'Nosotros', 'Servicios', 'Sectores', 'Reclutamiento', 'Contacto'].map(item => (
              <a key={item} href="#" className={`text-sm tracking-wide font-medium hover:text-deepgold transition-colors ${scrolled ? 'text-gray-300' : 'text-white/90'}`}>
                {item}
              </a>
            ))}
          </div>

          <div className="hidden lg:flex items-center gap-4">
            <button className={`text-sm font-semibold tracking-wide ${scrolled ? 'text-white' : 'text-white'}`}>
              Portal Clientes
            </button>
            <button className="bg-deepgold text-white px-6 py-3 text-sm font-semibold tracking-wider hover:bg-[#856b32] transition-colors">
              Solicitar Servicio
            </button>
          </div>

          <button className="lg:hidden text-white" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
            {mobileMenuOpen ? <X /> : <Menu />}
          </button>
        </div>
      </nav>

      {/* HERO SECTION */}
      <header className="relative h-screen w-full flex items-center justify-center bg-charcoal">
        <div className="absolute inset-0">
          <img 
            src="/__mockup/images/hero-cinematic.png" 
            alt="Security Operations Team" 
            className="w-full h-full object-cover opacity-60 mix-blend-overlay"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-charcoal via-charcoal/40 to-transparent" />
        </div>
        
        <div className="relative z-10 max-w-7xl mx-auto px-6 lg:px-12 w-full flex flex-col items-center text-center pt-24">
          <span className="inline-block px-4 py-1.5 border border-deepgold/50 text-deepgold tracking-widest text-xs font-semibold mb-8 backdrop-blur-sm">
            EMPRESA CERTIFICADA · GUATEMALA
          </span>
          <h1 className="font-serif text-5xl md:text-7xl lg:text-8xl text-white font-bold leading-[1.1] tracking-tight mb-6 max-w-5xl">
            La Presencia del <br/>
            <span className="text-deepgold italic font-normal">Poder Operativo.</span>
          </h1>
          <p className="text-gray-300 text-lg md:text-xl font-light max-w-2xl mb-12 leading-relaxed">
            Custodiamos el valor de las empresas más exigentes del país con inteligencia táctica, respuesta implacable y una discreción absoluta.
          </p>
          <div className="flex flex-col sm:flex-row items-center gap-6">
            <button className="bg-deepgold text-white px-8 py-4 text-sm font-semibold tracking-wider hover:bg-[#856b32] transition-all flex items-center gap-3">
              Solicitar Evaluación <ArrowRight className="w-4 h-4" />
            </button>
            <button className="border border-white/30 text-white px-8 py-4 text-sm font-semibold tracking-wider hover:bg-white hover:text-charcoal transition-all">
              WhatsApp Directo
            </button>
          </div>
        </div>
      </header>

      {/* STATS / METRICS */}
      <section className="bg-charcoal py-24 border-t border-white/5">
        <div className="max-w-7xl mx-auto px-6 lg:px-12 grid grid-cols-1 md:grid-cols-4 gap-12 text-center md:text-left divide-y md:divide-y-0 md:divide-x divide-white/10">
          <div className="pt-8 md:pt-0 md:pl-0 flex flex-col justify-center">
            <span className="font-serif text-6xl lg:text-8xl text-white mb-2">800<span className="text-deepgold">+</span></span>
            <span className="text-gray-400 text-sm tracking-widest uppercase font-medium">Agentes Activos</span>
          </div>
          <div className="pt-8 md:pt-0 md:pl-12 flex flex-col justify-center">
            <span className="font-serif text-6xl lg:text-8xl text-white mb-2">24<span className="text-deepgold">/</span>7</span>
            <span className="text-gray-400 text-sm tracking-widest uppercase font-medium">Respuesta Operativa</span>
          </div>
          <div className="pt-8 md:pt-0 md:pl-12 flex flex-col justify-center">
            <span className="font-serif text-6xl lg:text-8xl text-white mb-2">100<span className="text-deepgold">%</span></span>
            <span className="text-gray-400 text-sm tracking-widest uppercase font-medium">Cobertura Nacional</span>
          </div>
          <div className="pt-8 md:pt-0 md:pl-12 flex flex-col justify-center">
            <span className="font-serif text-6xl lg:text-8xl text-white mb-2">15<span className="text-deepgold">+</span></span>
            <span className="text-gray-400 text-sm tracking-widest uppercase font-medium">Años de Prestigio</span>
          </div>
        </div>
      </section>

      {/* SERVICIOS */}
      <section className="py-32 bg-cream">
        <div className="max-w-7xl mx-auto px-6 lg:px-12">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8 mb-20">
            <div className="max-w-2xl">
              <h2 className="font-serif text-4xl lg:text-6xl text-charcoal font-bold leading-tight mb-6">
                Precisión en cada línea de defensa.
              </h2>
              <p className="text-gray-600 text-lg leading-relaxed">
                Nuestros servicios están diseñados para operar de forma invisible cuando es necesario y disuasiva cuando la situación lo demanda.
              </p>
            </div>
            <button className="text-charcoal font-semibold tracking-wider border-b border-charcoal pb-1 hover:text-deepgold hover:border-deepgold transition-colors inline-flex items-center gap-2">
              Ver todos los servicios <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Service 1 */}
            <div className="group relative overflow-hidden bg-white shadow-xl h-[500px]">
              <div className="absolute inset-0">
                <img src="/__mockup/images/service-physical.png" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" alt="Seguridad Física" />
                <div className="absolute inset-0 bg-charcoal/20 group-hover:bg-charcoal/40 transition-colors duration-500" />
              </div>
              <div className="absolute inset-0 p-10 flex flex-col justify-between">
                <Shield className="w-10 h-10 text-white" />
                <div>
                  <h3 className="font-serif text-3xl text-white font-bold mb-4">Seguridad Física</h3>
                  <p className="text-gray-100 mb-6 max-w-md opacity-0 group-hover:opacity-100 transition-opacity duration-500 transform translate-y-4 group-hover:translate-y-0">
                    Guardias entrenados bajo rigor táctico para corporativos, industrias y residencias de alto nivel.
                  </p>
                  <span className="text-deepgold font-semibold tracking-wider flex items-center gap-2">Explorar <ChevronRight className="w-4 h-4" /></span>
                </div>
              </div>
            </div>

            {/* Service 2 */}
            <div className="group relative overflow-hidden bg-white shadow-xl h-[500px]">
              <div className="absolute inset-0">
                <img src="/__mockup/images/service-transit.png" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" alt="Custodia de Transporte" />
                <div className="absolute inset-0 bg-charcoal/20 group-hover:bg-charcoal/40 transition-colors duration-500" />
              </div>
              <div className="absolute inset-0 p-10 flex flex-col justify-between">
                <Truck className="w-10 h-10 text-white" />
                <div>
                  <h3 className="font-serif text-3xl text-white font-bold mb-4">Custodia de Transporte</h3>
                  <p className="text-gray-100 mb-6 max-w-md opacity-0 group-hover:opacity-100 transition-opacity duration-500 transform translate-y-4 group-hover:translate-y-0">
                    Aseguramiento de mercancías críticas con vehículos blindados y personal armado especializado.
                  </p>
                  <span className="text-deepgold font-semibold tracking-wider flex items-center gap-2">Explorar <ChevronRight className="w-4 h-4" /></span>
                </div>
              </div>
            </div>

            {/* Service 3 */}
            <div className="group relative overflow-hidden bg-charcoal p-10 h-[400px] flex flex-col justify-between shadow-xl">
              <Crosshair className="w-10 h-10 text-deepgold" />
              <div>
                <h3 className="font-serif text-3xl text-white font-bold mb-4">Operaciones Móviles</h3>
                <p className="text-gray-400 mb-6 max-w-md">
                  Patrullajes de reacción inmediata, motorizados y equipados para intervenir ante cualquier señal de riesgo o vulnerabilidad.
                </p>
                <span className="text-deepgold font-semibold tracking-wider flex items-center gap-2">Explorar <ChevronRight className="w-4 h-4" /></span>
              </div>
            </div>

            {/* Service 4 */}
            <div className="group relative overflow-hidden bg-[#2a2924] p-10 h-[400px] flex flex-col justify-between shadow-xl">
              <MonitorPlay className="w-10 h-10 text-deepgold" />
              <div>
                <h3 className="font-serif text-3xl text-white font-bold mb-4">Monitoreo 24/7</h3>
                <p className="text-gray-400 mb-6 max-w-md">
                  Vigilancia electrónica de última generación, supervisando posiciones remotamente con conexión directa a autoridades.
                </p>
                <span className="text-deepgold font-semibold tracking-wider flex items-center gap-2">Explorar <ChevronRight className="w-4 h-4" /></span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTORS */}
      <section className="py-32 bg-white">
        <div className="max-w-7xl mx-auto px-6 lg:px-12 flex flex-col lg:flex-row gap-20">
          <div className="lg:w-1/3">
            <h2 className="font-serif text-4xl lg:text-5xl text-charcoal font-bold leading-tight mb-8">
              Territorios de influencia.
            </h2>
            <p className="text-gray-600 text-lg leading-relaxed">
              No aplicamos recetas estándar. Cada industria enfrenta amenazas únicas, y por ello nuestro diseño táctico es estrictamente a la medida.
            </p>
          </div>
          <div className="lg:w-2/3 grid grid-cols-1 sm:grid-cols-2 gap-x-12 gap-y-16">
            <div className="border-t border-gray-200 pt-6">
              <Landmark className="w-8 h-8 text-deepgold mb-4" />
              <h4 className="text-xl font-bold text-charcoal mb-2">Bancario y Financiero</h4>
              <p className="text-gray-600">Protocolos rigurosos para el manejo de valores y seguridad de instalaciones sensibles.</p>
            </div>
            <div className="border-t border-gray-200 pt-6">
              <Factory className="w-8 h-8 text-deepgold mb-4" />
              <h4 className="text-xl font-bold text-charcoal mb-2">Industrial</h4>
              <p className="text-gray-600">Controles de acceso a gran escala, prevención de mermas y protección perimetral.</p>
            </div>
            <div className="border-t border-gray-200 pt-6">
              <Briefcase className="w-8 h-8 text-deepgold mb-4" />
              <h4 className="text-xl font-bold text-charcoal mb-2">Comercial</h4>
              <p className="text-gray-600">Seguridad disuasiva y de atención que protege sus activos sin intimidar a sus clientes.</p>
            </div>
            <div className="border-t border-gray-200 pt-6">
              <Home className="w-8 h-8 text-deepgold mb-4" />
              <h4 className="text-xl font-bold text-charcoal mb-2">Residencial VIP</h4>
              <p className="text-gray-600">Privacidad absoluta y control de accesos estricto para condominios de alto perfil.</p>
            </div>
          </div>
        </div>
      </section>

      {/* WHY ISP (Dark Minimal) */}
      <section className="py-32 bg-charcoal text-white">
        <div className="max-w-7xl mx-auto px-6 lg:px-12 text-center mb-20">
          <h2 className="font-serif text-4xl lg:text-6xl font-bold mb-6">Por qué la élite nos elige.</h2>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">No somos una agencia más. Somos un socio estratégico de riesgos.</p>
        </div>
        <div className="max-w-6xl mx-auto px-6 lg:px-12 grid grid-cols-1 md:grid-cols-2 gap-12">
          <div className="p-8 border border-white/10 hover:border-deepgold/50 transition-colors bg-white/[0.02]">
            <h3 className="font-serif text-2xl font-bold mb-4 flex items-center gap-4">
              <span className="text-deepgold font-sans text-sm">01</span> Agentes Certificados
            </h3>
            <p className="text-gray-400 leading-relaxed">
              Selección del 10% superior. Pruebas poligráficas, historial impecable y entrenamiento continuo en manejo de crisis y polígono.
            </p>
          </div>
          <div className="p-8 border border-white/10 hover:border-deepgold/50 transition-colors bg-white/[0.02]">
            <h3 className="font-serif text-2xl font-bold mb-4 flex items-center gap-4">
              <span className="text-deepgold font-sans text-sm">02</span> Respuesta Inmediata
            </h3>
            <p className="text-gray-400 leading-relaxed">
              La burocracia cuesta vidas. Nuestra cadena de mando opera con velocidad militar para enviar refuerzos en minutos.
            </p>
          </div>
          <div className="p-8 border border-white/10 hover:border-deepgold/50 transition-colors bg-white/[0.02]">
            <h3 className="font-serif text-2xl font-bold mb-4 flex items-center gap-4">
              <span className="text-deepgold font-sans text-sm">03</span> Control Total
            </h3>
            <p className="text-gray-400 leading-relaxed">
              Supervisores motorizados que fiscalizan posiciones física y aleatoriamente, garantizando disciplina operativa absoluta.
            </p>
          </div>
          <div className="p-8 border border-white/10 hover:border-deepgold/50 transition-colors bg-white/[0.02]">
            <h3 className="font-serif text-2xl font-bold mb-4 flex items-center gap-4">
              <span className="text-deepgold font-sans text-sm">04</span> Tecnología Propia
            </h3>
            <p className="text-gray-400 leading-relaxed">
              Portales digitales donde usted monitorea incidencias, rondas, asistencia y facturación en tiempo real.
            </p>
          </div>
        </div>
      </section>

      {/* CLIENT LOGOS */}
      <section className="py-24 bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 lg:px-12 text-center">
          <span className="text-sm font-bold tracking-widest uppercase text-gray-400 mb-12 block">CONFIAN EN NOSOTROS</span>
          <div className="flex flex-wrap justify-center items-center gap-12 lg:gap-24 opacity-60 grayscale hover:grayscale-0 transition-all duration-700">
            {['Banco de Inversión', 'Cementos Nacionales', 'Corporación Agrícola', 'Logística Global', 'Residencias Platinum'].map((logo, i) => (
              <div key={i} className="font-serif text-xl md:text-2xl font-bold text-gray-800">
                {logo}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* TESTIMONIAL */}
      <section className="py-32 bg-cream">
        <div className="max-w-5xl mx-auto px-6 lg:px-12 text-center">
          <Quote className="w-16 h-16 text-deepgold mx-auto mb-8 opacity-50" />
          <h3 className="font-serif text-3xl md:text-5xl text-charcoal font-bold leading-snug mb-12">
            "Desde que ISP asumió la seguridad de nuestras operaciones logísticas, nuestras mermas bajaron a cero absoluto. Su presencia no es solo vigilancia; es dominio del terreno."
          </h3>
          <div className="flex flex-col items-center">
            <div className="w-16 h-16 rounded-full bg-charcoal mb-4 flex items-center justify-center text-white font-serif italic text-2xl">
              C
            </div>
            <span className="font-bold text-charcoal uppercase tracking-widest text-sm mb-1">Director de Operaciones</span>
            <span className="text-gray-500 font-serif italic">Cementos Nacionales de Guatemala</span>
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="py-32 bg-deepgold text-white text-center">
        <div className="max-w-4xl mx-auto px-6 lg:px-12">
          <h2 className="font-serif text-5xl md:text-7xl font-bold mb-8">¿Listo para proteger su legado?</h2>
          <p className="text-xl text-white/90 font-light mb-12 max-w-2xl mx-auto">
            Hablemos hoy sobre cómo blindar sus operaciones con el estándar de oro en seguridad privada.
          </p>
          <button className="bg-charcoal text-white px-10 py-5 text-sm font-semibold tracking-widest uppercase hover:bg-black transition-colors">
            Solicitar Evaluación Estratégica
          </button>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="bg-charcoal pt-24 pb-12 border-t border-white/10">
        <div className="max-w-7xl mx-auto px-6 lg:px-12 grid grid-cols-1 md:grid-cols-4 gap-12 mb-16">
          <div className="col-span-1 md:col-span-2">
            <div className="flex items-center gap-3 mb-6">
              <Shield className="w-8 h-8 text-deepgold" />
              <span className="font-serif font-bold text-2xl tracking-widest text-white">ISP, S.A.</span>
            </div>
            <p className="text-gray-400 max-w-sm mb-8 leading-relaxed">
              Investigaciones y Seguridad Profesional. El máximo rigor táctico y tecnológico al servicio de su tranquilidad.
            </p>
            <div className="flex flex-col gap-3 text-gray-400">
              <span className="flex items-center gap-3"><Phone className="w-4 h-4 text-deepgold" /> +502 2200-0000</span>
              <span className="flex items-center gap-3"><Mail className="w-4 h-4 text-deepgold" /> contacto@ispsa.com.gt</span>
              <span className="flex items-center gap-3"><MapPin className="w-4 h-4 text-deepgold" /> Ciudad de Guatemala, Guatemala</span>
            </div>
          </div>
          
          <div>
            <h4 className="text-white font-bold tracking-widest uppercase text-sm mb-6">Servicios</h4>
            <ul className="flex flex-col gap-3 text-gray-400">
              <li><a href="#" className="hover:text-deepgold transition-colors">Seguridad Física</a></li>
              <li><a href="#" className="hover:text-deepgold transition-colors">Custodias de Transporte</a></li>
              <li><a href="#" className="hover:text-deepgold transition-colors">Operaciones Móviles</a></li>
              <li><a href="#" className="hover:text-deepgold transition-colors">Monitoreo 24/7</a></li>
            </ul>
          </div>

          <div>
            <h4 className="text-white font-bold tracking-widest uppercase text-sm mb-6">Compañía</h4>
            <ul className="flex flex-col gap-3 text-gray-400">
              <li><a href="#" className="hover:text-deepgold transition-colors">Nosotros</a></li>
              <li><a href="#" className="hover:text-deepgold transition-colors">Sectores</a></li>
              <li><a href="#" className="hover:text-deepgold transition-colors">Reclutamiento</a></li>
              <li><a href="#" className="hover:text-deepgold transition-colors">Portal Clientes</a></li>
            </ul>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-6 lg:px-12 pt-8 border-t border-white/10 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-gray-500 text-sm">© {new Date().getFullYear()} ISP, S.A. Todos los derechos reservados.</p>
          <div className="flex gap-6 text-sm text-gray-500">
            <a href="#" className="hover:text-white transition-colors">Términos de Servicio</a>
            <a href="#" className="hover:text-white transition-colors">Política de Privacidad</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
