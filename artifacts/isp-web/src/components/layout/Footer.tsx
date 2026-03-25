import { Link } from "wouter";
import { Shield, Phone, Mail, MapPin, ChevronRight } from "lucide-react";

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-[#030811] border-t border-border pt-16 pb-8 text-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 lg:gap-8 mb-12">
          
          {/* Brand Col */}
          <div className="flex flex-col gap-6">
            <Link href="/" className="flex items-center gap-3">
              <Shield className="w-8 h-8 text-primary" />
              <div className="flex flex-col">
                <span className="font-display font-bold text-xl tracking-tight leading-none text-foreground">
                  ISP S.A.
                </span>
                <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
                  Seguridad Profesional
                </span>
              </div>
            </Link>
            <p className="text-muted-foreground leading-relaxed">
              Soluciones integrales de seguridad privada de alto nivel corporativo. Protegiendo los activos más valiosos de las empresas en Guatemala.
            </p>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 w-fit">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
              <span className="text-xs font-medium text-white/80">Operaciones 24/7</span>
            </div>
          </div>

          {/* Links Col 1 */}
          <div>
            <h4 className="font-display font-semibold text-white mb-6 uppercase tracking-wider text-xs">Compañía</h4>
            <ul className="flex flex-col gap-4">
              <li>
                <Link href="/nosotros" className="text-muted-foreground hover:text-primary transition-colors flex items-center gap-2">
                  <ChevronRight className="w-3 h-3" /> Nosotros
                </Link>
              </li>
              <li>
                <Link href="/servicios" className="text-muted-foreground hover:text-primary transition-colors flex items-center gap-2">
                  <ChevronRight className="w-3 h-3" /> Nuestros Servicios
                </Link>
              </li>
              <li>
                <Link href="/sectores" className="text-muted-foreground hover:text-primary transition-colors flex items-center gap-2">
                  <ChevronRight className="w-3 h-3" /> Sectores que Atendemos
                </Link>
              </li>
              <li>
                <Link href="/reclutamiento" className="text-muted-foreground hover:text-primary transition-colors flex items-center gap-2">
                  <ChevronRight className="w-3 h-3" /> Únete al Equipo
                </Link>
              </li>
            </ul>
          </div>

          {/* Links Col 2 */}
          <div>
            <h4 className="font-display font-semibold text-white mb-6 uppercase tracking-wider text-xs">Servicios</h4>
            <ul className="flex flex-col gap-4">
              <li>
                <Link href="/servicios/seguridad-fisica" className="text-muted-foreground hover:text-primary transition-colors flex items-center gap-2">
                  <ChevronRight className="w-3 h-3" /> Seguridad Física
                </Link>
              </li>
              <li>
                <Link href="/servicios/custodia-transporte" className="text-muted-foreground hover:text-primary transition-colors flex items-center gap-2">
                  <ChevronRight className="w-3 h-3" /> Custodia de Transporte
                </Link>
              </li>
              <li>
                <Link href="/servicios" className="text-muted-foreground hover:text-primary transition-colors flex items-center gap-2">
                  <ChevronRight className="w-3 h-3" /> Operaciones Móviles
                </Link>
              </li>
              <li>
                <Link href="/acceso-clientes" className="text-muted-foreground hover:text-primary transition-colors flex items-center gap-2">
                  <ChevronRight className="w-3 h-3" /> Portal de Clientes
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact Col */}
          <div>
            <h4 className="font-display font-semibold text-white mb-6 uppercase tracking-wider text-xs">Contacto</h4>
            <ul className="flex flex-col gap-4">
              <li className="flex items-start gap-3 text-muted-foreground">
                <MapPin className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                <span>Ciudad de Guatemala, Guatemala<br/>Centro Corporativo, Zona 10</span>
              </li>
              <li className="flex items-center gap-3 text-muted-foreground">
                <Phone className="w-5 h-5 text-primary shrink-0" />
                <span>+502 2200-0000</span>
              </li>
              <li className="flex items-center gap-3 text-muted-foreground">
                <Mail className="w-5 h-5 text-primary shrink-0" />
                <span>contacto@isp-guatemala.com</span>
              </li>
            </ul>
          </div>

        </div>

        <div className="pt-8 border-t border-border flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-muted-foreground">
          <p>&copy; {currentYear} Investigaciones y Seguridad Profesional S.A. Todos los derechos reservados.</p>
          <div className="flex items-center gap-4">
            <span>Licencia de Operación: MEG-XXX-2024</span>
            <span className="hidden md:inline">|</span>
            <Link href="#" className="hover:text-white transition-colors">Términos Legales</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
