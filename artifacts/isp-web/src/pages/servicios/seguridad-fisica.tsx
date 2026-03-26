import { PageLayout } from "@/components/layout/PageLayout";
import { FadeIn } from "@/components/animations/FadeIn";
import { CheckCircle, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";

export default function SeguridadFisica() {
  return (
    <PageLayout>
      <section className="relative pt-32 pb-32 overflow-hidden">
        <div className="absolute inset-0 z-0">
          {/* corporate security guard at modern building */}
          <img 
            src="https://pixabay.com/get/gce61a525c15fa2242ef7ec9a7bec7316f67b5003bf153b04c64053ab90187a55ab1c8437dce95dccf077bab0402b32fbbe63c77e38bbc1354143721609f76fec_1280.jpg" 
            alt="Seguridad Física" 
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-background/90" />
        </div>
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <FadeIn>
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/20 text-primary font-medium text-sm mb-6 border border-primary/30">
              <ShieldCheck className="w-4 h-4" /> Servicio Especializado
            </div>
            <h1 className="text-4xl md:text-6xl font-bold mb-6">Seguridad Física</h1>
            <p className="text-xl text-muted-foreground max-w-2xl leading-relaxed">
              Presencia profesional y disuasiva en sus instalaciones. Agentes rigurosamente seleccionados, entrenados y supervisados para proteger su patrimonio y personal.
            </p>
          </FadeIn>
        </div>
      </section>

      <section className="py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
            <div>
              <FadeIn>
                <h2 className="text-3xl font-bold mb-8">¿Qué incluye nuestro servicio?</h2>
                <div className="space-y-6">
                  {[
                    "Control de accesos peatonales y vehiculares",
                    "Rondines de vigilancia programados y aleatorios",
                    "Agentes armados y desarmados según evaluación de riesgo",
                    "Registro y reporte de incidencias en bitácora operativa",
                    "Supervisión física por parte de jefes de zona 24/7",
                    "Verificación de seguridad en zonas críticas y vulnerables"
                  ].map((item, i) => (
                    <div key={i} className="flex gap-4 p-4 rounded-xl bg-card border border-white/5">
                      <CheckCircle className="w-6 h-6 text-primary shrink-0" />
                      <span className="text-foreground/90">{item}</span>
                    </div>
                  ))}
                </div>
              </FadeIn>
            </div>
            
            <div className="space-y-12">
              <FadeIn delay={0.2}>
                <h3 className="text-2xl font-bold mb-6">Perfil de nuestros agentes</h3>
                <p className="text-muted-foreground mb-6">
                  Todo el personal de ISP, S.A. atraviesa estrictos filtros de seguridad: pruebas psicométricas, estudio socioeconómico, carencia de antecedentes penales y policíacos, e inducción corporativa antes de pisar un puesto de servicio.
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-6 bg-card rounded-xl border border-white/5 text-center">
                    <span className="block text-2xl font-display font-bold text-primary mb-2">100%</span>
                    <span className="text-sm text-muted-foreground">Personal Depurado</span>
                  </div>
                  <div className="p-6 bg-card rounded-xl border border-white/5 text-center">
                    <span className="block text-2xl font-display font-bold text-primary mb-2">24h</span>
                    <span className="text-sm text-muted-foreground">Respaldo Operativo</span>
                  </div>
                </div>
              </FadeIn>

              <FadeIn delay={0.3}>
                <div className="p-8 bg-primary/10 border border-primary/20 rounded-2xl">
                  <h3 className="text-xl font-bold mb-4 text-white">Ideal para:</h3>
                  <ul className="grid grid-cols-2 gap-3 text-muted-foreground text-sm">
                    <li>• Parques Industriales</li>
                    <li>• Centros de Distribución</li>
                    <li>• Edificios Corporativos</li>
                    <li>• Comercio Retail</li>
                    <li>• Condominios Premium</li>
                    <li>• Centros Educativos</li>
                  </ul>
                </div>
              </FadeIn>
            </div>
          </div>
        </div>
      </section>

      <section className="py-20 bg-card border-t border-white/5 text-center">
        <div className="max-w-3xl mx-auto px-4">
          <FadeIn>
            <h2 className="text-3xl font-bold mb-6">Asegure la continuidad de sus operaciones</h2>
            <Link href="/solicitar-servicio">
              <Button size="lg" className="rounded-full px-8 h-14">
                Solicitar Cotización
              </Button>
            </Link>
          </FadeIn>
        </div>
      </section>
    </PageLayout>
  );
}
