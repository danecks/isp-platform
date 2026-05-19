# Convenciones de impresión (CSS `@media print`)

El sistema tiene varias pantallas imprimibles y todas comparten el mismo
`window.print()`. Si una de ellas declara reglas `@media print` con selectores
globales (`body > #root`, `html, body { … }`, `* { … }`, etc.) **y** ese CSS
queda activo cuando se imprime otra pantalla, el PDF de la otra sale en blanco
o roto. Eso pasó en la tarea #87 (planilla rompía la solicitud de empleo).

## La convención

Hay dos formas válidas de evitar el cruce. Cada pantalla imprimible debe usar
una de las dos, no inventar una tercera.

### Opción A — Scopear por clase del `body` (preferida para vistas dentro de la SPA)

1. Cuando la pantalla / modal imprimible se monta, pone una clase única en
   `document.body` (`printing-planilla`, `printing-solicitud`, …) y la quita
   al desmontarse:

   ```ts
   useEffect(() => {
     document.body.classList.add("printing-solicitud");
     return () => { document.body.classList.remove("printing-solicitud"); };
   }, []);
   ```

2. **Todas** las reglas dentro de `@media print` de esa vista — incluyendo
   las que tocan `html`, `body`, `#root` o `*` — empiezan con esa clase:

   ```css
   @media print {
     body.printing-solicitud .no-print { display: none !important; }
     body.printing-solicitud .print-root { background: #fff !important; }
     body.printing-solicitud * { print-color-adjust: exact !important; }
   }
   ```

3. Las únicas reglas que pueden quedar sin scopear son las puramente
   tipográficas dentro de clases propias de la vista (`.print-planilla th`,
   `.voucher-acreditacion h3`, etc.) que ya viven debajo de un selector
   exclusivo.

### Opción B — Imprimir en una ventana nueva con `window.open()`

Si lo que se imprime es un layout simple (una tabla, un QR), se puede abrir
una ventana aparte con `window.open()`, escribir HTML+CSS completos y llamar
`window.print()` dentro de esa ventana. Esa ventana es un documento
independiente: su CSS no puede tocar la SPA principal. No hace falta scopear
nada.

Ejemplos actuales:
- `Custodias.tsx` → `HojaImprimiblePanel.handlePrint`
- `RondasQR.tsx` → impresión de QR individual y `imprimirSeleccionados`

## Vistas imprimibles existentes

| Vista | Archivo | Estrategia | Clase / ventana |
| --- | --- | --- | --- |
| Planilla / cheques / acreditaciones | `planilla/impresion/print.css` + `ModalImprimir.tsx` | A | `body.printing-planilla` |
| Solicitud de empleo (PDF) | `KioscoSolicitudImprimible.tsx` | A | `body.printing-solicitud` |
| Hoja de custodia | `Custodias.tsx` | B | `window.open` |
| Etiquetas QR de rondas | `RondasQR.tsx` | B | `window.open` |

## Checklist al agregar una vista imprimible nueva

- [ ] ¿La vista está dentro de la SPA (no es una ventana aparte)?
  - Sí → Opción A. Reserva una clase `printing-<nombre>` única y aplícala con
    un `useEffect` durante todo el ciclo de vida del componente / modal.
  - No → Opción B. No hace falta nada más.
- [ ] ¿Todas las reglas dentro de `@media print` empiezan con `body.printing-<nombre>`?
  Especialmente las que tocan `html`, `body`, `#root`, `*`, `> *`.
- [ ] Probar imprimir esta vista **y** una segunda vista imprimible (planilla y
  solicitud, por ejemplo) en la misma sesión del navegador, sin recargar,
  para confirmar que no se pisan.
- [ ] Sumar la entrada nueva a la tabla de arriba.
