---
name: Borrado de datos debe correrlo el agente principal en Build
description: Operaciones de solo-datos (DELETE/UPDATE masivo) sobre la base de preview NO deben delegarse a un agente de tarea aislado.
---

# Operaciones de datos van por el agente principal (Build), no por task agent

Las operaciones que SOLO cambian datos (limpiezas, borrados masivos, backfills)
sobre la base de **preview/development** deben ejecutarlas el **agente principal en
modo Build**, contra `environment: "development"`. NO delegarlas a un agente de tarea.

**Why:** el agente de tarea corre en un entorno aislado con su **propia base
temporal**. Al fusionar, solo se trasladan cambios de **código/esquema**; los cambios
de **datos** de su base se descartan. Pasó con la limpieza de colaboradores: el task
agent reportó employees=0 en SU base, se fusionó "sin cambios de código", y la base
real de preview seguía con los 482. Hubo que re-ejecutar todo desde el agente principal.

**How to apply:** si una tarea es puramente datos (sin diff de código), márcala como
"la ejecuta el agente principal en Build" y córrela tú con executeSql
environment:"development", en una transacción BEGIN…COMMIT atómica. Verifica el grafo
de FK en vivo (information_schema) antes de borrar para ordenar hijos→padres y detectar
columnas SIN FK declarada (p.ej. planilla_lineas.employee_id) que no cascadean solas.
