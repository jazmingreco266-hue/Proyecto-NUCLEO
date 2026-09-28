/**
 * Límite de intentos por IP en memoria.
 * Complementa el bloqueo por cuenta (que vive en la base).
 * Limitación conocida: con varias instancias del servidor, cada una cuenta por separado.
 */
type Bucket = { count: number; resetAt: number };

export class RateLimiter {
  private buckets = new Map<string, Bucket>();
  constructor(
    private readonly max: number,
    private readonly windowMs: number,
  ) {}

  /** Devuelve true si la acción está permitida y la cuenta. */
  hit(key: string, now = Date.now()): boolean {
    if (this.buckets.size > 10_000) this.sweep(now);
    const b = this.buckets.get(key);
    if (!b || b.resetAt <= now) {
      this.buckets.set(key, { count: 1, resetAt: now + this.windowMs });
      return true;
    }
    b.count += 1;
    return b.count <= this.max;
  }

  private sweep(now: number) {
    for (const [k, b] of this.buckets) if (b.resetAt <= now) this.buckets.delete(k);
  }
}

export const loginLimiter = new RateLimiter(20, 15 * 60_000);
