---
name: Relevo parcial — fin = salida del turno
description: En el pizarrón operativo, el fin de un relevo parcial se deriva de la salida del turno del puesto, no se exige al usuario.
---

En sustitución del pizarrón operativo con cobertura "parcial", la hora de inicio se
registra (la que se ingresa) y la hora **final toma como base la hora de salida del
turno original del puesto** (`puesto.hora_salida`); si el puesto no la tiene
configurada, cae al default por turno (18:00 día / 06:00 noche).

**Por qué:** un relevo parcial cubre desde que entra el sustituto hasta el cierre
normal del turno; pedir el fin manualmente era redundante y bloqueaba el caso en que
el puesto no tiene `hora_salida`.

**Cómo aplicar:**
- Backend (`asignacion.ts`, bloque A-04 de cobertura): para `coberturaTipo==="parcial"`
  basta `horaInicioParcial`; `horaFin = horaFinParcial || finTurnoBase`, donde
  `finTurnoBase` = `puesto.hora_salida` válida o el default por turno. **Solo** la rama
  parcial cambia; relevo completo y demás tipos siguen usando defaults por turno y
  `turnoHorasPuesto`.
- Frontend (`ModalSustitucion.tsx`): el campo "Fin" se pre-llena con
  `puesto.hora_salida` y deja de ser obligatorio (solo el inicio bloquea la
  confirmación); si queda vacío se envía igual y el servidor deriva el fin.
- Ambas capas deben mantenerse en sincronía: si el front vuelve a exigir el fin, el
  fallback del backend nunca se activa cuando `hora_salida` es null.
