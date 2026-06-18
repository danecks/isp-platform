---
name: Acta administrativa en una sola hoja
description: Cuál es el generador real del acta y cómo se compacta a una página
---

El Acta Administrativa (RRHH) la genera `generarActaAdministrativa` en
`artifacts/isp-web/src/lib/pdfRrhh.ts` usando la clase `IspPdf`
(`artifacts/isp-web/src/lib/pdfExport.ts`). NO la genera `actaPdf.ts` — ese es
un señuelo: editarlo no cambia el acta que descarga el director.

**Por qué (una hoja):** el director la quiere en una sola hoja; antes las dos
filas de firmas (Representante/Trabajador + Testigo 1/2) caían solas en la hoja
2 porque el contenido terminaba muy abajo y `addFirmaDoble` saltaba de página
prematuramente.

**Cómo se logró (config verificada con simulación jspdf fiel):**
- `IspPdf` tiene una opción `compact` que baja el membrete de 42mm→28mm y
  reposiciona logo/títulos/fecha; en compacto el gap final del bloque meta es
  3 en vez de 5. El acta pasa `compact:true`.
- Cuerpo narrativo a font 8, párrafos de FUNDAMENTO LEGAL a 7.5 (límite bajo
  pero legible para carta formal).
- `addFirmaDoble` usa `checkPageBreak(14)` (antes 30, demasiado conservador:
  una fila de firma solo consume ~7.5mm de tinta). Sigue con margen seguro
  respecto al footer.
- Espacios antes/entre firmas reducidos (6 y 5).

**Cuidado:** `addFirmaDoble` y `addLinea` son compartidos por la clase. Hoy en
TS solo el acta usa `addFirmaDoble`, así que el cambio de 14 es de bajo riesgo;
si se agregan otros documentos con firmas, considerar volverlo parametrizable.
