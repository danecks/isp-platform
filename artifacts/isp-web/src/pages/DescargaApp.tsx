import { PageLayout } from "@/components/layout/PageLayout";
import { FadeIn } from "@/components/animations/FadeIn";
import { QRCodeSVG } from "qrcode.react";
import { Button } from "@/components/ui/button";
import {
  Smartphone,
  Download,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";

const APK_URL =
  "https://github.com/danecks/isp-platform/releases/download/mobile-v0.1.0/ISP-Operaciones-v0.1.0.apk";
const VERSION = "v0.1.0";

export default function DescargaApp() {
  return (
    <PageLayout>
      <section className="pt-32 pb-12 bg-background border-b border-white/5">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <FadeIn>
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
              <Smartphone className="w-4 h-4" />
              Aplicación móvil para guardias y supervisores
            </div>
            <h1 className="text-4xl md:text-5xl font-bold mb-4">
              ISP Operaciones
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Escaneá el código QR con tu teléfono Android para descargar la
              aplicación.
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              Versión {VERSION} · Compatible con Android 8 o superior
            </p>
          </FadeIn>
        </div>
      </section>

      <section className="py-16">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
            <FadeIn>
              <div className="bg-white p-8 rounded-2xl shadow-2xl flex flex-col items-center">
                <QRCodeSVG
                  value={APK_URL}
                  size={280}
                  level="M"
                  includeMargin
                />
                <p className="mt-6 text-center text-sm text-gray-700 font-medium">
                  Escaneá con la cámara de tu teléfono
                </p>
              </div>
            </FadeIn>

            <FadeIn>
              <div className="space-y-6">
                <h2 className="text-2xl font-bold">Cómo instalarla</h2>
                <ol className="space-y-4">
                  <li className="flex gap-3">
                    <span className="shrink-0 w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">
                      1
                    </span>
                    <span className="text-muted-foreground">
                      Abrí la cámara del teléfono y apuntá al código QR. Tocá
                      el link que aparece.
                    </span>
                  </li>
                  <li className="flex gap-3">
                    <span className="shrink-0 w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">
                      2
                    </span>
                    <span className="text-muted-foreground">
                      Esperá a que termine de descargar (~30 MB) y tocá el
                      archivo .apk.
                    </span>
                  </li>
                  <li className="flex gap-3">
                    <span className="shrink-0 w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">
                      3
                    </span>
                    <span className="text-muted-foreground">
                      Si Android pide permiso para "instalar apps desconocidas",
                      tocá "Permitir" solo para el navegador.
                    </span>
                  </li>
                  <li className="flex gap-3">
                    <span className="shrink-0 w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">
                      4
                    </span>
                    <span className="text-muted-foreground">
                      Tocá "Instalar". Cuando termine, abrí{" "}
                      <strong>ISP Operaciones</strong> y entrá con tu carnet.
                    </span>
                  </li>
                </ol>

                <div className="pt-2">
                  <Button asChild size="lg" className="w-full md:w-auto">
                    <a href={APK_URL} download>
                      <Download className="w-5 h-5 mr-2" />
                      Descargar APK directamente
                    </a>
                  </Button>
                  <p className="text-xs text-muted-foreground mt-2">
                    Usá este botón si ya estás navegando desde el teléfono.
                  </p>
                </div>
              </div>
            </FadeIn>
          </div>
        </div>
      </section>

      <section className="py-12 bg-background/40 border-t border-white/5">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <FadeIn>
            <div className="flex items-start gap-4 p-6 rounded-xl border border-orange-500/30 bg-orange-500/5">
              <AlertTriangle className="w-7 h-7 text-orange-400 shrink-0 mt-1" />
              <div>
                <h3 className="text-xl font-bold text-orange-300 mb-2">
                  Importante para teléfonos Xiaomi, Redmi y POCO (MIUI)
                </h3>
                <p className="text-muted-foreground mb-4">
                  MIUI cierra apps en segundo plano por defecto y eso rompe el
                  seguimiento GPS continuo. Antes de salir a turno hay que
                  configurar lo siguiente en cada equipo:
                </p>
                <ul className="space-y-2 text-sm">
                  <li className="flex gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0 mt-0.5" />
                    <span>
                      <strong>Ajustes → Apps → ISP Operaciones:</strong>{" "}
                      activar "Inicio automático".
                    </span>
                  </li>
                  <li className="flex gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0 mt-0.5" />
                    <span>
                      Permisos → Ubicación →{" "}
                      <strong>"Permitir siempre"</strong> (no "Solo mientras se
                      usa").
                    </span>
                  </li>
                  <li className="flex gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0 mt-0.5" />
                    <span>Permisos → Notificaciones: permitir todas.</span>
                  </li>
                  <li className="flex gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0 mt-0.5" />
                    <span>
                      <strong>Batería → Ahorro de batería</strong>: marcar la
                      app como "Sin restricciones".
                    </span>
                  </li>
                  <li className="flex gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0 mt-0.5" />
                    <span>
                      En la pantalla de apps recientes, mantener presionado el
                      ícono y tocar el candado 🔒 para fijarla en memoria.
                    </span>
                  </li>
                </ul>
              </div>
            </div>

            <div className="flex items-start gap-4 p-6 rounded-xl border border-blue-500/30 bg-blue-500/5 mt-6">
              <ShieldAlert className="w-7 h-7 text-blue-400 shrink-0 mt-1" />
              <div>
                <h3 className="text-lg font-bold text-blue-300 mb-2">
                  Aplicación oficial firmada
                </h3>
                <p className="text-sm text-muted-foreground">
                  Este APK fue firmado digitalmente con el certificado de
                  Investigaciones y Seguridad Profesional, S.A. y publicado
                  desde nuestro repositorio oficial. Solo descargá la app
                  desde esta página o desde el link directo que aparece
                  arriba.
                </p>
              </div>
            </div>
          </FadeIn>
        </div>
      </section>
    </PageLayout>
  );
}
