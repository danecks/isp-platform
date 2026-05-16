import { describe, it, expect } from "vitest";
import { horaDelDiaSlot, horaSemanaSlot } from "./utils";

describe("horaSemanaSlot", () => {
  it("usa hora_entrada cuando no hay rotación de horarios", () => {
    expect(horaSemanaSlot({ hora_entrada_por_semana: null, hora_entrada: "07:00" }, 0)).toBe("07:00");
    expect(horaSemanaSlot({ hora_entrada_por_semana: null, hora_entrada: "07:00" }, 3)).toBe("07:00");
  });

  it("usa el slot de la semana cuando hay rotación", () => {
    const slot = { hora_entrada_por_semana: ["06:00", "18:00"], hora_entrada: "07:00" };
    expect(horaSemanaSlot(slot, 0)).toBe("06:00");
    expect(horaSemanaSlot(slot, 1)).toBe("18:00");
  });

  it("cae al hora_entrada base si la semana pedida no existe en el array", () => {
    const slot = { hora_entrada_por_semana: ["06:00"], hora_entrada: "07:00" };
    expect(horaSemanaSlot(slot, 3)).toBe("07:00");
  });
});

describe("horaDelDiaSlot (TURNOS-05)", () => {
  const base = { hora_entrada: "07:00", hora_entrada_por_semana: null, hora_entrada_por_dia: null as Record<string, string> | null };

  it("usa la hora base cuando no hay excepciones ni rotación", () => {
    expect(horaDelDiaSlot(base, 1)).toBe("07:00");
    expect(horaDelDiaSlot(base, 14)).toBe("07:00");
  });

  it("usa la hora_por_semana cuando existe y no hay excepción por día", () => {
    const slot = { ...base, hora_entrada_por_semana: ["06:00", "18:00"] };
    expect(horaDelDiaSlot(slot, 1)).toBe("06:00");  // S1
    expect(horaDelDiaSlot(slot, 7)).toBe("06:00");  // último día S1
    expect(horaDelDiaSlot(slot, 8)).toBe("18:00");  // S2
    expect(horaDelDiaSlot(slot, 14)).toBe("18:00"); // último día S2
  });

  it("la excepción por día gana sobre la rotación por semana", () => {
    const slot = {
      ...base,
      hora_entrada_por_semana: ["06:00", "18:00"],
      hora_entrada_por_dia: { "1": "08:00", "9": "22:00" },
    };
    expect(horaDelDiaSlot(slot, 1)).toBe("08:00");  // excepción
    expect(horaDelDiaSlot(slot, 2)).toBe("06:00");  // sin excepción → S1
    expect(horaDelDiaSlot(slot, 9)).toBe("22:00");  // excepción
    expect(horaDelDiaSlot(slot, 10)).toBe("18:00"); // sin excepción → S2
  });

  it("la excepción por día gana sobre la hora base cuando no hay rotación", () => {
    const slot = { ...base, hora_entrada_por_dia: { "3": "23:30" } };
    expect(horaDelDiaSlot(slot, 3)).toBe("23:30");
    expect(horaDelDiaSlot(slot, 4)).toBe("07:00");
  });

  it("ignora valores con formato inválido en hora_entrada_por_dia", () => {
    const slot = { ...base, hora_entrada_por_dia: { "1": "not-a-time", "2": "" } as Record<string, string> };
    expect(horaDelDiaSlot(slot, 1)).toBe("07:00");
    expect(horaDelDiaSlot(slot, 2)).toBe("07:00");
  });

  it("computa correctamente el índice de semana para ciclos largos", () => {
    const slot = {
      ...base,
      hora_entrada_por_semana: ["06:00", "10:00", "14:00", "18:00"],
    };
    expect(horaDelDiaSlot(slot, 1)).toBe("06:00");
    expect(horaDelDiaSlot(slot, 8)).toBe("10:00");
    expect(horaDelDiaSlot(slot, 15)).toBe("14:00");
    expect(horaDelDiaSlot(slot, 22)).toBe("18:00");
    expect(horaDelDiaSlot(slot, 28)).toBe("18:00");
  });
});
