import { describe, expect, it, vi } from "vitest";
import {
  IdempotencyConflictError,
  IdempotencyService,
} from "@/lib/idempotency";

const payload = { amountCents: 10000, brand: "visa" };

describe("IdempotencyService", () => {
  it("não reprocessa: a mesma chave devolve a resposta em cache", async () => {
    const svc = new IdempotencyService<{ id: string }>();
    const handler = vi.fn().mockResolvedValue({ id: "ch_1" });
    const first = await svc.run("k1", payload, handler);
    const second = await svc.run("k1", payload, handler);
    expect(handler).toHaveBeenCalledTimes(1);
    expect(first).toEqual({ response: { id: "ch_1" }, replayed: false });
    expect(second).toEqual({ response: { id: "ch_1" }, replayed: true });
  });

  it("requisições concorrentes com a mesma chave executam uma única vez", async () => {
    const svc = new IdempotencyService<string>();
    const handler = vi.fn(
      () => new Promise<string>((r) => setTimeout(() => r("ok"), 20)),
    );
    const [a, b] = await Promise.all([
      svc.run("k", payload, handler),
      svc.run("k", payload, handler),
    ]);
    expect(handler).toHaveBeenCalledOnce();
    expect([a.replayed, b.replayed].sort()).toEqual([false, true]);
  });

  it("rejeita a mesma chave com payload diferente", async () => {
    const svc = new IdempotencyService<string>();
    await svc.run("k", payload, async () => "a");
    await expect(
      svc.run("k", { ...payload, amountCents: 1 }, async () => "b"),
    ).rejects.toBeInstanceOf(IdempotencyConflictError);
  });

  it("não guarda falhas em cache", async () => {
    const svc = new IdempotencyService<string>();
    const handler = vi
      .fn()
      .mockRejectedValueOnce(new Error("503"))
      .mockResolvedValueOnce("ok");
    await expect(svc.run("k", payload, handler)).rejects.toThrow("503");
    await expect(svc.run("k", payload, handler)).resolves.toMatchObject({
      response: "ok",
      replayed: false,
    });
  });

  it("expira após o TTL (timers falsos)", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-02T12:00:00Z"));
    const svc = new IdempotencyService<string>(24 * 3_600_000);
    const handler = vi.fn().mockResolvedValue("ok");
    await svc.run("k", payload, handler);
    vi.setSystemTime(new Date("2026-03-03T13:00:00Z")); // +25h
    await svc.run("k", payload, handler);
    expect(handler).toHaveBeenCalledTimes(2);
  });

  it("exige a chave", async () => {
    await expect(
      new IdempotencyService().run("  ", payload, async () => 1),
    ).rejects.toThrow(TypeError);
  });
});
