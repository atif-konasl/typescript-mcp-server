# Testing OpenAPI Axios Clients with Vitest

This guide explains how to unit test the OpenAPI-generated Offers Client (`src/clients/offers.ts`) in Vitest completely offline, without needing a running mock server or external network connections.

---

## 🎯 What We Need to Verify

When testing `NewOffersClient`, we need to verify five key behaviors:

| # | Test Scenario | Behavior Verified |
|---|---|---|
| **1** | **Operation Registration** | The client initializes and exposes generated OpenAPI methods (`listOffers`, `getOffer`). |
| **2** | **Default Timeout** | When no timeout is provided, `client.defaults.timeout` defaults to `5000` (5 seconds). |
| **3** | **Custom Options Override** | Custom `baseURL` and `timeout` values in `axiosConfigDefaults` override defaults. |
| **4** | **Interceptor Attachment** | The `tokenProvider` interceptor is registered and executed during request dispatch. |
| **5** | **Parameter Dispatch** | Calling `client.listOffers({ supplier_id, page, size })` generates the expected HTTP GET request with query params. |

---

## 💡 The Mocking Strategy: Axios `adapter`

Rather than mocking global `fetch` or intercepting raw HTTP traffic with a proxy, Axios allows you to mock the **`adapter`** directly on the client instance:

```typescript
client.defaults.adapter = vi.fn().mockResolvedValue({
  data: { items: [], total: 0, page: 1, size: 20 },
  status: 200,
  statusText: "OK",
  headers: {},
  config: {},
});
```

### Why this is best practice:
1. **Zero Network Traffic**: Requests never leave the Node process.
2. **Inspect Full Request Details**: The spy captures the exact `url`, `method`, `params`, and `headers` built by `openapi-client-axios`.
3. **Isolation**: Tests run completely offline in under **10 milliseconds**.

---

## 🧪 Complete Test Suite Blueprint: `src/clients/offers.test.ts`

```typescript
import { describe, it, expect, vi } from "vitest";
import { NewOffersClient } from "./offers.js";

describe("NewOffersClient", () => {
  // -------------------------------------------------------------
  // Test 1: Verifies generated operation methods exist
  // -------------------------------------------------------------
  it("should initialize client with listOffers and getOffer methods", async () => {
    const client = await NewOffersClient({
      axiosConfigDefaults: { baseURL: "http://api.local" },
    });

    expect(client).toBeDefined();
    expect(typeof client.listOffers).toBe("function");
    expect(typeof client.getOffer).toBe("function");
  });

  // -------------------------------------------------------------
  // Test 2: Verifies default 5000ms timeout
  // -------------------------------------------------------------
  it("should apply default timeout of 5000ms", async () => {
    const client = await NewOffersClient();
    expect(client.defaults.timeout).toBe(5000);
  });

  // -------------------------------------------------------------
  // Test 3: Verifies custom axiosConfigDefaults override
  // -------------------------------------------------------------
  it("should allow overriding timeout and other axios defaults", async () => {
    const client = await NewOffersClient({
      axiosConfigDefaults: {
        baseURL: "http://custom-upstream.local",
        timeout: 10000,
      },
    });

    expect(client.defaults.baseURL).toBe("http://custom-upstream.local");
    expect(client.defaults.timeout).toBe(10000);
  });

  // -------------------------------------------------------------
  // Test 4: Verifies tokenProvider interceptor runs on requests
  // -------------------------------------------------------------
  it("should register tokenProvider interceptor when provided", async () => {
    const mockInterceptor = vi.fn().mockImplementation((config) => {
      config.headers = config.headers || {};
      config.headers["Authorization"] = "Bearer test-token";
      return config;
    });

    const client = await NewOffersClient(undefined, mockInterceptor);

    // Mock network adapter so no actual HTTP call occurs
    client.defaults.adapter = vi.fn().mockResolvedValue({
      data: { items: [], total: 0, page: 1, size: 20 },
      status: 200,
      statusText: "OK",
      headers: {},
      config: {},
    });

    await client.listOffers();

    // Verify our interceptor was called during request pipeline
    expect(mockInterceptor).toHaveBeenCalledTimes(1);
  });

  // -------------------------------------------------------------
  // Test 5: Verifies parameter mapping to HTTP GET query params
  // -------------------------------------------------------------
  it("should send correct query params when calling listOffers", async () => {
    const client = await NewOffersClient();

    const mockAdapter = vi.fn().mockResolvedValue({
      data: { items: [], total: 0, page: 1, size: 20 },
      status: 200,
      statusText: "OK",
      headers: {},
      config: {},
    });
    client.defaults.adapter = mockAdapter;

    await client.listOffers({
      supplier_id: "supp-100",
      page: 2,
      size: 10,
    });

    expect(mockAdapter).toHaveBeenCalledWith(
      expect.objectContaining({
        url: "/s2s/v1/offers",
        method: "get",
        params: {
          supplier_id: "supp-100",
          page: 2,
          size: 10,
        },
      })
    );
  });
});
```

---

## 🚀 Running the Tests

Once you save `src/clients/offers.test.ts`, run:

```bash
npx vitest run src/clients/offers.test.ts
```

All 5 tests will execute in approximately **10-15 milliseconds**!
