import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Menu, X, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { brand } from "@/config/branding";

const logoImg = "/images/logo-isp.png";

export function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [location] = useLocation();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location]);

  const navLinks = [
    { name: "Inicio", path: "/" },
    { name: "Nosotros", path: "/nosotros" },
    { 
      name: "Servicios", 
      path: "/servicios",
      dropdown: [
        { name: "Ver todos", path: "/servicios" },
        { name: "Seguridad Física", path: "/servicios/seguridad-fisica" },
        { name: "Custodia de Transporte", path: "/servicios/custodia-transporte" }
      ]
    },
    { name: "Sectores", path: "/sectores" },
    { name: "Reclutamiento", path: "/reclutamiento" },
    { name: "Contacto", path: "/contacto" },
  ];

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled ? "backdrop-blur-md shadow-lg" : "bg-transparent py-4"
      }`}
      style={isScrolled ? { backgroundColor: "rgba(5, 13, 26, 0.97)" } : {}}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 group">
            <img
              src={logoImg}
              alt={`${brand.shortName} Logo`}
              className="h-14 w-auto object-contain"
            />
            <div className="flex flex-col">
              <span className="font-display font-bold text-lg tracking-tight leading-none text-white">
                {brand.shortName}
              </span>
              <span className="text-[10px] uppercase tracking-widest text-primary font-semibold">
                {brand.taglineShort}
              </span>
            </div>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden lg:flex items-center gap-8">
            {navLinks.map((link) => {
              const isActive = location === link.path || (link.dropdown && location.startsWith(link.path) && link.path !== "/");
              return (
                <div key={link.name} className="relative group">
                  <Link
                    href={link.path}
                    className={`flex items-center gap-1 font-sans text-sm font-medium transition-colors hover:text-primary ${
                      isActive ? "text-primary" : "text-white/80"
                    }`}
                  >
                    {link.name}
                    {link.dropdown && <ChevronDown className="w-4 h-4 opacity-70" />}
                  </Link>

                  {/* Active Indicator Dot */}
                  {isActive && (
                    <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-1 h-1 bg-primary rounded-full" />
                  )}

                  {/* Dropdown */}
                  {link.dropdown && (
                    <div className="absolute top-full left-0 mt-4 w-56 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 transform origin-top-left -translate-y-2 group-hover:translate-y-0">
                      <div className="bg-background/95 backdrop-blur rounded-xl border border-white/8 shadow-2xl py-2 overflow-hidden">
                        {link.dropdown.map((subItem) => (
                          <Link
                            key={subItem.name}
                            href={subItem.path}
                            className="block px-4 py-2.5 text-sm text-white/80 hover:text-primary hover:bg-white/5 transition-colors"
                          >
                            {subItem.name}
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </nav>

          <div className="hidden lg:flex items-center gap-3">
            <Link href="/acceso-clientes">
              <Button variant="outline" className="rounded-full px-5 py-2 text-sm font-semibold border-white/20 text-white hover:bg-white/8 hover:text-white bg-transparent">
                Portal Clientes
              </Button>
            </Link>
            <Link href="/solicitar-servicio">
              <Button className="bg-primary text-[#050d1a] hover:bg-primary/90 rounded-full px-5 py-2 text-sm font-semibold shadow-lg shadow-primary/20">
                Solicitar Servicio
              </Button>
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <button
            className="lg:hidden p-2 text-white"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="w-7 h-7" /> : <Menu className="w-7 h-7" />}
          </button>
        </div>
      </div>

      {/* Bottom subtle gold line when scrolled */}
      {isScrolled && (
        <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-primary opacity-30" />
      )}

      {/* Mobile Menu */}
      <div 
        className={`lg:hidden fixed inset-0 top-[80px] bg-[#050d1a] transition-transform duration-300 ease-in-out transform ${
          mobileMenuOpen ? "translate-y-0" : "-translate-y-full opacity-0 pointer-events-none"
        }`}
        style={{ zIndex: 40 }}
      >
        <div className="p-6 flex flex-col h-full overflow-y-auto">
          <div className="flex flex-col gap-6">
            {navLinks.map((link) => (
              <div key={link.name}>
                <Link
                  href={link.path}
                  className={`block text-2xl font-display font-medium ${
                    location === link.path ? "text-primary" : "text-white"
                  }`}
                >
                  {link.name}
                </Link>
                {link.dropdown && (
                  <div className="pl-4 py-3 flex flex-col gap-4 mt-2 border-l border-white/10">
                    {link.dropdown.map((subItem) => (
                      <Link
                        key={subItem.name}
                        href={subItem.path}
                        className="block text-base text-white/70 hover:text-primary"
                      >
                        {subItem.name}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
          
          <div className="mt-auto pt-8 flex flex-col gap-4 pb-10">
            <Link href="/acceso-clientes">
              <Button variant="outline" className="w-full h-12 justify-center border-white/20 text-white hover:bg-white/5">
                Portal Clientes
              </Button>
            </Link>
            <Link href="/solicitar-servicio">
              <Button className="w-full h-12 justify-center bg-primary text-[#050d1a] font-bold text-base hover:bg-primary/90">
                Solicitar Servicio
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}
