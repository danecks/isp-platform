import { Link } from "wouter";
import { Phone, Mail, MapPin, ChevronRight, MessageSquare } from "lucide-react";
import { brand } from "@/config/branding";

const logoImg = "/images/logo-isp.png";

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-[#030a14] relative text-sm">
      {/* Top Gold Line */}
      <div className="w-full h-[1px] bg-primary opacity-20" />
      
      <div className="pt-16 pb-8 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 lg:gap-8 mb-16">
          
          {/* Brand Col */}
          <div className="flex flex-col gap-6">
            <Link href="/" className="flex items-center gap-3">
              <div className="flex items-center justify-center w-14 h-14 rounded-full bg-white p-1 shadow-md shrink-0">
                <img
                  src={logoImg}
                  alt={`${brand.shortName} Logo`}
                  className="w-full h-full object-contain rounded-full"
                />
              </div>
              <div className="flex flex-col">
                <span className="font-display font-bold text-xl tracking-tight leading-none text-white">
                  {brand.shortName}
                </span>
                <span className="text-[10px] uppercase tracking-widest text-primary font-semibold">
                  {brand.taglineShort}
                </span>
              </div>
            </Link>
            <p className="text-white/70 leading-relaxed text-sm">
              Soluciones de seguridad privada de alto nivel corporativo para empresas guatemaltecas.
            </p>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 w-fit mt-2">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
              <span className="text-xs font-medium text-white/90">Operaciones 24/7 · 365 días</span>
            </div>
            <p className="text-xs text-white/40 mt-2">Licencia de Operación: MEG-XXX-2024</p>
          </div>

          {/* Empresa Col */}
          <div>
            <h4 className="font-display font-bold text-white mb-6 uppercase tracking-wider text-sm">Empresa</h4>
            <ul className="flex flex-col gap-4">
              <li>
                <Link href="/nosotros" className="text-white/70 hover:text-primary transition-colors flex items-center gap-2">
                  <ChevronRight className="w-4 h-4 text-primary/50" /> Nosotros
                </Link>
              </li>
              <li>
                <Link href="/servicios" className="text-white/70 hover:text-primary transition-colors flex items-center gap-2">
                  <ChevronRight className="w-4 h-4 text-primary/50" /> Servicios
                </Link>
              </li>
              <li>
                <Link href="/sectores" className="text-white/70 hover:text-primary transition-colors flex items-center gap-2">
                  <ChevronRight className="w-4 h-4 text-primary/50" /> Sectores
                </Link>
              </li>
              <li>
                <Link href="/reclutamiento" className="text-white/70 hover:text-primary transition-colors flex items-center gap-2">
                  <ChevronRight className="w-4 h-4 text-primary/50" /> Reclutamiento
                </Link>
              </li>
              <li>
                <Link href="/contacto" className="text-white/70 hover:text-primary transition-colors flex items-center gap-2">
                  <ChevronRight className="w-4 h-4 text-primary/50" /> Contacto
                </Link>
              </li>
            </ul>
          </div>

          {/* Servicios Col */}
          <div>
            <h4 className="font-display font-bold text-white mb-6 uppercase tracking-wider text-sm">Servicios</h4>
            <ul className="flex flex-col gap-4">
              <li>
                <Link href="/servicios/seguridad-fisica" className="text-white/70 hover:text-primary transition-colors flex items-center gap-2">
                  <ChevronRight className="w-4 h-4 text-primary/50" /> Seguridad Física
                </Link>
              </li>
              <li>
                <Link href="/servicios/custodia-transporte" className="text-white/70 hover:text-primary transition-colors flex items-center gap-2">
                  <ChevronRight className="w-4 h-4 text-primary/50" /> Custodia de Transporte
                </Link>
              </li>
              <li>
                <Link href="/servicios" className="text-white/70 hover:text-primary transition-colors flex items-center gap-2">
                  <ChevronRight className="w-4 h-4 text-primary/50" /> Operaciones Móviles
                </Link>
              </li>
              <li>
                <Link href="/acceso-clientes" className="text-white/70 hover:text-primary transition-colors flex items-center gap-2">
                  <ChevronRight className="w-4 h-4 text-primary/50" /> Portal de Clientes <span className="text-[10px] bg-white/10 px-2 py-0.5 rounded text-white/50 ml-1">Próximamente</span>
                </Link>
              </li>
            </ul>
          </div>

          {/* Contacto Col */}
          <div>
            <h4 className="font-display font-bold text-white mb-6 uppercase tracking-wider text-sm">Contacto</h4>
            <ul className="flex flex-col gap-5">
              <li className="flex items-start gap-3 text-white/70">
                <MapPin className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                <span>Ciudad de Guatemala, Zona 10</span>
              </li>
              <li className="flex items-center gap-3 text-white/70">
                <Phone className="w-5 h-5 text-primary shrink-0" />
                <span>+502 2200-0000</span>
              </li>
              <li className="flex items-center gap-3 text-white/70">
                <Mail className="w-5 h-5 text-primary shrink-0" />
                <span>contacto@isp-guatemala.com</span>
              </li>
              <li className="pt-2">
                <a href="https://wa.me/50250000000" target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#20bd5a] text-white px-4 py-2 rounded-full text-sm font-medium transition-colors shadow-lg shadow-[#25D366]/20">
                  <MessageSquare className="w-4 h-4" />
                  Escribir por WhatsApp
                </a>
              </li>
            </ul>
          </div>

        </div>

        <div className="pt-8 border-t border-white/10 flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-white/50">
          <p>{brand.copyright(currentYear)}</p>
          <div className="flex items-center gap-4">
            <span>Licencia MEG-XXX-2024</span>
            <span className="hidden md:inline text-white/20">|</span>
            <Link href="#" className="hover:text-white transition-colors">Términos</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
