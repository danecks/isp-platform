import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, renderHook } from "@testing-library/react";

const toastMock = vi.fn();
const apiPostMock = vi.fn();

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: toastMock }),
}));

vi.mock("../../utils", async () => {
  const actual = await vi.importActual<typeof import("../../utils")>("../../utils");
  return {
    ...actual,
    apiPost: (...args: unknown[]) => apiPostMock(...args),
  };
});

import { useCierreFlow } from "../use-cierre-flow";
import type { CierreHoyData, DiaPendienteCierre } from "../../types";

const baseUser = { id: 7, nombre: "Ana", username: "ana", rol: "admin" };

function makeArgs(overrides: Partial<Parameters<typeof useCierreFlow>[0]> = {}) {
  const refetchCierre = vi.fn();
  const volverHoy = vi.fn();
  return {
    args: {
      fechaVista: "2026-05-15",
      esPasado: false,
      primerDiaPendiente: null as DiaPendienteCierre | null,
      cierreHoy: undefined as CierreHoyData | undefined,
      diaHoyCerrado: false,
      fechaVistaCerrada: false,
      fechaCierreParaReabrir: "15-05-2026",
      currentUser: baseUser,
      refetchCierre,
      volverHoy,
      ...overrides,
    },
    refetchCierre,
    volverHoy,
  };
}

beforeEach(() => {
  toastMock.mockReset();
  apiPostMock.mockReset();
});

describe("useCierreFlow", () => {
  describe("cerrarDia", () => {
    it("happy path: posts cierre, toasts success and refetches", async () => {
      apiPostMock.mockResolvedValueOnce({ syncCustodias: { totalCambios: 3 } });
      const { args, refetchCierre, volverHoy } = makeArgs();
      const { result } = renderHook(() => useCierreFlow(args));

      await act(async () => {
        await result.current.cerrarDia("ok", true);
      });

      expect(apiPostMock).toHaveBeenCalledWith(
        "/api/operaciones/cierre",
        expect.objectContaining({
          confirmacion: "CERRAR 15-05-2026",
          comentario: "ok",
          usuario: "Ana",
          usuarioId: 7,
          rol: "admin",
          sincronizarCustodias: true,
          fecha: "2026-05-15",
        }),
      );
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Día cerrado",
          description: expect.stringContaining("3 custodia(s) actualizada(s)"),
        }),
      );
      expect(refetchCierre).toHaveBeenCalled();
      expect(volverHoy).not.toHaveBeenCalled();
    });

    it("calls volverHoy when esPasado=true after success", async () => {
      apiPostMock.mockResolvedValueOnce({});
      const { args, volverHoy } = makeArgs({ esPasado: true });
      const { result } = renderHook(() => useCierreFlow(args));

      await act(async () => {
        await result.current.cerrarDia("ok", false);
      });

      expect(volverHoy).toHaveBeenCalled();
    });

    it("error path: shows destructive toast and rethrows", async () => {
      apiPostMock.mockRejectedValueOnce({ error: "boom" });
      const { args, refetchCierre } = makeArgs();
      const { result } = renderHook(() => useCierreFlow(args));

      await expect(
        act(async () => {
          await result.current.cerrarDia("c", false);
        }),
      ).rejects.toMatchObject({ error: "boom" });

      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Error al cerrar",
          description: "boom",
          variant: "destructive",
        }),
      );
      expect(refetchCierre).not.toHaveBeenCalled();
    });
  });

  describe("cerrarDiaPendiente", () => {
    it("no-op when no pending day", async () => {
      const { args } = makeArgs();
      const { result } = renderHook(() => useCierreFlow(args));

      await act(async () => {
        await result.current.cerrarDiaPendiente("c", false);
      });
      expect(apiPostMock).not.toHaveBeenCalled();
    });

    it("happy path: closes pending day", async () => {
      apiPostMock.mockResolvedValueOnce({});
      const dia: DiaPendienteCierre = {
        fecha: "2026-05-10",
        fechaStr: "10-05-2026",
      } as DiaPendienteCierre;
      const { args, refetchCierre } = makeArgs({ primerDiaPendiente: dia });
      const { result } = renderHook(() => useCierreFlow(args));

      await act(async () => {
        await result.current.cerrarDiaPendiente("ok", false);
      });
      expect(apiPostMock).toHaveBeenCalledWith(
        "/api/operaciones/cierre",
        expect.objectContaining({
          confirmacion: "CERRAR 10-05-2026",
          fecha: "2026-05-10",
        }),
      );
      expect(refetchCierre).toHaveBeenCalled();
    });
  });

  describe("reabrirDia", () => {
    it("happy path: posts reabrir with explicit fechaVista when esPasado+fechaVistaCerrada", async () => {
      apiPostMock.mockResolvedValueOnce({});
      const { args, refetchCierre } = makeArgs({
        esPasado: true,
        fechaVistaCerrada: true,
      });
      const { result } = renderHook(() => useCierreFlow(args));

      await act(async () => {
        await result.current.reabrirDia("razón");
      });

      expect(apiPostMock).toHaveBeenCalledWith(
        "/api/operaciones/reabrir",
        expect.objectContaining({
          confirmacion: "REABRIR 15-05-2026",
          motivo: "razón",
          fecha: "2026-05-15",
        }),
      );
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Día reabierto" }),
      );
      expect(refetchCierre).toHaveBeenCalled();
    });

    it("error path: shows destructive toast", async () => {
      apiPostMock.mockRejectedValueOnce({ error: "no se puede" });
      const { args, refetchCierre } = makeArgs({
        esPasado: true,
        fechaVistaCerrada: true,
      });
      const { result } = renderHook(() => useCierreFlow(args));

      await act(async () => {
        await result.current.reabrirDia("razón");
      });

      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Error al reabrir",
          description: "no se puede",
          variant: "destructive",
        }),
      );
      expect(refetchCierre).not.toHaveBeenCalled();
    });
  });
});
