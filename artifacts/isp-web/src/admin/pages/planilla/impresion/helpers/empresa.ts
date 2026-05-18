// Hook para obtener la configuración de empresa (encabezado de impresión)
import { useEffect, useState } from "react";
import { BASE, getSession } from "../../helpers";

const API = `${BASE}/api`;

export interface ConfigEmpresa {
  nombre_empresa: string | null;
  nit_empresa: string | null;
  direccion_empresa: string | null;
  telefono_empresa: string | null;
  representante_nombre: string | null;
}

export function useConfigEmpresa() {
  const [data, setData] = useState<ConfigEmpresa | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    fetch(`${API}/config-empresa`, { headers: { "x-isp-session": getSession() } })
      .then(r => r.ok ? r.json() : null)
      .then(setData)
      .finally(() => setLoading(false));
  }, []);
  return { empresa: data, loading };
}
