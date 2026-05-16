import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, renderHook } from "@testing-library/react";

const toastMock = vi.fn();
const apiPostMock = vi.fn();

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: toastMock }),
}));

vi.mock("@/lib/httpClient", () => ({
  getSessionToken: () => "tok",
}));

vi.mock("../../utils", async () => {
  const actual = await vi.importActual<typeof import("../../utils")>("../../utils");
  return {
    ...actual,
    apiPost: (...args: unknown[]) => apiPostMock(...args),
    getSession: () => "tok",
  };
});

import { useAssignmentFlow } from "../use-assignment-flow";
import type { Agente, Pool, Puesto } from "../../types";

const baseAgente = {
  id: 10,
  nombre_completo: "Juan",
  tipo_asignacion_eoa: "pool",
} as unknown as Agente;

const basePuesto = {
  id: "p-1",
  nombre: "Caseta 1",
  cliente_id: 1,
  cliente_nombre: "ACME",
  sede_id: 1,
  jornada: "12h",
  agente_id: null,
  agente_nombre: null,
  titular_employee_id: null,
  titulares: [],
  tiene_slot_vacio: true,
  es_par_24x24: false,
  par_trabajando: false,
  par_descansando: false,
  es_custodia: false,
} as unknown as Puesto;

const emptyPool = {
  disponibles: [],
  disponiblesCubriendo: [],
  descansandoCiclo: [],
  haciendoHE: [],
  enVacaciones: [],
  vacacionistasCubriendo: [],
  trabajando: [],
  enPuesto: [],
} as unknown as Pool;

function makeArgs(overrides: Partial<Parameters<typeof useAssignmentFlow>[0]> = {}) {
  const invalidate = vi.fn();
  const refetchTablero = vi.fn(async () => undefined);
  const refetchPool = vi.fn(async () => undefined);
  const setAgenteSeleccionado = vi.fn();
  const setPuestoContexto = vi.fn();
  return {
    args: {
      pool: emptyPool,
      fechaVista: "2026-05-15",
      esPasado: false,
      fechaActivaStr: "2026-05-15",
      currentUser: { nombre: "Ana", username: "ana" },
      invalidate,
      refetchTablero,
      refetchPool,
      setAgenteSeleccionado,
      setPuestoContexto,
      ...overrides,
    },
    invalidate,
    refetchTablero,
    refetchPool,
  };
}

beforeEach(() => {
  toastMock.mockReset();
  apiPostMock.mockReset();
  vi.stubGlobal("fetch", vi.fn());
});

describe("useAssignmentFlow", () => {
  describe("asignarCustodia", () => {
    it("opens sustitución modal when puesto already has a titular", async () => {
      const { args } = makeArgs();
      const { result } = renderHook(() => useAssignmentFlow(args));
      const puesto = { ...basePuesto, titular_employee_id: 99 } as Puesto;

      await act(async () => {
        await result.current.asignarCustodia(puesto, baseAgente);
      });

      expect(result.current.modalSustitucion).toMatchObject({ puesto, agente: baseAgente });
      expect(result.current.modalCustodiaTipo).toBeNull();
    });

    it("opens custodia tipo modal with parsed cliente/slot when no titular", async () => {
      const { args } = makeArgs();
      const { result } = renderHook(() => useAssignmentFlow(args));
      const puesto = { ...basePuesto, id: "cust-7-3" } as unknown as Puesto;

      await act(async () => {
        await result.current.asignarCustodia(puesto, baseAgente);
      });

      expect(result.current.modalCustodiaTipo).toMatchObject({
        clienteId: 7,
        slotNumero: 3,
        agente: baseAgente,
      });
    });
  });

  describe("ejecutarAsignarCustodia", () => {
    it("happy path: posts and toasts success", async () => {
      (globalThis.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({}),
      });
      const { args, invalidate } = makeArgs();
      const { result } = renderHook(() => useAssignmentFlow(args));

      await act(async () => {
        await result.current.ejecutarAsignarCustodia(7, 3, baseAgente, false, basePuesto);
      });

      const [url, init] = (globalThis.fetch as any).mock.calls[0];
      expect(url).toBe("/api/operaciones/asignar-custodia");
      expect(init.method).toBe("POST");
      expect(JSON.parse(init.body)).toMatchObject({
        clienteId: 7,
        slotNumero: 3,
        employeeId: 10,
        soloCobertura: false,
      });
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Titular asignado" }),
      );
      expect(invalidate).toHaveBeenCalled();
    });

    it("error response: shows destructive toast and does not invalidate", async () => {
      (globalThis.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ error: "no permitido" }),
      });
      const { args, invalidate } = makeArgs();
      const { result } = renderHook(() => useAssignmentFlow(args));

      await act(async () => {
        await result.current.ejecutarAsignarCustodia(1, 1, baseAgente, true);
      });

      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Error",
          description: "no permitido",
          variant: "destructive",
        }),
      );
      expect(invalidate).not.toHaveBeenCalled();
    });

    it("network error: toasts conexión", async () => {
      (globalThis.fetch as any).mockRejectedValueOnce(new Error("offline"));
      const { args } = makeArgs();
      const { result } = renderHook(() => useAssignmentFlow(args));

      await act(async () => {
        await result.current.ejecutarAsignarCustodia(1, 1, baseAgente, false);
      });

      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Error de conexión", variant: "destructive" }),
      );
    });
  });

  describe("iniciarAsignacion", () => {
    it("auto-asigna como titular cuando hay slot vacío y agente del pool", async () => {
      apiPostMock.mockResolvedValueOnce({});
      const { args, refetchTablero, refetchPool } = makeArgs();
      const { result } = renderHook(() => useAssignmentFlow(args));

      await act(async () => {
        await result.current.iniciarAsignacion(basePuesto, baseAgente);
      });

      expect(apiPostMock).toHaveBeenCalledWith(
        "/api/operaciones/asignar",
        expect.objectContaining({
          puestoId: "p-1",
          agenteId: 10,
          soloCobertura: false,
          motivoCambio: "asignacion_directa",
        }),
      );
      expect(refetchTablero).toHaveBeenCalled();
      expect(refetchPool).toHaveBeenCalled();
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Titular asignado" }),
      );
    });

    it("no-ops when same agente already on puesto", async () => {
      const { args, invalidate } = makeArgs();
      const { result } = renderHook(() => useAssignmentFlow(args));
      const puesto = { ...basePuesto, agente_id: 10 } as Puesto;

      await act(async () => {
        await result.current.iniciarAsignacion(puesto, baseAgente);
      });

      expect(apiPostMock).not.toHaveBeenCalled();
      expect(invalidate).not.toHaveBeenCalled();
    });

    it("advertencia branch: opens sustitución modal with conflict warning", async () => {
      const puesto = { ...basePuesto, agente_id: 99, agente_nombre: "Otro" } as Puesto;
      (globalThis.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          puestosActivos: [{ cliente_nombre: "Banco X", nombre: "Caseta 9" }],
        }),
      });
      const { args } = makeArgs();
      const { result } = renderHook(() => useAssignmentFlow(args));

      await act(async () => {
        await result.current.iniciarAsignacion(puesto, baseAgente);
      });

      expect(result.current.modalSustitucion).toMatchObject({
        puesto,
        agente: baseAgente,
        advertencia: expect.stringContaining("Banco X"),
      });
    });

    it("opens elige cobertura modal when pool agente targets a puesto with titulares (no auto-asigna)", async () => {
      const puesto = {
        ...basePuesto,
        titulares: [{ id: 1 }],
        tiene_slot_vacio: false,
      } as unknown as Puesto;
      const { args } = makeArgs();
      const { result } = renderHook(() => useAssignmentFlow(args));

      await act(async () => {
        await result.current.iniciarAsignacion(puesto, baseAgente);
      });

      expect(apiPostMock).not.toHaveBeenCalled();
      expect(result.current.modalEligeCobertura).toMatchObject({ puesto, agente: baseAgente });
    });
  });

  describe("confirmarSustitucion", () => {
    it("custodia branch (relevo): registers falta + asigna cobertura", async () => {
      apiPostMock.mockResolvedValueOnce({}); // registrar-falta-custodia
      (globalThis.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({}),
      });

      const puesto = {
        ...basePuesto,
        id: "cust-5-2",
        es_custodia: true,
        titular_employee_id: 77,
        titular_nombre: "TitOld",
      } as unknown as Puesto;

      const { args, invalidate } = makeArgs();
      const { result } = renderHook(() => useAssignmentFlow(args));

      act(() => {
        result.current.setModalSustitucion({
          puesto,
          agente: baseAgente,
          agentePoolStatus: "disponible",
        });
      });

      await act(async () => {
        await result.current.confirmarSustitucion("falta", "n", false, "relevo", "ausente_sin_aviso");
      });

      expect(apiPostMock).toHaveBeenCalledWith(
        "/api/operaciones/registrar-falta-custodia",
        expect.objectContaining({ clienteId: 5, slotNumero: 2, empleadoId: 77 }),
      );
      const [url, init] = (globalThis.fetch as any).mock.calls[0];
      expect(url).toBe("/api/operaciones/asignar-custodia");
      expect(JSON.parse(init.body)).toMatchObject({
        clienteId: 5,
        slotNumero: 2,
        employeeId: 10,
        soloCobertura: true,
      });
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({ title: expect.stringContaining("Sustitución registrada") }),
      );
      expect(invalidate).toHaveBeenCalled();
      expect(result.current.modalSustitucion).toBeNull();
    });

    it("custodia branch (reasignacion): cambia titular endpoint", async () => {
      apiPostMock.mockResolvedValueOnce({});
      const puesto = {
        ...basePuesto,
        id: "cust-9-1",
        es_custodia: true,
        titular_employee_id: 50,
      } as unknown as Puesto;
      const { args } = makeArgs();
      const { result } = renderHook(() => useAssignmentFlow(args));

      act(() => {
        result.current.setModalSustitucion({ puesto, agente: baseAgente });
      });
      await act(async () => {
        await result.current.confirmarSustitucion("x", "", false, "reasignacion");
      });

      expect(apiPostMock).toHaveBeenCalledWith(
        "/api/operaciones/cambiar-titular-custodia",
        expect.objectContaining({
          clienteId: 9,
          slotNumero: 1,
          nuevoTitularId: 10,
          anteriorTitularId: 50,
        }),
      );
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Titular cambiado" }),
      );
    });

    it("puesto branch with current agente: posts /sustituir", async () => {
      apiPostMock.mockResolvedValueOnce({ eventoRrhhGenerado: false });
      const puesto = {
        ...basePuesto,
        agente_id: 88,
        agente_nombre: "Saliente",
      } as Puesto;
      const { args, invalidate } = makeArgs();
      const { result } = renderHook(() => useAssignmentFlow(args));

      act(() => {
        result.current.setModalSustitucion({
          puesto,
          agente: baseAgente,
          agentePoolStatus: "disponible",
        });
      });
      await act(async () => {
        await result.current.confirmarSustitucion("falta", "", false, "relevo", "ausente_sin_aviso");
      });

      expect(apiPostMock).toHaveBeenCalledWith(
        "/api/operaciones/sustituir",
        expect.objectContaining({
          puestoId: "p-1",
          agenteEntranteId: 10,
          agenteSalienteId: 88,
          tipoSustitucion: "relevo",
        }),
      );
      expect(invalidate).toHaveBeenCalled();
    });

    it("SSA conflict: shows servicio especial activo toast and clears modal", async () => {
      apiPostMock.mockRejectedValueOnce({ ssaId: 42, error: "ssa activo" });
      const puesto = { ...basePuesto, agente_id: 88 } as Puesto;
      const { args, invalidate } = makeArgs();
      const { result } = renderHook(() => useAssignmentFlow(args));

      act(() => result.current.setModalSustitucion({ puesto, agente: baseAgente }));
      await act(async () => {
        await result.current.confirmarSustitucion("m", "", false, "relevo");
      });

      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({
          title: expect.stringContaining("Servicio Especial"),
          variant: "destructive",
        }),
      );
      expect(result.current.modalSustitucion).toBeNull();
      expect(invalidate).not.toHaveBeenCalled();
    });

    it("advertencia branch: keeps modal open with new advertencia", async () => {
      apiPostMock.mockRejectedValueOnce({ advertencia: true, error: "ya está en otro lado" });
      const puesto = { ...basePuesto, agente_id: 88 } as Puesto;
      const { args } = makeArgs();
      const { result } = renderHook(() => useAssignmentFlow(args));

      act(() => result.current.setModalSustitucion({ puesto, agente: baseAgente }));
      await act(async () => {
        await result.current.confirmarSustitucion("m", "", false, "relevo");
      });

      expect(result.current.modalSustitucion).toMatchObject({
        advertencia: "ya está en otro lado",
      });
    });
  });

  describe("confirmarLiberar", () => {
    it("happy path", async () => {
      apiPostMock.mockResolvedValueOnce({});
      const { args, invalidate } = makeArgs();
      const { result } = renderHook(() => useAssignmentFlow(args));

      const puesto = { ...basePuesto, agente_nombre: "Agente X" } as Puesto;
      act(() => result.current.setModalLiberar(puesto));
      await act(async () => {
        await result.current.confirmarLiberar("descanso", "18:00", true);
      });

      expect(apiPostMock).toHaveBeenCalledWith(
        "/api/operaciones/liberar",
        expect.objectContaining({
          puestoId: "p-1",
          motivo: "descanso",
          horaFin: "18:00",
          generarEventoFalta: true,
        }),
      );
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Puesto liberado",
          description: expect.stringContaining("Falta registrada en RRHH"),
        }),
      );
      expect(invalidate).toHaveBeenCalled();
      expect(result.current.modalLiberar).toBeNull();
    });

    it("error path: destructive toast", async () => {
      apiPostMock.mockRejectedValueOnce({ error: "no se puede" });
      const { args, invalidate } = makeArgs();
      const { result } = renderHook(() => useAssignmentFlow(args));

      act(() => result.current.setModalLiberar(basePuesto));
      await act(async () => {
        await result.current.confirmarLiberar("x");
      });

      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Error",
          description: "no se puede",
          variant: "destructive",
        }),
      );
      expect(invalidate).not.toHaveBeenCalled();
    });
  });

  describe("confirmarFalta", () => {
    it("custodia branch: posts /registrar-falta-custodia", async () => {
      apiPostMock.mockResolvedValueOnce({});
      const { args } = makeArgs();
      const { result } = renderHook(() => useAssignmentFlow(args));

      act(() =>
        result.current.setModalFalta({
          puesto: { ...basePuesto, id: "cust-3-2", es_custodia: true } as unknown as Puesto,
          titularId: 55,
          titularNombre: "Tit",
        }),
      );
      await act(async () => {
        await result.current.confirmarFalta("ausente", "n");
      });

      expect(apiPostMock).toHaveBeenCalledWith(
        "/api/operaciones/registrar-falta-custodia",
        expect.objectContaining({ clienteId: 3, slotNumero: 2, empleadoId: 55 }),
      );
    });

    it("puesto branch: posts /registrar-falta", async () => {
      apiPostMock.mockResolvedValueOnce({});
      const { args, invalidate } = makeArgs();
      const { result } = renderHook(() => useAssignmentFlow(args));

      act(() =>
        result.current.setModalFalta({
          puesto: basePuesto,
          titularId: 55,
          titularNombre: "Tit",
        }),
      );
      await act(async () => {
        await result.current.confirmarFalta("ausente");
      });

      expect(apiPostMock).toHaveBeenCalledWith(
        "/api/operaciones/registrar-falta",
        expect.objectContaining({
          puestoId: "p-1",
          empleadoId: 55,
          motivo: "ausente",
          es_24x24: false,
        }),
      );
      expect(invalidate).toHaveBeenCalled();
    });

    it("error path: destructive toast", async () => {
      apiPostMock.mockRejectedValueOnce({ error: "fallo" });
      const { args } = makeArgs();
      const { result } = renderHook(() => useAssignmentFlow(args));

      act(() =>
        result.current.setModalFalta({
          puesto: basePuesto,
          titularId: 55,
          titularNombre: "Tit",
        }),
      );
      await act(async () => {
        await result.current.confirmarFalta("ausente");
      });

      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Error",
          description: "fallo",
          variant: "destructive",
        }),
      );
    });
  });
});
