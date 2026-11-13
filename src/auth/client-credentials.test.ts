import axios, { type InternalAxiosRequestConfig } from "axios"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { createOAuthInterceptor } from "./client-credentials.js"

describe("createOAuthInterceptor", () => {
  const OAUTH_OPTIONS = {
    tokenUrl: "http://auth.local/oauth/token",
    clientId: "test-client-id",
    clientSecret: "test-client-secret",
    scope: "offers.read",
    gracePeriodSeconds: 30,
  }

  let mockPostInstance: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()

    mockPostInstance = vi.fn().mockResolvedValue({
      data: {
        access_token: "mock-access-token-123",
        token_type: "Bearer",
        expires_in: 3600,
      },
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.spyOn(axios, "create").mockReturnValue(mockPostInstance as any)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("should fetch token and inject Bearer header into request config", async () => {
    const interceptor = createOAuthInterceptor(OAUTH_OPTIONS)
    const initConfig = {
      headers: {},
      url: "/api/v1/products",
      method: "get",
    } as unknown as InternalAxiosRequestConfig

    const updatedConfig = await interceptor(initConfig)

    expect(updatedConfig.headers["Authorization"]).toBe(
      "Bearer mock-access-token-123",
    )
    expect(mockPostInstance).toHaveBeenCalledTimes(1)
    expect(mockPostInstance).toHaveBeenCalledWith(
      expect.objectContaining({
        url: OAUTH_OPTIONS.tokenUrl,
        method: "post",
        data: expect.stringContaining("grant_type=client_credentials"),
      }),
    )
  })

  it("should serve token from in-memory cache on subsequent requests", async () => {
    const interceptor = createOAuthInterceptor(OAUTH_OPTIONS)

    const config1 = { headers: {} } as unknown as InternalAxiosRequestConfig
    const config2 = { headers: {} } as unknown as InternalAxiosRequestConfig

    // Call 1: Network call
    const res1 = await interceptor(config1)
    expect(res1.headers["Authorization"]).toBe("Bearer mock-access-token-123")
    expect(mockPostInstance).toHaveBeenCalledTimes(1)

    // Call 2: Must be served from cache!
    const res2 = await interceptor(config2)
    expect(res2.headers["Authorization"]).toBe("Bearer mock-access-token-123")
    expect(mockPostInstance).toHaveBeenCalledTimes(1) // 🎯 Still 1 call!
  })

  it("should refetch token when TTL expires considering grace period", async () => {
    vi.useFakeTimers()

    mockPostInstance
      .mockResolvedValueOnce({
        data: { access_token: "first-token", expires_in: 60 },
      })
      .mockResolvedValueOnce({
        data: { access_token: "refreshed-token", expires_in: 60 },
      })

    const interceptor = createOAuthInterceptor({
      ...OAUTH_OPTIONS,
      gracePeriodSeconds: 30,
    })

    const res1 = await interceptor({
      headers: {},
    } as InternalAxiosRequestConfig)
    expect(res1.headers["Authorization"]).toBe("Bearer first-token")
    expect(mockPostInstance).toHaveBeenCalledTimes(1)

    vi.advanceTimersByTime(31 * 1000)

    const res2 = await interceptor({
      headers: {},
    } as InternalAxiosRequestConfig)
    expect(res2.headers["Authorization"]).toBe("Bearer refreshed-token")
    expect(mockPostInstance).toHaveBeenCalledTimes(2)
  })

  it("should fallback safely to 1 hour if server omits expires_in", async () => {
    mockPostInstance.mockResolvedValue({
      data: {
        access_token: "token-without-expiry",
        // Notice: expires_in is undefined!
      },
    })

    const interceptor = createOAuthInterceptor(OAUTH_OPTIONS)
    const config = { headers: {} } as InternalAxiosRequestConfig

    const result = await interceptor(config)
    expect(result.headers["Authorization"]).toBe("Bearer token-without-expiry")
    expect(mockPostInstance).toHaveBeenCalledTimes(1)
  })
})
