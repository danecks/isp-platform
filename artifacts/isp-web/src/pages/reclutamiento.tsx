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
import { ShieldCheck, UserPlus } from "lucide-react";
import { applicationsApi } from "@/lib/api";

const formSchema = z.object({
  fullName: z.string().min(4, "Ingrese su nombre completo"),
  dpi: z.string().min(13, "Ingrese un DPI válido"),
  phone: z.string().min(8, "Ingrese un teléfono válido"),
  email: z.string().email("Correo inválido"),
  location: z.string().min(4, "Ingrese su municipio/departamento"),
  experience: z.string().min(1, "Seleccione su experiencia"),
  position: z.string().min(1, "Seleccione el puesto"),
  gunLicense: z.string().min(1, "Indique si tiene licencia"),
  message: z.string().optional(),
});

export default function Reclutamiento() {
  const { toast } = useToast();
  
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      fullName: "",
      dpi: "",
      phone: "",
      email: "",
      location: "",
      experience: "",
      position: "",
      gunLicense: "",
      message: "",
    }
  });

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    try {
      await applicationsApi.create({
        nombre: values.fullName,
        telefono: values.phone,
        correo: values.email,
        experiencia: values.experience,
        ubicacion: values.location,
        puesto: values.position,
        canal: "web",
        notas: values.gunLicense ? `Licencia de armas: ${values.gunLicense}. ${values.message ?? ""}` : values.message,
      });
      toast({
        title: "Solicitud enviada correctamente",
        description: "Recursos Humanos evaluará su perfil y se pondrá en contacto.",
        duration: 5000,
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
      <section className="pt-32 pb-20 bg-background relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
          <FadeIn>
            <UserPlus className="w-12 h-12 text-primary mx-auto mb-6" />
            <h1 className="text-4xl md:text-5xl font-bold mb-6">Únete al Equipo ISP, S.A.</h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Buscamos personas íntegras, disciplinadas y con vocación de servicio para formar parte de la élite de seguridad en Guatemala.
            </p>
          </FadeIn>
        </div>
      </section>

      <section className="py-12 pb-32">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
            
            <div className="lg:col-span-1 space-y-8">
              <FadeIn>
                <div className="bg-card p-8 rounded-2xl border border-white/5">
                  <h3 className="text-xl font-bold mb-6">Requisitos de Contratación</h3>
                  <ul className="space-y-4 text-muted-foreground">
                    <li className="flex gap-3"><ShieldCheck className="w-5 h-5 text-primary shrink-0" /> Edad de 20 a 45 años.</li>
                    <li className="flex gap-3"><ShieldCheck className="w-5 h-5 text-primary shrink-0" /> Estatura mínima: 1.65m.</li>
                    <li className="flex gap-3"><ShieldCheck className="w-5 h-5 text-primary shrink-0" /> Educación mínima: Sexto primaria.</li>
                    <li className="flex gap-3"><ShieldCheck className="w-5 h-5 text-primary shrink-0" /> Carencia de antecedentes (Recientes).</li>
                    <li className="flex gap-3"><ShieldCheck className="w-5 h-5 text-primary shrink-0" /> Cartas de recomendación laboral.</li>
                    <li className="flex gap-3"><ShieldCheck className="w-5 h-5 text-primary shrink-0" /> Excelente presentación y actitud.</li>
                  </ul>
                </div>
              </FadeIn>
              <FadeIn delay={0.2}>
                <div className="bg-primary/10 p-8 rounded-2xl border border-primary/20">
                  <h3 className="text-xl font-bold mb-4 text-white">Beneficios</h3>
                  <ul className="space-y-3 text-muted-foreground">
                    <li>• Salario puntual y prestaciones de ley</li>
                    <li>• Seguro de vida</li>
                    <li>• Uniforme y equipo sin costo</li>
                    <li>• Capacitación constante</li>
                    <li>• Oportunidad de crecimiento</li>
                  </ul>
                </div>
              </FadeIn>
            </div>

            <div className="lg:col-span-2">
              <FadeIn delay={0.1}>
                <div className="bg-card p-8 md:p-12 rounded-2xl border border-white/5">
                  <h2 className="text-2xl font-bold mb-8">Formulario de Aplicación</h2>
                  
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <FormField
                          control={form.control}
                          name="fullName"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Nombre Completo</FormLabel>
                              <FormControl><Input placeholder="Juan Pérez" {...field} /></FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="dpi"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>CUI / DPI</FormLabel>
                              <FormControl><Input placeholder="1234 56789 0101" {...field} /></FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="phone"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Teléfono Celular</FormLabel>
                              <FormControl><Input type="tel" placeholder="5555-5555" {...field} /></FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="email"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Correo Electrónico</FormLabel>
                              <FormControl><Input type="email" placeholder="juan@ejemplo.com" {...field} /></FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="location"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Municipio / Departamento</FormLabel>
                              <FormControl><Input placeholder="Zona 1, Guatemala" {...field} /></FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="experience"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Experiencia Previa</FormLabel>
                              <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                  <SelectTrigger><SelectValue placeholder="Seleccione opción" /></SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="none">Sin experiencia</SelectItem>
                                  <SelectItem value="1-2">1 - 2 años</SelectItem>
                                  <SelectItem value="3-5">3 - 5 años</SelectItem>
                                  <SelectItem value="5+">Más de 5 años</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="position"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Puesto de Interés</FormLabel>
                              <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                  <SelectTrigger><SelectValue placeholder="Seleccione puesto" /></SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="guard">Agente de Seguridad Física</SelectItem>
                                  <SelectItem value="custody">Agente de Custodia</SelectItem>
                                  <SelectItem value="mobile">Agente Móvil (Patrullero)</SelectItem>
                                  <SelectItem value="supervisor">Supervisor de Zona</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="gunLicense"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>¿Tiene Licencia de Armas DIGECAM?</FormLabel>
                              <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                  <SelectTrigger><SelectValue placeholder="Seleccione opción" /></SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="yes">Sí, vigente</SelectItem>
                                  <SelectItem value="no">No</SelectItem>
                                  <SelectItem value="process">En trámite</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      
                      <FormField
                        control={form.control}
                        name="message"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Información Adicional (Opcional)</FormLabel>
                            <FormControl>
                              <Textarea placeholder="Breve descripción de su experiencia o disponibilidad..." className="h-24" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <Button type="submit" size="lg" className="w-full h-14 text-base font-bold mt-4">
                        Enviar Aplicación
                      </Button>
                    </form>
                  </Form>
                </div>
              </FadeIn>
            </div>

          </div>
        </div>
      </section>
    </PageLayout>
  );
}
