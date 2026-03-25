import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";

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
import NotFound from "@/pages/not-found";

// Admin pages
import AdminDashboard from "@/admin/pages/Dashboard";
import AdminIncidencias from "@/admin/pages/Incidencias";
import AdminReclutamiento from "@/admin/pages/Reclutamiento";
import AdminComercial from "@/admin/pages/Comercial";
import AdminTareas from "@/admin/pages/Tareas";
import AdminKPI from "@/admin/pages/KPI";
import AdminCustodias from "@/admin/pages/Custodias";
import AdminClientes from "@/admin/pages/Clientes";

const queryClient = new QueryClient();

function Router() {
  return (
    <Switch>
      {/* Public routes */}
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

      {/* Admin routes */}
      <Route path="/admin">
        {() => <Redirect to="/admin/dashboard" />}
      </Route>
      <Route path="/admin/dashboard" component={AdminDashboard} />
      <Route path="/admin/incidencias" component={AdminIncidencias} />
      <Route path="/admin/reclutamiento" component={AdminReclutamiento} />
      <Route path="/admin/comercial" component={AdminComercial} />
      <Route path="/admin/tareas" component={AdminTareas} />
      <Route path="/admin/kpi" component={AdminKPI} />
      <Route path="/admin/custodias" component={AdminCustodias} />
      <Route path="/admin/clientes" component={AdminClientes} />

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
