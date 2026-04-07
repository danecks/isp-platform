import VacacionesTab from "@/admin/pages/VacacionesTab";
import { AdminLayout } from "@/admin/layout/AdminLayout";

export default function AdminVacaciones() {
  return (
    <AdminLayout title="Solicitudes de Vacaciones">
      <VacacionesTab />
    </AdminLayout>
  );
}
