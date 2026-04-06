import { useState, useEffect } from "react";
import { KioskScreen } from "@/admin/pages/NfcPiloto";

export default function KioskoPublico() {
  const [devices, setDevices] = useState<Parameters<typeof KioskScreen>[0]["devices"]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch("/api/pilot/nfc/kiosk/devices")
      .then(r => r.ok ? r.json() : [])
      .then((data: { id: number; device_code: string; device_name: string; status: string; has_token: boolean; nombre_puesto?: string }[]) => {
        // Mapear has_token → device_token_hash (el KioskScreen solo lo evalúa como truthy/falsy)
        setDevices(data.map(d => ({
          id: d.id,
          device_code: d.device_code,
          device_name: d.device_name,
          status: d.status,
          device_token_hash: d.has_token ? "enrolled" : null,
          nombre_puesto: d.nombre_puesto,
          device_uuid: "",
          sandbox_mode: true,
          puesto_id_ref: null,
          notes: null,
          last_seen_at: null,
          created_at: new Date().toISOString(),
        })));
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  if (!loaded) {
    return (
      <div className="fixed inset-0 bg-[#04080f] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return <KioskScreen devices={devices} />;
}
