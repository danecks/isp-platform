---
name: Cobertura de puesto fuente única
description: Helper único para "¿está cubierto este puesto?"; no leer la columna legacy estado.
---
La verdad de "¿está cubierto un puesto operativo?" vive en `lib/cobertura-puesto.ts`
(`puestoCubiertoSql(alias)` / `puestoEstadoCoberturaSql(alias)`): cubierto = hay un
`puesto_slots` activo con `empleado_id`, o fallback legacy `po.agente_id IS NOT NULL`.

**Why:** la columna legacy `puestos_operativos.estado` ('cubierto'/'descubierto')
quedó obsoleta al pasar al modelo 24x24; reportaba casi todo "descubierto" y divergía
del pizarrón/cierre. La auditoría encontró que fichaje, zonas y portal aún la leían.

**How to apply:** cualquier nueva decisión o display de cobertura debe usar el helper,
nunca `estado = 'cubierto'`. cierre.contarCoberturaPuestos y los endpoints de
agente-fichaje/zonas/portal ya lo consumen. Las ESCRITURAS que mantienen la columna
legacy (UPDATE estado='cubierto' en el cierre) y el snapshot del cierre quedan aparte:
son writes/derivaciones propias, no lecturas de cobertura. El EXISTS usa alias `ps_cob`
para no chocar con otros `ps` en la query.
