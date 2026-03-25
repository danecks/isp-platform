import { Link } from "wouter";
import { 
  ArrowRight, ShieldCheck, Truck, Users, Activity, 
  CheckCircle, Eye, MapPin, Clock, BarChart3, Zap, 
  Target, ChevronRight, PhoneCall, MessageSquare,
  Shield, Building2, Factory 
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { FadeIn } from "@/components/animations/FadeIn";
import { PageLayout } from "@/components/layout/PageLayout";

export default function Home() {
  return (
    <PageLayout>
      {/* SECTION 1 — HERO */}
      <section className="relative min-h-screen flex items-center pt-20 overflow-hidden bg-gradient-to-br from-[#050d1a] to-[#0a1628]">
        {/* Subtle decorative elements */}
        <div className="absolute inset-0 pointer-events-none">
          {/* Large blurred circle */}
          <div className="absolute top-10 right-10 w-[600px] h-[600px] bg-primary/5 blur-3xl rounded-full mix-blend-screen" />
          {/* Diagonal line grid pattern */}
          <div 
            className="absolute inset-0 opacity-5"
            style={{
              backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 10px, white 10px, white 11px)'
            }}
          />
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 w-full flex flex-col lg:flex-row items-center justify-between gap-12">
          {/* Left Column Content */}
          <div className="flex-1 max-w-3xl text-left">
            <FadeIn delay={0.1}>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary text-primary font-medium text-sm mb-8">
                <Shield className="w-4 h-4" />
                Empresa Certificada · Guatemala
              </div>
            </FadeIn>
            
            <FadeIn delay={0.2}>
              <h1 className="text-6xl lg:text-8xl font-display font-bold leading-none mb-6 flex flex-col">
                <span className="text-white">PROTECCIÓN</span>
                <span className="text-gradient-gold">PROFESIONAL</span>
              </h1>
            </FadeIn>

            <FadeIn delay={0.3}>
              <p className="text-xl font-sans text-muted-foreground mb-10 max-w-2xl leading-relaxed">
                Seguridad física, custodia de transporte y operaciones móviles para empresas de alto requerimiento. Más de 400 agentes activos en todo el territorio guatemalteco.
              </p>
            </FadeIn>

            <FadeIn delay={0.4} className="flex flex-col sm:flex-row gap-4 mb-6">
              <Link href="/solicitar-servicio">
                <Button size="lg" className="w-full sm:w-auto h-14 px-8 rounded-full text-base font-semibold bg-primary text-[#050d1a] hover:bg-primary/90 shadow-lg shadow-primary/20">
                  Solicitar Evaluación <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
              </Link>
              <a href="https://wa.me/50250000000" target="_blank" rel="noopener noreferrer">
                <Button size="lg" variant="outline" className="w-full sm:w-auto h-14 px-8 rounded-full text-base font-semibold border-primary text-primary hover:bg-primary/10">
                  <MessageSquare className="mr-2 w-5 h-5" /> WhatsApp Directo
                </Button>
              </a>
            </FadeIn>

            <FadeIn delay={0.5}>
              <p className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                Operaciones activas 24 / 7 · 365 días
              </p>
            </FadeIn>
          </div>

          {/* Right Column Stats Cluster (Hidden on mobile) */}
          <div className="hidden lg:flex relative flex-1 h-[500px] items-center justify-center pointer-events-none">
            {/* Big decorative shield background */}
            <Shield className="absolute w-[400px] h-[400px] text-primary opacity-5" />
            
            <div className="relative w-full h-full">
              <FadeIn delay={0.3} direction="right" className="absolute top-[20%] right-[10%]">
                <div className="glass-panel p-6 rounded-2xl flex flex-col items-center shadow-2xl border-l-4 border-l-primary">
                  <span className="text-4xl font-display font-bold text-white mb-1">+400</span>
                  <span className="text-sm text-primary font-semibold uppercase tracking-wider">Agentes</span>
                </div>
              </FadeIn>
              
              <FadeIn delay={0.4} direction="up" className="absolute bottom-[30%] left-[10%]">
                <div className="glass-panel p-6 rounded-2xl flex flex-col items-center shadow-2xl border-l-4 border-l-primary">
                  <span className="text-4xl font-display font-bold text-white mb-1">24/7</span>
                  <span className="text-sm text-primary font-semibold uppercase tracking-wider">Activo</span>
                </div>
              </FadeIn>

              <FadeIn delay={0.5} direction="left" className="absolute top-[50%] right-[30%]">
                <div className="glass-panel p-6 rounded-2xl flex flex-col items-center shadow-2xl border-l-4 border-l-primary">
                  <MapPin className="w-10 h-10 text-white mb-2" />
                  <span className="text-sm text-primary font-semibold uppercase tracking-wider">Nacional</span>
                </div>
              </FadeIn>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 2 — STATS BAR */}
      <div className="w-full bg-card border-y border-white/5 py-10 relative z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:divide-x divide-white/10">
            <FadeIn delay={0.1} className="flex flex-col items-center text-center">
              <span className="text-4xl font-display font-bold text-primary mb-2">+400</span>
              <span className="text-sm font-medium text-muted-foreground">Agentes</span>
            </FadeIn>
            <FadeIn delay={0.2} className="flex flex-col items-center text-center">
              <span className="text-4xl font-display font-bold text-primary mb-2">Cobertura</span>
              <span className="text-sm font-medium text-muted-foreground">Nacional</span>
            </FadeIn>
            <FadeIn delay={0.3} className="flex flex-col items-center text-center">
              <span className="text-4xl font-display font-bold text-primary mb-2">24/7</span>
              <span className="text-sm font-medium text-muted-foreground">Respuesta</span>
            </FadeIn>
            <FadeIn delay={0.4} className="flex flex-col items-center text-center">
              <span className="text-4xl font-display font-bold text-primary mb-2">+15</span>
              <span className="text-sm font-medium text-muted-foreground">Años</span>
            </FadeIn>
          </div>
        </div>
      </div>

      {/* SECTION 3 — SERVICES */}
      <section className="py-24 bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <FadeIn>
            <div className="mb-16">
              <div className="divider-gold" />
              <p className="text-sm font-bold tracking-widest text-muted-foreground uppercase mb-2">Líneas de Servicio</p>
              <h2 className="text-4xl md:text-5xl font-display font-bold text-white">Soluciones Integrales de Seguridad</h2>
            </div>
          </FadeIn>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FadeIn delay={0.1}>
              <div className="group glass-panel rounded-2xl p-8 hover:border-primary/30 transition-all duration-300 h-full flex flex-col">
                <div className="w-12 h-12 rounded-xl bg-primary/15 flex items-center justify-center mb-6">
                  <ShieldCheck className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-xl font-bold text-white mb-3">Seguridad Física</h3>
                <p className="text-muted-foreground leading-relaxed mb-8 flex-grow">
                  Agentes certificados, armados y desarmados, desplegados en instalaciones corporativas, industriales, comerciales y residenciales bajo protocolos de operación estrictos.
                </p>
                <Link href="/servicios/seguridad-fisica" className="text-primary font-medium flex items-center gap-2 group-hover:gap-3 transition-all">
                  Conocer más <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </FadeIn>

            <FadeIn delay={0.2}>
              <div className="group glass-panel rounded-2xl p-8 hover:border-primary/30 transition-all duration-300 h-full flex flex-col">
                <div className="w-12 h-12 rounded-xl bg-primary/15 flex items-center justify-center mb-6">
                  <Truck className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-xl font-bold text-white mb-3">Custodia de Transporte</h3>
                <p className="text-muted-foreground leading-relaxed mb-8 flex-grow">
                  Escolta especializada para protección de carga, valores y mercancías de alto riesgo. Planificación de rutas, seguimiento y coordinación con autoridades.
                </p>
                <Link href="/servicios/custodia-transporte" className="text-primary font-medium flex items-center gap-2 group-hover:gap-3 transition-all">
                  Conocer más <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </FadeIn>

            <FadeIn delay={0.3}>
              <div className="group glass-panel rounded-2xl p-8 hover:border-primary/30 transition-all duration-300 h-full flex flex-col">
                <div className="w-12 h-12 rounded-xl bg-primary/15 flex items-center justify-center mb-6">
                  <Users className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-xl font-bold text-white mb-3">Operaciones Móviles</h3>
                <p className="text-muted-foreground leading-relaxed mb-8 flex-grow">
                  Unidades de reacción rápida y patrullaje preventivo. Presencia disuasoria que neutraliza amenazas antes de que escalen.
                </p>
                <Link href="/servicios" className="text-primary font-medium flex items-center gap-2 group-hover:gap-3 transition-all">
                  Conocer más <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </FadeIn>

            <FadeIn delay={0.4}>
              <div className="group glass-panel rounded-2xl p-8 hover:border-primary/30 transition-all duration-300 h-full flex flex-col">
                <div className="w-12 h-12 rounded-xl bg-primary/15 flex items-center justify-center mb-6">
                  <Eye className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-xl font-bold text-white mb-3">Supervisión y Control</h3>
                <p className="text-muted-foreground leading-relaxed mb-8 flex-grow">
                  Centro de monitoreo que respalda cada puesto con seguimiento en tiempo real, gestión de incidencias y reportes ejecutivos para la toma de decisiones.
                </p>
                <Link href="/servicios" className="text-primary font-medium flex items-center gap-2 group-hover:gap-3 transition-all">
                  Conocer más <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </FadeIn>
          </div>
        </div>
      </section>

      {/* SECTION 4 — OPERATIONAL CAPACITY */}
      <section className="py-24 bg-[#06101d]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <FadeIn>
                <div className="divider-gold" />
                <p className="text-sm font-bold tracking-widest text-muted-foreground uppercase mb-2">Capacidad Operativa</p>
                <h2 className="text-4xl md:text-5xl font-display font-bold text-white mb-6">Un cuerpo de seguridad listo para cualquier escenario.</h2>
                <p className="text-lg text-muted-foreground leading-relaxed mb-8">
                  ISP S.A. cuenta con la infraestructura humana y logística para responder ante cualquier requerimiento de seguridad. Desde un puesto fijo hasta una operación de custodia nacional de múltiple unidad.
                </p>
                <Link href="/solicitar-servicio">
                  <Button variant="outline" className="rounded-full border-primary text-primary hover:bg-primary/10 h-12 px-8">
                    Solicitar cotización
                  </Button>
                </Link>
              </FadeIn>
            </div>

            <div className="flex flex-col gap-8">
              <FadeIn delay={0.2} className="pb-8 border-b border-primary/20">
                <div className="flex items-end gap-6">
                  <span className="text-5xl font-display font-bold text-primary w-24">+400</span>
                  <div>
                    <h4 className="text-xl font-bold text-white">Agentes Activos</h4>
                    <p className="text-muted-foreground text-sm mt-1">Distribuidos en toda la república</p>
                  </div>
                </div>
              </FadeIn>
              <FadeIn delay={0.3} className="pb-8 border-b border-primary/20">
                <div className="flex items-end gap-6">
                  <span className="text-5xl font-display font-bold text-primary w-24">+50</span>
                  <div>
                    <h4 className="text-xl font-bold text-white">Clientes Activos</h4>
                    <p className="text-muted-foreground text-sm mt-1">Empresas líderes en sus sectores</p>
                  </div>
                </div>
              </FadeIn>
              <FadeIn delay={0.4} className="pb-8 border-b border-primary/20">
                <div className="flex items-end gap-6">
                  <span className="text-5xl font-display font-bold text-primary w-24">22</span>
                  <div>
                    <h4 className="text-xl font-bold text-white">Departamentos</h4>
                    <p className="text-muted-foreground text-sm mt-1">Cobertura en todo el territorio nacional</p>
                  </div>
                </div>
              </FadeIn>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 5 — WHY CHOOSE US */}
      <section className="py-24 bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <FadeIn>
            <div className="mb-16">
              <div className="divider-gold" />
              <h2 className="text-4xl md:text-5xl font-display font-bold text-white">¿Por qué elegir ISP S.A.?</h2>
            </div>
          </FadeIn>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            <FadeIn delay={0.1}>
              <div className="glass-panel p-10 rounded-2xl h-full relative overflow-hidden flex flex-col justify-center min-h-[400px]">
                <Shield className="absolute -right-10 -bottom-10 w-[200px] h-[200px] text-primary opacity-10" />
                <h3 className="text-3xl font-display font-bold text-white mb-6 relative z-10">15+ años protegiendo lo que importa</h3>
                <p className="text-lg text-muted-foreground mb-8 relative z-10">
                  Nuestra filosofía no se basa solo en proveer guardias, sino en implementar un sistema integral de seguridad donde la supervisión, el entrenamiento y la tecnología garantizan la continuidad de su negocio.
                </p>
                <Link href="/nosotros" className="text-primary font-medium flex items-center gap-2 hover:gap-3 transition-all relative z-10 w-fit">
                  Conozca nuestra historia <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </FadeIn>

            <div className="flex flex-col justify-center gap-6">
              {[
                { title: "Selección rigurosa de personal", desc: "Procesos de investigación, pruebas psicométricas y verificación de antecedentes." },
                { title: "Supervisión física permanente", desc: "Supervisores de ronda verifican cada puesto de forma continua." },
                { title: "Respuesta rápida garantizada", desc: "Unidades de reacción disponibles las 24 horas, todos los días." },
                { title: "Protocolos ante emergencias", desc: "Procedimientos definidos para cada tipo de incidente crítico." },
                { title: "Reportes ejecutivos de operación", desc: "Información consolidada entregada puntualmente a la gerencia del cliente." },
                { title: "Mejora continua y tecnología", desc: "Incorporamos herramientas digitales para la gestión operativa avanzada." }
              ].map((item, index) => (
                <FadeIn key={index} delay={0.1 * index}>
                  <div className="flex items-start gap-4">
                    <CheckCircle className="w-6 h-6 text-primary shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-bold text-white mb-1">{item.title}</h4>
                      <p className="text-sm text-muted-foreground">{item.desc}</p>
                    </div>
                  </div>
                </FadeIn>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 6 — SUPERVISION & MONITORING */}
      <section className="py-28 bg-[#070f1c] relative overflow-hidden">
        {/* Subtle radial dot pattern bg */}
        <div className="absolute inset-0 opacity-20 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle, #c9a227 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
        
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
          <FadeIn>
            <span className="text-primary text-sm font-bold tracking-widest uppercase mb-4 block">Control Operativo</span>
            <h2 className="text-5xl md:text-6xl font-display font-bold text-white mb-8">Supervisión Continua. Control Total.</h2>
            <p className="text-xl text-muted-foreground mb-16 leading-relaxed">
              Cada puesto de ISP S.A. está respaldado por un sistema de supervisión que combina rondas físicas, reportes digitales y comunicación directa con el supervisor de zona. Nuestros clientes cuentan con visibilidad operativa en todo momento.
            </p>
          </FadeIn>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
            <FadeIn delay={0.1}>
              <div className="bg-background/40 backdrop-blur-md p-8 rounded-2xl border border-white/5 flex flex-col items-center">
                <Clock className="w-10 h-10 text-primary mb-4" />
                <h4 className="text-lg font-bold text-white mb-2">Monitoreo 24/7</h4>
                <p className="text-sm text-muted-foreground">Supervisores activos durante todos los turnos sin excepción</p>
              </div>
            </FadeIn>
            <FadeIn delay={0.2}>
              <div className="bg-background/40 backdrop-blur-md p-8 rounded-2xl border border-white/5 flex flex-col items-center">
                <BarChart3 className="w-10 h-10 text-primary mb-4" />
                <h4 className="text-lg font-bold text-white mb-2">Reportes de Operación</h4>
                <p className="text-sm text-muted-foreground">Informes ejecutivos entregados con la periodicidad que el cliente requiera</p>
              </div>
            </FadeIn>
            <FadeIn delay={0.3}>
              <div className="bg-background/40 backdrop-blur-md p-8 rounded-2xl border border-white/5 flex flex-col items-center">
                <Zap className="w-10 h-10 text-primary mb-4" />
                <h4 className="text-lg font-bold text-white mb-2">Respuesta a Incidencias</h4>
                <p className="text-sm text-muted-foreground">Protocolo de escalamiento inmediato ante cualquier evento crítico</p>
              </div>
            </FadeIn>
          </div>

          <FadeIn delay={0.4}>
            <p className="text-primary font-medium text-lg">Nos convertimos en la extensión operativa de su empresa de seguridad.</p>
          </FadeIn>
        </div>
      </section>

      {/* SECTION 7 — SECTORS */}
      <section className="py-24 bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <FadeIn>
            <div className="mb-16">
              <div className="divider-gold" />
              <h2 className="text-4xl md:text-5xl font-display font-bold text-white">Sectores que Atendemos</h2>
            </div>
          </FadeIn>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { icon: Factory, title: "Industria y Manufactura", desc: "Protección de plantas de producción, bodegas y centros de distribución con controles estrictos de acceso." },
              { icon: Truck, title: "Logística y Cadena de Suministro", desc: "Prevención de pérdidas en el traslado y almacenamiento de mercancías de alto valor." },
              { icon: Building2, title: "Comercio y Retail", desc: "Seguridad para centros comerciales y plazas, enfocada en la protección de activos y atención al cliente." },
              { icon: Target, title: "Sector Corporativo", desc: "Seguridad de perfil ejecutivo para edificios de oficinas e instalaciones empresariales." },
              { icon: Users, title: "Eventos Especiales", desc: "Despliegue táctico para control de multitudes y protección VIP en eventos de alta concurrencia." },
              { icon: MapPin, title: "Complejos Residenciales", desc: "Control perimetral y de accesos con protocolos diseñados para la tranquilidad de los residentes." }
            ].map((sector, index) => (
              <FadeIn key={index} delay={index * 0.1}>
                <div className="glass-panel p-6 rounded-xl flex flex-col h-full hover:border-b-primary hover:-translate-y-1 transition-all duration-300 border-b-2 border-b-transparent">
                  <sector.icon className="w-8 h-8 text-primary mb-4" />
                  <h4 className="text-lg font-bold text-white mb-2">{sector.title}</h4>
                  <p className="text-sm text-muted-foreground flex-grow">{sector.desc}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* SECTION 8 — CTA */}
      <section className="py-32 relative overflow-hidden bg-[#030811]">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/10 blur-[100px] rounded-full pointer-events-none" />
        
        <div className="max-w-4xl mx-auto px-4 relative z-10 text-center">
          <FadeIn>
            <Shield className="w-16 h-16 text-primary mx-auto mb-8" />
            <h2 className="text-4xl md:text-5xl font-display font-bold mb-6 text-white">Solicite una evaluación de seguridad sin costo</h2>
            <p className="text-xl text-muted-foreground mb-10 max-w-2xl mx-auto">
              Permítanos analizar las vulnerabilidades de su operación y presentarle una propuesta de valor enfocada en la mitigación de riesgos.
            </p>
            <div className="flex flex-col sm:flex-row justify-center items-center gap-4 mb-8">
              <Link href="/solicitar-servicio">
                <Button size="lg" className="h-14 px-8 rounded-full text-base font-semibold bg-primary text-[#050d1a] hover:bg-primary/90 w-full sm:w-auto">
                  Solicitar Evaluación
                </Button>
              </Link>
              <a href="https://wa.me/50250000000" target="_blank" rel="noopener noreferrer" className="w-full sm:w-auto">
                <Button size="lg" variant="outline" className="h-14 px-8 rounded-full text-base font-semibold border-primary text-primary hover:bg-primary/10 w-full">
                  Contactar por WhatsApp
                </Button>
              </a>
            </div>
            <p className="text-sm text-muted-foreground font-medium">Un ejecutivo de cuenta se comunicará en menos de 24 horas.</p>
          </FadeIn>
        </div>
      </section>
    </PageLayout>
  );
}
