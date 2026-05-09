// Barrel retrocompatible — el schema fue dividido por dominio en archivos
// separados (ver `./index.ts`). Este archivo se mantiene únicamente para no
// romper imports existentes del tipo:
//   import { ... } from "@workspace/db/schema/isp"
// Todo el código nuevo debería importar desde "@workspace/db" directamente.
export * from "./usuarios";
export * from "./clientes";
export * from "./rrhh";
export * from "./operaciones";
export * from "./comercial";
export * from "./whatsapp";
