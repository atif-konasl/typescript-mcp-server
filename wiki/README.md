# TypeScript MCP Server: Engineering Master Plan & Mentorship Guide

Welcome to your mentorship guide! This repository and documentation are designed to guide you step-by-step in building a production-grade **Model Context Protocol (MCP)** server in **TypeScript**.

This plan is modeled after the architecture patterns in the Python reference project (`visable/python-projects/supplier-backend-mcp-service`), translating its enterprise-grade design into idiomatic, modern TypeScript.

---

## 🎯 Project Goals

By completing this project, you will master:
1. **Model Context Protocol (MCP)**: How MCP servers operate over **Streamable HTTP / Server-Sent Events (SSE)** and JSON-RPC 2.0.
2. **Two-Tier Authentication**:
   - **Inbound Auth (Agent → MCP Server)**: Enforcing that the AI agent provides an authenticated bearer token (via HTTP headers and/or tool parameters) validated via RFC 7662 introspection or JWT validation.
   - **Outbound Auth (MCP Server → Upstream API)**: S2S (Service-to-Service) OAuth 2.0 **Client Credentials Grant** with in-memory token caching, clock skew management, and automatic retry on 401 Unauthorized.
3. **Enterprise MCP Tools (2 Tools)**:
   - `list_offers`: Filter and paginate supplier offers.
   - `get_offer_by_id`: Retrieve comprehensive details for a specific offer.
4. **Mock Upstream Server**: A local mock service providing an OAuth token endpoint, RFC 7662 token introspection, and protected business endpoints.
5. **Modern TypeScript Stack**: Using `@modelcontextprotocol/sdk`, Node.js 20+, `zod` for type-safe schema definitions, `AsyncLocalStorage` for context propagation, and `vitest` for test-driven development.

> [!IMPORTANT]
> **Mentorship Rule**: As your mentor, I provide the architectural blueprints, concepts, design decisions, and step-by-step guidance in this `wiki/`. **You write the code.** This ensures hands-on mastery of TypeScript, asynchronous runtime patterns, and MCP internals.

---

## 🏛️ System Architecture

```
                    ┌────────────────────────────────────────────────────────┐
                    │                      AI Agent                          │
                    │               (e.g., Claude, Accio)                    │
                    └──────────────────────────┬─────────────────────────────┘
                                               │
                                               │ JSON-RPC 2.0 over Streamable HTTP/SSE
                                               │ Header: Authorization: Bearer <agent-token>
                                               ▼
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                           TypeScript MCP Gateway Server                                 │
│                                                                                         │
│  ┌───────────────────────────────────────────────────────────────────────────────────┐  │
│  │ 1. Inbound Auth Middleware                                                        │  │
│  │    • Extracts Agent Bearer Token                                                  │  │
│  │    • Verifies via RFC 7662 Introspection (or JWT) against Auth Server             │  │
│  │    • Stores validated session in AsyncLocalStorage (request-scoped context)       │  │
│  └────────────────────────────────────────┬──────────────────────────────────────────┘  │
│                                           │                                             │
│                                           ▼                                             │
│  ┌───────────────────────────────────────────────────────────────────────────────────┐  │
│  │ 2. MCP Server Core (@modelcontextprotocol/sdk)                                    │  │
│  │    ├── Tool 1: list_offers(supplierId, page, size, status, [authToken])           │  │
│  │    └── Tool 2: get_offer_by_id(offerId, [authToken])                              │  │
│  │    • Validates input parameters with Zod                                          │  │
│  │    • requireAuth guard: ensures caller identity matches context                   │  │
│  └────────────────────────────────────────┬──────────────────────────────────────────┘  │
│                                           │                                             │
│                                           ▼                                             │
│  ┌───────────────────────────────────────────────────────────────────────────────────┐  │
│  │ 3. S2S Outbound OAuth Token Provider (Client Credentials Grant)                   │  │
│  │    • POST /oauth/token (Basic Auth: clientId + clientSecret)                      │  │
│  │    • Caches upstream access_token in memory with TTL - 60s clock skew             │  │
│  │    • Mutex/Promise lock to prevent thundering herds on token refresh              │  │
│  └────────────────────────────────────────┬──────────────────────────────────────────┘  │
│                                           │                                             │
│                                           ▼                                             │
│  ┌───────────────────────────────────────────────────────────────────────────────────┐  │
│  │ 4. Upstream HTTP Client                                                           │  │
│  │    • Injects Authorization: Bearer <upstream-token>                               │  │
│  │    • Automatically catches 401 -> invalidates cache -> retries once               │  │
│  │    • Wraps responses into standardized envelope: { ok, data, error, meta }        │  │
│  └────────────────────────────────────────┬──────────────────────────────────────────┘  │
└───────────────────────────────────────────┼─────────────────────────────────────────────┘
                                            │
                                            │ HTTP GET/POST with S2S Bearer Token
                                            ▼
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                               Mock Upstream Server                                      │
│                                                                                         │
│  • POST /oauth/token          -> Returns upstream access_token (Client Credentials)     │
│  • POST /oauth/introspect     -> RFC 7662 introspection for inbound agent tokens        │
│  • GET  /s2s/v1/offers        -> Returns paginated mock offers                         │
│  • GET  /s2s/v1/offers/:id    -> Returns single mock offer detail                       │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 📚 Curriculum & Wiki Navigation

Work through the chapters sequentially:

1. **[01. Architecture & Specifications](./01-architecture-and-specs.md)**
   - Detailed component breakdown.
   - Python reference comparison (`FastAPI + FastMCP` vs `Node.js + @modelcontextprotocol/sdk`).
   - Inbound vs Outbound auth sequence diagrams.
   - Tool contracts and standardized JSON envelopes.

2. **[02. Project Setup & Tooling](./02-project-setup-and-tooling.md)**
   - Initializing the TypeScript project (`package.json`, `tsconfig.json`).
   - Installing dependencies (MCP SDK, Zod, Express/Hono, Vitest, tsx).
   - Folder structure blueprint.

3. **[03. Inbound Agent Authentication & Context](./03-inbound-agent-auth.md)**
   - Capturing the Agent's token (HTTP Header vs Tool Argument vs Hybrid).
   - Request-scoped context with Node's `AsyncLocalStorage` (equivalent to Python's `contextvars`).
   - Implementing RFC 7662 Token Introspection with in-memory caching.
   - The `@requireAuth` guard pattern for tool handlers.

4. **[04. Outbound S2S OAuth Client Credentials Flow](./04-outbound-oauth-client.md)**
   - Implementing `ClientCredentialsTokenProvider`.
   - Managing token expiration, clock skew, and thread-safe / concurrent token refresh.
   - Base HTTP Client with automatic 401 invalidation and retry.

5. **[05. Implementing the 2 MCP Tools](./05-tools-implementation.md)**
   - Registering tools with `@modelcontextprotocol/sdk/server/mcp.js`.
   - Defining runtime schemas with `zod`.
   - Implementing `list_offers` and `get_offer_by_id`.
   - Formatting MCP JSON-RPC content and error envelopes.

6. **[06. Building the Mock Upstream Server](./06-mock-upstream-server.md)**
   - Designing the lightweight mock server (`oauth` endpoints + `offers` endpoints).
   - Realistic mock fixtures and dataset.
   - Running the mock server concurrently during development.

7. **[07. Testing, Verification & Debugging](./07-testing-and-verification.md)**
   - Unit and integration testing with Vitest.
   - Testing with MCP Inspector (`npx @modelcontextprotocol/inspector`).
   - Testing with `curl` for JSON-RPC over Streamable HTTP/SSE.
   - Connecting Claude Desktop / Cursor / Accio Agent.

---

## 📋 Mentor Checklist: Your Implementation Roadmap

Track your progress by checking off each milestone as you build it:

- [ ] **Milestone 1: Environment & Mock Server**
  - [ ] Initialize `package.json` and configure `tsconfig.json`.
  - [ ] Implement the `mock-upstream-server` with `/oauth/token`, `/oauth/introspect`, and `/s2s/v1/offers`.
  - [ ] Verify mock server endpoints using `curl`.
- [ ] **Milestone 2: Outbound Client Credentials Provider**
  - [ ] Implement `ClientCredentialsTokenProvider` with caching and clock skew.
  - [ ] Implement `SupplierClient` extending a base HTTP client.
  - [ ] Write Vitest unit tests verifying token acquisition and automatic 401 retry.
- [ ] **Milestone 3: Inbound Authentication & Context**
  - [ ] Create `RequestContext` using Node's `AsyncLocalStorage`.
  - [ ] Implement `TokenIntrospector` with cached verification.
  - [ ] Create HTTP middleware extracting bearer tokens and attaching to context.
- [ ] **Milestone 4: MCP Server & Tool Definitions**
  - [ ] Setup `McpServer` and connect it to an HTTP/SSE transport.
  - [ ] Implement `list_offers` tool with Zod schema validation.
  - [ ] Implement `get_offer_by_id` tool with Zod schema validation.
  - [ ] Apply authentication check ensuring agent token was verified.
- [ ] **Milestone 5: End-to-End Verification**
  - [ ] Run full system (Mock Server + MCP Server).
  - [ ] Inspect tools using MCP Inspector.
  - [ ] Verify that unauthenticated agent calls are rejected.
  - [ ] Verify that authenticated calls correctly query the mock upstream using S2S credentials.

---

Ready? Start with **[01. Architecture & Specifications](./01-architecture-and-specs.md)**!
