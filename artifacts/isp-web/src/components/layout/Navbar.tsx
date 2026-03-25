import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Shield, Menu, X, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";

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
        isScrolled ? "bg-background/95 backdrop-blur-md border-b border-border shadow-md" : "bg-transparent py-2"
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 group">
            <div className="relative flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors duration-300">
              <Shield className="w-6 h-6" />
            </div>
            <div className="flex flex-col">
              <span className="font-display font-bold text-xl tracking-tight leading-none text-foreground">
                ISP S.A.
              </span>
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
                Seguridad Profesional
              </span>
            </div>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden lg:flex items-center gap-8">
            {navLinks.map((link) => (
              <div key={link.name} className="relative group">
                <Link
                  href={link.path}
                  className={`flex items-center gap-1 text-sm font-medium transition-colors hover:text-primary ${
                    location === link.path || (link.dropdown && location.startsWith(link.path) && link.path !== "/") 
                      ? "text-primary" 
                      : "text-foreground/90"
                  }`}
                >
                  {link.name}
                  {link.dropdown && <ChevronDown className="w-4 h-4 opacity-50" />}
                </Link>

                {/* Dropdown */}
                {link.dropdown && (
                  <div className="absolute top-full left-0 mt-2 w-56 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 transform origin-top-left -translate-y-2 group-hover:translate-y-0">
                    <div className="bg-card border border-border rounded-xl shadow-xl py-2 overflow-hidden">
                      {link.dropdown.map((subItem) => (
                        <Link
                          key={subItem.name}
                          href={subItem.path}
                          className="block px-4 py-2.5 text-sm text-muted-foreground hover:text-primary hover:bg-white/5 transition-colors"
                        >
                          {subItem.name}
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </nav>

          <div className="hidden lg:flex items-center gap-4">
            <Link href="/acceso-clientes" className="text-sm font-medium text-muted-foreground hover:text-white transition-colors">
              Portal Clientes
            </Link>
            <Link href="/solicitar-servicio">
              <Button className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-full px-6 font-semibold shadow-lg shadow-primary/20">
                Solicitar Servicio
              </Button>
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <button
            className="lg:hidden p-2 text-foreground"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden absolute top-full left-0 right-0 bg-card border-b border-border shadow-2xl p-4 flex flex-col gap-4">
          {navLinks.map((link) => (
            <div key={link.name}>
              <Link
                href={link.path}
                className={`block text-lg font-medium py-2 border-b border-white/5 ${
                  location === link.path ? "text-primary" : "text-foreground"
                }`}
              >
                {link.name}
              </Link>
              {link.dropdown && (
                <div className="pl-4 py-2 flex flex-col gap-3">
                  {link.dropdown.map((subItem) => (
                    <Link
                      key={subItem.name}
                      href={subItem.path}
                      className="block text-sm text-muted-foreground hover:text-primary"
                    >
                      {subItem.name}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          ))}
          <div className="flex flex-col gap-3 pt-4">
            <Link href="/acceso-clientes">
              <Button variant="outline" className="w-full justify-center">
                Portal Clientes
              </Button>
            </Link>
            <Link href="/solicitar-servicio">
              <Button className="w-full justify-center">
                Solicitar Servicio
              </Button>
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
