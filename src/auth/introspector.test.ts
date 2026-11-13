import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { TokenIntrospector } from "./introspector.js"

describe("TokenIntrosepctor", () => {
  const INTROSPECTION_URL = "http://auth.local/oauth/introspect"
  const CACHE_TTL_SECONDS = 300

  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {})

  it("should return an AgentSession when token is active", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        active: true,
        sub: "user-123",
        supplier_id: "supp-100",
        scope: "offers:read offers:write",
        exp: 1740000000,
      }),
    })
    vi.stubGlobal("fetch", mockFetch)

    const introspector = new TokenIntrospector(
      INTROSPECTION_URL,
      CACHE_TTL_SECONDS,
    )
    const session = await introspector.verify("valid-token", 1730000000)

    expect(session).toEqual({
      token: "valid-token",
      userId: "user-123",
      supplierId: "supp-100",
      scopes: ["offers:read", "offers:write"],
      expiresAt: 1740000000 * 1000,
    })
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it("should return from cache", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        active: true,
        sub: "user-123",
        supplier_id: "supp-100",
        scope: "offers:read offers:write",
        exp: 1740000000,
      }),
    })
    vi.stubGlobal("fetch", mockFetch)

    const introspector = new TokenIntrospector(
      INTROSPECTION_URL,
      CACHE_TTL_SECONDS,
    )
    await introspector.verify("valid-token", 1730000000)

    await introspector.verify("valid-token", 1730009000)
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })
})
