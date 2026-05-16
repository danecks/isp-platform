import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, renderHook } from "@testing-library/react";

const toastMock = vi.fn();

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: toastMock }),
}));

vi.mock("../../utils", async () => {
  const actual = await vi.importActual<typeof import("../../utils")>("../../utils");
  return {
    ...actual,
    getSession: () => "tok",
  };
});

import { usePlanFuturoFlow } from "../use-plan-futuro-flow";
import type { InicioProyecto, PlanFuturo, Puesto } from "../../types";

function makeArgs(overrides: Partial<Parameters<typeof usePlanFuturoFlow>[0]> = {}) {
  const invalidateFuture = vi.fn();
  return {
    args: {
      fechaVista: "2026-05-20",
      currentUser: { username: "ana" },
      invalidateFuture,
      ...overrides,
    },
    invalidateFuture,
  };
}

const puesto = { id: 99, nombre: "Caseta 1" } as unknown as Puesto;

const mockOk = (body: unknown = {}) => ({
  ok: true,
  status: 200,
  json: async () => body,
});

beforeEach(() => {
  toastMock.mockReset();
  vi.stubGlobal("fetch", vi.fn());
});

describe("usePlanFuturoFlow", () => {
  describe("guardarPlanFuturo", () => {
    it("creates a plan with POST when no existing plan", async () => {
      (globalThis.fetch as any).mockResolvedValueOnce(mockOk());
      const { args, invalidateFuture } = makeArgs();
      const { result } = renderHook(() => usePlanFuturoFlow(args));

      act(() => {
        result.current.setModalPlanFuturo({ puesto, plan: null });
      });
      await act(async () => {
        await result.current.guardarPlanFuturo({
          tipoAusencia: "vacaciones",
          titularAusenteId: 12,
          relevId: 34,
          motivo: "x",
          notas: "n",
        });
      });

      const [url, init] = (globalThis.fetch as any).mock.calls[0];
      expect(url).toBe("/api/operaciones/planificacion-futura");
      expect(init.method).toBe("POST");
      expect(JSON.parse(init.body)).toMatchObject({
        fecha: "2026-05-20",
        puestoId: 99,
        tipoEvento: "ausencia",
        creadoPor: "ana",
      });
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Planificación guardada" }),
      );
      expect(invalidateFuture).toHaveBeenCalled();
      expect(result.current.modalPlanFuturo).toBeNull();
    });

    it("updates an existing plan with PATCH", async () => {
      (globalThis.fetch as any).mockResolvedValueOnce(mockOk());
      const { args } = makeArgs();
      const { result } = renderHook(() => usePlanFuturoFlow(args));

      const plan = { id: 555 } as PlanFuturo;
      act(() => result.current.setModalPlanFuturo({ puesto, plan }));
      await act(async () => {
        await result.current.guardarPlanFuturo({
          tipoAusencia: "permiso",
          titularAusenteId: null,
          relevId: null,
          motivo: "",
          notas: "",
        });
      });

      const [url, init] = (globalThis.fetch as any).mock.calls[0];
      expect(url).toBe("/api/operaciones/planificacion-futura/555");
      expect(init.method).toBe("PATCH");
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Plan actualizado" }),
      );
    });

    it("no-ops when modal is not open", async () => {
      const { args, invalidateFuture } = makeArgs();
      const { result } = renderHook(() => usePlanFuturoFlow(args));

      await act(async () => {
        await result.current.guardarPlanFuturo({
          tipoAusencia: "x",
          titularAusenteId: null,
          relevId: null,
          motivo: "",
          notas: "",
        });
      });
      expect(globalThis.fetch).not.toHaveBeenCalled();
      expect(invalidateFuture).not.toHaveBeenCalled();
    });
  });

  describe("eliminarPlanFuturo", () => {
    it("DELETEs the plan and toasts", async () => {
      (globalThis.fetch as any).mockResolvedValueOnce(mockOk());
      const { args, invalidateFuture } = makeArgs();
      const { result } = renderHook(() => usePlanFuturoFlow(args));

      await act(async () => {
        await result.current.eliminarPlanFuturo(42);
      });
      const [url, init] = (globalThis.fetch as any).mock.calls[0];
      expect(url).toBe("/api/operaciones/planificacion-futura/42");
      expect(init.method).toBe("DELETE");
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Plan cancelado" }),
      );
      expect(invalidateFuture).toHaveBeenCalled();
    });
  });

  describe("guardarPlanSSA", () => {
    const ip = {
      ssa_id: 7,
      cliente_nombre: "ACME",
    } as unknown as InicioProyecto;

    it("happy path with N agentes shows planificación guardada", async () => {
      (globalThis.fetch as any).mockResolvedValueOnce(mockOk({ ok: true }));
      const { args, invalidateFuture } = makeArgs();
      const { result } = renderHook(() => usePlanFuturoFlow(args));

      act(() => result.current.setModalPlanSSA(ip));
      await act(async () => {
        await result.current.guardarPlanSSA([{ id: 1 }, { id: 2 }, { id: null }]);
      });

      const [url, init] = (globalThis.fetch as any).mock.calls[0];
      expect(url).toBe("/api/operaciones/planificacion-futura/ssa-batch");
      expect(init.method).toBe("PUT");
      expect(JSON.parse(init.body)).toMatchObject({
        ssaId: 7,
        agentes: [{ id: 1 }, { id: 2 }],
      });
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Planificación SSA guardada",
          description: expect.stringContaining("2 agente(s)"),
        }),
      );
      expect(invalidateFuture).toHaveBeenCalled();
      expect(result.current.modalPlanSSA).toBeNull();
    });

    it("empty list shows 'cancelados' toast", async () => {
      (globalThis.fetch as any).mockResolvedValueOnce(mockOk());
      const { args } = makeArgs();
      const { result } = renderHook(() => usePlanFuturoFlow(args));
      act(() => result.current.setModalPlanSSA(ip));
      await act(async () => {
        await result.current.guardarPlanSSA([]);
      });
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Planes SSA cancelados" }),
      );
    });

    it("error response: shows destructive toast and keeps modal open", async () => {
      (globalThis.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ error: "fallo" }),
      });
      const { args, invalidateFuture } = makeArgs();
      const { result } = renderHook(() => usePlanFuturoFlow(args));
      act(() => result.current.setModalPlanSSA(ip));
      await act(async () => {
        await result.current.guardarPlanSSA([{ id: 1 }]);
      });

      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Error al guardar",
          description: "fallo",
          variant: "destructive",
        }),
      );
      expect(invalidateFuture).not.toHaveBeenCalled();
      expect(result.current.modalPlanSSA).not.toBeNull();
    });
  });
});
