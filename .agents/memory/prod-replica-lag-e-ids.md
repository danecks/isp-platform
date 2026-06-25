---
name: Réplica de prod atrasada e IDs por entorno
description: La réplica read-only de producción puede ir ~1 día atrasada y los IDs de entidades difieren entre dev y prod; cómo no sacar conclusiones falsas al diagnosticar.
---

# Réplica de producción atrasada e IDs distintos por entorno

Al diagnosticar bugs reportados sobre la app PUBLICADA usando `executeSql({environment:"production"})`:

## La réplica read-only puede ir ~1 día atrasada
- Síntoma: toda consulta de "hoy" (faltas, custodia_asignacion_diaria, cobertura_segmentos, SSA del día) sale VACÍA aunque el usuario claramente ve esos datos en vivo.
- **Antes de concluir "no hay datos hoy"**, verificar frescura:
  `SELECT MAX(fecha::date) FROM eventos_rrhh, MAX(fecha) FROM custodia_asignacion_diaria, MAX(fecha) FROM cobertura_segmentos, CURRENT_DATE;`
  Si el MAX va detrás de CURRENT_DATE, la réplica no tiene el día actual y NO se puede confirmar la causa de un bug "de hoy" desde aquí.
- Lo que NO se puede ver con réplica atrasada: registros creados HOY (faltas del día, asignación diaria del día, segmentos de cobertura del día). Lo multi-día creado ayer o antes (p. ej. SSA con rango que abarca hoy) SÍ aparece.

## Los IDs de cliente/entidad difieren entre dev y prod
- Ejemplo real: "VAS VILLA NUEVA" = cliente **83 en dev** (custodia_titulares vacío) pero **73 en prod** (con titulares). Nunca asumir que un id mapea entre entornos.
- **How to apply:** al reproducir un bug de prod, resolver la entidad por NOMBRE en la base de prod, no por el id visto en dev.

## Regla de cobertura de custodia (para el "porqué" recurrente)
Un slot de custodia con titular ACTIVO sale "sin cobertura" no por falta de titular, sino porque ese titular HOY: tiene falta, está en Servicio Especial (SSA), o está cubriendo otro puesto/custodia (no puede estar en dos lugares). Excedente (i > fuerza del día) es caso aparte → queda DISPONIBLE. Si nada de eso aplica y aún sale descubierto, sospechar réplica atrasada o fecha vista distinta.
