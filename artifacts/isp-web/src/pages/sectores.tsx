import { PageLayout } from "@/components/layout/PageLayout";
import { FadeIn } from "@/components/animations/FadeIn";
import { Factory, Truck, ShoppingCart, Building2, Calendar, Home } from "lucide-react";

export default function Sectores() {
  const sectores = [
    {
      icon: Factory,
      title: "Industria y Manufactura",
      desc: "Protección de plantas de producción, control de personal masivo, protección de materia prima e instalaciones contra sabotaje o intrusión.",
    },
    {
      icon: Truck,
      title: "Logística y Transporte",
      desc: "Blindaje de la cadena de suministro, custodia de mercadería en ruta, vigilancia en centros de distribución y aduanas.",
    },
    {
      icon: ShoppingCart,
      title: "Comercio y Retail",
      desc: "Prevención de robo hormiga, resguardo de valores, atención a incidentes con clientes y protección de inventario en tienda.",
    },
    {
      icon: Building2,
      title: "Corporativo y Oficinas",
      desc: "Seguridad ejecutiva, control de visitantes, protección de información y mantenimiento del orden en entornos corporativos formales.",
    },
    {
      icon: Calendar,
      title: "Eventos Especiales",
      desc: "Agentes especializados para manejo de masas, controles de acceso temporales y protección VIP en eventos corporativos y privados.",
    },
    {
      icon: Home,
      title: "Residenciales y Condominios",
      desc: "Control de visitas, rondines perimetrales, atención a condóminos y respuesta inmediata ante emergencias domésticas.",
    }
  ];

  return (
    <PageLayout>
      <section className="pt-32 pb-20 bg-background relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
          <FadeIn>
            <h1 className="text-4xl md:text-6xl font-bold mb-6">Sectores que Atendemos</h1>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Nuestra experiencia nos permite adaptar los protocolos operativos a las vulnerabilidades específicas de cada modelo de negocio.
            </p>
          </FadeIn>
        </div>
      </section>

      <section className="py-12 pb-32">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {sectores.map((s, i) => (
              <FadeIn key={i} delay={i * 0.1}>
                <div className="bg-card p-8 rounded-2xl border border-white/5 hover-elevate h-full">
                  <div className="w-16 h-16 rounded-xl bg-primary/10 flex items-center justify-center mb-6">
                    <s.icon className="w-8 h-8 text-primary" />
                  </div>
                  <h3 className="text-2xl font-bold mb-4 text-white">{s.title}</h3>
                  <p className="text-muted-foreground leading-relaxed">
                    {s.desc}
                  </p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>
    </PageLayout>
  );
}
