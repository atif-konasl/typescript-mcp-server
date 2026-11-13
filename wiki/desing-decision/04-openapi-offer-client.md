# 04. OpenAPI-Generated Offer Client Architecture

This guide details the complete design and implementation plan for the Supplier Offers API client using **OpenAPI 3.0**, **`openapi-client-axios`**, and automated schema-to-TypeScript type generation.

---

## 🏛️ Architecture Overview

Rather than manually writing HTTP request methods and duplicating API response types, our system uses an **OpenAPI-Driven Contract**:

```
┌─────────────────────────────────┐
│   Mock Upstream Server (:8080)  │
│   GET /openapi.json             │
└────────────────┬────────────────┘
                 │
                 │ 1. npm run schema:fetch:offers
                 ▼
┌───────────────────────────────────────────────┐
│ src/gen/supplier-offers.openapi.json          │
│ (Bundled & Dereferenced OpenAPI Specification)│
└────────┬──────────────────────────────┬───────┘
         │                              │
         │ 2. schema:runtime:offers     │ 3. schema:types:offers
         ▼                              ▼
┌────────────────────────────────┐ ┌────────────────────────────────┐
│ src/gen/                       │ │ src/types/                     │
│ supplier-offers.openapi-       │ │ supplier-offers.gen.d.ts       │
│ runtime.json                   │ │                                │
│ (Lightweight runtime paths     │ │ (Type-safe Operations, Schemas,│
│  & operationIds for Axios)     │ │  and OffersClient interface)   │
└────────┬───────────────────────┘ └────────┬───────────────────────┘
         │                                  │
         └────────────────┬─────────────────┘
                          │
                          ▼
             ┌─────────────────────────┐
             │  src/clients/offers.ts  │
             │    NewOffersClient()    │
             └────────────┬────────────┘
                          │ Injects S2S OAuth Interceptor
                          ▼
             ┌─────────────────────────┐
             │       MCP Tools         │
             │  • list_offers          │
             │  • get_offer_by_id      │
             └─────────────────────────┘
```

---

## 🚀 1. The 3-Step Schema Generation Pipeline

In [`package.json`](file:///Users/atifanowar/Workspace/personal-projects/typescript/typescript-mcp-server/package.json), four scripts manage the OpenAPI lifecycle:

```bash
npm run schema
```

This single command sequentially executes:

1. **Fetch (`schema:fetch:offers`)**:
   Downloads the latest OpenAPI 3.0 document from the server:
   ```bash
   openapi read --bundle --dereference --json http://localhost:8080/openapi.json > ./src/gen/supplier-offers.openapi.json
   ```

2. **Strip for Runtime (`schema:runtime:offers`)**:
   Strips unneeded descriptions, markdown, and unreferenced schemas to create a fast, featherlight 1 KB runtime payload:
   ```bash
   openapi read --strip openapi_client_axios --dereference --remove-unreferenced --json ./src/gen/supplier-offers.openapi.json > ./src/gen/supplier-offers.openapi-runtime.json
   ```

3. **Typegen (`schema:types:offers`)**:
   Generates TypeScript interfaces and operation signatures into `src/types/supplier-offers.gen.d.ts`:
   ```bash
   openapi typegen --client ./src/gen/supplier-offers.openapi.json > src/types/supplier-offers.gen.d.ts
   ```

---

## 🛠️ 2. Blueprint for `src/clients/offers.ts`

When you implement the client in [`src/clients/offers.ts`](file:///Users/atifanowar/Workspace/personal-projects/typescript/typescript-mcp-server/src/clients/offers.ts), follow this pattern:

```typescript
import OfferClientDefinition from "@/gen/supplier-offers.openapi-runtime.json" with { type: "json" };
import type { Client as OffersClient } from "@/types/supplier-offers.gen.d.ts";
import type { AxiosRequestInterceptor } from "../auth/client-credentials.js";
import OpenAPIClientAxios from "openapi-client-axios";

const DEFAULT_TIMEOUT = 5000; // 5 seconds

export type OfferClientConfiguration = Omit<
  ConstructorParameters<typeof OpenAPIClientAxios>[0],
  "definition"
>;

/**
 * Initializes and returns an OpenAPI-backed, type-safe Offers client.
 *
 * @param options Axios and OpenAPIClientAxios configuration (baseURL, timeout, etc.)
 * @param tokenProvider Optional OAuth2 token interceptor (e.g., from createOAuthInterceptor)
 */
export async function NewOffersClient(
  options?: OfferClientConfiguration,
  tokenProvider?: AxiosRequestInterceptor
): Promise<OffersClient> {
  const api = new OpenAPIClientAxios({
    ...options,
    axiosConfigDefaults: {
      timeout: DEFAULT_TIMEOUT,
      ...options?.axiosConfigDefaults,
    },
    definition: OfferClientDefinition,
  });

  const client = await api.init<OffersClient>();

  if (tokenProvider) {
    client.interceptors.request.use(tokenProvider as any);
  }

  return client;
}
```

---

## 🎯 3. How MCP Tools Will Consume `OffersClient`

With `OffersClient`, calling upstream APIs inside your MCP tools is completely type-safe with zero boilerplate:

### Tool 1: `list_offers`
```typescript
// Autocompletion for query parameters and responses!
const response = await client.listOffers({
  supplier_id: session.supplierId, // Enforce tenant isolation from RequestContext!
  status: "ACTIVE",
  page: 1,
  size: 20,
});

const { items, total, page, size } = response.data;
```

### Tool 2: `get_offer_by_id`
```typescript
const response = await client.getOffer({
  offer_id: "off-101",
});

const offer = response.data;
```

---

## 🧪 4. Testing & Verification

1. Start mock upstream server:
   ```bash
   npm run mock
   ```

2. Re-generate schema whenever APIs change:
   ```bash
   npm run schema
   ```

3. Run test suites:
   ```bash
   npm test
   ```
