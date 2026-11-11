# 05. Implementing the 2 MCP Tools

In this chapter, you will implement the two core MCP tools using `@modelcontextprotocol/sdk` and `zod`. You will also learn how to wire the MCP server to Express using Server-Sent Events (SSE).

---

## 🛠️ Registering Tools with `McpServer`

The high-level `McpServer` class in `@modelcontextprotocol/sdk/server/mcp.js` allows you to define tools with full type inference:

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

const mcp = new McpServer({
  name: "supplier-backend-mcp-service",
  version: "1.0.0",
});
```

---

## 📋 Tool 1: `list_offers`

This tool allows the agent to query supplier offers with pagination and status filtering.

### Implementation Blueprint: `src/tools/list-offers.ts`
```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { SupplierClient } from "../clients/supplier-client.js";
import { RequestContext } from "../context/request-context.js";
import { TokenIntrospector } from "../auth/introspector.js";

export function registerListOffersTool(
  server: McpServer,
  supplierClient: SupplierClient,
  introspector: TokenIntrospector
) {
  server.tool(
    "list_offers",
    "List offers for a supplier with optional status filtering and pagination.",
    {
      supplierId: z.string().describe("Supplier ID to list offers for"),
      status: z.enum(["ACTIVE", "INACTIVE", "DRAFT"]).optional().describe("Filter by offer status"),
      page: z.number().int().min(1).default(1).describe("Page number (1-based)"),
      size: z.number().int().min(1).max(100).default(20).describe("Page size (max 100)"),
      authToken: z.string().optional().describe("Agent auth token (if not provided in HTTP headers)"),
    },
    async (args) => {
      const requestMeta = {
        operation: "list_offers",
        request: {
          supplier_id: args.supplierId,
          status: args.status,
          page: args.page,
          size: args.size,
        },
      };

      try {
        // 1. Resolve Inbound Authentication
        let session = RequestContext.current();
        if (!session && args.authToken) {
          session = (await introspector.verify(args.authToken)) || undefined;
        }

        if (!session) {
          return {
            content: [{
              type: "text",
              text: JSON.stringify({
                ok: false,
                data: null,
                error: {
                  category: "auth_error",
                  message: "Missing or invalid authentication token. You must provide a valid auth-token.",
                  status_code: 401,
                },
                meta: requestMeta,
              }, null, 2),
            }],
          };
        }

        // 2. Enforce Tenant Isolation (matching Python reference)
        if (session.supplierId && session.supplierId !== args.supplierId) {
          return {
            content: [{
              type: "text",
              text: JSON.stringify({
                ok: false,
                data: null,
                error: {
                  category: "auth_error",
                  message: `Forbidden: Token supplier_id (${session.supplierId}) does not match requested supplierId (${args.supplierId}).`,
                  status_code: 403,
                },
                meta: requestMeta,
              }, null, 2),
            }],
          };
        }

        // 3. Call Upstream Supplier Service (via S2S Client Credentials)
        const result = await supplierClient.listOffers({
          supplierId: args.supplierId,
          status: args.status,
          page: args.page,
          size: args.size,
        });

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              ok: true,
              data: result,
              error: null,
              meta: requestMeta,
            }, null, 2),
          }],
        };
      } catch (error: any) {
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              ok: false,
              data: null,
              error: {
                category: error.statusCode ? "upstream_http_error" : "internal_error",
                message: error.message || String(error),
                status_code: error.statusCode || null,
              },
              meta: requestMeta,
            }, null, 2),
          }],
        };
      }
    }
  );
}
```

---

## 🔍 Tool 2: `get_offer_by_id`

This tool fetches complete details for a single offer.

### Implementation Blueprint: `src/tools/get-offer.ts`
```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { SupplierClient } from "../clients/supplier-client.js";
import { RequestContext } from "../context/request-context.js";
import { TokenIntrospector } from "../auth/introspector.js";

export function registerGetOfferTool(
  server: McpServer,
  supplierClient: SupplierClient,
  introspector: TokenIntrospector
) {
  server.tool(
    "get_offer_by_id",
    "Fetch detailed information for a single offer by its unique offer ID.",
    {
      offerId: z.string().describe("The unique ID of the offer to fetch"),
      authToken: z.string().optional().describe("Agent auth token (if not provided in HTTP headers)"),
    },
    async (args) => {
      const requestMeta = {
        operation: "get_offer_by_id",
        request: { offer_id: args.offerId },
      };

      try {
        // 1. Resolve Inbound Authentication
        let session = RequestContext.current();
        if (!session && args.authToken) {
          session = (await introspector.verify(args.authToken)) || undefined;
        }

        if (!session) {
          return {
            content: [{
              type: "text",
              text: JSON.stringify({
                ok: false,
                data: null,
                error: {
                  category: "auth_error",
                  message: "Authentication required: Missing or expired auth token.",
                  status_code: 401,
                },
                meta: requestMeta,
              }, null, 2),
            }],
          };
        }

        // 2. Call Upstream Supplier Service
        const offer = await supplierClient.getOfferById(args.offerId);

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              ok: true,
              data: offer,
              error: null,
              meta: requestMeta,
            }, null, 2),
          }],
        };
      } catch (error: any) {
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              ok: false,
              data: null,
              error: {
                category: error.statusCode === 404 ? "not_found" : "upstream_http_error",
                message: error.message || String(error),
                status_code: error.statusCode || null,
              },
              meta: requestMeta,
            }, null, 2),
          }],
        };
      }
    }
  );
}
```

---

## 🌐 Connecting `McpServer` to Express (SSE Transport)

To expose your tools over HTTP using Server-Sent Events (the standard MCP remote protocol):

```typescript
// Blueprint for src/index.ts
import express from "express";
import cors from "cors";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { config } from "./config.js";
import { TokenIntrospector } from "./auth/introspector.js";
import { createAuthMiddleware } from "./middleware/auth-middleware.js";
import { ClientCredentialsTokenProvider } from "./oauth/client-credentials.js";
import { SupplierClient } from "./clients/supplier-client.js";
import { registerListOffersTool } from "./tools/list-offers.js";
import { registerGetOfferTool } from "./tools/get-offer.js";

const app = express();
app.use(cors());
app.use(express.json());

// Initialize services
const introspector = new TokenIntrospector(config.INTROSPECTION_URL, config.TOKEN_CACHE_TTL_SECONDS);
const tokenProvider = new ClientCredentialsTokenProvider(
  config.UPSTREAM_OAUTH_TOKEN_URL,
  config.UPSTREAM_CLIENT_ID,
  config.UPSTREAM_CLIENT_SECRET
);
const supplierClient = new SupplierClient(config.UPSTREAM_BASE_URL, tokenProvider);

// Initialize MCP Server
const mcp = new McpServer({
  name: "supplier-backend-mcp-service",
  version: "1.0.0",
});

// Register the 2 tools
registerListOffersTool(mcp, supplierClient, introspector);
registerGetOfferTool(mcp, supplierClient, introspector);

// Inbound Auth Middleware
if (config.INBOUND_AUTH_ENABLED) {
  app.use(createAuthMiddleware(introspector));
}

// Health Check
app.get("/health", (req, res) => {
  res.json({ status: "healthy", service: "supplier-mcp-server", version: "1.0.0" });
});

// SSE Transport Map
const transports = new Map<string, SSEServerTransport>();

// Establish SSE Stream
app.get("/sse", async (req, res) => {
  const transport = new SSEServerTransport("/messages", res);
  transports.set(transport.sessionId, transport);

  res.on("close", () => {
    transports.delete(transport.sessionId);
  });

  await mcp.connect(transport);
});

// Handle incoming JSON-RPC messages for established session
app.post("/messages", async (req, res) => {
  const sessionId = req.query.sessionId as string;
  const transport = transports.get(sessionId);

  if (!transport) {
    return res.status(404).send("Session not found");
  }

  await transport.handlePostMessage(req, res);
});

app.listen(config.PORT, config.HOST, () => {
  console.log(`🚀 MCP Gateway running at http://${config.HOST}:${config.PORT}`);
  console.log(`   SSE endpoint:    http://${config.HOST}:${config.PORT}/sse`);
  console.log(`   Health endpoint: http://${config.HOST}:${config.PORT}/health`);
});
```

---

Next Step: **[06. Building the Mock Upstream Server](./06-mock-upstream-server.md)**
