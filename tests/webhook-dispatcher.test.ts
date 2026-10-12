import { createHmac } from "node:crypto";
import { describe, expect, it, test, vi } from "vitest";
import {
  signPayload,
  verifySignature,
  WebhookDispatcher,
} from "@/lib/webhook-dispatcher";

const SECRET = "whsec_test";
const event = {
  id: "evt_1",
  type: "charge.approved",
  data: { id: "ch_1", netCents: 9850 },
};

describe("WebhookDispatcher", () => {
  it("assina o corpo com HMAC-SHA256 e envia os headers", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-02T12:00:00Z"));
    const fetchFn = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 200 }));
    const result = await new WebhookDispatcher({
      secret: SECRET,
      fetchFn,
    }).dispatch("https://loja.test/hook", event);

    expect(result).toEqual({ delivered: true, status: 200 });
    const [url, init] = fetchFn.mock.calls[0];
    const t = Math.floor(Date.now() / 1000);
    const expected = createHmac("sha256", SECRET)
      .update(`${t}.${init.body}`)
      .digest("hex");
    expect(url).toBe("https://loja.test/hook");
    expect(init.headers["X-Gateway-Signature"]).toBe(`t=${t},v1=${expected}`);
    expect(init.headers["X-Gateway-Event"]).toBe("charge.approved");
    expect(JSON.parse(init.body)).toEqual(event);
  });

  test.each([[500], [404], [410]])(
    "marca como não entregue em HTTP %i",
    async (status) => {
      const fetchFn = vi.fn().mockResolvedValue(new Response(null, { status }));
      expect(
        await new WebhookDispatcher({ secret: SECRET, fetchFn }).dispatch(
          "https://x.test",
          event,
        ),
      ).toEqual({ delivered: false, status });
    },
  );

  it("captura erros de rede sem lançar", async () => {
    const fetchFn = vi.fn().mockRejectedValue(new Error("ECONNREFUSED"));
    expect(
      await new WebhookDispatcher({ secret: SECRET, fetchFn }).dispatch(
        "https://x.test",
        event,
      ),
    ).toEqual({ delivered: false, error: "ECONNREFUSED" });
  });
});

describe("verifySignature", () => {
  const now = Date.UTC(2026, 2, 2, 12, 0, 0);
  const t = now / 1000;
  const body = JSON.stringify(event);
  const header = `t=${t},v1=${signPayload(body, SECRET, t)}`;

  it("aceita assinatura válida", () =>
    expect(verifySignature(body, SECRET, header, 300, now)).toBe(true));
  it("rejeita corpo adulterado", () =>
    expect(verifySignature(body + " ", SECRET, header, 300, now)).toBe(false));
  it("rejeita segredo errado", () =>
    expect(verifySignature(body, "outro", header, 300, now)).toBe(false));
  it("rejeita replay fora da janela", () =>
    expect(verifySignature(body, SECRET, header, 300, now + 10 * 60_000)).toBe(
      false,
    ));
  it("rejeita header malformado", () =>
    expect(verifySignature(body, SECRET, "lixo", 300, now)).toBe(false));
});
