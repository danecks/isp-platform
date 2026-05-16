/**
 * Prestaciones.tsx — Módulo de Prestaciones Laborales (Guatemala)
 * Aguinaldo · Bono 14 · Vacaciones · Indemnización · Liquidación Final · Provisiones
 *
 * Container delgado: cada pestaña vive en `./prestaciones/`.
 */

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Landmark, Palmtree, Receipt, Settings2,
  TrendingUp, Gift,
} from "lucide-react";
import { AdminLayout } from "@/admin/layout/AdminLayout";
import VacacionesTab from "@/admin/pages/VacacionesTab";

import { TabConfiguracion } from "./prestaciones/TabConfiguracion";
import { TabPrestacionesOdbc } from "./prestaciones/TabPrestacionesOdbc";
import { TabProvisiones } from "./prestaciones/TabProvisiones";
import { TabLiquidaciones } from "./prestaciones/TabLiquidaciones";

export default function Prestaciones() {
  return (
    <AdminLayout>
      <div className="min-h-screen bg-[#050d1a] text-white">
        {/* Header */}
        <div className="border-b border-white/8 bg-[#060e1c]/80 backdrop-blur-sm px-6 py-5 flex items-center gap-4">
          <div className="w-10 h-10 rounded-2xl bg-teal-500/15 border border-teal-500/25 flex items-center justify-center">
            <Landmark className="w-5 h-5 text-teal-400" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white">Prestaciones Laborales</h1>
            <p className="text-xs text-white/40 mt-0.5">
              Aguinaldo · Bono 14 · Vacaciones · Indemnización · Liquidación — Ley Guatemala
            </p>
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="bono14" className="flex flex-col h-full">
          <div className="px-6 pt-4 border-b border-white/8 overflow-x-auto">
            <TabsList className="bg-transparent gap-1 p-0 flex-nowrap">
              {[
                { value: "bono14",      label: "Bono 14",        Icon: Gift,       color: "data-[state=active]:text-blue-300 data-[state=active]:border-blue-500 data-[state=active]:bg-blue-500/10" },
                { value: "aguinaldo",   label: "Aguinaldo",      Icon: Gift,       color: "data-[state=active]:text-purple-300 data-[state=active]:border-purple-500 data-[state=active]:bg-purple-500/10" },
                { value: "vacaciones",  label: "Vacaciones",     Icon: Palmtree,   color: "data-[state=active]:text-teal-300 data-[state=active]:border-teal-500 data-[state=active]:bg-teal-500/10" },
                { value: "provisiones", label: "Provisiones",    Icon: TrendingUp, color: "data-[state=active]:text-teal-300 data-[state=active]:border-teal-500 data-[state=active]:bg-teal-500/10" },
                { value: "liquidaciones",label: "Liquidaciones", Icon: Receipt,    color: "data-[state=active]:text-teal-300 data-[state=active]:border-teal-500 data-[state=active]:bg-teal-500/10" },
                { value: "config",      label: "Configuración",  Icon: Settings2,  color: "data-[state=active]:text-teal-300 data-[state=active]:border-teal-500 data-[state=active]:bg-teal-500/10" },
              ].map(({ value, label, Icon, color }) => (
                <TabsTrigger
                  key={value}
                  value={value}
                  className={`px-4 py-2 text-xs font-medium rounded-t-xl data-[state=active]:border-b-2 text-white/40 hover:text-white/70 transition-all border-b-2 border-transparent whitespace-nowrap ${color}`}
                >
                  <Icon className="w-3.5 h-3.5 mr-1.5" />
                  {label}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          <TabsContent value="bono14" className="mt-0 flex-1">
            <TabPrestacionesOdbc tipo="bono14" />
          </TabsContent>
          <TabsContent value="aguinaldo" className="mt-0 flex-1">
            <TabPrestacionesOdbc tipo="aguinaldo" />
          </TabsContent>
          <TabsContent value="vacaciones" className="mt-0 flex-1 px-6 pt-4">
            <VacacionesTab />
          </TabsContent>
          <TabsContent value="provisiones" className="mt-0 flex-1">
            <TabProvisiones />
          </TabsContent>
          <TabsContent value="liquidaciones" className="mt-0 flex-1">
            <TabLiquidaciones />
          </TabsContent>
          <TabsContent value="config" className="mt-0 flex-1">
            <TabConfiguracion />
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}
