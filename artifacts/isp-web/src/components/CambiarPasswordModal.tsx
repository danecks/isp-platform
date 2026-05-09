import { useState } from "react";
import { createPortal } from "react-dom";
import { KeyRound, X, Lock, AlertCircle, Check, Loader2, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getSessionToken } from "@/lib/httpClient";

function getAdminSessionHeader(): Record<string, string> {
  try {
    const raw = getSessionToken();
    return raw ? { "x-isp-session": raw } : {};
  } catch { return {}; }
}

interface Props {
  onClose: () => void;
}

export function CambiarPasswordModal({ onClose }: Props) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!currentPassword || !newPassword || !confirmPassword) {
      setError("Todos los campos son obligatorios");
      return;
    }
    if (newPassword.length < 4) {
      setError("La nueva contraseña debe tener al menos 4 caracteres");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("La nueva contraseña y su confirmación no coinciden");
      return;
    }
    if (newPassword === currentPassword) {
      setError("La nueva contraseña debe ser distinta de la actual");
      return;
    }

    setLoading(true);
    try {
      const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
      const r = await fetch(`${BASE}/api/auth/change-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAdminSessionHeader() },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError(data.error ?? "No se pudo cambiar la contraseña");
        return;
      }
      setSuccess(true);
      setTimeout(() => { onClose(); }, 1500);
    } catch {
      setError("Error de conexión con el servidor");
    } finally {
      setLoading(false);
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-[#0a1628] border border-white/10 rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/8">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center">
              <KeyRound className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Cambiar mi contraseña</h2>
              <p className="text-[10px] text-white/40">Solo vos podés ver tu nueva contraseña.</p>
            </div>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white p-1">
            <X className="w-4 h-4" />
          </button>
        </div>

        {success ? (
          <div className="p-8 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-green-500/20 border border-green-500/30 flex items-center justify-center mx-auto">
              <Check className="w-6 h-6 text-green-400" />
            </div>
            <p className="text-sm font-semibold text-white">Contraseña actualizada</p>
            <p className="text-xs text-white/50">Usá la nueva contraseña la próxima vez que ingreses.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-white/60 font-medium">Contraseña actual *</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
                <Input
                  type={showCurrent ? "text" : "password"}
                  value={currentPassword}
                  onChange={e => setCurrentPassword(e.target.value)}
                  placeholder="Tu contraseña actual"
                  className="pl-9 pr-10 bg-[#060e1c] border-white/10 text-white text-sm h-10"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrent(s => !s)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-white/30 hover:text-white p-1"
                >
                  {showCurrent ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-white/60 font-medium">Nueva contraseña *</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
                <Input
                  type={showNew ? "text" : "password"}
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="Mínimo 4 caracteres"
                  className="pl-9 pr-10 bg-[#060e1c] border-white/10 text-white text-sm h-10"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowNew(s => !s)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-white/30 hover:text-white p-1"
                >
                  {showNew ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-white/60 font-medium">Confirmar nueva contraseña *</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
                <Input
                  type={showNew ? "text" : "password"}
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="Repetí la nueva contraseña"
                  className="pl-9 bg-[#060e1c] border-white/10 text-white text-sm h-10"
                  autoComplete="new-password"
                />
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 bg-red-950/40 border border-red-500/20 rounded-lg px-3 py-2.5">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                <p className="text-xs text-red-400">{error}</p>
              </div>
            )}

            <div className="flex gap-3 pt-1">
              <Button type="button" variant="outline" onClick={onClose} className="flex-1 border-white/10 text-white/60 hover:text-white h-10">
                Cancelar
              </Button>
              <Button type="submit" disabled={loading} className="flex-1 bg-primary text-[#050d1a] font-bold hover:bg-primary/90 h-10">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Cambiar contraseña"}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>,
    document.body
  );
}
