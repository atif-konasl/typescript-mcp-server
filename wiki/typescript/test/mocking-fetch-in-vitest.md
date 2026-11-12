# Mocking `fetch` in Vitest: Single and Multi-Endpoint Strategies

In unit testing, we want tests to execute in **2 milliseconds, completely offline**, without spinning up real HTTP servers or depending on flaky external networks.

This guide explains:
1. **How Vitest intercepts and mocks Node's global `fetch` under the hood.**
2. **How to handle multiple different endpoints in a single test suite.**

---

## Part 1: How `fetch` Mocking Works Under the Hood

### The Code
```typescript
const mockFetch = vi.fn().mockResolvedValue({
  ok: true,
  json: async () => ({
    active: true,
    sub: "user-123",
    supplier_id: "supp-100",
    scope: "offers:read offers:write",
    exp: 1740000000,
  }),
});
vi.stubGlobal("fetch", mockFetch);
```

### The Sequence of Events

```mermaid
sequenceDiagram
    autonumber
    participant Test as Your Test Code
    participant Global as Node.js globalThis.fetch
    participant Mock as mockFetch (Vitest Spy)
    participant Class as TokenIntrospector.verify()

    Test->>Mock: 1. Create fake fetch with mockResolvedValue()
    Test->>Global: 2. vi.stubGlobal("fetch", mockFetch) [HIJACKS GLOBAL FETCH]
    
    Test->>Class: 3. Calls introspector.verify("valid-token")
    Class->>Global: 4. Calls fetch("http://auth.local/oauth/introspect", {...})
    Note over Global,Mock: Global fetch is replaced by mockFetch!
    Global->>Mock: Routes call to mockFetch
    Mock-->>Class: 5. Returns fake { ok: true, json: async () => ({ active: true, ... }) }
    
    Class->>Class: 6. Parses sub, supplier_id, scope into AgentSession
    Class-->>Test: 7. Returns session object
    Test->>Mock: 8. Asserts mockFetch was called 1 time
```

---

### Key Mechanics Explained

#### 1. Faking the HTTP `Response` Object
In real life, `await fetch(...)` returns a web-standard `Response` object containing:
- `response.ok` (boolean: `true` for 2xx, `false` otherwise)
- `response.status` (number: 200, 401, 500)
- `response.json()` (an async method resolving to the parsed JSON body)
- `response.text()` (an async method resolving to raw string text)

`mockResolvedValue(...)` creates a plain JavaScript object matching that exact structure. When your application code calls `await response.json()`, it calls your fake method and receives the canned data!

#### 2. The Global Hijack: `vi.stubGlobal("fetch", mockFetch)`
In Node.js 18+, `fetch` is a global function living on `globalThis.fetch`.  
`vi.stubGlobal` replaces `globalThis.fetch` with `mockFetch`. Any code executed in the test that calls `fetch(...)` will unwittingly invoke your spy function instead of the real internet.

#### 3. Testing Failure Scenarios with Ease
You don't need a broken server to test edge cases:

```typescript
// Test an HTTP 500 Server Crash:
vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
  ok: false,
  status: 500,
  text: async () => "Internal Server Error"
}));

// Test a Network Timeout / Wi-Fi Disconnect:
vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Network timeout / ECONNREFUSED")));
```

---

## Part 2: Handling Multiple Different Fetch Endpoints

When your code calls multiple different APIs (e.g. `POST /oauth/token` first to get a token, and then `GET /s2s/v1/offers` to fetch business data), use one of the two strategies below:

---

### Strategy 1: URL-Based Routing with `mockImplementation` (Recommended) 🌟

Instead of returning one static response, inspect the `url` (and options) passed into `fetch`:

```typescript
const mockFetch = vi.fn().mockImplementation(async (url: string, options?: RequestInit) => {
  // 1. Mock the OAuth2 Token Endpoint
  if (url.includes("/oauth/token")) {
    return {
      ok: true,
      status: 200,
      json: async () => ({
        access_token: "upstream-s2s-token-xyz",
        expires_in: 3600,
      }),
    };
  }

  // 2. Mock the Token Introspection Endpoint
  if (url.includes("/oauth/introspect")) {
    return {
      ok: true,
      status: 200,
      json: async () => ({
        active: true,
        sub: "user-123",
        supplier_id: "supp-100",
      }),
    };
  }

  // 3. Mock the Supplier Offers Endpoint
  if (url.includes("/s2s/v1/offers")) {
    return {
      ok: true,
      status: 200,
      json: async () => ({
        items: [{ id: "off-101", title: "CNC Milling Center" }],
        pagination: { page: 1, size: 20, total: 1 },
      }),
    };
  }

  // 4. Fail loudly on unexpected URLs (prevents silent typos!)
  throw new Error(`Unhandled mock fetch for URL: ${url}`);
});

vi.stubGlobal("fetch", mockFetch);
```

#### Why this is best:
- **Order-Independent**: Works regardless of which endpoint is called first.
- **Self-Documenting**: Clearly maps every endpoint URL to its expected payload.

---

### Strategy 2: Sequential Calls with `mockResolvedValueOnce`

If your code executes a strict sequence of calls, chain `mockResolvedValueOnce`:

```typescript
const mockFetch = vi.fn()
  // Call 1: First fetch() gets the token
  .mockResolvedValueOnce({
    ok: true,
    json: async () => ({ access_token: "token-123", expires_in: 3600 }),
  })
  // Call 2: Second fetch() gets the offers data
  .mockResolvedValueOnce({
    ok: true,
    json: async () => ({ items: [{ id: "off-101" }] }),
  });

vi.stubGlobal("fetch", mockFetch);
```

---

## 🎯 Verifying Outgoing Headers and Payloads

Because `vi.fn()` is a spy, you can assert that your code sent the exact headers and parameters expected by upstream services:

```typescript
// Assert Call #1 posted to the token endpoint
expect(mockFetch).toHaveBeenNthCalledWith(
  1,
  "http://auth.local/oauth/token",
  expect.objectContaining({ method: "POST" })
);

// Assert Call #2 attached the Bearer token in headers
expect(mockFetch).toHaveBeenNthCalledWith(
  2,
  expect.stringContaining("/s2s/v1/offers"),
  expect.objectContaining({
    headers: expect.objectContaining({
      Authorization: "Bearer upstream-s2s-token-xyz"
    })
  })
);
```

---

## 💡 Summary

| What You Need | Vitest Tool |
|---|---|
| **Hijack global `fetch`** | `vi.stubGlobal("fetch", mockFetch)` |
| **Simulate single response** | `mockFetch.mockResolvedValue({ ok: true, json: ... })` |
| **Simulate network crash** | `mockFetch.mockRejectedValue(new Error("Timeout"))` |
| **Handle multiple URLs** | `mockFetch.mockImplementation(async (url) => { if (url...) ... })` |
| **Handle sequential calls** | `mockFetch.mockResolvedValueOnce(...).mockResolvedValueOnce(...)` |
| **Assert call headers** | `expect(mockFetch).toHaveBeenCalledWith(url, { headers: ... })` |
