import { PageLayout } from "@/components/layout/PageLayout";
import { FadeIn } from "@/components/animations/FadeIn";
import { Truck, Map, ShieldAlert, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { useCmsPage } from "@/hooks/useCmsPage";

export default function CustodiaTransporte() {
  const { c } = useCmsPage("custodia-transporte");

  const features = [
    {
      icon: ShieldAlert,
      title: "Escolta Armada",
      desc: "Agentes altamente capacitados en vehículos escolta para proteger transportes de alto valor y neutralizar amenazas.",
    },
    {
      icon: Map,
      title: "Evaluación de Rutas",
      desc: "Análisis previo de trayectos, identificación de zonas rojas y planificación de rutas alternas seguras.",
    },
    {
      icon: CheckCircle,
      title: "Control en Origen y Destino",
      desc: "Verificación de marchamos y precintos desde el punto de carga hasta la entrega final de la mercadería.",
    },
  ];

  const steps = [
    { step: "01", title: "Coordinación", desc: "Recepción del itinerario, asignación de unidad patrulla y agentes designados." },
    { step: "02", title: "Encuentro", desc: "Contacto con piloto de transporte, verificación de identidades e inspección visual de la carga." },
    { step: "03", title: "Tránsito", desc: "Escolta a distancia táctica, comunicación constante con el centro de control y reportes de ubicación." },
    { step: "04", title: "Entrega", desc: "Arribo al destino, firma de conformidad y reporte final de conclusión exitosa de servicio." },
  ];

  return (
    <PageLayout>
      <section className="relative pt-32 pb-32 overflow-hidden">
        <div className="absolute inset-0 z-0">
          <img
            src="https://pixabay.com/get/g6b4431eb7be59cc4f2df724cf6f0de6852241434b26759b04de91f79dbc93d0c2e9b95918081503fb59c839de7a2167122000907682e545b81b2b10ea7726d1b_1280.jpg"
            alt="Custodia de Transporte"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-background/90" />
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <FadeIn>
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/20 text-primary font-medium text-sm mb-6 border border-primary/30">
              <Truck className="w-4 h-4" />
              {c("hero_badge", "Logística Segura")}
            </div>
            <h1 className="text-4xl md:text-6xl font-bold mb-6">
              {c("hero_title", "Custodia de Transporte")}
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl leading-relaxed">
              {c("hero_subtitle", "Acompañamiento táctico para la protección de mercadería en tránsito. Minimizamos el riesgo de asalto, desvío o pérdida en las carreteras de Guatemala.")}
            </p>
          </FadeIn>
        </div>
      </section>

      <section className="py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-20">
            {features.map((item, i) => (
              <FadeIn key={i} delay={i * 0.1}>
                <div className="p-8 bg-card rounded-2xl border border-white/5 hover-elevate h-full">
                  <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center mb-6">
                    <item.icon className="w-7 h-7 text-primary" />
                  </div>
                  <h3 className="text-xl font-bold mb-3">{item.title}</h3>
                  <p className="text-muted-foreground">{item.desc}</p>
                </div>
              </FadeIn>
            ))}
          </div>

          <div className="bg-card p-10 lg:p-16 rounded-3xl border border-white/5">
            <div className="max-w-3xl mx-auto text-center">
              <FadeIn>
                <h2 className="text-3xl font-bold mb-6">
                  {c("process_title", "Proceso Operativo")}
                </h2>
                <p className="text-lg text-muted-foreground mb-12">
                  {c("process_subtitle", "Implementamos un protocolo estricto que no deja espacio a la improvisación.")}
                </p>
              </FadeIn>

              <div className="space-y-6 text-left">
                {steps.map((s, i) => (
                  <FadeIn key={i} delay={i * 0.1}>
                    <div className="flex gap-6 items-start">
                      <div className="w-12 h-12 rounded-full bg-primary text-primary-foreground font-display font-bold text-lg flex items-center justify-center shrink-0">
                        {s.step}
                      </div>
                      <div className="pt-2">
                        <h4 className="text-xl font-bold mb-2 text-white">{s.title}</h4>
                        <p className="text-muted-foreground">{s.desc}</p>
                      </div>
                    </div>
                  </FadeIn>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-20 bg-background border-t border-white/5 text-center">
        <div className="max-w-3xl mx-auto px-4">
          <FadeIn>
            <h2 className="text-3xl font-bold mb-6">
              {c("cta_title", "Proteja su cadena de suministro hoy")}
            </h2>
            <Link href="/solicitar-servicio">
              <Button size="lg" className="rounded-full px-8 h-14">
                Agendar Operación
              </Button>
            </Link>
          </FadeIn>
        </div>
      </section>
    </PageLayout>
  );
}
