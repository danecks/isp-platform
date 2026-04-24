import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { DeleteModeProvider } from "@/contexts/DeleteModeContext";
import { AuthGuard } from "@/components/AuthGuard";
import { PortalGuard } from "@/components/PortalGuard";

// Public pages
import Home from "@/pages/home";
import Nosotros from "@/pages/nosotros";
import Servicios from "@/pages/servicios/index";
import SeguridadFisica from "@/pages/servicios/seguridad-fisica";
import CustodiaTransporte from "@/pages/servicios/custodia-transporte";
import Sectores from "@/pages/sectores";
import Reclutamiento from "@/pages/reclutamiento";
import SolicitarServicio from "@/pages/solicitar-servicio";
import Contacto from "@/pages/contacto";
import AccesoClientes from "@/pages/acceso-clientes";
import AnuncioPlazas from "@/pages/AnuncioPlazas";
import NotFound from "@/pages/not-found";

// Admin pages
import AdminLogin from "@/admin/pages/Login";
import AdminDashboard from "@/admin/pages/Dashboard";
import AdminIncidencias from "@/admin/pages/Incidencias";
import AdminComercial from "@/admin/pages/Comercial";
import AdminTareas from "@/admin/pages/Tareas";
import AdminKPI from "@/admin/pages/KPI";
import AdminCustodias from "@/admin/pages/Custodias";
import AdminClientes from "@/admin/pages/Clientes";
import AdminUsuarios from "@/admin/pages/Usuarios";
import AdminAnticipos from "@/admin/pages/Anticipos";
import AdminSeguros from "@/admin/pages/Seguros";
import AdminWhatsappConfig from "@/admin/pages/configuracion/WhatsappConfig";
import AdminPlantillasContrato from "@/admin/pages/configuracion/PlantillasContrato";
import AdminReportes from "@/admin/pages/Reportes";
import AdminCMS from "@/admin/pages/CMS";
import AdminSimulador from "@/admin/pages/SimuladorWhatsApp";
import AdminEmpleados from "@/admin/pages/Empleados";
import AdminOperaciones from "@/admin/pages/Operaciones";
import AdminCierresHistorico from "@/admin/pages/CierresHistorico";
import AdminPizarronHistorico from "@/admin/pages/PizarronHistorico";
import AdminZonasOperativas from "@/admin/pages/ZonasOperativas";
import AdminRrhhEventos from "@/admin/pages/RRHHEventos";
import AdminRrhhAlertas from "@/admin/pages/RRHHAlertas";
import AdminNovedadesNomina from "@/admin/pages/NovedadesNomina";
import AdminPrePlanilla from "@/admin/pages/PrePlanilla";
import AdminPlanilla from "@/admin/pages/Planilla";
import AdminTurnos from "@/admin/pages/Turnos";
import AdminFichaCliente from "@/admin/pages/FichaCliente";
import AdminIGSS from "@/admin/pages/IGSS";
import AdminReporteCoberturaZonas from "@/admin/pages/ReporteCoberturaZonas";
import AdminCambiosEstructurales from "@/admin/pages/CambiosEstructurales";
import AdminPipelineServicios from "@/admin/pages/PipelineServicios";
import AdminTableroServicios from "@/admin/pages/TableroServicios";
import AdminVehiculos from "@/admin/pages/Vehiculos";
import AdminArmeria from "@/admin/pages/Armeria";
import AdminSolicitudesEliminacion from "@/admin/pages/SolicitudesEliminacion";
import AdminCambiosSalariales from "@/admin/pages/CambiosSalariales";
import AdminPrestaciones from "@/admin/pages/Prestaciones";
import AdminPlanillasEspeciales from "@/admin/pages/PlanillasEspeciales";
import AdminLibroSalarios from "@/admin/pages/LibroSalarios";
import AdminBodega from "@/admin/pages/Bodega";
import AdminImportacion from "@/admin/pages/Importacion";
import AdminControlOperativoQR from "@/admin/pages/ControlOperativoQR";
import AdminVacaciones from "@/admin/pages/AdminVacaciones";
import CarnetesQR from "@/admin/pages/CarnetesQR";
import AdminBarracas from "@/admin/pages/Barracas";
import AdminAmonestaciones from "@/admin/pages/Amonestaciones";
import RondaGuardia from "@/pages/RondaGuardia";
import AgenteEscaneo from "@/pages/AgenteEscaneo";
import SupervisorActivar from "@/pages/SupervisorActivar";
import KioscoSolicitud from "@/pages/KioscoSolicitud";
import SolicitudEmpleo from "@/pages/SolicitudEmpleo";
import ActualizacionDatos from "@/pages/ActualizacionDatos";
import SolicitarAnticipo from "@/pages/SolicitarAnticipo";
import AdminKioscoSolicitudes from "@/admin/pages/KioscoSolicitudes";
import AdminKioscoSolicitudImprimible from "@/admin/pages/KioscoSolicitudImprimible";
import AdminMergeRequests from "@/admin/pages/MergeRequests";
import AdminModeloDatos from "@/admin/pages/ModeloDatos";
import AdminDocumentacion from "@/admin/pages/Documentacion";

// Portal de clientes
import PortalDashboard from "@/portal/pages/PortalDashboard";
import PortalIncidencias from "@/portal/pages/PortalIncidencias";
import PortalKPI from "@/portal/pages/PortalKPI";
import PortalAgentes from "@/portal/pages/PortalAgentes";
import PortalSolicitudes from "@/portal/pages/PortalSolicitudes";
import PortalCobertura from "@/portal/pages/PortalCobertura";
import PortalFichajes from "@/portal/pages/PortalFichajes";
import PortalRecorridos from "@/portal/pages/PortalRecorridos";
import PortalRondas from "@/portal/pages/PortalRondas";
import AgenteInicio from "@/pages/AgenteInicio";

const queryClient = new QueryClient();

function Router() {
  return (
    <Switch>
      {/* ── Rutas públicas ─────────────────────────────────────────────── */}
      <Route path="/" component={Home} />
      <Route path="/nosotros" component={Nosotros} />
      <Route path="/servicios" component={Servicios} />
      <Route path="/servicios/seguridad-fisica" component={SeguridadFisica} />
      <Route path="/servicios/custodia-transporte" component={CustodiaTransporte} />
      <Route path="/sectores" component={Sectores} />
      <Route path="/reclutamiento" component={Reclutamiento} />
      <Route path="/solicitar-servicio" component={SolicitarServicio} />
      <Route path="/contacto" component={Contacto} />
      <Route path="/acceso-clientes" component={AccesoClientes} />

      {/* ── Login unificado (admin + clientes) ─────────────────────────── */}
      <Route path="/admin/login" component={AdminLogin} />

      {/* ── PWA agente: inicio de turno por carnet QR (sin login) ──────── */}
      <Route path="/agente/inicio" component={AgenteInicio} />

      {/* ── Redirecciones de acceso directo ────────────────────────────── */}
      <Route path="/admin">
        {() => <Redirect to="/admin/dashboard" />}
      </Route>
      <Route path="/portal">
        {() => <Redirect to="/portal/dashboard" />}
      </Route>

      {/* ── Portal de clientes (solo rol: cliente) ──────────────────────── */}
      <Route path="/portal/dashboard">
        {() => <PortalGuard><PortalDashboard /></PortalGuard>}
      </Route>
      <Route path="/portal/incidencias">
        {() => <PortalGuard><PortalIncidencias /></PortalGuard>}
      </Route>
      <Route path="/portal/kpi">
        {() => <PortalGuard><PortalKPI /></PortalGuard>}
      </Route>
      <Route path="/portal/agentes">
        {() => <PortalGuard><PortalAgentes /></PortalGuard>}
      </Route>
      <Route path="/portal/solicitudes">
        {() => <PortalGuard><PortalSolicitudes /></PortalGuard>}
      </Route>
      <Route path="/portal/cobertura">
        {() => <PortalGuard><PortalCobertura /></PortalGuard>}
      </Route>
      <Route path="/portal/fichajes">
        {() => <PortalGuard><PortalFichajes /></PortalGuard>}
      </Route>
      <Route path="/portal/rondas">
        {() => <PortalGuard><PortalRondas /></PortalGuard>}
      </Route>
      <Route path="/portal/recorridos">
        {() => <PortalGuard><PortalRecorridos /></PortalGuard>}
      </Route>

      {/* ── Panel administrativo (rol admin, operaciones, rrhh, etc.) ───── */}
      <Route path="/admin/dashboard">
        {() => <AuthGuard><AdminDashboard /></AuthGuard>}
      </Route>
      <Route path="/admin/incidencias">
        {() => <AuthGuard><AdminIncidencias /></AuthGuard>}
      </Route>
      <Route path="/admin/comercial">
        {() => <AuthGuard><AdminComercial /></AuthGuard>}
      </Route>
      <Route path="/admin/tareas">
        {() => <AuthGuard><AdminTareas /></AuthGuard>}
      </Route>
      <Route path="/admin/kpi">
        {() => <AuthGuard><AdminKPI /></AuthGuard>}
      </Route>
      <Route path="/admin/custodias">
        {() => <AuthGuard><AdminCustodias /></AuthGuard>}
      </Route>
      <Route path="/admin/clientes/:id">
        {() => <AuthGuard><AdminFichaCliente /></AuthGuard>}
      </Route>
      <Route path="/admin/clientes">
        {() => <AuthGuard><AdminClientes /></AuthGuard>}
      </Route>
      <Route path="/admin/rrhh/igss">
        {() => <AuthGuard requiredRoles={["admin", "rrhh"]}><AdminIGSS /></AuthGuard>}
      </Route>
      <Route path="/admin/usuarios">
        {() => <AuthGuard requiredRoles={["admin"]}><AdminUsuarios /></AuthGuard>}
      </Route>
      <Route path="/admin/documentacion">
        {() => <AuthGuard requiredRoles={["admin"]}><AdminDocumentacion /></AuthGuard>}
      </Route>
      <Route path="/admin/modelo-datos">
        {() => <AuthGuard requiredRoles={["admin"]}><AdminModeloDatos /></AuthGuard>}
      </Route>
      <Route path="/admin/anticipos">
        {() => <AuthGuard requiredRoles={["admin", "rrhh"]}><AdminAnticipos /></AuthGuard>}
      </Route>
      <Route path="/admin/rrhh/amonestaciones">
        {() => <AuthGuard requiredRoles={["admin", "rrhh", "operaciones", "supervisor"]}><AdminAmonestaciones /></AuthGuard>}
      </Route>
      <Route path="/admin/rrhh/seguros">
        {() => <AuthGuard requiredRoles={["admin", "rrhh"]}><AdminSeguros /></AuthGuard>}
      </Route>
      <Route path="/admin/configuracion/whatsapp">
        {() => <AuthGuard requiredRoles={["admin"]}><AdminWhatsappConfig /></AuthGuard>}
      </Route>
      <Route path="/admin/configuracion/plantillas-contrato">
        {() => <AuthGuard requiredRoles={["admin", "rrhh"]}><AdminPlantillasContrato /></AuthGuard>}
      </Route>
      <Route path="/admin/reportes/cobertura-zonas">
        {() => <AuthGuard requiredRoles={["admin", "operaciones", "supervisor"]}><AdminReporteCoberturaZonas /></AuthGuard>}
      </Route>
      <Route path="/admin/reportes">
        {() => <AuthGuard requiredRoles={["admin", "operaciones", "rrhh", "comercial", "supervisor"]}><AdminReportes /></AuthGuard>}
      </Route>
      <Route path="/admin/cms">
        {() => <AuthGuard requiredRoles={["admin"]}><AdminCMS /></AuthGuard>}
      </Route>
      <Route path="/admin/simulador-whatsapp">
        {() => <AuthGuard requiredRoles={["admin"]}><AdminSimulador /></AuthGuard>}
      </Route>
      <Route path="/admin/empleados">
        {() => <AuthGuard requiredRoles={["admin", "operaciones", "rrhh", "supervisor"]}><AdminEmpleados /></AuthGuard>}
      </Route>
      <Route path="/admin/operaciones/zonas">
        {() => <AuthGuard requiredRoles={["admin", "operaciones", "supervisor"]}><AdminZonasOperativas /></AuthGuard>}
      </Route>
      <Route path="/admin/operaciones/cierres">
        {() => <AuthGuard requiredRoles={["admin", "operaciones", "supervisor"]}><AdminCierresHistorico /></AuthGuard>}
      </Route>
      <Route path="/admin/operaciones/pizarron-historico">
        {() => <AuthGuard requiredRoles={["admin", "operaciones", "supervisor"]}><AdminPizarronHistorico /></AuthGuard>}
      </Route>
      <Route path="/admin/operaciones">
        {() => <AuthGuard requiredRoles={["admin", "operaciones", "supervisor"]}><AdminOperaciones /></AuthGuard>}
      </Route>
      <Route path="/admin/rrhh/eventos">
        {() => <AuthGuard requiredRoles={["admin", "rrhh", "operaciones"]}><AdminRrhhEventos /></AuthGuard>}
      </Route>
      <Route path="/admin/rrhh/alertas">
        {() => <AuthGuard requiredRoles={["admin", "rrhh"]}><AdminRrhhAlertas /></AuthGuard>}
      </Route>
      <Route path="/admin/rrhh/nomina">
        {() => <AuthGuard requiredRoles={["admin", "rrhh"]}><AdminNovedadesNomina /></AuthGuard>}
      </Route>
      <Route path="/admin/rrhh/pre-planilla">
        {() => <AuthGuard requiredRoles={["admin", "rrhh"]}><AdminPrePlanilla /></AuthGuard>}
      </Route>
      <Route path="/admin/pre-planilla">
        {() => <Redirect to="/admin/rrhh/pre-planilla" />}
      </Route>
      <Route path="/admin/rrhh/planilla">
        {() => <AuthGuard requiredRoles={["admin", "rrhh"]}><AdminPlanilla /></AuthGuard>}
      </Route>
      <Route path="/admin/rrhh/turnos">
        {() => <AuthGuard requiredRoles={["admin", "rrhh"]}><AdminTurnos /></AuthGuard>}
      </Route>
      <Route path="/admin/cambios-estructurales">
        {() => <AuthGuard requiredRoles={["admin", "operaciones", "rrhh"]}><AdminCambiosEstructurales /></AuthGuard>}
      </Route>
      <Route path="/admin/pipeline-servicios">
        {() => <AuthGuard requiredRoles={["admin", "operaciones", "rrhh", "comercial", "supervisor"]}><AdminPipelineServicios /></AuthGuard>}
      </Route>
      <Route path="/admin/tablero-servicios">
        {() => <AuthGuard requiredRoles={["admin", "operaciones", "rrhh", "comercial", "supervisor"]}><AdminTableroServicios /></AuthGuard>}
      </Route>
      <Route path="/admin/vehiculos">
        {() => <AuthGuard><AdminVehiculos /></AuthGuard>}
      </Route>
      <Route path="/admin/armeria">
        {() => <AuthGuard><AdminArmeria /></AuthGuard>}
      </Route>
      <Route path="/admin/solicitudes-eliminacion">
        {() => <AuthGuard requiredRoles={["admin"]}><AdminSolicitudesEliminacion /></AuthGuard>}
      </Route>
      <Route path="/admin/rrhh/cambios-salariales">
        {() => <AuthGuard requiredRoles={["admin", "rrhh"]}><AdminCambiosSalariales /></AuthGuard>}
      </Route>
      <Route path="/admin/rrhh/prestaciones">
        {() => <AuthGuard requiredRoles={["admin", "rrhh"]}><AdminPrestaciones /></AuthGuard>}
      </Route>
      <Route path="/admin/rrhh/planillas-especiales">
        {() => <AuthGuard requiredRoles={["admin", "rrhh"]}><AdminPlanillasEspeciales /></AuthGuard>}
      </Route>
      <Route path="/admin/rrhh/libro-salarios">
        {() => <AuthGuard requiredRoles={["admin", "rrhh"]}><AdminLibroSalarios /></AuthGuard>}
      </Route>
      <Route path="/admin/rrhh/vacaciones">
        {() => <AuthGuard requiredRoles={["admin", "rrhh", "operaciones"]}><AdminVacaciones /></AuthGuard>}
      </Route>
      <Route path="/admin/rrhh/carnets">
        {() => <AuthGuard requiredRoles={["admin", "rrhh"]}><CarnetesQR /></AuthGuard>}
      </Route>
      <Route path="/admin/rrhh/barracas">
        {() => <AuthGuard requiredRoles={["admin", "rrhh"]}><AdminBarracas /></AuthGuard>}
      </Route>
      <Route path="/admin/bodega">
        {() => <AuthGuard><AdminBodega /></AuthGuard>}
      </Route>
      <Route path="/admin/importacion">
        {() => <AuthGuard requiredRoles={["admin"]}><AdminImportacion /></AuthGuard>}
      </Route>
      <Route path="/admin/control-operativo-qr">
        {() => <AuthGuard requiredRoles={["admin", "operaciones", "supervisor"]}><AdminControlOperativoQR /></AuthGuard>}
      </Route>
      <Route path="/ronda" component={RondaGuardia} />
      <Route path="/agente" component={AgenteEscaneo} />
      <Route path="/supervisor/activar" component={SupervisorActivar} />
      <Route path="/kiosco" component={KioscoSolicitud} />
      <Route path="/solicitud-empleo" component={SolicitudEmpleo} />
      <Route path="/actualizacion-datos" component={ActualizacionDatos} />
      <Route path="/solicitar-anticipo" component={SolicitarAnticipo} />
      <Route path="/plazas-disponibles" component={AnuncioPlazas} />
      <Route path="/admin/rrhh/kiosco-solicitudes">
        {() => <AuthGuard><AdminKioscoSolicitudes /></AuthGuard>}
      </Route>
      <Route path="/admin/rrhh/kiosco-solicitudes/:id/imprimir">
        {() => <AuthGuard><AdminKioscoSolicitudImprimible /></AuthGuard>}
      </Route>
      <Route path="/admin/rrhh/reingresos">
        {() => <AuthGuard><AdminMergeRequests /></AuthGuard>}
      </Route>

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <DeleteModeProvider>
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
              <Router />
            </WouterRouter>
            <Toaster />
          </DeleteModeProvider>
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
