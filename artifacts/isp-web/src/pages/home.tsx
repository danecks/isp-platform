import { Link } from "wouter";
import { ArrowRight, ShieldCheck, Truck, Users, Activity, CheckCircle, Navigation, Map, Lock, Building2, Factory, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FadeIn } from "@/components/animations/FadeIn";
import { PageLayout } from "@/components/layout/PageLayout";

export default function Home() {
  return (
    <PageLayout>
      {/* HERO SECTION */}
      <section className="relative min-h-screen flex items-center pt-20 overflow-hidden">
        <div className="absolute inset-0 z-0">
          {/* landing page hero dark corporate security guards professional */}
          <img 
            src="https://pixabay.com/get/g844cabc50db0033740297b1b6ce59567ab6409af1029b0428ded0e459ee573ca6dd3e9361e107091a758526ec13d0e406945d8712f8ee75bac10ceae79f2ad67_1280.jpg" 
            alt="Corporate Security" 
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-background/90" />
          <div className="absolute inset-0 bg-gradient-to-r from-background via-background/80 to-transparent" />
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 w-full">
          <div className="max-w-3xl">
            <FadeIn delay={0.1}>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary font-medium text-sm mb-6">
                <Shield className="w-4 h-4" />
                Empresa Líder en Seguridad en Guatemala
              </div>
            </FadeIn>
            
            <FadeIn delay={0.2}>
              <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold leading-tight mb-6">
                Protección Profesional para <span className="text-gradient-gold">Empresas</span> en Guatemala.
              </h1>
            </FadeIn>

            <FadeIn delay={0.3}>
              <p className="text-lg md:text-xl text-muted-foreground mb-10 max-w-2xl leading-relaxed">
                Seguridad física especializada, custodia de transporte y operaciones móviles.
                Contamos con un equipo de más de 400 agentes activos listos para proteger sus activos más importantes.
              </p>
            </FadeIn>

            <FadeIn delay={0.4} className="flex flex-col sm:flex-row gap-4">
              <Link href="/solicitar-servicio">
                <Button size="lg" className="w-full sm:w-auto h-14 px-8 rounded-full text-base font-semibold shadow-lg shadow-primary/20">
                  Solicitar Evaluación <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
              </Link>
              <Button size="lg" variant="outline" className="w-full sm:w-auto h-14 px-8 rounded-full text-base font-semibold border-white/20 hover:bg-white/5">
                Contactar por WhatsApp
              </Button>
            </FadeIn>
          </div>
        </div>
      </section>

      {/* STATS STRIP */}
      <div className="relative z-20 -mt-16 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <FadeIn delay={0.5}>
          <div className="glass-panel rounded-2xl p-8 grid grid-cols-2 md:grid-cols-4 gap-8 divide-x divide-white/10">
            <div className="flex flex-col items-center justify-center text-center">
              <span className="text-4xl font-display font-bold text-primary mb-2">+400</span>
              <span className="text-sm font-medium text-muted-foreground">Agentes Activos</span>
            </div>
            <div className="flex flex-col items-center justify-center text-center">
              <span className="text-4xl font-display font-bold text-primary mb-2">100%</span>
              <span className="text-sm font-medium text-muted-foreground">Cobertura Nacional</span>
            </div>
            <div className="flex flex-col items-center justify-center text-center">
              <span className="text-4xl font-display font-bold text-primary mb-2">24/7</span>
              <span className="text-sm font-medium text-muted-foreground">Respuesta Rápida</span>
            </div>
            <div className="flex flex-col items-center justify-center text-center">
              <span className="text-4xl font-display font-bold text-primary mb-2">+15</span>
              <span className="text-sm font-medium text-muted-foreground">Años de Experiencia</span>
            </div>
          </div>
        </FadeIn>
      </div>

      {/* SERVICES SECTION */}
      <section className="py-24 bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <FadeIn>
            <div className="text-center max-w-3xl mx-auto mb-16">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">Líneas de Servicio</h2>
              <p className="text-muted-foreground">
                Desarrollamos estrategias integrales adaptadas a los niveles de riesgo y requerimientos específicos de cada industria.
              </p>
            </div>
          </FadeIn>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FadeIn delay={0.1}>
              <div className="group bg-card rounded-2xl p-8 border border-white/5 hover-elevate h-full flex flex-col">
                <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center mb-6">
                  <ShieldCheck className="w-7 h-7 text-primary" />
                </div>
                <h3 className="text-2xl font-bold mb-3">Seguridad Física</h3>
                <p className="text-muted-foreground mb-8 flex-grow">
                  Agentes profesionales, armados y desarmados, entrenados para el control de accesos, vigilancia y protección de instalaciones corporativas, industriales y residenciales.
                </p>
                <Link href="/servicios/seguridad-fisica" className="text-primary font-medium flex items-center gap-2 group-hover:gap-3 transition-all">
                  Conocer más <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </FadeIn>

            <FadeIn delay={0.2}>
              <div className="group bg-card rounded-2xl p-8 border border-white/5 hover-elevate h-full flex flex-col">
                <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center mb-6">
                  <Truck className="w-7 h-7 text-primary" />
                </div>
                <h3 className="text-2xl font-bold mb-3">Custodia de Transporte</h3>
                <p className="text-muted-foreground mb-8 flex-grow">
                  Escoltas especializadas para proteger la cadena de suministro. Unidades de reacción, seguimiento satelital y protocolos estrictos para asegurar que la carga llegue a su destino.
                </p>
                <Link href="/servicios/custodia-transporte" className="text-primary font-medium flex items-center gap-2 group-hover:gap-3 transition-all">
                  Conocer más <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </FadeIn>

            <FadeIn delay={0.3}>
              <div className="group bg-card rounded-2xl p-8 border border-white/5 hover-elevate h-full flex flex-col">
                <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center mb-6">
                  <Users className="w-7 h-7 text-primary" />
                </div>
                <h3 className="text-2xl font-bold mb-3">Operaciones Móviles</h3>
                <p className="text-muted-foreground mb-8 flex-grow">
                  Unidades patrulla motorizadas para respuesta inmediata y vigilancia perimetral extendida, disuadiendo amenazas antes de que escalen.
                </p>
                <Link href="/servicios" className="text-primary font-medium flex items-center gap-2 group-hover:gap-3 transition-all">
                  Conocer más <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </FadeIn>

            <FadeIn delay={0.4}>
              <div className="group bg-card rounded-2xl p-8 border border-white/5 hover-elevate h-full flex flex-col">
                <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center mb-6">
                  <Activity className="w-7 h-7 text-primary" />
                </div>
                <h3 className="text-2xl font-bold mb-3">Supervisión y Control</h3>
                <p className="text-muted-foreground mb-8 flex-grow">
                  Centro de monitoreo activo que respalda a nuestros agentes de campo, gestionando incidencias en tiempo real y generando reportes operativos para el cliente.
                </p>
                <Link href="/servicios" className="text-primary font-medium flex items-center gap-2 group-hover:gap-3 transition-all">
                  Conocer más <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </FadeIn>
          </div>
        </div>
      </section>

      {/* DIFFERENTIALS SECTION */}
      <section className="py-24 bg-card/50 border-y border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <FadeIn>
                <h2 className="text-3xl md:text-4xl font-bold mb-6">¿Por qué elegir ISP S.A.?</h2>
                <p className="text-lg text-muted-foreground mb-8">
                  Nuestra filosofía no se basa solo en proveer guardias, sino en implementar un sistema integral de seguridad donde la supervisión, el entrenamiento y la tecnología garantizan la continuidad de su negocio.
                </p>
              </FadeIn>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {[
                  "Agentes rigurosamente filtrados y capacitados",
                  "Supervisión física 24/7 de todos los puestos",
                  "Capacidad de respuesta a nivel nacional",
                  "Protocolos estrictos de manejo de crisis",
                  "Reportes ejecutivos de incidencias",
                  "Visión tecnológica y mejora continua",
                ].map((point, index) => (
                  <FadeIn key={index} delay={index * 0.1}>
                    <div className="flex items-start gap-3">
                      <CheckCircle className="w-6 h-6 text-primary shrink-0" />
                      <span className="font-medium text-foreground/90">{point}</span>
                    </div>
                  </FadeIn>
                ))}
              </div>
            </div>
            
            <div className="relative">
              <FadeIn delay={0.3} direction="left">
                <div className="aspect-[4/5] rounded-3xl overflow-hidden relative">
                  {/* corporate security command center abstract */}
                  <img 
                    src="https://images.unsplash.com/photo-1550751827-4bd374c3f58b?q=80&w=1000&auto=format&fit=crop" 
                    alt="Centro de Operaciones"
                    className="w-full h-full object-cover" 
                  />
                  <div className="absolute inset-0 bg-background/40 mix-blend-multiply" />
                  <div className="absolute inset-0 border border-white/10 rounded-3xl" />
                </div>
              </FadeIn>
            </div>
          </div>
        </div>
      </section>

      {/* CTA SECTION */}
      <section className="py-32 relative overflow-hidden">
        <div className="absolute inset-0 bg-primary/5" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/20 blur-[120px] rounded-full pointer-events-none" />
        
        <div className="max-w-4xl mx-auto px-4 relative z-10 text-center">
          <FadeIn>
            <Shield className="w-16 h-16 text-primary mx-auto mb-8" />
            <h2 className="text-4xl md:text-5xl font-bold mb-6 text-white">¿Listo para proteger lo que más importa?</h2>
            <p className="text-xl text-muted-foreground mb-10">
              Contáctenos hoy mismo para recibir una evaluación de riesgos sin costo y descubrir cómo podemos blindar la operación de su empresa.
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-4">
              <Link href="/solicitar-servicio">
                <Button size="lg" className="h-14 px-8 rounded-full text-base font-semibold">
                  Solicitar evaluación gratuita
                </Button>
              </Link>
            </div>
          </FadeIn>
        </div>
      </section>
    </PageLayout>
  );
}
