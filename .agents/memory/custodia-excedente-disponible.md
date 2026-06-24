---
name: Custodia titular excedente del día → DISPONIBLE
description: En custodia, el titular que sobra un día (más titulares que la fuerza pedida) va a DISPONIBLE (día normal), no a DESCANSO; consistencia tablero/pool.
---

# Custodia: titular excedente del día → DISPONIBLE (no DESCANSO)

Cuando un cliente de custodia tiene más titulares activos que la fuerza pedida
ese día, los titulares que sobran NO descansan: quedan **DISPONIBLES**, asignables
a otros puestos y pagados a **día normal** (no horas extra).

**Why:** Decisión del director. El excedente es fuerza ociosa reutilizable, no
ausencia ni descanso de ciclo; pagarlo como HE al cubrir otro puesto sería doble
costo indebido.

**How to apply:**
- Umbral = **demanda del día** (`fuerzaHoy`), NO el mínimo semanal. Así se preserva
  el auto-fill en días de alta demanda y solo sobra en días bajos.
  `fuerzaHoy = COALESCE(custodia_excepciones.cantidad [por fecha], custodia_fuerza_semanal.cantidad_agentes [por EXTRACT(DOW)], 0)`.
- **Solo custodia.** No tocar puestos fijos, 24x24 ni armería.
- **tablero.ts** (loop custodia): el slot excedente emite `descanso_por_ciclo:false` +
  `excedente_disponible:true`, estado sigue `descubierto` (asignable). El flag
  `excedenteDisponible` excluye al titular de las ramas titularCubriendoOtro /
  titularEnSsa / cubierto.
- **pool.ts** (LATERAL `custodia_tit` + CASE categoría): las ramas `en_puesto` y
  `faltando` exigen `slot_numero <= fuerza_hoy`; el excedente cae a `disponible`
  (NO `disponibleHE`), garantizando pago de día normal al cubrir otro puesto.
- **Las dos fuentes (tablero y pool) deben mantenerse alineadas**: si cambia el
  cálculo de fuerza del día en una, replicar en la otra o el slot y el pool se
  contradicen.
- Frontend: `Puesto.excedente_disponible?`; badge DISPONIBLE (emerald/UserCheck) en
  vez de DESCANSO; `CustodiaGrupo` y `ClienteColumna` cuentan el excedente como
  cubierto-ish (excluido de "descubiertos", incluido en el % y numerador), no rojo.
