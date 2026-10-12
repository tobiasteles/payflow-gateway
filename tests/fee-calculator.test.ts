import { describe, expect, it, test } from "vitest";
import {
  calculateNet,
  distribute,
  getMdrBps,
  splitPayment,
} from "@/lib/fee-calculator";
import type { Brand, PaymentMode } from "@/lib/types";

describe("getMdrBps", () => {
  test.each<[Brand, PaymentMode, number, number]>([
    ["visa", "debit", 1, 150],
    ["mastercard", "debit", 1, 150],
    ["elo", "debit", 1, 180],
    ["visa", "credit", 1, 280],
    ["elo", "credit", 1, 310],
    ["visa", "credit_installments", 2, 350],
    ["visa", "credit_installments", 6, 350],
    ["visa", "credit_installments", 7, 430],
    ["elo", "credit_installments", 12, 460],
  ])("%s / %s / %ix → %i bps", (brand, mode, n, bps) => {
    expect(getMdrBps(brand, mode, n)).toBe(bps);
  });

  test.each([0, 1, 13, 2.5])("rejeita parcelamento inválido (%s)", (n) => {
    expect(() => getMdrBps("visa", "credit_installments", n)).toThrow(
      RangeError,
    );
  });
});

describe("calculateNet", () => {
  test.each<[number, Brand, PaymentMode, number, number, number]>([
    // bruto, bandeira, modalidade, parcelas, MDR (centavos), líquido (centavos)
    [10000, "visa", "debit", 1, 150, 9850],
    [10000, "elo", "credit", 1, 310, 9690],
    [30000, "visa", "credit_installments", 3, 1050, 28950],
    [10000, "mastercard", "credit_installments", 12, 430, 9570],
    [9999, "visa", "credit", 1, 280, 9719], // 279,972 → 280
  ])("R$ %i ¢ %s %s %ix", (gross, brand, mode, n, mdr, net) => {
    const r = calculateNet({
      amountCents: gross,
      brand,
      mode,
      installments: n,
    });
    expect(r.mdrCents).toBe(mdr);
    expect(r.netCents).toBe(net);
    expect(r.mdrCents + r.netCents).toBe(gross);
  });

  it("não sofre com ponto flutuante: 0,1 + 0,2 em centavos", () => {
    expect(0.1 + 0.2).not.toBe(0.3); // o problema que evitamos
    expect(
      calculateNet({ amountCents: 30, brand: "visa", mode: "debit" }).netCents,
    ).toBe(30 - 0); // 0,45 → 0
  });

  it("distribui centavos de parcelas sem perder nenhum", () => {
    const r = calculateNet({
      amountCents: 10000,
      brand: "mastercard",
      mode: "credit_installments",
      installments: 12,
    });
    expect(r.installmentPlan).toHaveLength(12);
    expect(r.installmentPlan.slice(0, 6)).toEqual(Array(6).fill(798));
    expect(r.installmentPlan.slice(6)).toEqual(Array(6).fill(797));
    expect(r.installmentPlan.reduce((a, b) => a + b, 0)).toBe(r.netCents);
  });

  test.each([0, -100, 10.5, NaN])(
    "rejeita valor inválido (%s)",
    (amountCents) => {
      expect(() =>
        calculateNet({ amountCents, brand: "visa", mode: "debit" }),
      ).toThrow(RangeError);
    },
  );
});

describe("distribute", () => {
  it("mantém a soma exata", () => {
    expect(distribute(100, 3)).toEqual([34, 33, 33]);
  });
});

describe("splitPayment", () => {
  it("usa o maior resto para fechar a soma", () => {
    const out = splitPayment(10001, [
      { recipientId: "lojista", bps: 3333 },
      { recipientId: "marketplace", bps: 3333 },
      { recipientId: "plataforma", bps: 3334 },
    ]);
    expect(out.map((o) => o.amountCents)).toEqual([3333, 3333, 3335]);
    expect(out.reduce((s, o) => s + o.amountCents, 0)).toBe(10001);
  });

  it("split 90/10 simples", () => {
    expect(
      splitPayment(9850, [
        { recipientId: "a", bps: 9000 },
        { recipientId: "b", bps: 1000 },
      ]),
    ).toEqual([
      { recipientId: "a", amountCents: 8865 },
      { recipientId: "b", amountCents: 985 },
    ]);
  });

  it("rejeita splits que não somam 100%", () => {
    expect(() => splitPayment(100, [{ recipientId: "a", bps: 5000 }])).toThrow(
      /100%/,
    );
  });
});
