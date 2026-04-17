import React, { useEffect, useRef, useState } from "react";
import { 
  ArrowRight, ShieldCheck, Truck, Users, Activity, 
  CheckCircle, Eye, MapPin, Clock, BarChart3, Zap, 
  Target, ChevronRight, PhoneCall, MessageSquare,
  Shield, Building2, Factory, Menu, X
} from "lucide-react";

// Mini local hook for IntersectionObserver reveal
function useReveal() {
  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const currentRef = ref.current;
    if (!currentRef) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.unobserve(entry.target);
        }
      },
      { threshold: 0.1, rootMargin: "0px 0px -50px 0px" }
    );

    observer.observe(currentRef);
    return () => {
      if (currentRef) observer.unobserve(currentRef);
    };
  }, []);

  return { ref, isVisible };
}

// FadeIn Replacement Component
function FadeIn({ children, delay = 0, className = "" }: { children: React.ReactNode, delay?: number, className?: string }) {
  const { ref, isVisible } = useReveal();
  
  return (
    <div 
      ref={ref}
      className={"transition-all duration-700 ease-out " + (isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8") + " " + className}
      style={{ transitionDelay: delay + "s" }}
    >
      {children}
    </div>
  );
}

// Animated Counter Component
function AnimatedCounter({ end, duration = 2000, prefix = "", suffix = "" }: { end: number, duration?: number, prefix?: string, suffix?: string }) {
  const [count, setCount] = useState(0);
  const { ref, isVisible } = useReveal();

  useEffect(() => {
    if (!isVisible) return;
    
    let startTime: number | null = null;
    let animationFrame: number;

    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = timestamp - startTime;
      
      // easeOutQuart
      const easeProgress = 1 - Math.pow(1 - Math.min(progress / duration, 1), 4);
      
      setCount(Math.floor(easeProgress * end));

      if (progress < duration) {
        animationFrame = requestAnimationFrame(animate);
      } else {
        setCount(end);
      }
    };

    animationFrame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrame);
  }, [isVisible, end, duration]);

  return <span ref={ref}>{prefix}{count}{suffix}</span>;
}

export function Inmersiva() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);
  const [scrollY, setScrollY] = useState(0);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Scroll listener for parallax
  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Mouse move listener for 3D tilt
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!heroRef.current) return;
    const rect = heroRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    
    // Normalize -1 to 1
    setMousePos({
      x: (x - centerX) / centerX,
      y: (y - centerY) / centerY
    });
  };

  // Particles Canvas Effect
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let particles: {x: number, y: number, vx: number, vy: number, size: number}[] = [];
    let animationFrameId: number;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      initParticles();
    };

    const initParticles = () => {
      particles = [];
      const particleCount = Math.floor(window.innerWidth / 20); // ~80 particles depending on width
      for (let i = 0; i < particleCount; i++) {
        particles.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          vx: (Math.random() - 0.5) * 0.5,
          vy: (Math.random() - 0.5) * 0.5,
          size: Math.random() * 1.5 + 0.5
        });
      }
    };

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Update & Draw Particles
      particles.forEach((p, i) => {
        p.x += p.vx;
        p.y += p.vy;

        if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
        if (p.y < 0 || p.y > canvas.height) p.vy *= -1;

        ctx.fillStyle = 'rgba(201, 162, 39, 0.4)';
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();

        // Connect lines
        for (let j = i + 1; j < particles.length; j++) {
          const p2 = particles[j];
          const dx = p.x - p2.x;
          const dy = p.y - p2.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < 150) {
            ctx.strokeStyle = "rgba(201, 162, 39, " + (0.15 * (1 - dist/150)) + ")";
            ctx.lineWidth = 0.5;
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();
          }
        }
      });

      animationFrameId = requestAnimationFrame(draw);
    };

    resize();
    window.addEventListener('resize', resize);
    draw();

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  const clientLogos = [
    { id: "1", name: "Banco Industrial" },
    { id: "2", name: "Cementos Progreso" },
    { id: "3", name: "Pollo Campero" },
    { id: "4", name: "Cervecería Centro Americana" },
    { id: "5", name: "Disagro" },
    { id: "6", name: "Tigo" }
  ];

  return (
    <div className="min-h-screen bg-[#050d1a] text-white font-sans selection:bg-[#c9a227] selection:text-white overflow-x-hidden">
      <style>{`
        :root {
          --primary: #c9a227;
        }
        
        .text-primary { color: var(--primary); }
        .bg-primary { background-color: var(--primary); }
        .border-primary { border-color: var(--primary); }
        
        .text-gradient-gold {
          background: linear-gradient(to right, #e2c254, #c9a227, #b08d22);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .glass-panel {
          background: rgba(255, 255, 255, 0.03);
          backdrop-filter: blur(12px);
          border: 1px solid rgba(255, 255, 255, 0.05);
        }

        .divider-gold {
          width: 60px;
          height: 3px;
          background: var(--primary);
          margin-bottom: 20px;
          border-radius: 2px;
        }

        @keyframes pulse-ring-1 {
          0% { transform: scale(0.8); opacity: 0.8; }
          100% { transform: scale(2.5); opacity: 0; }
        }
        @keyframes pulse-ring-2 {
          0% { transform: scale(0.8); opacity: 0.8; }
          100% { transform: scale(3.5); opacity: 0; }
        }
        
        .radar-dot {
          position: relative;
        }
        .radar-dot::before, .radar-dot::after {
          content: '';
          position: absolute;
          left: 50%;
          top: 50%;
          width: 100%;
          height: 100%;
          margin-left: -50%;
          margin-top: -50%;
          border-radius: 50%;
          border: 1px solid #22c55e;
          pointer-events: none;
        }
        .radar-dot::before {
          animation: pulse-ring-1 2s cubic-bezier(0.215, 0.61, 0.355, 1) infinite;
        }
        .radar-dot::after {
          animation: pulse-ring-2 2s cubic-bezier(0.215, 0.61, 0.355, 1) infinite 1s;
        }

        @keyframes gold-glow {
          0% { text-shadow: 0 0 20px rgba(201,162,39,0.3); }
          100% { text-shadow: 0 0 40px rgba(201,162,39,0.6); }
        }
        .animate-gold-glow {
          animation: gold-glow 3s infinite alternate ease-in-out;
        }

        @keyframes logos-scroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-33.33%); }
        }
        .animate-logos-scroll {
          animation: logos-scroll 40s linear infinite;
        }

        @keyframes breathe {
          0% { transform: translate(-50%, -50%) scale(1); opacity: 0.1; }
          50% { transform: translate(-50%, -50%) scale(1.2); opacity: 0.15; }
          100% { transform: translate(-50%, -50%) scale(1); opacity: 0.1; }
        }
        .animate-breathe {
          animation: breathe 8s ease-in-out infinite;
        }
      `}</style>

      {/* NAVBAR */}
      <nav className={"fixed top-0 left-0 right-0 z-50 transition-all duration-300 " + (scrollY > 20 ? 'bg-[#050d1a]/95 backdrop-blur-md py-4 shadow-xl shadow-black/20' : 'bg-transparent py-6')}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield className="w-8 h-8 text-primary" />
            <span className="font-bold text-2xl tracking-widest text-white">ISP, S.A.</span>
          </div>

          <div className="hidden lg:flex items-center gap-8">
            {['Inicio', 'Nosotros', 'Servicios', 'Sectores', 'Reclutamiento', 'Contacto'].map(item => (
              <a key={item} href="#" className="text-sm font-medium text-white/80 hover:text-primary transition-colors">
                {item}
              </a>
            ))}
          </div>

          <div className="hidden lg:flex items-center gap-4">
            <button className="text-sm font-semibold text-white hover:text-primary transition-colors">
              Portal Clientes
            </button>
            <button className="bg-primary text-[#050d1a] px-6 py-2.5 rounded-full text-sm font-semibold hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20">
              Solicitar Servicio
            </button>
          </div>

          <button className="lg:hidden text-white" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
            {mobileMenuOpen ? <X /> : <Menu />}
          </button>
        </div>
      </nav>

      {/* SECTION 1 — HERO */}
      <section 
        ref={heroRef}
        onMouseMove={handleMouseMove}
        className="relative min-h-[100dvh] flex items-center pt-20 overflow-hidden bg-gradient-to-br from-[#050d1a] to-[#0a1628]"
      >
        <canvas ref={canvasRef} className="absolute inset-0 z-0 pointer-events-none opacity-30" />
        
        {/* Subtle decorative elements */}
        <div className="absolute inset-0 pointer-events-none z-0">
          <div className="absolute top-10 right-10 w-[600px] h-[600px] bg-primary/10 blur-[120px] rounded-full mix-blend-screen" />
          <div 
            className="absolute inset-0 opacity-5"
            style={{ backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 10px, white 10px, white 11px)' }}
          />
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 w-full flex flex-col lg:flex-row items-center justify-between gap-12">
          {/* Left Column Content */}
          <div className="flex-1 max-w-3xl text-left">
            <FadeIn delay={0.1}>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary text-primary font-medium text-sm mb-8 bg-primary/5 backdrop-blur-sm">
                <Shield className="w-4 h-4" />
                Empresa Certificada · Guatemala
              </div>
            </FadeIn>

            <FadeIn delay={0.2}>
              <h1 className="text-6xl lg:text-8xl font-display font-bold leading-none mb-6 flex flex-col">
                <span className="text-white">PROTECCIÓN</span>
                <span className="text-gradient-gold animate-gold-glow">PROFESIONAL</span>
              </h1>
            </FadeIn>

            <FadeIn delay={0.3}>
              <p className="text-xl font-sans text-muted-foreground mb-10 max-w-2xl leading-relaxed">
                Seguridad física, custodia de transporte y operaciones móviles para empresas de alto requerimiento. Más de 800 agentes activos en todo el territorio guatemalteco.
              </p>
            </FadeIn>

            <FadeIn delay={0.4} className="flex flex-col sm:flex-row gap-4 mb-6">
              <a href="#">
                <button className="w-full sm:w-auto h-14 px-8 rounded-full text-base font-semibold bg-primary text-[#050d1a] hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 flex items-center justify-center">
                  Solicitar Evaluación <ArrowRight className="ml-2 w-5 h-5" />
                </button>
              </a>
              <a href="#" target="_blank" rel="noopener noreferrer">
                <button className="w-full sm:w-auto h-14 px-8 rounded-full text-base font-semibold border border-primary text-primary hover:bg-primary/10 transition-all flex items-center justify-center">
                  <MessageSquare className="mr-2 w-5 h-5" /> WhatsApp Directo
                </button>
              </a>
            </FadeIn>

            <FadeIn delay={0.5}>
              <p className="text-sm font-medium text-muted-foreground flex items-center gap-3">
                <span className="w-2.5 h-2.5 rounded-full bg-green-500 radar-dot"></span>
                Operaciones activas 24 / 7 · 365 días
              </p>
            </FadeIn>
          </div>

          {/* Right Column Stats Cluster (Hidden on mobile) */}
          <div className="hidden lg:flex relative flex-1 h-[500px] items-center justify-center pointer-events-none">
            {/* Big decorative shield background with scroll parallax */}
            <Shield 
              className="absolute w-[400px] h-[400px] text-primary opacity-5 transition-transform duration-75"
              style={{ transform: "translateY(" + (scrollY * 0.2) + "px)" }}
            />
            
            <div className="relative w-full h-full perspective-1000">
              <FadeIn delay={0.3} className="absolute top-[20%] right-[10%]">
                <div 
                  className="glass-panel p-6 rounded-2xl flex flex-col items-center shadow-2xl border-l-4 border-l-primary transition-transform duration-200 ease-out"
                  style={{ transform: "translateY(" + (scrollY * -0.1) + "px) rotateX(" + (mousePos.y * -10) + "deg) rotateY(" + (mousePos.x * 10) + "deg) translateZ(20px)" }}
                >
                  <span className="text-4xl font-display font-bold text-white mb-1">+800</span>
                  <span className="text-sm text-primary font-semibold uppercase tracking-wider">Agentes</span>
                </div>
              </FadeIn>
              
              <FadeIn delay={0.4} className="absolute bottom-[30%] left-[10%]">
                <div 
                  className="glass-panel p-6 rounded-2xl flex flex-col items-center shadow-2xl border-l-4 border-l-primary transition-transform duration-200 ease-out"
                  style={{ transform: "translateY(" + (scrollY * -0.2) + "px) rotateX(" + (mousePos.y * -15) + "deg) rotateY(" + (mousePos.x * 15) + "deg) translateZ(40px)" }}
                >
                  <span className="text-4xl font-display font-bold text-white mb-1">24/7</span>
                  <span className="text-sm text-primary font-semibold uppercase tracking-wider">Respuesta</span>
                </div>
              </FadeIn>

              <FadeIn delay={0.5} className="absolute top-[50%] right-[30%]">
                <div 
                  className="glass-panel p-6 rounded-2xl flex flex-col items-center shadow-2xl border-l-4 border-l-primary transition-transform duration-200 ease-out"
                  style={{ transform: "translateY(" + (scrollY * -0.15) + "px) rotateX(" + (mousePos.y * -5) + "deg) rotateY(" + (mousePos.x * 5) + "deg) translateZ(60px)" }}
                >
                  <MapPin className="w-10 h-10 text-white mb-2" />
                  <span className="text-sm text-primary font-semibold uppercase tracking-wider">Nacional</span>
                </div>
              </FadeIn>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 2 — STATS BAR */}
      <div className="w-full bg-[#030811] border-y border-white/5 py-10 relative z-20 shadow-2xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:divide-x divide-white/10">
            <FadeIn delay={0.1} className="flex flex-col items-center text-center">
              <span className="text-4xl font-display font-bold text-primary mb-2">
                <AnimatedCounter end={800} prefix="+" />
              </span>
              <span className="text-sm font-medium text-muted-foreground">Agentes</span>
            </FadeIn>
            <FadeIn delay={0.2} className="flex flex-col items-center text-center">
              <span className="text-4xl font-display font-bold text-primary mb-2">Cobertura</span>
              <span className="text-sm font-medium text-muted-foreground">Nacional</span>
            </FadeIn>
            <FadeIn delay={0.3} className="flex flex-col items-center text-center">
              <span className="text-4xl font-display font-bold text-primary mb-2">24/7</span>
              <span className="text-sm font-medium text-muted-foreground">Respuesta</span>
            </FadeIn>
            <FadeIn delay={0.4} className="flex flex-col items-center text-center">
              <span className="text-4xl font-display font-bold text-primary mb-2">
                <AnimatedCounter end={15} prefix="+" />
              </span>
              <span className="text-sm font-medium text-muted-foreground">Años</span>
            </FadeIn>
          </div>
        </div>
      </div>

      {/* SECTION 3 — SERVICES */}
      <section className="py-24 bg-[#050d1a]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <FadeIn>
            <div className="mb-16">
              <div className="divider-gold" />
              <p className="text-sm font-bold tracking-widest text-muted-foreground uppercase mb-2">Líneas de Servicio</p>
              <h2 className="text-4xl md:text-5xl font-display font-bold text-white">Soluciones Integrales de Seguridad</h2>
            </div>
          </FadeIn>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[
              { icon: ShieldCheck, title: "Seguridad Física", desc: "Agentes certificados, armados y desarmados, desplegados en instalaciones corporativas, industriales, comerciales y residenciales bajo protocolos de operación estrictos." },
              { icon: Truck, title: "Custodia de Transporte", desc: "Escolta especializada para protección de carga, valores y mercancías de alto riesgo. Planificación de rutas, seguimiento y coordinación con autoridades." },
              { icon: Users, title: "Operaciones Móviles", desc: "Unidades de reacción rápida y patrullaje preventivo. Presencia disuasoria que neutraliza amenazas antes de que escalen." },
              { icon: Eye, title: "Supervisión y Control", desc: "Centro de monitoreo que respalda cada puesto con seguimiento en tiempo real, gestión de incidencias y reportes ejecutivos para la toma de decisiones." }
            ].map((service, index) => (
              <FadeIn key={index} delay={0.1 * (index + 1)}>
                <div className="group glass-panel rounded-2xl p-8 transition-all duration-300 h-full flex flex-col hover:-translate-y-2 hover:shadow-2xl hover:shadow-primary/20 hover:border-primary/40">
                  <div className="w-12 h-12 rounded-xl bg-primary/15 flex items-center justify-center mb-6 overflow-hidden">
                    <service.icon className="w-6 h-6 text-primary transition-transform duration-300 group-hover:scale-110" />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-3 group-hover:text-primary transition-colors">{service.title}</h3>
                  <p className="text-muted-foreground leading-relaxed mb-8 flex-grow">
                    {service.desc}
                  </p>
                  <a href="#" className="text-primary font-medium flex items-center gap-2 group-hover:gap-3 transition-all">
                    Conocer más <ArrowRight className="w-4 h-4" />
                  </a>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* SECTION 4 — OPERATIONAL CAPACITY */}
      <section className="py-24 bg-[#06101d]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <FadeIn>
                <div className="divider-gold" />
                <p className="text-sm font-bold tracking-widest text-muted-foreground uppercase mb-2">
                  Capacidad Operativa
                </p>
                <h2 className="text-4xl md:text-5xl font-display font-bold text-white mb-6">
                  Un cuerpo de seguridad listo para cualquier escenario.
                </h2>
                <p className="text-lg text-muted-foreground leading-relaxed mb-8">
                  ISP, S.A. cuenta con la infraestructura humana y logística para responder ante cualquier requerimiento de seguridad. Desde un puesto fijo hasta una operación de custodia nacional de múltiple unidad.
                </p>
                <a href="#">
                  <button className="rounded-full border border-primary text-primary hover:bg-primary/10 h-12 px-8 font-semibold transition-colors">
                    Solicitar cotización
                  </button>
                </a>
              </FadeIn>
            </div>

            <div className="flex flex-col gap-8">
              <FadeIn delay={0.2} className="pb-8 border-b border-primary/20 group">
                <div className="flex items-end gap-6 transition-transform group-hover:translate-x-2">
                  <span className="text-5xl font-display font-bold text-primary w-24">
                    <AnimatedCounter end={800} prefix="+" />
                  </span>
                  <div>
                    <h4 className="text-xl font-bold text-white">Agentes Activos</h4>
                    <p className="text-muted-foreground text-sm mt-1">Distribuidos en toda la república</p>
                  </div>
                </div>
              </FadeIn>
              <FadeIn delay={0.3} className="pb-8 border-b border-primary/20 group">
                <div className="flex items-end gap-6 transition-transform group-hover:translate-x-2">
                  <span className="text-5xl font-display font-bold text-primary w-24">
                    <AnimatedCounter end={50} prefix="+" />
                  </span>
                  <div>
                    <h4 className="text-xl font-bold text-white">Clientes Activos</h4>
                    <p className="text-muted-foreground text-sm mt-1">Empresas líderes en sus sectores</p>
                  </div>
                </div>
              </FadeIn>
              <FadeIn delay={0.4} className="pb-8 border-b border-primary/20 group">
                <div className="flex items-end gap-6 transition-transform group-hover:translate-x-2">
                  <span className="text-5xl font-display font-bold text-primary w-24">
                    <AnimatedCounter end={22} />
                  </span>
                  <div>
                    <h4 className="text-xl font-bold text-white">Departamentos</h4>
                    <p className="text-muted-foreground text-sm mt-1">Cobertura en todo el territorio nacional</p>
                  </div>
                </div>
              </FadeIn>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 4B — CLIENT LOGOS BAND */}
      <section className="py-12 bg-[#050d1a] border-y border-white/5 overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-6 text-center">
          <p className="text-xs font-bold tracking-widest text-white/30 uppercase">
            Empresas que Confían en ISP, S.A.
          </p>
        </div>
        {/* Infinite scroll band */}
        <div className="relative">
          {/* Fade edges */}
          <div className="absolute left-0 top-0 bottom-0 w-32 bg-gradient-to-r from-[#050d1a] to-transparent z-10 pointer-events-none" />
          <div className="absolute right-0 top-0 bottom-0 w-32 bg-gradient-to-l from-[#050d1a] to-transparent z-10 pointer-events-none" />
          {/* Scrolling track - Smooth 40s loop, pause on hover */}
          <div className="flex gap-8 animate-logos-scroll hover:[animation-play-state:paused]" style={{ width: "max-content" }}>
            {[...clientLogos, ...clientLogos, ...clientLogos, ...clientLogos].map((logo, idx) => (
              <div
                key={logo.id + "-" + idx}
                className="flex items-center justify-center h-14 px-8 bg-white/5 border border-white/8 rounded-xl shrink-0 hover:bg-white/10 hover:border-primary/30 transition-all cursor-default"
                title={logo.name}
              >
                <span className="font-display font-bold text-white/60 hover:text-white transition-colors">{logo.name}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SECTION 5 — WHY CHOOSE US */}
      <section className="py-24 bg-[#050d1a]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <FadeIn>
            <div className="mb-16">
              <div className="divider-gold" />
              <h2 className="text-4xl md:text-5xl font-display font-bold text-white">¿Por qué elegir ISP, S.A.?</h2>
            </div>
          </FadeIn>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            <FadeIn delay={0.1}>
              <div className="glass-panel p-10 rounded-2xl h-full relative overflow-hidden flex flex-col justify-center min-h-[400px] border border-white/10 hover:border-primary/30 transition-colors">
                <Shield className="absolute -right-10 -bottom-10 w-[200px] h-[200px] text-primary opacity-10" />
                <h3 className="text-3xl font-display font-bold text-white mb-6 relative z-10">15+ años protegiendo lo que importa</h3>
                <p className="text-lg text-muted-foreground mb-8 relative z-10">
                  Nuestra filosofía no se basa solo en proveer guardias, sino en implementar un sistema integral de seguridad donde la supervisión, el entrenamiento y la tecnología garantizan la continuidad de su negocio.
                </p>
                <a href="#" className="text-primary font-medium flex items-center gap-2 hover:gap-3 transition-all relative z-10 w-fit group">
                  Conozca nuestra historia <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                </a>
              </div>
            </FadeIn>

            <div className="flex flex-col justify-center gap-6">
              {[
                { title: "Selección rigurosa de personal", desc: "Procesos de investigación, pruebas psicométricas y verificación de antecedentes." },
                { title: "Supervisión física permanente", desc: "Supervisores de ronda verifican cada puesto de forma continua." },
                { title: "Respuesta rápida garantizada", desc: "Unidades de reacción disponibles las 24 horas, todos los días." },
                { title: "Protocolos ante emergencias", desc: "Procedimientos definidos para cada tipo de incidente crítico." },
                { title: "Reportes ejecutivos de operación", desc: "Información consolidada entregada puntualmente a la gerencia del cliente." },
                { title: "Mejora continua y tecnología", desc: "Incorporamos herramientas digitales para la gestión operativa avanzada." }
              ].map((item, index) => (
                <FadeIn key={index} delay={0.1 * index}>
                  <div className="flex items-start gap-4 group">
                    <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5 group-hover:bg-primary/20 transition-colors">
                      <CheckCircle className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <h4 className="font-bold text-white mb-1 group-hover:text-primary transition-colors">{item.title}</h4>
                      <p className="text-sm text-muted-foreground">{item.desc}</p>
                    </div>
                  </div>
                </FadeIn>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 6 — SUPERVISION & MONITORING */}
      <section className="py-28 bg-[#070f1c] relative overflow-hidden border-y border-white/5">
        {/* Subtle radial dot pattern bg */}
        <div className="absolute inset-0 opacity-20 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle, #c9a227 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
        
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
          <FadeIn>
            <span className="text-primary text-sm font-bold tracking-widest uppercase mb-4 block">Control Operativo</span>
            <h2 className="text-5xl md:text-6xl font-display font-bold text-white mb-8">Supervisión Continua. Control Total.</h2>
            <p className="text-xl text-muted-foreground mb-16 leading-relaxed">
              Cada puesto de ISP, S.A. está respaldado por un sistema de supervisión que combina rondas físicas, reportes digitales y comunicación directa con el supervisor de zona. Nuestros clientes cuentan con visibilidad operativa en todo momento.
            </p>
          </FadeIn>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
            {[
              { icon: Clock, title: "Monitoreo 24/7", desc: "Supervisores activos durante todos los turnos sin excepción" },
              { icon: BarChart3, title: "Reportes de Operación", desc: "Informes ejecutivos entregados con la periodicidad que el cliente requiera" },
              { icon: Zap, title: "Respuesta a Incidencias", desc: "Protocolo de escalamiento inmediato ante cualquier evento crítico" }
            ].map((item, i) => (
              <FadeIn delay={0.1 * (i+1)} key={i}>
                <div className="bg-[#050d1a]/80 backdrop-blur-md p-8 rounded-2xl border border-white/5 flex flex-col items-center hover:-translate-y-2 hover:border-primary/30 transition-all shadow-xl">
                  <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-6">
                    <item.icon className="w-8 h-8 text-primary" />
                  </div>
                  <h4 className="text-lg font-bold text-white mb-2">{item.title}</h4>
                  <p className="text-sm text-muted-foreground">{item.desc}</p>
                </div>
              </FadeIn>
            ))}
          </div>

          <FadeIn delay={0.4}>
            <p className="text-primary font-medium text-lg bg-primary/10 inline-block px-6 py-2 rounded-full border border-primary/20">
              Nos convertimos en la extensión operativa de su empresa de seguridad.
            </p>
          </FadeIn>
        </div>
      </section>

      {/* SECTION 7 — SECTORS */}
      <section className="py-24 bg-[#050d1a]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <FadeIn>
            <div className="mb-16">
              <div className="divider-gold" />
              <h2 className="text-4xl md:text-5xl font-display font-bold text-white">Sectores que Atendemos</h2>
            </div>
          </FadeIn>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { icon: Factory, title: "Industria y Manufactura", desc: "Protección de plantas de producción, bodegas y centros de distribución con controles estrictos de acceso." },
              { icon: Truck, title: "Logística y Cadena de Suministro", desc: "Prevención de pérdidas en el traslado y almacenamiento de mercancías de alto valor." },
              { icon: Building2, title: "Comercial y Retail", desc: "Seguridad para centros comerciales y plazas, enfocada en la prevención y atención al cliente." },
              { icon: Target, title: "Sector Corporativo", desc: "Seguridad de perfil ejecutivo para edificios de oficinas e instalaciones empresariales." },
              { icon: Users, title: "Eventos Especiales", desc: "Despliegue táctico para control de multitudes y protección VIP en eventos de alta concurrencia." },
              { icon: MapPin, title: "Complejos Residenciales", desc: "Control perimetral y de accesos con protocolos diseñados para la tranquilidad de los residentes." }
            ].map((sector, index) => (
              <FadeIn key={index} delay={index * 0.1}>
                <div className="group glass-panel p-8 rounded-xl flex flex-col h-full hover:border-primary/50 hover:-translate-y-2 hover:shadow-2xl hover:shadow-primary/10 transition-all duration-300">
                  <sector.icon className="w-8 h-8 text-primary mb-6 transition-transform duration-300 group-hover:scale-110" />
                  <h4 className="text-xl font-bold text-white mb-3 group-hover:text-primary transition-colors">{sector.title}</h4>
                  <p className="text-sm text-muted-foreground flex-grow leading-relaxed">{sector.desc}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* SECTION 8 — CTA */}
      <section className="py-32 relative overflow-hidden bg-[#030811]">
        {/* Breathing Orb Background */}
        <div className="absolute top-1/2 left-1/2 w-[800px] h-[800px] bg-primary blur-[100px] rounded-full pointer-events-none animate-breathe" />
        
        <div className="max-w-4xl mx-auto px-4 relative z-10 text-center">
          <FadeIn>
            <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-8 border border-primary/20">
              <Shield className="w-10 h-10 text-primary" />
            </div>
            <h2 className="text-4xl md:text-5xl lg:text-6xl font-display font-bold mb-6 text-white">Solicite una evaluación de seguridad sin costo</h2>
            <p className="text-xl text-muted-foreground mb-10 max-w-2xl mx-auto">
              Permítanos analizar las vulnerabilidades de su operación y presentarle una propuesta de valor enfocada en la mitigación de riesgos.
            </p>
            <div className="flex flex-col sm:flex-row justify-center items-center gap-4 mb-8">
              <a href="#" className="w-full sm:w-auto">
                <button className="h-14 px-10 rounded-full text-base font-semibold bg-primary text-[#050d1a] hover:bg-primary/90 w-full sm:w-auto transition-colors shadow-xl shadow-primary/20">
                  Solicitar Evaluación
                </button>
              </a>
              <a href="#" target="_blank" rel="noopener noreferrer" className="w-full sm:w-auto">
                <button className="h-14 px-10 rounded-full text-base font-semibold border border-primary text-primary hover:bg-primary/10 w-full transition-colors">
                  Contactar por WhatsApp
                </button>
              </a>
            </div>
            <p className="text-sm text-muted-foreground font-medium flex items-center justify-center gap-2">
              <Clock className="w-4 h-4 text-primary" /> Un ejecutivo de cuenta se comunicará en menos de 24 horas.
            </p>
          </FadeIn>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="bg-[#02050a] py-12 border-t border-white/5 relative z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
            <div className="col-span-1 md:col-span-2">
              <div className="flex items-center gap-3 mb-4">
                <Shield className="w-6 h-6 text-primary" />
                <span className="font-bold text-xl tracking-widest text-white">ISP, S.A.</span>
              </div>
              <p className="text-muted-foreground text-sm max-w-sm">
                Seguridad integral, custodia de valores y operaciones móviles con más de 15 años de experiencia en el mercado.
              </p>
            </div>
            <div>
              <h4 className="text-white font-bold mb-4">Enlaces</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-primary transition-colors">Inicio</a></li>
                <li><a href="#" className="hover:text-primary transition-colors">Nosotros</a></li>
                <li><a href="#" className="hover:text-primary transition-colors">Servicios</a></li>
                <li><a href="#" className="hover:text-primary transition-colors">Sectores</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-bold mb-4">Contacto</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-center gap-2"><PhoneCall className="w-4 h-4 text-primary" /> +502 2200-0000</li>
                <li className="flex items-center gap-2"><MessageSquare className="w-4 h-4 text-primary" /> WhatsApp Directo</li>
              </ul>
            </div>
          </div>
          <div className="border-t border-white/10 pt-8 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
            <p>© {new Date().getFullYear()} Investigaciones y Seguridad Profesional S.A. Todos los derechos reservados.</p>
            <div className="flex gap-4">
              <a href="#" className="hover:text-white transition-colors">Términos de uso</a>
              <a href="#" className="hover:text-white transition-colors">Políticas de privacidad</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
