import { Link } from "wouter";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background text-foreground">
      <div className="text-center p-8 bg-card rounded-3xl border border-white/5 shadow-2xl max-w-md w-full">
        <AlertCircle className="w-16 h-16 text-primary mx-auto mb-6" />
        <h1 className="text-4xl font-bold mb-4">404</h1>
        <p className="text-lg text-muted-foreground mb-8">Página no encontrada o ruta inexistente.</p>
        <Link href="/">
          <Button size="lg" className="w-full">
            Volver al Inicio
          </Button>
        </Link>
      </div>
    </div>
  );
}
