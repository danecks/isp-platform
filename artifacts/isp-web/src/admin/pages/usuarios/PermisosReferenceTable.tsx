import { Check, ShieldCheck, Info } from "lucide-react";
import { RolBadge, ROLES_ADMIN } from "./shared";

const ROWS: Array<{
  mod: string;
  admin: boolean | "permiso";
  operaciones: boolean | "permiso";
  rrhh: boolean | "permiso";
  comercial: boolean | "permiso";
  supervisor: boolean | "permiso";
  guardia: boolean | "permiso";
  cliente: boolean | "permiso";
}> = [
  { mod: "Panel admin",        admin: true,  operaciones: true,  rrhh: true,  comercial: true,  supervisor: true,  guardia: false, cliente: false },
  { mod: "Incidencias",        admin: true,  operaciones: true,  rrhh: false, comercial: false, supervisor: true,  guardia: false, cliente: false },
  { mod: "Tareas",             admin: true,  operaciones: true,  rrhh: false, comercial: false, supervisor: true,  guardia: false, cliente: false },
  { mod: "Reclutamiento",      admin: true,  operaciones: false, rrhh: true,  comercial: false, supervisor: false, guardia: false, cliente: false },
  { mod: "Anticipos (panel)",  admin: true,  operaciones: false, rrhh: true,  comercial: false, supervisor: false, guardia: false, cliente: false },
  { mod: "Comercial / Leads",  admin: true,  operaciones: false, rrhh: false, comercial: true,  supervisor: false, guardia: false, cliente: false },
  { mod: "KPI Ejecutivo",      admin: true,  operaciones: false, rrhh: false, comercial: false, supervisor: false, guardia: false, cliente: false },
  { mod: "Usuarios",           admin: true,  operaciones: false, rrhh: false, comercial: false, supervisor: false, guardia: false, cliente: false },
  { mod: "Portal de cliente",  admin: false, operaciones: false, rrhh: false, comercial: false, supervisor: false, guardia: false, cliente: true  },
  { mod: "WhatsApp (reportar)", admin: true, operaciones: true,  rrhh: false, comercial: false, supervisor: true,  guardia: "permiso", cliente: false },
  { mod: "WhatsApp (anticipo)", admin: true, operaciones: false, rrhh: false, comercial: false, supervisor: false, guardia: "permiso", cliente: false },
];

export function PermisosReferenceTable() {
  return (
    <div className="bg-card border border-white/5 rounded-xl p-5">
      <h3 className="text-xs font-bold text-white/60 uppercase tracking-widest mb-4 flex items-center gap-2">
        <ShieldCheck className="w-3.5 h-3.5" />
        Referencia de Permisos por Rol
      </h3>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-white/5">
              <th className="text-left text-white/30 font-medium pb-2 pr-4">Módulo / Capacidad</th>
              {ROLES_ADMIN.map(r => (
                <th key={r} className="text-center pb-2 px-2">
                  <RolBadge rol={r} />
                </th>
              ))}
              <th className="text-center pb-2 px-2"><RolBadge rol="guardia" /></th>
              <th className="text-center pb-2 px-2"><RolBadge rol="cliente" /></th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map(row => (
              <tr key={row.mod} className="border-b border-white/3 hover:bg-white/1">
                <td className="py-2 pr-4 text-white/60">{row.mod}</td>
                {(["admin", "operaciones", "rrhh", "comercial", "supervisor", "guardia", "cliente"] as const).map(r => (
                  <td key={r} className="text-center py-2 px-2">
                    {row[r] === true ? (
                      <Check className="w-3.5 h-3.5 text-green-400 mx-auto" />
                    ) : row[r] === "permiso" ? (
                      <span className="text-[9px] text-primary font-bold mx-auto block text-center">PERM</span>
                    ) : (
                      <span className="text-white/15 text-base">—</span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[10px] text-white/25 mt-3 flex items-center gap-1">
        <Info className="w-3 h-3" />
        <strong className="text-white/40">PERM</strong> = Requiere habilitación explícita desde el tab "Permisos WA" de este módulo.
      </p>
    </div>
  );
}
