# Testing Axios OAuth2 Client Credentials Interceptors with Vitest

This guide explains how to unit test the Axios OAuth2 Client Credentials Interceptor (`client-credentials.ts`) in Vitest without requiring a live authorization server or external network connections.

---

## 🎯 The Architectural Challenge

In [`src/auth/client-credentials.ts`](./../../04-outbound-oauth-client.md), your code instantiates the OAuth client as follows:

```typescript
const getCredentials = clientCredentials(
  axios.create(), // 👈 A dedicated Axios instance created internally
  tokenUrl,
  clientId,
  clientSecret,
  scope,
)
```

Because `axios-oauth-client` uses `axios.create()` to issue the `POST /oauth/token` request, we can intercept and mock the entire token exchange by spying on **`axios.create()`** with Vitest.

---

## 📋 The 4 Test Scenarios to Cover

| #     | Test Scenario            | Behavior Verified                                                                                     |
| ----- | ------------------------ | ----------------------------------------------------------------------------------------------------- |
| **1** | **Header Injection**     | Interceptor calls token endpoint and stamps `Authorization: Bearer <token>` onto `config.headers`.    |
| **2** | **In-Memory Caching**    | Multiple outgoing requests reuse the cached token; `axios.create()` is called **only once**.          |
| **3** | **TTL & Grace Period**   | Time advances past `(expires_in - gracePeriodSeconds)` ➔ cache expires and fetches a refreshed token. |
| **4** | **Missing `expires_in`** | OAuth server omits `expires_in` ➔ defaults safely to 3600s without crashing or calculating `NaN`.     |

---

## 🧪 Complete Test Suite: `tests/client-credentials.test.ts`

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import axios, { type InternalAxiosRequestConfig } from "axios"
import { creaateOAuthInterceptor } from "../src/auth/client-credentials.js"

describe("creaateOAuthInterceptor", () => {
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

    // 1. Mock the Axios instance that axios-oauth-client uses for token POSTs
    mockPostInstance = vi.fn().mockResolvedValue({
      data: {
        access_token: "mock-access-token-123",
        token_type: "Bearer",
        expires_in: 3600,
      },
    })

    // 2. Hijack axios.create() to return our mock instance
    vi.spyOn(axios, "create").mockReturnValue(mockPostInstance as any)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  // -------------------------------------------------------------
  // Test 1: Injects Bearer token into outgoing request headers
  // -------------------------------------------------------------
  it("should fetch token and inject Bearer header into request config", async () => {
    const interceptor = creaateOAuthInterceptor(OAUTH_OPTIONS)

    const initialConfig = {
      headers: {},
      url: "/s2s/v1/offers",
      method: "get",
    } as unknown as InternalAxiosRequestConfig

    const updatedConfig = await interceptor(initialConfig)

    // Verify token was injected into Authorization header
    expect(updatedConfig.headers["Authorization"]).toBe(
      "Bearer mock-access-token-123",
    )

    // Verify token was requested from the right URL with client_credentials
    expect(mockPostInstance).toHaveBeenCalledTimes(1)
    expect(mockPostInstance).toHaveBeenCalledWith(
      expect.objectContaining({
        url: OAUTH_OPTIONS.tokenUrl,
        method: "post",
        data: expect.stringContaining("grant_type=client_credentials"),
      }),
    )
  })

  // -------------------------------------------------------------
  // Test 2: In-Memory Caching (Second request must not re-fetch)
  // -------------------------------------------------------------
  it("should serve token from in-memory cache on subsequent requests", async () => {
    const interceptor = creaateOAuthInterceptor(OAUTH_OPTIONS)

    const config1 = { headers: {} } as unknown as InternalAxiosRequestConfig
    const config2 = { headers: {} } as unknown as InternalAxiosRequestConfig

    // Call 1: Network call
    const res1 = await interceptor(config1)
    expect(res1.headers["Authorization"]).toBe("Bearer mock-access-token-123")
    expect(mockPostInstance).toHaveBeenCalledTimes(1)

    // Call 2: Must be served from memory cache!
    const res2 = await interceptor(config2)
    expect(res2.headers["Authorization"]).toBe("Bearer mock-access-token-123")
    expect(mockPostInstance).toHaveBeenCalledTimes(1) // 🎯 Still 1 call!
  })

  // -------------------------------------------------------------
  // Test 3: Respects Grace Period Expiration
  // -------------------------------------------------------------
  it("should refetch token when TTL expires considering grace period", async () => {
    vi.useFakeTimers()

    // Token expires in 60s, grace period is 30s ➔ Safe TTL is (60 - 30) = 30 seconds
    mockPostInstance
      .mockResolvedValueOnce({
        data: { access_token: "first-token", expires_in: 60 },
      })
      .mockResolvedValueOnce({
        data: { access_token: "refreshed-token", expires_in: 60 },
      })

    const interceptor = creaateOAuthInterceptor({
      ...OAUTH_OPTIONS,
      gracePeriodSeconds: 30,
    })

    // Call 1: gets first-token
    const res1 = await interceptor({
      headers: {},
    } as InternalAxiosRequestConfig)
    expect(res1.headers["Authorization"]).toBe("Bearer first-token")
    expect(mockPostInstance).toHaveBeenCalledTimes(1)

    // Fast-forward time by 31 seconds (past the 30s TTL!)
    vi.advanceTimersByTime(31 * 1000)

    // Call 2: Cache has expired, must fetch refreshed-token!
    const res2 = await interceptor({
      headers: {},
    } as InternalAxiosRequestConfig)
    expect(res2.headers["Authorization"]).toBe("Bearer refreshed-token")
    expect(mockPostInstance).toHaveBeenCalledTimes(2)
  })

  // -------------------------------------------------------------
  // Test 4: Defensive fallback when expires_in is missing
  // -------------------------------------------------------------
  it("should fallback safely to 1 hour if server omits expires_in", async () => {
    mockPostInstance.mockResolvedValue({
      data: {
        access_token: "token-without-expiry",
        // Notice: expires_in is undefined!
      },
    })

    const interceptor = creaateOAuthInterceptor(OAUTH_OPTIONS)
    const config = { headers: {} } as InternalAxiosRequestConfig

    const result = await interceptor(config)
    expect(result.headers["Authorization"]).toBe("Bearer token-without-expiry")
    expect(mockPostInstance).toHaveBeenCalledTimes(1)
  })
})
```

---

## 🔍 Key Vitest Testing Techniques Used

### 1. Spying on Factory Methods (`vi.spyOn(axios, "create")`)

Instead of mocking the entire `axios` module, `vi.spyOn(axios, "create")` only intercepts calls that create new Axios instances. When `clientCredentials` executes, it receives our `mockPostInstance` spy, letting us inspect the exact payload sent to `/oauth/token`.

---

### 2. Time Travel with Fake Timers (`vi.useFakeTimers()`)

Testing cache expiration normally requires waiting for real-world time to elapse.  
With `vi.useFakeTimers()` and `vi.advanceTimersByTime(31 * 1000)`, Vitest simulates the passage of 31 seconds in **1 millisecond**, allowing us to reliably verify TTL expiration without slowing down our test suite.

---

### 3. Partial Payload Matching (`expect.objectContaining`)

```typescript
expect(mockPostInstance).toHaveBeenCalledWith(
  expect.objectContaining({
    url: OAUTH_OPTIONS.tokenUrl,
    method: "post",
    data: expect.stringContaining("grant_type=client_credentials"),
  }),
)
```

Rather than asserting every tiny internal property of the Axios request, `expect.objectContaining` focuses only on the essential fields: the URL, the HTTP method, and the presence of `grant_type=client_credentials`.

---

## 🚀 Running the Tests

To run this test suite in your terminal:

```bash
npx vitest run tests/client-credentials.test.ts
```

All 4 tests will execute completely offline in approximately **15 milliseconds**!
