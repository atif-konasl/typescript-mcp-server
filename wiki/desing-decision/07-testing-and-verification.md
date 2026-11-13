# 07. Testing, Verification & Debugging

In this chapter, you will learn how to verify your TypeScript MCP server at every level: unit testing with **Vitest**, interactive debugging with **MCP Inspector**, command-line verification with **`curl`**, and integration with real **AI Agents**.

---

## 🧪 1. Unit & Integration Testing with Vitest

Create `vitest.config.ts` in your root directory:

```typescript
// vitest.config.ts
import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
    },
  },
})
```

### Writing Test: S2S Token Provider (`tests/client-credentials.test.ts`)

Test that the provider caches tokens, respects clock skew, and deduplicates concurrent calls:

```typescript
// Blueprint for tests/client-credentials.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest"
import { ClientCredentialsTokenProvider } from "../src/oauth/client-credentials.js"

describe("ClientCredentialsTokenProvider", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it("fetches and caches an access token", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ access_token: "test-token-123", expires_in: 3600 }),
    })
    vi.stubGlobal("fetch", mockFetch)

    const provider = new ClientCredentialsTokenProvider(
      "http://auth.local/oauth/token",
      "client_id",
      "client_secret",
    )

    // Call 1: fetches from network
    const token1 = await provider.getAccessToken()
    expect(token1).toBe("test-token-123")
    expect(mockFetch).toHaveBeenCalledTimes(1)

    // Call 2: served from memory cache
    const token2 = await provider.getAccessToken()
    expect(token2).toBe("test-token-123")
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it("deduplicates concurrent in-flight requests", async () => {
    let resolveNetwork: (val: any) => void
    const pendingNetwork = new Promise((resolve) => {
      resolveNetwork = resolve
    })

    const mockFetch = vi.fn().mockReturnValue(pendingNetwork)
    vi.stubGlobal("fetch", mockFetch)

    const provider = new ClientCredentialsTokenProvider(
      "http://auth.local/oauth/token",
      "client_id",
      "client_secret",
    )

    // Fire 3 simultaneous token requests
    const promise1 = provider.getAccessToken()
    const promise2 = provider.getAccessToken()
    const promise3 = provider.getAccessToken()

    // Resolve network once
    resolveNetwork!({
      ok: true,
      json: async () => ({ access_token: "shared-token", expires_in: 3600 }),
    })

    const [t1, t2, t3] = await Promise.all([promise1, promise2, promise3])
    expect(t1).toBe("shared-token")
    expect(t2).toBe("shared-token")
    expect(t3).toBe("shared-token")
    expect(mockFetch).toHaveBeenCalledTimes(1) // Only 1 network request fired!
  })

  it("refetches token when invalidated", async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: "token-v1", expires_in: 3600 }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: "token-v2", expires_in: 3600 }),
      })
    vi.stubGlobal("fetch", mockFetch)

    const provider = new ClientCredentialsTokenProvider(
      "http://auth.local/oauth/token",
      "client_id",
      "client_secret",
    )

    const t1 = await provider.getAccessToken()
    expect(t1).toBe("token-v1")

    provider.invalidate()

    const t2 = await provider.getAccessToken()
    expect(t2).toBe("token-v2")
    expect(mockFetch).toHaveBeenCalledTimes(2)
  })
})
```

Run tests with:

```bash
npm run test
```

---

## 🕵️ 2. Interactive Verification with MCP Inspector

Anthropic provides the official **MCP Inspector** web UI, which allows you to inspect tools, prompts, and execute them visually.

1. Start your mock server and MCP server:

   ```bash
   # Terminal 1:
   npm run mock

   # Terminal 2:
   npm run dev
   ```

2. Launch MCP Inspector against your SSE endpoint:

   ```bash
   npx @modelcontextprotocol/inspector http://localhost:8000/sse
   ```

3. In the Inspector UI:
   - Click **Connect**.
   - Navigate to the **Tools** tab. You should see `list_offers` and `get_offer_by_id`.
   - Test **Negative Auth Scenario**: Call `list_offers` without an `authToken`. Verify that it returns `ok: false` with `category: "auth_error"`.
   - Test **Tenant Mismatch Scenario**: Provide `authToken: "agent-token-supp-100"` and `supplierId: "supp-200"`. Verify that it returns `403 Forbidden` tenant mismatch.
   - Test **Happy Path Scenario**: Provide `authToken: "agent-token-supp-100"` and `supplierId: "supp-100"`. Verify that it returns `ok: true` with the list of mock offers.

---

## 💻 3. Command-Line Verification with `curl`

You can verify the SSE stream and JSON-RPC message exchange using `curl`:

### Step 1: Open SSE Connection (Terminal 1)

```bash
curl -N -H "Accept: text/event-stream" \
  -H "Authorization: Bearer agent-token-supp-100" \
  "http://localhost:8000/sse"
```

The server will respond with an SSE endpoint event containing your session URI:

```
event: endpoint
data: /messages?sessionId=e4b7c8a9-4321-...
```

### Step 2: Send `tools/call` JSON-RPC (Terminal 2)

Copy the `sessionId` returned in Terminal 1 and post a tool invocation:

```bash
curl -X POST "http://localhost:8000/messages?sessionId=<YOUR_SESSION_ID>" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "list_offers",
      "arguments": {
        "supplierId": "supp-100",
        "page": 1,
        "size": 10
      }
    }
  }'
```

In Terminal 1 (the SSE stream), you will immediately receive the JSON-RPC response event:

```
event: message
data: {"jsonrpc":"2.0","id":1,"result":{"content":[{"type":"text","text":"{\n  \"ok\": true,\n  \"data\": ...\n}"}]}}
```

---

## 🤖 4. Connecting to AI Agents (e.g. Claude Desktop)

To connect your server to Claude Desktop, edit `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "supplier-mcp": {
      "command": "node",
      "args": [
        "/Users/atifanowar/Workspace/personal-projects/typescript/typescript-mcp-server/dist/index.js"
      ],
      "env": {
        "PORT": "8000",
        "UPSTREAM_BASE_URL": "http://localhost:8080",
        "UPSTREAM_CLIENT_ID": "mcp-supplier-client",
        "UPSTREAM_CLIENT_SECRET": "super-secret-key-123",
        "UPSTREAM_OAUTH_TOKEN_URL": "http://localhost:8080/oauth/token",
        "INTROSPECTION_URL": "http://localhost:8080/oauth/introspect"
      }
    }
  }
}
```

---

## ⚠️ Common Pitfalls & Mentor Tips

1. **SSE Buffering in Express / Proxies**:
   If SSE events don't appear in real time, ensure headers include:
   - `Cache-Control: no-cache`
   - `Connection: keep-alive`
   - If behind Nginx, disable proxy buffering (`X-Accel-Buffering: no`).
2. **Context Loss with `AsyncLocalStorage`**:
   `AsyncLocalStorage.run()` propagates context across standard promises (`await`). However, if you use legacy callback-based libraries (like old `EventEmitter` or `setTimeout` without promises), context might be lost unless you bind it. Using modern `async/await` and native `fetch` avoids this issue completely.
3. **Zod Coercion**:
   When reading query parameters or environment variables, numbers and booleans are passed as strings. Use `z.coerce.number()` or `z.coerce.boolean()` so Zod parses `"8000"` into `8000`.
4. **Clock Skew Tuning**:
   Always set `clockSkewSeconds` to at least 30 to 60 seconds. In production distributed systems, clock drift between the auth server and your MCP server can cause token validation to fail if you check expiry at the exact last second.

---

🎉 **You are now fully equipped to build your TypeScript MCP Server! Refer back to [README.md](./README.md) to track your milestones.**
