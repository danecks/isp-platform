import { PageLayout } from "@/components/layout/PageLayout";
import { FadeIn } from "@/components/animations/FadeIn";
import { Shield, Lock, FileText, Activity, Server, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";

export default function AccesoClientes() {
  return (
    <PageLayout>
      <section className="min-h-[85vh] flex items-center py-20 bg-background relative overflow-hidden">
        {/* Background effects */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-primary/10 via-background to-background" />
        <div className="absolute top-0 right-0 w-1/2 h-1/2 bg-primary/5 blur-[100px] rounded-full pointer-events-none" />
        
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 w-full">
          <FadeIn className="text-center">
            <div className="w-20 h-20 mx-auto rounded-2xl bg-card border border-primary/20 flex items-center justify-center mb-8 shadow-xl shadow-primary/10">
              <Lock className="w-10 h-10 text-primary" />
            </div>
            
            <div className="inline-block px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-sm font-medium text-muted-foreground mb-6 uppercase tracking-widest">
              Plataforma Digital En Desarrollo
            </div>
            
            <h1 className="text-4xl md:text-6xl font-bold mb-6 text-white tracking-tight">
              Portal de <span className="text-gradient-gold">Clientes ISP</span>
            </h1>
            
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto mb-16 leading-relaxed">
              Estamos desarrollando una plataforma integral exclusiva para nuestros clientes corporativos, diseñada para brindar transparencia total y control operativo en tiempo real.
            </p>
          </FadeIn>

          <FadeIn delay={0.2}>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
              {[
                { icon: Activity, title: "Dashboard en Tiempo Real", desc: "Monitoreo del estado de operaciones y turnos cubiertos." },
                { icon: FileText, title: "Reportes Digitales", desc: "Acceso inmediato a bitácoras de servicio y reportes de incidencias." },
                { icon: Shield, title: "Métricas y KPIs", desc: "Análisis estadístico del nivel de riesgo e incidentes mitigados." },
                { icon: Server, title: "Gestión Administrativa", desc: "Control centralizado de facturación y requerimientos especiales." }
              ].map((feature, i) => (
                <div key={i} className="bg-card/50 p-6 rounded-2xl border border-white/5 text-left flex flex-col items-start hover:bg-card/80 transition-colors">
                  <feature.icon className="w-8 h-8 text-primary/80 mb-4" />
                  <h3 className="font-bold text-white mb-2">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground">{feature.desc}</p>
                </div>
              ))}
            </div>
          </FadeIn>

          <FadeIn delay={0.4} className="flex flex-col items-center">
            <p className="text-muted-foreground mb-6">
              ¿Es usted cliente actual y requiere reportes inmediatos?
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Link href="/contacto">
                <Button size="lg" className="rounded-full px-8 h-12">
                  Contactar a Operaciones
                </Button>
              </Link>
              <Link href="/">
                <Button variant="outline" size="lg" className="rounded-full px-8 h-12 bg-transparent border-white/20 text-white hover:bg-white/5">
                  Volver al Inicio
                </Button>
              </Link>
            </div>
          </FadeIn>
        </div>
      </section>
    </PageLayout>
  );
}
