# 03. Inbound Agent Authentication & Context

In this chapter, you will implement inbound authentication. When an AI Agent invokes an MCP tool, it must supply a valid authentication token. Your server will authenticate the token and propagate the authenticated user context safely across asynchronous calls.

---

## 🎯 How the Agent Sends the Auth-Token

There are two primary ways an AI Agent delivers an auth-token to an MCP server:

1. **Transport Header (Streamable HTTP / SSE)**:
   The agent or gateway adds an HTTP header:

   ```http
   POST /mcp HTTP/1.1
   Authorization: Bearer <agent-auth-token>
   Content-Type: application/json
   ```

   _Advantage_: Standard HTTP practice; mirrors the Python reference (`TokenValidationMiddleware`).

2. **Tool Argument (JSON-RPC `tools/call`)**:
   The agent passes `authToken` directly inside the tool arguments:
   ```json
   {
     "jsonrpc": "2.0",
     "method": "tools/call",
     "params": {
       "name": "list_offers",
       "arguments": {
         "supplierId": "supp-99",
         "authToken": "agent-token-xyz"
       }
     }
   }
   ```
   _Advantage_: Works across all transports (including standard I/O `stdio` where HTTP headers do not exist).

### 🏆 Recommended Best Practice: The Hybrid Pattern

Support **both**:

- The HTTP middleware extracts `Authorization: Bearer <token>` (or `x-auth-token`) from the incoming HTTP request.
- The tool handler also accepts an optional `authToken?: string` parameter.
- The server checks: `token = args.authToken || context.getBearerToken()`. If neither is present, it rejects the request with an authentication error.

---

## 🧵 Request Context with `AsyncLocalStorage`

In Python, `contextvars` is used to store request-scoped variables without passing them down every function signature:

```python
# Python reference (app/context.py)
_current_access_token: contextvars.ContextVar[AccessToken | None] = contextvars.ContextVar(...)
```

In Node.js, the standard equivalent is **`AsyncLocalStorage`** from `node:async_hooks`. Because Node.js handles multiple concurrent asynchronous requests on a single thread, global variables would lead to race conditions and cross-request contamination. `AsyncLocalStorage` isolates state per async execution chain.

### Blueprint: `src/context/request-context.ts`

```typescript
import { AsyncLocalStorage } from "node:async_hooks"

export interface AgentSession {
  token: string
  userId: string
  supplierId: string
  scopes: string[]
  expiresAt?: number
}

const storage = new AsyncLocalStorage<AgentSession>()

export const RequestContext = {
  /** Run an async callback within an authenticated session context */
  run<T>(session: AgentSession, callback: () => Promise<T>): Promise<T> {
    return storage.run(session, callback)
  },

  /** Get the current authenticated agent session (or undefined if unauthenticated) */
  current(): AgentSession | undefined {
    return storage.getStore()
  },

  /** Require an active session or throw an error */
  require(): AgentSession {
    const session = storage.getStore()
    if (!session) {
      throw new Error("Unauthorized: No authenticated agent session found.")
    }
    return session
  },
}
```

---

## 🔍 RFC 7662 Token Introspection

In the reference repo (`app/auth.py`), the gateway uses standard **RFC 7662 Token Introspection** to verify inbound tokens against an identity server (e.g. Hydra, Keycloak, or Auth0).

### How RFC 7662 Works

1. Gateway receives agent token `T`.
2. Gateway sends `POST /oauth/introspect` with body `token=T`.
3. Identity server responds:
   ```json
   {
     "active": true,
     "sub": "user-4819",
     "supplier_id": "supp-99",
     "scope": "offers:read offers:write",
     "exp": 1740000000
   }
   ```
   If the token is invalid, revoked, or expired, it returns `{ "active": false }`.

### Token Verification Blueprint: `src/auth/introspector.ts`

```typescript
import crypto from "node:crypto"
import { AgentSession } from "../context/request-context.js"

export class TokenIntrospector {
  private cache = new Map<
    string,
    { session: AgentSession; expiresAt: number }
  >()

  constructor(
    private introspectionUrl: string,
    private cacheTtlSeconds: number = 300,
  ) {}

  async verify(token: string): Promise<AgentSession | null> {
    const cacheKey = crypto.createHash("sha256").update(token).digest("hex")
    const now = Date.now()

    // 1. Check in-memory cache to prevent flooding the auth server
    const cached = this.cache.get(cacheKey)
    if (cached && cached.expiresAt > now) {
      return cached.session
    }

    // 2. Call RFC 7662 Introspection endpoint
    try {
      const response = await fetch(this.introspectionUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
        },
        body: new URLSearchParams({ token, token_type_hint: "access_token" }),
      })

      if (!response.ok) {
        return null
      }

      const body = (await response.json()) as {
        active: boolean
        sub?: string
        supplier_id?: string
        scope?: string
        exp?: number
      }

      if (!body.active) {
        return null
      }

      const session: AgentSession = {
        token,
        userId: body.sub || "unknown",
        supplierId: body.supplier_id || "",
        scopes: body.scope ? body.scope.split(" ") : [],
        expiresAt: body.exp ? body.exp * 1000 : undefined,
      }

      // 3. Cache valid session
      const ttl = Math.min(this.cacheTtlSeconds * 1000, 3600 * 1000)
      this.cache.set(cacheKey, { session, expiresAt: now + ttl })

      return session
    } catch (error) {
      console.error("Introspection network failure:", error)
      return null
    }
  }
}
```

---

## 🛡️ Express Middleware for Inbound Auth

In Express, wrap incoming `/mcp` requests with the token verification middleware. If a valid token is found, execute the request inside `RequestContext.run()`:

```typescript
// Blueprint for src/middleware/auth-middleware.ts
import { Request, Response, NextFunction } from "express"
import { TokenIntrospector } from "../auth/introspector.js"
import { RequestContext } from "../context/request-context.js"

export function createAuthMiddleware(introspector: TokenIntrospector) {
  return async (req: Request, res: Response, next: NextFunction) => {
    // 1. Extract Bearer token from headers
    const authHeader =
      req.headers["authorization"] || req.headers["x-auth-token"]
    let token: string | undefined

    if (typeof authHeader === "string") {
      token = authHeader.startsWith("Bearer ")
        ? authHeader.slice(7).trim()
        : authHeader.trim()
    }

    if (!token) {
      // Continue unauthenticated; individual tools requiring auth will validate
      return next()
    }

    // 2. Validate token
    const session = await introspector.verify(token)
    if (!session) {
      return res.status(401).json({
        jsonrpc: "2.0",
        id: null,
        error: {
          code: -32001,
          message: "Authentication failed: token invalid or expired",
        },
      })
    }

    // 3. Bind session to current async context
    RequestContext.run(session, () => {
      next()
    })
  }
}
```

---

## 🔒 The `@requireAuth` Tool Guard Pattern

In your tool handlers, you can enforce that the caller has a valid token, and optionally enforce that the requested `supplierId` matches the authenticated `supplierId`:

```typescript
export function assertAuthorizedSupplier(
  targetSupplierId: string,
  directToken?: string,
): void {
  const session = RequestContext.current()

  if (!session && !directToken) {
    throw new Error("Missing authentication: You must provide an auth-token.")
  }

  // If session is present and claims a supplierId, enforce tenant isolation
  if (
    session &&
    session.supplierId &&
    session.supplierId !== targetSupplierId
  ) {
    throw new Error(
      `Forbidden: Your token (${session.supplierId}) is not authorized for supplier '${targetSupplierId}'.`,
    )
  }
}
```

---

Next Step: **[04. Outbound S2S OAuth Client Credentials Flow](./04-outbound-oauth-client.md)**
