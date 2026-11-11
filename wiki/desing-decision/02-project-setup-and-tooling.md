# 02. Project Setup & Tooling

In this chapter, you will configure your TypeScript project, establish strict type-checking, define dependency management, and design the folder layout.

---

## 🛠️ Prerequisites

- **Node.js**: `v20.x` or `v22.x` (LTS recommended)
- **Package Manager**: `pnpm` (recommended for speed) or `npm`
- **Shell**: bash or zsh

Check your current versions:
```bash
node -v   # Should be >= 20.0.0
pnpm -v   # or npm -v
```

---

## 📁 Recommended Project Structure

Here is the clean, modular layout recommended for this project:

```
typescript-mcp-server/
├── wiki/                          # Mentorship guides & architectural specs
├── mock-upstream/                 # Mock Upstream API & Auth Server
│   ├── server.ts                  # Mock HTTP server implementation
│   └── fixtures.ts                # Mock supplier and offer data
├── src/
│   ├── index.ts                   # Entry point (Starts Express + MCP Server)
│   ├── config.ts                  # Type-safe environment config (via Zod)
│   ├── context/
│   │   └── request-context.ts     # AsyncLocalStorage for request-scoped auth
│   ├── auth/
│   │   ├── introspector.ts        # RFC 7662 token introspector
│   │   └── token-cache.ts         # In-memory TTL cache for verified tokens
│   ├── oauth/
│   │   └── client-credentials.ts  # S2S OAuth 2.0 token provider with cache & lock
│   ├── clients/
│   │   ├── base-client.ts         # Base fetch client with auto 401 retry
│   │   └── supplier-client.ts     # Upstream Supplier service client
│   ├── middleware/
│   │   └── auth-middleware.ts     # Inbound Bearer token validation middleware
│   └── tools/
│       ├── list-offers.ts         # Tool 1: list_offers implementation
│       └── get-offer.ts           # Tool 2: get_offer_by_id implementation
├── tests/
│   ├── client-credentials.test.ts # Unit tests for S2S OAuth provider
│   ├── supplier-client.test.ts    # Unit tests for Upstream client
│   └── introspector.test.ts       # Unit tests for inbound token verification
├── .env.example                   # Template environment variables
├── package.json                   # Project scripts and dependencies
├── tsconfig.json                  # TypeScript compiler settings
└── vitest.config.ts               # Test runner configuration
```

---

## 📦 Dependencies Breakdown

### Production Dependencies (`dependencies`)
1. `@modelcontextprotocol/sdk` (v1.x): The official TypeScript SDK implementing Model Context Protocol (Server, Transports, Tools, Prompts).
2. `express` (v4.x) & `cors`: Fast HTTP server for hosting Streamable HTTP / Server-Sent Events (SSE).
3. `zod` (v3.x): Runtime schema validation for environment variables and MCP tool arguments.
4. `dotenv`: Loads `.env` file into `process.env`.

### Development Dependencies (`devDependencies`)
1. `typescript` (v5.x): The TypeScript compiler.
2. `@types/node`, `@types/express`, `@types/cors`: Static type definitions.
3. `tsx`: Fast TypeScript executor (like `node`, but runs `.ts` files on the fly without manual compile step).
4. `vitest`: Ultra-fast modern test framework.
5. `tsup`: Fast zero-config TypeScript bundler for production builds.

---

## ⚙️ Initializing `package.json`

When you create your `package.json`, ensure `"type": "module"` is configured to enable modern ECMAScript Modules (ESM):

```json
{
  "name": "typescript-mcp-server",
  "version": "1.0.0",
  "description": "Production-grade TypeScript MCP Server with S2S OAuth2 client credentials and inbound agent auth",
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "mock": "tsx watch mock-upstream/server.ts",
    "build": "tsup src/index.ts --format esm --dts --clean",
    "start": "node dist/index.js",
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

---

## 📐 Configuring `tsconfig.json`

For modern Node.js ESM and `@modelcontextprotocol/sdk`, configure `tsconfig.json` with `NodeNext` module resolution:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true
  },
  "include": ["src/**/*", "mock-upstream/**/*", "tests/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

> [!TIP]
> **Why `NodeNext`?** The MCP SDK uses modern ESM exports (`export * from ...`). Setting `"module": "NodeNext"` ensures TypeScript accurately mirrors Node's native module loader and enforces correct `.js` extensions in import paths if required.

---

## 🌐 Environment Configuration (`src/config.ts`)

Instead of accessing `process.env.MY_VAR` randomly throughout the codebase, use a centralized config module validated with **Zod**. This guarantees the server fails fast on startup if critical secrets or URLs are missing.

### Template `.env.example`
```env
# Server
PORT=8000
HOST=0.0.0.0
LOG_LEVEL=info

# Upstream Mock Service
UPSTREAM_BASE_URL=http://localhost:8080
UPSTREAM_CLIENT_ID=mcp-supplier-client
UPSTREAM_CLIENT_SECRET=super-secret-key-123
UPSTREAM_OAUTH_TOKEN_URL=http://localhost:8080/oauth/token

# Inbound Agent Auth (Introspection)
INBOUND_AUTH_ENABLED=true
INTROSPECTION_URL=http://localhost:8080/oauth/introspect
INTROSPECTION_CLIENT_ID=mcp-gateway
INTROSPECTION_CLIENT_SECRET=gateway-secret
TOKEN_CACHE_TTL_SECONDS=1800
```

### Zod Configuration Pattern
```typescript
// Blueprint for src/config.ts
import { z } from "zod";
import dotenv from "dotenv";

dotenv.config();

const configSchema = z.object({
  PORT: z.coerce.number().default(8000),
  HOST: z.string().default("0.0.0.0"),
  UPSTREAM_BASE_URL: z.string().url(),
  UPSTREAM_CLIENT_ID: z.string().min(1),
  UPSTREAM_CLIENT_SECRET: z.string().min(1),
  UPSTREAM_OAUTH_TOKEN_URL: z.string().url(),
  INBOUND_AUTH_ENABLED: z.coerce.boolean().default(true),
  INTROSPECTION_URL: z.string().url(),
  TOKEN_CACHE_TTL_SECONDS: z.coerce.number().default(1800),
});

export const config = configSchema.parse(process.env);
```

---

Next Step: **[03. Inbound Agent Authentication & Context](./03-inbound-agent-auth.md)**
