import crypto from "node:crypto"
import { AgentSession } from "../context/request-context.js"

interface IntrospectionResponse {
  active: boolean
  sub?: string
  supplier_id?: string
  scope?: string
  exp?: number
}

interface CacheEntity {
  session: AgentSession
  expiresAt: number
}

export class TokenIntrospector {
  private cache = new Map<string, CacheEntity>()

  constructor(
    private readonly introspectionUrl: string,
    private readonly cacheTtlSeconds: number = 300,
    private readonly timeoutMs: number = 5_000,
  ) {}

  async verify(
    token: string,
    now: number = Date.now(),
  ): Promise<AgentSession | null> {
    const cacheKey = this.hashToken(token)
    const cached = this.cache.get(cacheKey)
    if (cached && cached.expiresAt > now) {
      return cached.session
    }

    const session = await this.introspect(token)
    if (!session) return null

    const maxCacheTtlMs = this.cacheTtlSeconds * 1000
    const tokenRemainingMs = session.expiresAt
      ? session.expiresAt - now
      : Infinity
    const safeTtlMs = Math.min(maxCacheTtlMs, tokenRemainingMs)

    this.cache.set(cacheKey, { session, expiresAt: now + safeTtlMs })
    return session
  }

  private async introspect(token: string): Promise<AgentSession | null> {
    try {
      const response = await fetch(this.introspectionUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
        },
        body: new URLSearchParams({
          token,
          token_type_hint: "access_token",
        }),
        signal: AbortSignal.timeout(this.timeoutMs),
      })

      if (!response.ok) return null
      const body = (await response.json()) as IntrospectionResponse
      if (!body.active) return null

      return {
        token,
        userId: body.sub ?? "unknown",
        supplierId: body.supplier_id ?? "",
        scopes: body.scope ? body.scope.split(" ") : [],
        expiresAt: body.exp ? body.exp * 1000 : undefined,
      }
    } catch {
      return null
    }
  }

  private hashToken(token: string): string {
    return crypto.createHash("sha256").update(token).digest("hex")
  }
}
