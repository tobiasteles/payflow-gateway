import { beforeEach, describe, expect, it, test, vi } from "vitest";
import {
  brazilianHolidays,
  easterSunday,
  installmentSchedule,
  schedulePayout,
} from "@/lib/payout-scheduler";

describe("calendário", () => {
  it("calcula a Páscoa de 2026", () => {
    expect(easterSunday(2026).toISOString().slice(0, 10)).toBe("2026-04-05");
  });
  it("inclui feriados móveis de 2026", () => {
    const h = brazilianHolidays(2026);
    [
      "2026-02-16",
      "2026-02-17",
      "2026-04-03",
      "2026-06-04",
      "2026-11-20",
    ].forEach((d) => expect(h.has(d)).toBe(true));
  });
});

describe("schedulePayout com relógio falso", () => {
  beforeEach(() => vi.useFakeTimers());

  test.each([
    [
      "débito, segunda → terça (D+1)",
      "2026-03-02T15:00:00Z",
      "debit",
      "2026-03-03",
    ],
    [
      "débito, sexta → sábado → segunda",
      "2026-03-06T15:00:00Z",
      "debit",
      "2026-03-09",
    ],
    [
      "débito, quinta antes da Sexta-feira Santa → segunda",
      "2026-04-02T15:00:00Z",
      "debit",
      "2026-04-06",
    ],
    [
      "débito, 24/12 → Natal (sex) → segunda",
      "2026-12-24T15:00:00Z",
      "debit",
      "2026-12-28",
    ],
    [
      "crédito, D+30 em dia útil",
      "2026-03-02T15:00:00Z",
      "credit",
      "2026-04-01",
    ],
    [
      "crédito, D+30 cai no 1º de maio → segunda 04/05",
      "2026-04-01T15:00:00Z",
      "credit",
      "2026-05-04",
    ],
  ] as const)("%s", (_nome, agora, mode, esperado) => {
    vi.setSystemTime(new Date(agora));
    expect(schedulePayout({ mode })).toBe(esperado);
  });

  it("usa o dia de Brasília: 23h30 de sexta (02h30Z de sábado) ainda é sexta", () => {
    vi.setSystemTime(new Date("2026-03-07T02:30:00Z"));
    expect(schedulePayout({ mode: "debit" })).toBe("2026-03-09"); // sexta 06/03 + 1 = sábado → segunda
  });

  it("gera o cronograma de parcelas (D+30·n)", () => {
    vi.setSystemTime(new Date("2026-03-02T15:00:00Z"));
    expect(installmentSchedule(3)).toEqual([
      "2026-04-01",
      "2026-05-04",
      "2026-06-01",
    ]);
  });
});
