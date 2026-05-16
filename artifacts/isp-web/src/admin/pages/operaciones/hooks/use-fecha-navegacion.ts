import { useEffect, useRef, useState } from "react";
import { toISODate } from "../utils";
import { leerClienteURL, leerFechaURL, limpiarURLPizarron, navFechaISO, setURLPizarron } from "../helpers";

export function useFechaNavegacion() {
  const hoyISO = toISODate(new Date());
  const fechaDesdeURL = leerFechaURL();

  const [fechaVista, setFechaVista] = useState<string>(fechaDesdeURL ?? hoyISO);
  const esFuturo = fechaVista > hoyISO;
  const esPasado = fechaVista < hoyISO;
  const esOtraFecha = fechaVista !== hoyISO;

  const [clienteResaltado, setClienteResaltado] = useState<number | null>(() => leerClienteURL());
  const resaltadoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (clienteResaltado !== null) {
      if (resaltadoTimerRef.current) clearTimeout(resaltadoTimerRef.current);
      resaltadoTimerRef.current = setTimeout(() => setClienteResaltado(null), 4000);
    }
    return () => { if (resaltadoTimerRef.current) clearTimeout(resaltadoTimerRef.current); };
  }, [clienteResaltado]);

  function irAFecha(fecha: string, clienteId?: number) {
    setFechaVista(fecha);
    if (clienteId) setClienteResaltado(clienteId);
    setURLPizarron(fecha, clienteId);
  }

  function navFecha(delta: number) {
    setFechaVista(navFechaISO(fechaVista, delta));
    limpiarURLPizarron();
  }

  function volverHoy() {
    setFechaVista(hoyISO);
    setClienteResaltado(null);
    limpiarURLPizarron();
  }

  return {
    hoyISO,
    fechaVista,
    setFechaVista,
    esFuturo,
    esPasado,
    esOtraFecha,
    clienteResaltado,
    setClienteResaltado,
    irAFecha,
    navFecha,
    volverHoy,
  };
}
