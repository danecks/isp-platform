import { PageLayout } from "@/components/layout/PageLayout";
import { FadeIn } from "@/components/animations/FadeIn";
import { MapPin, Phone, Mail, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

export default function Contacto() {
  const { toast } = useToast();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    toast({
      title: "Mensaje enviado",
      description: "Gracias por contactarnos. Le responderemos a la brevedad.",
    });
    (e.target as HTMLFormElement).reset();
  };

  return (
    <PageLayout>
      <section className="pt-32 pb-20 bg-background relative overflow-hidden border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
          <FadeIn>
            <h1 className="text-4xl md:text-5xl font-bold mb-6">Contacto Institucional</h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Estamos a su disposición para resolver cualquier duda, requerimiento operativo o emergencia las 24 horas del día.
            </p>
          </FadeIn>
        </div>
      </section>

      <section className="py-20 pb-32">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
            
            <FadeIn>
              <div className="space-y-10">
                <h2 className="text-2xl font-bold mb-8">Información de Contacto</h2>
                
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <MapPin className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <h4 className="font-bold text-lg mb-1">Oficinas Centrales</h4>
                    <p className="text-muted-foreground">Centro Corporativo, Zona 10<br/>Ciudad de Guatemala, Guatemala</p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <Phone className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <h4 className="font-bold text-lg mb-1">Central Telefónica</h4>
                    <p className="text-muted-foreground">+502 2200-0000<br/>+502 2200-0001 (Emergencias)</p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <Mail className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <h4 className="font-bold text-lg mb-1">Correos Electrónicos</h4>
                    <p className="text-muted-foreground">contacto@isp-guatemala.com<br/>operaciones@isp-guatemala.com</p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <Clock className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <h4 className="font-bold text-lg mb-1">Horarios de Atención</h4>
                    <p className="text-muted-foreground">Administración: Lunes a Viernes 8:00 a 17:00<br/>Monitoreo y Operaciones: 24/7 los 365 días</p>
                  </div>
                </div>

                <div className="pt-6">
                  <a href="https://wa.me/50250000000" target="_blank" rel="noreferrer">
                    <Button size="lg" className="w-full sm:w-auto bg-[#25D366] hover:bg-[#25D366]/90 text-white font-bold h-14">
                      Contactar por WhatsApp
                    </Button>
                  </a>
                </div>
              </div>
            </FadeIn>

            <FadeIn delay={0.2}>
              <div className="bg-card p-8 md:p-10 rounded-2xl border border-white/5">
                <h2 className="text-2xl font-bold mb-6">Envíenos un mensaje</h2>
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">Nombre / Empresa</label>
                    <Input required placeholder="Escriba su nombre" className="h-12 bg-background border-white/10" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">Correo Electrónico</label>
                    <Input required type="email" placeholder="correo@ejemplo.com" className="h-12 bg-background border-white/10" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">Teléfono</label>
                    <Input required type="tel" placeholder="+502" className="h-12 bg-background border-white/10" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">Mensaje</label>
                    <Textarea required placeholder="¿Cómo podemos ayudarle?" className="h-32 bg-background border-white/10" />
                  </div>
                  <Button type="submit" size="lg" className="w-full h-14 font-bold text-base">
                    Enviar Mensaje
                  </Button>
                </form>
              </div>
            </FadeIn>

          </div>
        </div>
      </section>
    </PageLayout>
  );
}
