import { useEffect, useRef, useState } from "react";
import mermaid from "mermaid";

const ERD = `
erDiagram
    %% ===== NÚCLEO RRHH =====
    employees {
        int id PK
        string dpi UK
        string nombre_completo
        string estado_laboral
        int puesto_actual_id FK
        date fecha_ingreso
        date fecha_baja
        string motivo_baja
        int liquidacion_id FK
    }
    empleados_periodos_laborales {
        int id PK
        int employee_id FK
        int numero_periodo
        date fecha_ingreso
        date fecha_baja
        string motivo_baja
        int liquidacion_id FK
    }
    contratos_empleados {
        int id PK
        int employee_id FK
        string tipo
        date fecha_inicio
        date fecha_fin
    }
    cambios_salariales {
        int id PK
        int employee_id FK
        decimal salario_anterior
        decimal salario_nuevo
        date fecha_efectiva
    }
    eventos_rrhh {
        int id PK
        int employee_id FK
        string tipo
        date fecha_inicio
        date fecha_fin
        int fichaje_origen_id FK
        string numero_acta
    }
    vacaciones_saldos {
        int id PK
        int employee_id FK
        int dias_ganados
        int dias_gozados
        int dias_disponibles
    }
    vacaciones_movimientos {
        int id PK
        int employee_id FK
        string tipo
        int dias
        date fecha
    }
    anticipos {
        int id PK
        int employee_id FK
        decimal monto
        decimal monto_cobro
        int cuotas
    }

    %% ===== PRESTACIONES =====
    prestaciones_acumulados {
        int id PK
        int employee_id FK
        decimal indemnizacion
        decimal aguinaldo
        decimal bono_14
        decimal vacaciones
    }
    prestaciones_liquidaciones {
        int id PK
        int employee_id FK
        date fecha_liquidacion
        string estado
        decimal total
    }
    prestaciones_liquidacion_detalle {
        int id PK
        int liquidacion_id FK
        string concepto
        decimal monto
    }

    %% ===== CLIENTES + OPERACIONES =====
    clients {
        int id PK
        string nombre
        string nit
        string depto_codigo
        boolean contrato_sin_prueba
    }
    client_sedes {
        int id PK
        int client_id FK
        string nombre
        string direccion
    }
    puestos_operativos {
        int id PK
        int client_id FK
        int sede_id FK
        string nombre
        decimal salario_puesto
        string tipo_puesto
    }
    puesto_titulares {
        int id PK
        int puesto_id FK
        int employee_id FK
        int orden
    }
    puesto_slots {
        int id PK
        int puesto_id FK
        int orden
        date fecha
        string turno
    }
    cobertura_segmentos {
        int id PK
        int puesto_id FK
        int employee_id FK
        date fecha
        string turno
        decimal horas
    }
    novedades_nomina_diarias {
        int id PK
        int employee_id FK
        int puesto_id FK
        date fecha
        string tipo
        decimal horas_extras
    }

    %% ===== NÓMINA / PLANILLA =====
    planillas {
        int id PK
        int periodo_id
        string estado
        decimal total_bruto
        decimal total_igss
    }
    planilla_lineas {
        int id PK
        int planilla_id FK
        int employee_id FK
        decimal sueldo_base
        decimal bonificacion_1
        decimal descuento_uniforme
    }
    planillas_especiales {
        int id PK
        string tipo
        int anio
    }
    planillas_especiales_lineas {
        int id PK
        int planilla_especial_id FK
        int employee_id FK
        decimal monto
    }

    %% ===== ARMERÍA / CUSTODIA / VEHÍCULOS =====
    armas {
        int id PK
        string serie UK
        string tipo
        string estado
        date fecha_emision_portacion
    }
    arma_custodia {
        int id PK
        int arma_id FK
        int employee_id FK
        date fecha_asignacion
    }
    vehiculos {
        int id PK
        string placa UK
        string tipo
    }
    vehiculo_custodia {
        int id PK
        int vehiculo_id FK
        int employee_id FK
    }
    custodia_titulares {
        int id PK
        int employee_id FK
        string tipo_servicio
    }

    %% ===== BODEGA / UNIFORMES =====
    bodega_articulos {
        int id PK
        int categoria_id FK
        string nombre
        int stock
    }
    entregas_uniforme {
        int id PK
        int employee_id FK
        int articulo_id FK
        date fecha_entrega
        decimal costo
    }
    entregas_uniforme_cuotas {
        int id PK
        int entrega_id FK
        int numero_cuota
        decimal monto
        boolean cobrada
    }

    %% ===== FICHAJE / QR =====
    agente_qr_tokens {
        int id PK
        int employee_id FK
        string token UK
        boolean carnet_entregado
    }
    agente_fichajes {
        int id PK
        int employee_id FK
        int token_id FK
        datetime timestamp
        string foto_url
    }

    %% ===== KIOSCO =====
    solicitudes_empleo {
        int id PK
        string dpi
        string canal
        string estado
    }
    solicitudes_merge_requests {
        int id PK
        int solicitud_id FK
        int employee_id_existente FK
        boolean es_reingreso
        string estado
    }

    %% ===== RELACIONES =====
    employees ||--o{ empleados_periodos_laborales : "tiene historial"
    employees ||--o{ contratos_empleados : "firma"
    employees ||--o{ cambios_salariales : "registra"
    employees ||--o{ eventos_rrhh : "genera"
    employees ||--|| vacaciones_saldos : "saldo único"
    employees ||--o{ vacaciones_movimientos : "movimientos"
    employees ||--o{ anticipos : "recibe"
    employees ||--o{ prestaciones_acumulados : "acumula"
    employees ||--o{ prestaciones_liquidaciones : "al liquidarse"
    prestaciones_liquidaciones ||--o{ prestaciones_liquidacion_detalle : "detalle"
    prestaciones_liquidaciones ||--o| empleados_periodos_laborales : "cierra periodo"

    clients ||--o{ client_sedes : "tiene sedes"
    clients ||--o{ puestos_operativos : "tiene puestos"
    client_sedes ||--o{ puestos_operativos : "ubicacion"

    puestos_operativos ||--o{ puesto_titulares : "titulares 1-4"
    puestos_operativos ||--o{ puesto_slots : "slots 14d"
    puestos_operativos ||--o{ cobertura_segmentos : "cobertura"
    employees ||--o{ puesto_titulares : "titular en"
    employees ||--o{ cobertura_segmentos : "cubre"

    employees ||--o{ novedades_nomina_diarias : "novedad"
    puestos_operativos ||--o{ novedades_nomina_diarias : "contexto"

    planillas ||--o{ planilla_lineas : "contiene"
    employees ||--o{ planilla_lineas : "recibe linea"
    planillas_especiales ||--o{ planillas_especiales_lineas : "contiene"
    employees ||--o{ planillas_especiales_lineas : "recibe"

    armas ||--o{ arma_custodia : "asignada"
    employees ||--o{ arma_custodia : "custodia arma"
    vehiculos ||--o{ vehiculo_custodia : "asignado"
    employees ||--o{ vehiculo_custodia : "custodia vehiculo"
    employees ||--o| custodia_titulares : "es custodio"

    bodega_articulos ||--o{ entregas_uniforme : "entrega"
    employees ||--o{ entregas_uniforme : "recibe uniforme"
    entregas_uniforme ||--o{ entregas_uniforme_cuotas : "a cuotas"

    employees ||--|| agente_qr_tokens : "token QR"
    agente_qr_tokens ||--o{ agente_fichajes : "fichajes"
    employees ||--o{ agente_fichajes : "registra"
    agente_fichajes ||--o{ eventos_rrhh : "genera acta"

    solicitudes_empleo ||--o| solicitudes_merge_requests : "si DPI dup"
    solicitudes_merge_requests }o--|| employees : "match con"
`;

export function ERDDiagram() {
  const ref = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    mermaid.initialize({
      startOnLoad: false,
      theme: "dark",
      securityLevel: "loose",
      er: { useMaxWidth: false, fontSize: 14 },
      themeVariables: {
        primaryColor: "#1e293b",
        primaryTextColor: "#f1f5f9",
        primaryBorderColor: "#3b82f6",
        lineColor: "#60a5fa",
        secondaryColor: "#334155",
        tertiaryColor: "#0f172a",
      },
    });
    if (ref.current) {
      mermaid
        .render("erd-svg", ERD)
        .then(({ svg }) => {
          if (ref.current) {
            const parser = new DOMParser();
            const svgDoc = parser.parseFromString(svg, "image/svg+xml");
            const svgEl = svgDoc.documentElement;
            ref.current.replaceChildren(svgEl);
          }
        })
        .catch((e) => setError(String(e)));
    }
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6">
      <header className="mb-4 pb-4 border-b border-slate-800">
        <h1 className="text-2xl font-bold text-white">
          🗺️ Modelo de Datos — ISP S.A.
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Diagrama relacional estilo Access. <span className="text-amber-300">PK</span> = llave primaria ·
          <span className="text-blue-300 ml-1">FK</span> = llave foránea ·
          <span className="text-emerald-300 ml-1">UK</span> = llave única
        </p>
        <div className="mt-3 flex flex-wrap gap-3 text-[11px]">
          <span className="px-2 py-1 rounded bg-emerald-500/20 text-emerald-200 border border-emerald-500/30">
            🟢 Núcleo RRHH ↔ Operaciones ↔ Nómina ↔ Prestaciones
          </span>
          <span className="px-2 py-1 rounded bg-blue-500/20 text-blue-200 border border-blue-500/30">
            🔵 Armería / Custodia / Vehículos
          </span>
          <span className="px-2 py-1 rounded bg-purple-500/20 text-purple-200 border border-purple-500/30">
            🟣 Bodega / Uniformes
          </span>
          <span className="px-2 py-1 rounded bg-amber-500/20 text-amber-200 border border-amber-500/30">
            🟡 Kiosco / Fichaje QR
          </span>
        </div>
        <p className="text-[11px] text-slate-500 mt-2">
          {"Notación: ||--o{ uno-a-muchos · ||--|| uno-a-uno · }o--|| muchos-a-uno opcional. Use scroll o zoom del navegador (Ctrl+rueda) para explorar."}
        </p>
      </header>

      {error && (
        <div className="p-4 bg-red-900/30 border border-red-500/50 rounded text-red-200 text-xs whitespace-pre-wrap">
          {error}
        </div>
      )}

      <div
        ref={ref}
        className="bg-slate-900 rounded-lg p-4 border border-slate-800 overflow-auto"
        style={{ minHeight: "600px" }}
      />
    </div>
  );
}
