import { PageLayout } from "@/components/layout/PageLayout";
import { FadeIn } from "@/components/animations/FadeIn";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building, ShieldCheck } from "lucide-react";
import { leadsApi } from "@/lib/api";

const formSchema = z.object({
  company: z.string().min(2, "Nombre de la empresa es requerido"),
  contact: z.string().min(2, "Nombre del contacto es requerido"),
  position: z.string().min(2, "Cargo es requerido"),
  phone: z.string().min(8, "Teléfono válido requerido"),
  email: z.string().email("Correo electrónico inválido"),
  serviceType: z.string().min(1, "Debe seleccionar un servicio"),
  location: z.string().min(4, "Ubicación es requerida"),
  agentsCount: z.string().min(1, "Indique cantidad estimada"),
  details: z.string().min(10, "Por favor detalle su requerimiento"),
});

export default function SolicitarServicio() {
  const { toast } = useToast();
  
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      company: "",
      contact: "",
      position: "",
      phone: "",
      email: "",
      serviceType: "",
      location: "",
      agentsCount: "",
      details: "",
    }
  });

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    try {
      await leadsApi.create({
        empresa: values.company,
        contacto: `${values.contact} (${values.position})`,
        telefono: values.phone,
        correo: values.email,
        servicio: `${values.serviceType} — ${values.agentsCount} agentes`,
        ubicacion: values.location,
        canal: "web",
        notas: values.details,
      });
      toast({
        title: "Solicitud de Evaluación Recibida",
        description: "Un ejecutivo de cuentas corporativas se comunicará con usted en menos de 24 horas.",
        duration: 6000,
      });
      form.reset();
    } catch {
      toast({
        title: "Error al enviar",
        description: "Intente nuevamente o contáctenos por WhatsApp.",
        variant: "destructive",
        duration: 5000,
      });
    }
  };

  return (
    <PageLayout>
      <section className="pt-32 pb-20 bg-background relative overflow-hidden border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <FadeIn>
            <div className="max-w-3xl">
              <Building className="w-12 h-12 text-primary mb-6" />
              <h1 className="text-4xl md:text-5xl font-bold mb-6">Solicitar Evaluación de Seguridad</h1>
              <p className="text-xl text-muted-foreground">
                Diseñamos esquemas de seguridad corporativa adaptados a la realidad de su empresa. Por favor, comparta los detalles iniciales de su requerimiento para agendar una consultoría sin costo.
              </p>
            </div>
          </FadeIn>
        </div>
      </section>

      <section className="py-20 pb-32">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <FadeIn delay={0.1}>
            <div className="bg-card p-8 md:p-12 rounded-2xl border border-white/5 shadow-2xl">
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                  
                  <div className="space-y-4">
                    <h3 className="text-lg font-bold border-b border-white/10 pb-2 mb-4">Datos de la Empresa</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <FormField
                        control={form.control}
                        name="company"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Nombre de la Empresa</FormLabel>
                            <FormControl><Input placeholder="Su Empresa S.A." {...field} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="location"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Ubicación / Departamento</FormLabel>
                            <FormControl><Input placeholder="Ciudad, Zona..." {...field} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-lg font-bold border-b border-white/10 pb-2 mb-4">Datos de Contacto</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <FormField
                        control={form.control}
                        name="contact"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Nombre del Solicitante</FormLabel>
                            <FormControl><Input placeholder="Lic. Juan Pérez" {...field} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="position"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Cargo / Puesto</FormLabel>
                            <FormControl><Input placeholder="Gerente de Operaciones" {...field} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="phone"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Teléfono Directo</FormLabel>
                            <FormControl><Input type="tel" placeholder="+502 0000-0000" {...field} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Correo Corporativo</FormLabel>
                            <FormControl><Input type="email" placeholder="jperez@empresa.com" {...field} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-lg font-bold border-b border-white/10 pb-2 mb-4">Detalles del Requerimiento</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <FormField
                        control={form.control}
                        name="serviceType"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Tipo de Servicio Principal</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger><SelectValue placeholder="Seleccione opción" /></SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="fisica">Seguridad Física</SelectItem>
                                <SelectItem value="custodia">Custodia de Transporte</SelectItem>
                                <SelectItem value="movil">Operaciones Móviles</SelectItem>
                                <SelectItem value="mixto">Servicio Combinado</SelectItem>
                                <SelectItem value="ns">No definido aún</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="agentsCount"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Cantidad de Agentes Estimada</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger><SelectValue placeholder="Seleccione rango" /></SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="1-5">1 a 5 agentes</SelectItem>
                                <SelectItem value="6-15">6 a 15 agentes</SelectItem>
                                <SelectItem value="16-30">16 a 30 agentes</SelectItem>
                                <SelectItem value="30+">Más de 30 agentes</SelectItem>
                                <SelectItem value="ns">Por evaluar</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <FormField
                      control={form.control}
                      name="details"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Descripción de la Necesidad</FormLabel>
                          <FormControl>
                            <Textarea placeholder="Indique horarios, tipo de instalación, riesgos detectados u otros comentarios relevantes..." className="h-32" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="pt-4">
                    <Button type="submit" size="lg" className="w-full h-14 text-base font-bold bg-primary text-black hover:bg-primary/90">
                      <ShieldCheck className="w-5 h-5 mr-2" />
                      Solicitar Evaluación
                    </Button>
                    <p className="text-center text-xs text-muted-foreground mt-4">
                      Toda la información proporcionada es manejada bajo estricto acuerdo de confidencialidad.
                    </p>
                  </div>

                </form>
              </Form>
            </div>
          </FadeIn>
        </div>
      </section>
    </PageLayout>
  );
}
