import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Info, Pencil, Save, Settings } from "lucide-react";
import { apiRequest } from "./helpers";
import type { TarifaHE } from "./types";

export function TabTarifasHE() {
  const [tarifas, setTarifas] = useState<TarifaHE[]>([]);
  const [loading, setLoading] = useState(true);
  const [editId, setEditId] = useState<number | null>(null);
  const [editTarifa, setEditTarifa] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [saving, setSaving] = useState(false);

  const cargar = useCallback(async () => {
    try {
      const data = await apiRequest<TarifaHE[]>("/nomina/tarifas-he");
      setTarifas(data);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  async function guardar(id: number) {
    setSaving(true);
    try {
      await apiRequest(`/nomina/tarifas-he/${id}`, {
        method: "PUT",
        json: { tarifa: Number(editTarifa), descripcion: editDesc || null },
      });
      setEditId(null);
      await cargar();
    } catch { /* ignore */ }
    setSaving(false);
  }

  if (loading) return <div className="p-8 text-center text-[#8bacc8]">Cargando tarifas…</div>;

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center gap-3">
        <Settings className="h-5 w-5 text-amber-400" />
        <div>
          <h3 className="text-white font-semibold">Tarifas de Horas Extra</h3>
          <p className="text-xs text-[#8bacc8]">
            Monto fijo que se paga por cada turno completo de horas extra. Se aplica en la planilla automáticamente.
          </p>
        </div>
      </div>

      <Separator className="bg-[#1e3a5f]" />

      <div className="grid gap-3">
        {tarifas.map((t) => {
          const isEditing = editId === t.id;
          return (
            <div key={t.id} className="bg-[#0a1628] border border-[#1e3a5f] rounded-lg p-4 flex items-center gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-lg font-bold text-white">Turno {t.jornada}</span>
                  <Badge className="bg-blue-900 text-blue-300">{t.horas_turno} horas</Badge>
                </div>
                {isEditing ? (
                  <div className="space-y-2 mt-2">
                    <div className="flex items-center gap-2">
                      <Label className="text-xs text-[#8bacc8] w-16">Tarifa Q</Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={editTarifa}
                        onChange={(e) => setEditTarifa(e.target.value)}
                        className="w-32 bg-[#0d1b2a] border-[#1e3a5f] text-white"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <Label className="text-xs text-[#8bacc8] w-16">Nota</Label>
                      <Input
                        value={editDesc}
                        onChange={(e) => setEditDesc(e.target.value)}
                        className="flex-1 bg-[#0d1b2a] border-[#1e3a5f] text-white"
                        placeholder="Descripción opcional"
                      />
                    </div>
                    <div className="flex gap-2 mt-1">
                      <Button size="sm" onClick={() => guardar(t.id)} disabled={saving || !editTarifa}
                        className="bg-amber-600 hover:bg-amber-500 text-white gap-1">
                        <Save className="h-3.5 w-3.5" /> Guardar
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditId(null)}
                        className="text-[#8bacc8] hover:text-white">
                        Cancelar
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-[#8bacc8]">{t.descripcion || "Sin descripción"}</p>
                )}
              </div>
              {!isEditing && (
                <div className="text-right">
                  <p className="text-2xl font-bold text-amber-400">Q{parseFloat(t.tarifa).toFixed(2)}</p>
                  <button
                    onClick={() => { setEditId(t.id); setEditTarifa(t.tarifa); setEditDesc(t.descripcion ?? ""); }}
                    className="text-xs text-[#8bacc8] hover:text-white flex items-center gap-1 mt-1 ml-auto"
                  >
                    <Pencil className="h-3 w-3" /> Editar
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {tarifas.length === 0 && (
        <div className="text-center py-8 text-[#8bacc8]">
          No hay tarifas configuradas. Reinicie el servidor para crear las tarifas predeterminadas.
        </div>
      )}

      <div className="bg-amber-950/30 border border-amber-700/50 rounded p-3 text-xs text-amber-300 flex gap-2">
        <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
        <span>
          Estos montos se aplican automáticamente al calcular la planilla. Si un agente cubre un turno de 12h como HE,
          se le paga Q{tarifas.find(t => t.jornada === "12h")?.tarifa ?? "150"}. Para un turno de 24h,
          Q{tarifas.find(t => t.jornada === "24h")?.tarifa ?? "300"}.
        </span>
      </div>
    </div>
  );
}
