import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { Eye, EyeOff, AlertCircle, Lock, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { brand } from "@/config/branding";

const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined;

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: Record<string, unknown>) => string;
      reset: (id?: string) => void;
      remove: (id: string) => void;
    };
    __ispOnTurnstileLoad?: () => void;
  }
}

export default function AdminLogin() {
  const [, navigate] = useLocation();
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [captchaToken, setCaptchaToken] = useState("");
  const [captchaStatus, setCaptchaStatus] = useState<"loading" | "ready" | "error" | "verified">("loading");
  const captchaContainerRef = useRef<HTMLDivElement>(null);
  const captchaWidgetIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!TURNSTILE_SITE_KEY) {
      setCaptchaStatus("ready");
      return;
    }

    const failTimer = window.setTimeout(() => {
      if (!captchaWidgetIdRef.current) setCaptchaStatus("error");
    }, 8000);

    const renderWidget = () => {
      if (!captchaContainerRef.current || captchaWidgetIdRef.current || !window.turnstile) return;
      try {
        captchaWidgetIdRef.current = window.turnstile.render(captchaContainerRef.current, {
          sitekey: TURNSTILE_SITE_KEY,
          theme: "dark",
          callback: (token: string) => { setCaptchaToken(token); setCaptchaStatus("verified"); },
          "error-callback": () => { setCaptchaToken(""); setCaptchaStatus("error"); },
          "expired-callback": () => { setCaptchaToken(""); setCaptchaStatus("ready"); },
        });
        setCaptchaStatus((s) => (s === "verified" ? s : "ready"));
      } catch {
        setCaptchaStatus("error");
      }
    };

    if (window.turnstile) {
      renderWidget();
    } else {
      window.__ispOnTurnstileLoad = renderWidget;
      if (!document.querySelector('script[data-isp-turnstile]')) {
        const s = document.createElement("script");
        s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?onload=__ispOnTurnstileLoad&render=explicit";
        s.async = true;
        s.defer = true;
        s.onerror = () => setCaptchaStatus("error");
        s.setAttribute("data-isp-turnstile", "true");
        document.head.appendChild(s);
      }
    }

    return () => {
      window.clearTimeout(failTimer);
      if (captchaWidgetIdRef.current && window.turnstile) {
        try { window.turnstile.remove(captchaWidgetIdRef.current); } catch { /* ignore */ }
        captchaWidgetIdRef.current = null;
      }
    };
  }, []);

  const resetCaptcha = () => {
    setCaptchaToken("");
    if (captchaWidgetIdRef.current && window.turnstile) {
      try { window.turnstile.reset(captchaWidgetIdRef.current); } catch { /* ignore */ }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (TURNSTILE_SITE_KEY && !captchaToken) {
      setError("Por favor complete la verificación de seguridad.");
      return;
    }
    setLoading(true);
    const result = await login(username, password, captchaToken);
    setLoading(false);
    if (!result.ok) {
      resetCaptcha();
    }
    if (result.ok) {
      try {
        const raw = sessionStorage.getItem("isp_admin_session_v2");
        const user = raw ? JSON.parse(raw) : null;
        navigate(user?.rol === "cliente" ? "/portal/dashboard" : "/admin/dashboard");
      } catch {
        navigate("/admin/dashboard");
      }
    } else {
      setError(result.error ?? "Usuario o contraseña incorrectos.");
    }
  };

  return (
    <div className="min-h-screen bg-[#050d1a] flex items-center justify-center relative overflow-hidden px-4">
      {/* Background effects */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/8 via-transparent to-transparent pointer-events-none" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-primary/5 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-blue-900/10 blur-[100px] rounded-full pointer-events-none" />

      {/* Grid pattern */}
      <div
        className="absolute inset-0 opacity-[0.02] pointer-events-none"
        style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
          backgroundSize: "60px 60px",
        }}
      />

      <div className="w-full max-w-md relative z-10">
        {/* Logo / Brand */}
        <div className="text-center mb-10">
          <div className="h-32 mx-auto mb-4 flex items-center justify-center">
            <img src={`${import.meta.env.BASE_URL}images/logo-isp.png`} alt="ISP, S.A." className="h-full w-auto object-contain" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">{brand.shortName}</h1>
          <p className="text-sm text-muted-foreground mt-1">{brand.systemName}</p>
        </div>

        {/* Card */}
        <div className="bg-[#07111f] border border-white/8 rounded-2xl p-8 shadow-2xl">
          <h2 className="text-lg font-semibold text-white mb-1">Acceso Restringido</h2>
          <p className="text-sm text-muted-foreground mb-8">
            Ingrese sus credenciales para continuar al panel de control.
          </p>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="username" className="text-sm text-white/70 font-medium">
                Usuario
              </Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="username"
                  type="text"
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Nombre de usuario"
                  className="pl-10 bg-[#060e1c] border-white/10 text-white placeholder:text-white/30 focus:border-primary/50 h-11"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm text-white/70 font-medium">
                Contraseña
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="pl-10 pr-10 bg-[#060e1c] border-white/10 text-white placeholder:text-white/30 focus:border-primary/50 h-11"
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

            {TURNSTILE_SITE_KEY && (
              <div className="space-y-2">
                <div ref={captchaContainerRef} className="flex justify-center min-h-[65px] items-center" />
                {captchaStatus === "loading" && (
                  <p className="text-xs text-white/40 text-center">Cargando verificación de seguridad…</p>
                )}
                {captchaStatus === "error" && (
                  <p className="text-xs text-red-400 text-center">
                    No se pudo cargar la verificación. Revise su conexión o desactive bloqueadores y recargue la página.
                  </p>
                )}
              </div>
            )}

            {error && (
              <div className="flex items-center gap-2 bg-red-950/40 border border-red-500/20 rounded-lg px-4 py-3">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                <p className="text-sm text-red-400">{error}</p>
              </div>
            )}

            <Button
              type="submit"
              disabled={loading || (!!TURNSTILE_SITE_KEY && !captchaToken)}
              className="w-full h-11 bg-primary text-[#050d1a] font-bold hover:bg-primary/90 rounded-lg mt-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-[#050d1a]/30 border-t-[#050d1a] rounded-full animate-spin" />
                  Verificando...
                </span>
              ) : (
                "Ingresar al Sistema"
              )}
            </Button>
          </form>

          <div className="mt-8 pt-6 border-t border-white/5 text-center">
            <p className="text-xs text-muted-foreground">
              Acceso exclusivo para personal autorizado de {brand.shortName}
            </p>
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6">
          <a href="/" className="hover:text-white/60 transition-colors">
            ← Volver al sitio público
          </a>
        </p>
      </div>
    </div>
  );
}
