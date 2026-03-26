import { PageLayout } from "@/components/layout/PageLayout";
import { FadeIn } from "@/components/animations/FadeIn";
import { Target, Eye, ShieldAlert, Award } from "lucide-react";

export default function Nosotros() {
  return (
    <PageLayout>
      <section className="pt-32 pb-20 bg-card border-b border-white/5 relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1497366216548-37526070297c?q=80&w=2000&auto=format&fit=crop')] opacity-[0.03] bg-cover bg-center" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <FadeIn>
            <h1 className="text-4xl md:text-6xl font-bold mb-6">Sobre ISP, S.A.</h1>
            <p className="text-xl text-muted-foreground max-w-3xl">
              Nuestra trayectoria en la industria de la seguridad privada guatemalteca se fundamenta en el compromiso inquebrantable con la protección corporativa y la mejora continua.
            </p>
          </FadeIn>
        </div>
      </section>

      <section className="py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-16 mb-24">
            <FadeIn>
              <div className="bg-card p-10 rounded-2xl border border-white/5 hover-elevate">
                <Target className="w-12 h-12 text-primary mb-6" />
                <h2 className="text-3xl font-bold mb-4">Nuestra Misión</h2>
                <p className="text-muted-foreground leading-relaxed">
                  Proveer servicios de seguridad integral con los más altos estándares de profesionalismo, garantizando la integridad de los activos, el capital humano y la continuidad operativa de las empresas en Guatemala, a través de agentes capacitados, protocolos eficientes y supervisión constante.
                </p>
              </div>
            </FadeIn>
            <FadeIn delay={0.2}>
              <div className="bg-card p-10 rounded-2xl border border-white/5 hover-elevate">
                <Eye className="w-12 h-12 text-primary mb-6" />
                <h2 className="text-3xl font-bold mb-4">Nuestra Visión</h2>
                <p className="text-muted-foreground leading-relaxed">
                  Consolidarnos como la firma de seguridad privada más confiable y avanzada del país, reconocida no solo por la presencia de nuestros guardias, sino por liderar la integración tecnológica y operativa que redefine la mitigación de riesgos corporativos.
                </p>
              </div>
            </FadeIn>
          </div>

          <FadeIn>
            <h2 className="text-3xl md:text-4xl font-bold text-center mb-16">Valores Corporativos</h2>
          </FadeIn>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              { title: "Profesionalismo", desc: "Actuamos con disciplina y estricto apego a protocolos.", icon: Award },
              { title: "Integridad", desc: "Honestidad absoluta en nuestro proceder y reportes.", icon: ShieldAlert },
              { title: "Respuesta", desc: "Capacidad de reacción rápida ante cualquier incidencia.", icon: Target },
              { title: "Innovación", desc: "Búsqueda constante de herramientas para mejorar.", icon: Eye },
            ].map((v, i) => (
              <FadeIn key={i} delay={i * 0.1}>
                <div className="flex flex-col items-center text-center p-6">
                  <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-6">
                    <v.icon className="w-8 h-8 text-primary" />
                  </div>
                  <h3 className="text-xl font-bold mb-3">{v.title}</h3>
                  <p className="text-muted-foreground text-sm">{v.desc}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>
    </PageLayout>
  );
}
