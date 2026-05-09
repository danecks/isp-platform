/**
 * Cliente compartido de TanStack Query (Fase 0 — refactor).
 *
 * Antes el `QueryClient` se construía inline en `App.tsx` como
 * `new QueryClient()` sin overrides. Lo trasladamos a un módulo dedicado
 * preservando exactamente esos defaults para no alterar el comportamiento
 * de cache/refetch/retry. Cualquier ajuste de defaults se evaluará en
 * fases posteriores.
 */
import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient();
