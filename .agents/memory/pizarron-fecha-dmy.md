---
name: Pizarrón envía fecha DD-MM-YYYY
description: El pizarrón operativo manda fechas en formato guatemalteco DD-MM-YYYY; endpoints que castean ::date deben normalizar a ISO o PostgreSQL falla.
---

# El pizarrón operativo envía fecha en DD-MM-YYYY

`fechaHoyStr()`/`fechaVista` en isp-web (admin/pages/operaciones) producen
fecha en formato **DD-MM-YYYY** (`${dd}-${mm}-${yyyy}`), no ISO. Ese string
viaja en el body a varios endpoints. `fechaActivaStr` suele ser ISO pero cae a
`fechaHoyStr()` (DD-MM-YYYY) cuando no hay cierre, así que tampoco es confiable.

**Síntoma:** PostgreSQL `DateTimeParseError` (code 22008,
`date/time field value out of range: "22-06-2026"`) al castear `$N::date`.
Apareció en POST /api/incentivos (registrar HE en efectivo desde el pizarrón):
2 de los 4 call sites del modal de incentivo pasaban `fechaVista` (DD-MM-YYYY) y
2 pasaban `fechaActivaStr`, por eso "a veces sí, a veces no".

**Regla:** cualquier endpoint que reciba `fecha` del pizarrón y la use como
`::date` debe normalizarla a ISO primero. Patrón usado en incentivos.ts:
`toISODate(v)` → si matchea `^(\d{2})-(\d{2})-(\d{4})$` reordena a YYYY-MM-DD;
si no, `slice(0,10)` (deja ISO y timestamps intactos).

**Por qué backend y no frontend:** el formato DD-MM-YYYY es la convención que el
pizarrón ya manda a muchos endpoints; normalizar en el backend cubre los 4 call
sites y cualquier formato futuro, en vez de parchear cada lugar del front.

**Dónde más vigilar:** GET /incentivos también filtra por `fecha` cruda; otros
endpoints de operaciones (falta-personal, anular/reactivar) reciben `fechaVista`
y la castean a ::date — si reportan el mismo error, aplicar el mismo helper.
