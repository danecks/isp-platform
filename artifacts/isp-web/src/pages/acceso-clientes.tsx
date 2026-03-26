import { useState } from "react";
import { useLocation } from "wouter";
import { PageLayout } from "@/components/layout/PageLayout";
import { FadeIn } from "@/components/animations/FadeIn";
import { useAuth } from "@/contexts/AuthContext";
import {
  Shield,
  Lock,
  FileText,
  Activity,
  Server,
  MessageSquare,
  Trello,
  AlertTriangle,
  Users,
  BarChart3,
  ChevronRight,
  ArrowRight,
  Eye,
  EyeOff,
  User,
  LogIn,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link } from "wouter";

function LoginPanel() {
  const [, navigate] = useLocation();
  const { login, isAuthenticated } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (isAuthenticated) {
    return (
      <div className="bg-[#07111f] border border-primary/20 rounded-2xl p-8 text-center shadow-2xl">
        <div className="w-14 h-14 mx-auto rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center mb-4">
          <Shield className="w-7 h-7 text-primary" />
        </div>
        <h3 className="font-bold text-white text-lg mb-2">Sesión Activa</h3>
        <p className="text-sm text-muted-foreground mb-6">Ya tiene una sesión iniciada en el sistema.</p>
        <Button
          onClick={() => navigate("/admin/dashboard")}
          className="w-full h-11 bg-primary text-[#050d1a] font-bold hover:bg-primary/90 rounded-lg"
        >
          Ir al Dashboard <ArrowRight className="ml-2 w-4 h-4" />
        </Button>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    await new Promise((r) => setTimeout(r, 600));
    const ok = login(username, password);
    setLoading(false);
    if (ok) {
      navigate("/admin/dashboard");
    } else {
      setError("Usuario o contraseña incorrectos.");
    }
  };

  return (
    <div className="bg-[#07111f] border border-white/8 rounded-2xl p-8 shadow-2xl">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-primary/15 border border-primary/20 flex items-center justify-center">
          <LogIn className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h3 className="font-bold text-white text-base">Acceso al Portal</h3>
          <p className="text-xs text-muted-foreground">Personal autorizado ISP S.A.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="portal-user" className="text-xs text-white/60 font-medium">Usuario</Label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              id="portal-user"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Nombre de usuario"
              className="pl-10 bg-[#060e1c] border-white/10 text-white placeholder:text-white/25 focus:border-primary/50 h-10"
              required
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="portal-pass" className="text-xs text-white/60 font-medium">Contraseña</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              id="portal-pass"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="pl-10 pr-10 bg-[#060e1c] border-white/10 text-white placeholder:text-white/25 focus:border-primary/50 h-10"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-white transition-colors"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 bg-red-950/40 border border-red-500/20 rounded-lg px-3 py-2.5">
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
            <p className="text-xs text-red-400">{error}</p>
          </div>
        )}

        <Button
          type="submit"
          disabled={loading}
          className="w-full h-10 bg-primary text-[#050d1a] font-bold hover:bg-primary/90 rounded-lg mt-1"
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <span className="w-3.5 h-3.5 border-2 border-[#050d1a]/30 border-t-[#050d1a] rounded-full animate-spin" />
              Verificando...
            </span>
          ) : (
            <>Ingresar al Sistema <ArrowRight className="ml-2 w-4 h-4" /></>
          )}
        </Button>
      </form>

      <p className="text-xs text-muted-foreground text-center mt-5">
        Acceso exclusivo para operaciones autorizadas
      </p>
    </div>
  );
}

export default function AccesoClientes() {
  return (
    <PageLayout>
      {/* HERO — Portal con Login */}
      <section className="pt-32 pb-20 bg-background relative overflow-hidden border-b border-white/5">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-primary/8 via-background to-background pointer-events-none" />
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/5 blur-[120px] rounded-full pointer-events-none" />

        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            {/* Left: Info */}
            <FadeIn>
              <div className="inline-block px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs font-semibold text-muted-foreground mb-6 uppercase tracking-widest">
                Portal Operativo · ISP S.A.
              </div>

              <h1 className="text-4xl md:text-5xl font-display font-bold mb-6 text-white tracking-tight">
                Portal de <span className="text-gradient-gold">Clientes ISP</span>
              </h1>

              <p className="text-lg text-muted-foreground mb-6 leading-relaxed">
                Acceso exclusivo al sistema de operaciones internas. Visibilidad total del servicio, gestión de incidencias y reportes operativos en tiempo real.
              </p>

              <ul className="space-y-3 mb-8">
                {[
                  "Dashboard de operaciones en tiempo real",
                  "Gestión y seguimiento de incidencias",
                  "Reportes y métricas de seguridad (KPIs)",
                  "Control de custodias y reclutamiento",
                ].map((item, i) => (
                  <li key={i} className="flex items-center gap-3 text-sm text-white/70">
                    <Shield className="w-4 h-4 text-primary shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>

              <div className="flex flex-col sm:flex-row gap-3">
                <Link href="/contacto">
                  <Button size="sm" variant="outline" className="rounded-full px-6 bg-transparent border-white/20 text-white hover:bg-white/5">
                    Contactar Operaciones
                  </Button>
                </Link>
                <a href="https://wa.me/50250000000" target="_blank" rel="noreferrer">
                  <Button size="sm" variant="outline" className="rounded-full px-6 bg-transparent border-white/20 text-white hover:bg-white/5">
                    <MessageSquare className="w-4 h-4 mr-2" /> WhatsApp
                  </Button>
                </a>
              </div>
            </FadeIn>

            {/* Right: Login Panel */}
            <FadeIn delay={0.15}>
              <LoginPanel />
            </FadeIn>
          </div>
        </div>
      </section>

      {/* MÓDULOS DEL PORTAL */}
      <section className="py-24 bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <FadeIn>
            <div className="text-center mb-16">
              <div className="divider-gold mx-auto" />
              <p className="text-xs uppercase tracking-widest text-primary font-semibold mb-3">Funcionalidades Planificadas</p>
              <h2 className="text-3xl md:text-4xl font-display font-bold text-white">Lo que incluirá el portal</h2>
            </div>
          </FadeIn>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                icon: Activity,
                title: "Dashboard en Tiempo Real",
                desc: "Vista ejecutiva del estado de operaciones: puestos cubiertos, turnos activos, incidencias del día y nivel de riesgo.",
                status: "Diseñando",
              },
              {
                icon: FileText,
                title: "Reportes de Operación",
                desc: "Acceso a bitácoras de servicio, reportes diarios y consolidados mensuales. Descarga en PDF para gerencia.",
                status: "Planificado",
              },
              {
                icon: AlertTriangle,
                title: "Gestión de Incidencias",
                desc: "Registro, seguimiento y resolución de incidentes. Cada evento queda documentado con tiempo de respuesta y resolución.",
                status: "Planificado",
              },
              {
                icon: BarChart3,
                title: "KPIs de Seguridad",
                desc: "Métricas clave: incidentes mitigados, tiempo de respuesta promedio, cobertura efectiva y cumplimiento de protocolo.",
                status: "Planificado",
              },
              {
                icon: Users,
                title: "Control de Agentes",
                desc: "Listado del personal asignado a su cuenta, historial de turnos y documentación del equipo activo en sus instalaciones.",
                status: "Planificado",
              },
              {
                icon: Server,
                title: "Gestión Administrativa",
                desc: "Acceso a contratos, facturas y solicitudes especiales. Comunicación directa con su ejecutivo de cuenta.",
                status: "Planificado",
              },
            ].map((feature, i) => (
              <FadeIn key={i} delay={i * 0.07}>
                <div className="glass-panel rounded-2xl p-7 flex flex-col h-full hover:border-primary/20 transition-all duration-300 group">
                  <div className="flex items-start justify-between mb-5">
                    <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center">
                      <feature.icon className="w-5 h-5 text-primary" />
                    </div>
                    <span className="text-[10px] uppercase tracking-wider text-primary/70 font-semibold bg-primary/10 px-2 py-1 rounded-full">
                      {feature.status}
                    </span>
                  </div>
                  <h3 className="font-bold text-white text-lg mb-2">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed flex-grow">{feature.desc}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* VISIÓN: WHATSAPP INTEGRADO */}
      <section className="py-24 bg-[#06101d] border-y border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <FadeIn>
              <div className="divider-gold" />
              <p className="text-xs uppercase tracking-widest text-primary font-semibold mb-3">Canal Integrado</p>
              <h2 className="text-3xl md:text-4xl font-display font-bold text-white mb-6">
                WhatsApp como canal operativo
              </h2>
              <p className="text-muted-foreground leading-relaxed mb-6">
                WhatsApp no será un canal aislado. Será un punto de entrada al sistema. Cada mensaje recibido —sea un incidente, una solicitud de cotización o una aplicación de empleo— quedará registrado y visible en el dashboard de operaciones.
              </p>
              <p className="text-muted-foreground leading-relaxed mb-8">
                El equipo de operaciones podrá ver, clasificar y responder desde un solo lugar, sin perder trazabilidad de ninguna comunicación crítica.
              </p>

              <ul className="space-y-4">
                {[
                  { label: "Incidente reportado por cliente", flow: "→ Registro en sistema → Notificación a supervisor de zona" },
                  { label: "Solicitud de cotización", flow: "→ Lead registrado → Ejecutivo de cuenta asignado" },
                  { label: "Aplicación de empleo", flow: "→ Pre-registro en RRHH → Revisión de perfil" },
                  { label: "Emergencia operativa", flow: "→ Alerta inmediata → Protocolo de respuesta activado" },
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <ChevronRight className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                    <div>
                      <span className="font-semibold text-white text-sm">{item.label}</span>
                      <span className="text-muted-foreground text-sm block">{item.flow}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </FadeIn>

            <FadeIn delay={0.2}>
              <div className="glass-panel rounded-2xl p-8 border border-[#25D366]/15">
                <div className="flex items-center gap-3 mb-8">
                  <div className="w-12 h-12 rounded-xl bg-[#25D366]/10 flex items-center justify-center">
                    <MessageSquare className="w-6 h-6 text-[#25D366]" />
                  </div>
                  <div>
                    <p className="font-bold text-white">Canal WhatsApp ISP</p>
                    <p className="text-sm text-[#25D366]">Integración futura con dashboard</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="bg-white/5 rounded-xl p-4 max-w-[85%]">
                    <p className="text-sm text-white/80">"Buen día, necesito cotización para 3 agentes en bodega zona 12."</p>
                    <p className="text-[10px] text-muted-foreground mt-1">Cliente · 09:14 am</p>
                  </div>
                  <div className="bg-primary/15 rounded-xl p-4 max-w-[85%] ml-auto">
                    <p className="text-sm text-white/80">Recibido. Nuestro ejecutivo lo contactará en los próximos 30 minutos. Su solicitud fue registrada con folio #2024-0891.</p>
                    <p className="text-[10px] text-muted-foreground mt-1">ISP Operaciones · 09:15 am</p>
                  </div>
                  <div className="bg-white/5 rounded-xl p-4 max-w-[85%]">
                    <p className="text-sm text-white/80">"Hay un incidente en el ingreso norte, agente requiere apoyo."</p>
                    <p className="text-[10px] text-muted-foreground mt-1">Cliente · 11:32 am</p>
                  </div>
                  <div className="bg-red-900/30 border border-red-500/20 rounded-xl p-4 ml-auto max-w-[85%]">
                    <p className="text-sm text-red-300 font-semibold flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4" /> INCIDENTE REGISTRADO #INC-0412
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">Protocolo activado · Supervisor notificado · 11:32 am</p>
                  </div>
                </div>

                <p className="text-xs text-muted-foreground mt-6 text-center">
                  Concepto visual · La integración real estará disponible en la plataforma
                </p>
              </div>
            </FadeIn>
          </div>
        </div>
      </section>

      {/* VISIÓN: TRELLO INTEGRADO */}
      <section className="py-24 bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <FadeIn delay={0.2} className="order-2 lg:order-1">
              <div className="glass-panel rounded-2xl p-6 border border-blue-500/10">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-xl bg-blue-500/15 flex items-center justify-center">
                    <Trello className="w-5 h-5 text-blue-400" />
                  </div>
                  <div>
                    <p className="font-bold text-white text-sm">Tablero: Incidencias Operativas</p>
                    <p className="text-xs text-blue-400">ISP · Integración futura con Trello</p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  {[
                    {
                      col: "Por Atender",
                      color: "border-yellow-500/30",
                      labelColor: "text-yellow-400",
                      cards: [
                        { title: "Incidente bodega Zona 12", tag: "Urgente" },
                        { title: "Solicitud de cotización", tag: "Lead" },
                      ],
                    },
                    {
                      col: "En Proceso",
                      color: "border-blue-500/30",
                      labelColor: "text-blue-400",
                      cards: [
                        { title: "Aplicación de empleo #0342", tag: "RRHH" },
                      ],
                    },
                    {
                      col: "Resuelto",
                      color: "border-green-500/30",
                      labelColor: "text-green-400",
                      cards: [
                        { title: "Alarma falsa · Bodega Norte", tag: "Cerrado" },
                        { title: "Reporte mensual enviado", tag: "Completado" },
                      ],
                    },
                  ].map((col, ci) => (
                    <div key={ci} className={`rounded-xl border ${col.color} bg-white/3 p-3`}>
                      <p className={`text-xs font-bold uppercase tracking-wider mb-3 ${col.labelColor}`}>{col.col}</p>
                      <div className="space-y-2">
                        {col.cards.map((card, ki) => (
                          <div key={ki} className="bg-card/80 rounded-lg p-2.5 border border-white/5">
                            <p className="text-xs text-white/80 font-medium leading-snug">{card.title}</p>
                            <span className="text-[9px] text-muted-foreground bg-white/5 px-1.5 py-0.5 rounded mt-1 inline-block">{card.tag}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                <p className="text-xs text-muted-foreground mt-4 text-center">
                  Concepto visual · La integración real estará disponible en la plataforma
                </p>
              </div>
            </FadeIn>

            <FadeIn className="order-1 lg:order-2">
              <div className="divider-gold" />
              <p className="text-xs uppercase tracking-widest text-primary font-semibold mb-3">Gestión Operativa</p>
              <h2 className="text-3xl md:text-4xl font-display font-bold text-white mb-6">
                Incidencias vinculadas a Trello
              </h2>
              <p className="text-muted-foreground leading-relaxed mb-6">
                Cada incidencia registrada en el sistema podrá convertirse automáticamente en una tarjeta dentro del tablero operativo de ISP en Trello. El supervisor asignado, el tiempo de respuesta y la resolución quedan documentados en un solo lugar.
              </p>

              <ul className="space-y-4">
                {[
                  "Incidente recibido por WhatsApp o formulario web",
                  "Registro automático en el tablero de incidencias",
                  "Asignación a supervisor de zona responsable",
                  "Seguimiento del caso hasta su resolución",
                  "Reporte final disponible para el cliente",
                ].map((step, i) => (
                  <li key={i} className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center shrink-0">
                      <span className="text-primary text-xs font-bold">{i + 1}</span>
                    </div>
                    <span className="text-white/80 text-sm">{step}</span>
                  </li>
                ))}
              </ul>
            </FadeIn>
          </div>
        </div>
      </section>

      {/* CTA FINAL */}
      <section className="py-20 bg-[#06101d] border-t border-white/5">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <FadeIn>
            <Shield className="w-12 h-12 text-primary mx-auto mb-6" />
            <h2 className="text-2xl md:text-3xl font-display font-bold text-white mb-4">
              ¿Es cliente actual de ISP S.A.?
            </h2>
            <p className="text-muted-foreground mb-8 max-w-xl mx-auto">
              Mientras la plataforma está en desarrollo, contamos con atención directa para reportes, incidencias y requerimientos. Su ejecutivo de cuenta está disponible de inmediato.
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-4">
              <Link href="/contacto">
                <Button size="lg" className="rounded-full px-8 h-12 bg-primary text-[#050d1a] font-bold hover:bg-primary/90">
                  Contactar a Operaciones
                </Button>
              </Link>
              <a href="https://wa.me/50250000000" target="_blank" rel="noreferrer">
                <Button size="lg" variant="outline" className="rounded-full px-8 h-12 bg-transparent border-[#25D366]/40 text-[#25D366] hover:bg-[#25D366]/10">
                  <MessageSquare className="w-4 h-4 mr-2" /> WhatsApp Directo
                </Button>
              </a>
            </div>
          </FadeIn>
        </div>
      </section>
    </PageLayout>
  );
}
