export class IdempotencyConflictError extends Error {
  constructor(key: string) {
    super(`Idempotency-Key "${key}" já foi usada com um payload diferente`);
    this.name = 'IdempotencyConflictError';
  }
}

interface Entry<T> { fingerprint: string; expiresAt: number; response?: T; pending?: Promise<T> }

export class IdempotencyService<T = unknown> {
  private store = new Map<string, Entry<T>>();

  constructor(private ttlMs = 24 * 3_600_000, private now: () => number = () => Date.now()) {}

  async run(key: string, payload: unknown, handler: () => Promise<T>): Promise<{ response: T; replayed: boolean }> {
    if (!key?.trim()) throw new TypeError('Idempotency-Key é obrigatória');
    const fingerprint = JSON.stringify(payload);
    const existing = this.store.get(key);

    if (existing && existing.expiresAt > this.now()) {
      if (existing.fingerprint !== fingerprint) throw new IdempotencyConflictError(key);
      const response = existing.pending ? await existing.pending : (existing.response as T);
      return { response, replayed: true };
    }

    const pending = handler();
    this.store.set(key, { fingerprint, expiresAt: this.now() + this.ttlMs, pending });
    try {
      const response = await pending;
      this.store.set(key, { fingerprint, expiresAt: this.now() + this.ttlMs, response });
      return { response, replayed: false };
    } catch (err) {
      this.store.delete(key); // falhas não ficam em cache: o cliente pode repetir a chave
      throw err;
    }
  }
}
