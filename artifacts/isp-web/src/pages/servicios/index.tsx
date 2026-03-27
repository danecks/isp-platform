import { PageLayout } from "@/components/layout/PageLayout";
import { FadeIn } from "@/components/animations/FadeIn";
import { ShieldCheck, Truck, Users, Activity, ArrowRight } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { useCmsPage } from "@/hooks/useCmsPage";

export default function Servicios() {
  const { c } = useCmsPage("servicios");

  const services = [
    {
      icon: ShieldCheck,
      title: c("s1_title", "Seguridad Física"),
      desc: c("s1_desc", "Protección experta para instalaciones corporativas, industriales y residenciales con agentes armados y desarmados rigurosamente seleccionados."),
      path: "/servicios/seguridad-fisica",
    },
    {
      icon: Truck,
      title: c("s2_title", "Custodia de Transporte"),
      desc: c("s2_desc", "Escoltas especializadas para garantizar que sus activos críticos viajen seguros a lo largo de toda la cadena de suministro nacional."),
      path: "/servicios/custodia-transporte",
    },
    {
      icon: Users,
      title: c("s3_title", "Operaciones Móviles"),
      desc: c("s3_desc", "Unidades patrulla y reacción rápida para supervisión de perímetro, atención a emergencias y presencia disuasiva puntual."),
      path: "/contacto",
    },
    {
      icon: Activity,
      title: c("s4_title", "Supervisión y Control"),
      desc: c("s4_desc", "Gestión centralizada para el monitoreo de unidades, levantamiento de partes de novedad y coordinación operativa ininterrumpida."),
      path: "/contacto",
    },
  ];

  return (
    <PageLayout>
      <section className="pt-32 pb-20 bg-background relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
          <FadeIn>
            <h1 className="text-4xl md:text-6xl font-bold mb-6">
              {c("hero_title", "Nuestros Servicios")}
            </h1>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              {c("hero_subtitle", "Estrategias de seguridad a la medida, ejecutadas por profesionales capacitados para mantener su empresa siempre protegida.")}
            </p>
          </FadeIn>
        </div>
      </section>

      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {services.map((s, i) => (
              <FadeIn key={i} delay={i * 0.1}>
                <div className="bg-card p-10 rounded-2xl border border-white/5 hover-elevate h-full flex flex-col group">
                  <div className="w-16 h-16 rounded-xl bg-primary/10 flex items-center justify-center mb-6">
                    <s.icon className="w-8 h-8 text-primary" />
                  </div>
                  <h2 className="text-3xl font-bold mb-4">{s.title}</h2>
                  <p className="text-muted-foreground mb-8 flex-grow text-lg">{s.desc}</p>
                  <Link href={s.path}>
                    <Button variant="outline" className="group-hover:bg-primary group-hover:text-primary-foreground group-hover:border-primary transition-all">
                      Ver Detalles <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </Link>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>
    </PageLayout>
  );
}
