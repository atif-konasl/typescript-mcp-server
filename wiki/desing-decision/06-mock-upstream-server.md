# 06. Building the Mock Upstream Server

To practice and test your MCP server independently without depending on staging VPNs or external credentials, you will build a lightweight mock upstream service.

---

## 🎯 What the Mock Server Simulates

The mock server simulates both identity provider and supplier backend in one simple process:

```
┌─────────────────────────────────────────────────────────────┐
│                   Mock Upstream Server (:8080)              │
│                                                             │
│  [Identity Endpoints]                                       │
│  ├── POST /oauth/token      (OAuth2 Client Credentials)     │
│  └── POST /oauth/introspect (RFC 7662 Token Introspection)  │
│                                                             │
│  [Business Endpoints]                                       │
│  ├── GET  /s2s/v1/offers    (List Supplier Offers)          │
│  └── GET  /s2s/v1/offers/:id (Get Single Offer by ID)        │
└─────────────────────────────────────────────────────────────┘
```

---

## 📄 Mock Fixtures: `mock-upstream/fixtures.ts`

Define a set of realistic supplier offers:

```typescript
// Blueprint for mock-upstream/fixtures.ts
export interface MockOffer {
  id: string;
  supplierId: string;
  title: string;
  description: string;
  status: "ACTIVE" | "INACTIVE" | "DRAFT";
  price: number;
  currency: string;
  updatedAt: string;
}

export const MOCK_OFFERS: MockOffer[] = [
  {
    id: "off-101",
    supplierId: "supp-100",
    title: "5-Axis CNC Milling Center VMC-850",
    description: "High-precision vertical machining center for aerospace and automotive parts.",
    status: "ACTIVE",
    price: 89500.0,
    currency: "EUR",
    updatedAt: "2026-10-15T09:30:00Z",
  },
  {
    id: "off-102",
    supplierId: "supp-100",
    title: "Industrial Fiber Laser Cutting Machine 3000W",
    description: "Sheet metal laser cutting system with dual exchange tables.",
    status: "ACTIVE",
    price: 45000.0,
    currency: "EUR",
    updatedAt: "2026-10-20T14:15:00Z",
  },
  {
    id: "off-103",
    supplierId: "supp-100",
    title: "Hydraulic Press Brake 160T/3200",
    description: "CNC electro-hydraulic synchronization bending machine.",
    status: "DRAFT",
    price: 32000.0,
    currency: "EUR",
    updatedAt: "2026-11-01T11:00:00Z",
  },
  {
    id: "off-201",
    supplierId: "supp-200",
    title: "Automated Packaging Conveyor Belt System",
    description: "Modular roller conveyor line with smart sorting sensors.",
    status: "ACTIVE",
    price: 18500.0,
    currency: "EUR",
    updatedAt: "2026-11-05T16:45:00Z",
  },
];
```

---

## ⚡ Mock Server Implementation: `mock-upstream/server.ts`

You can implement the mock server using standard Express:

```typescript
// Blueprint for mock-upstream/server.ts
import express from "express";
import { MOCK_OFFERS } from "./fixtures.js";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const VALID_CLIENT_ID = "mcp-supplier-client";
const VALID_CLIENT_SECRET = "super-secret-key-123";
const VALID_S2S_TOKEN = "mock-s2s-token-upstream-secret-999";

// ==========================================
// 1. Identity Endpoints
// ==========================================

// OAuth 2.0 Client Credentials Grant
app.post("/oauth/token", (req, res) => {
  // Check Basic Auth header or body
  const authHeader = req.headers.authorization;
  let clientId = req.body.client_id;
  let clientSecret = req.body.client_secret;

  if (authHeader && authHeader.startsWith("Basic ")) {
    const creds = Buffer.from(authHeader.slice(6), "base64").toString("utf-8").split(":");
    clientId = creds[0];
    clientSecret = creds[1];
  }

  if (clientId !== VALID_CLIENT_ID || clientSecret !== VALID_CLIENT_SECRET) {
    return res.status(401).json({ error: "invalid_client", error_description: "Invalid client credentials" });
  }

  if (req.body.grant_type !== "client_credentials") {
    return res.status(400).json({ error: "unsupported_grant_type" });
  }

  console.log("Mock Auth: Issued S2S Token for", clientId);
  return res.json({
    access_token: VALID_S2S_TOKEN,
    token_type: "Bearer",
    expires_in: 3600,
  });
});

// RFC 7662 Inbound Token Introspection
app.post("/oauth/introspect", (req, res) => {
  const token = req.body.token;

  // Simulate known tokens
  if (token === "agent-token-supp-100") {
    return res.json({
      active: true,
      sub: "agent-user-01",
      supplier_id: "supp-100",
      scope: "offers:read offers:write",
      exp: Math.floor(Date.now() / 1000) + 3600,
    });
  }

  if (token === "agent-token-supp-200") {
    return res.json({
      active: true,
      sub: "agent-user-02",
      supplier_id: "supp-200",
      scope: "offers:read",
      exp: Math.floor(Date.now() / 1000) + 3600,
    });
  }

  // Any other token is deemed invalid or expired
  return res.json({ active: false });
});

// ==========================================
// 2. Upstream Business Endpoints
// ==========================================

// Auth middleware for upstream endpoints
function requireS2SToken(req: express.Request, res: express.Response, next: express.NextFunction) {
  const auth = req.headers.authorization;
  if (auth !== `Bearer ${VALID_S2S_TOKEN}`) {
    return res.status(401).json({ error: "Unauthorized: Invalid or missing upstream S2S token" });
  }
  next();
}

// GET /s2s/v1/offers
app.get("/s2s/v1/offers", requireS2SToken, (req, res) => {
  const supplierId = req.query.supplier_id as string;
  const status = req.query.status as string | undefined;
  const page = parseInt((req.query.page as string) || "1", 10);
  const size = parseInt((req.query.size as string) || "20", 10);

  if (!supplierId) {
    return res.status(400).json({ error: "Missing required parameter: supplier_id" });
  }

  let filtered = MOCK_OFFERS.filter((o) => o.supplierId === supplierId);
  if (status) {
    filtered = filtered.filter((o) => o.status === status);
  }

  const startIndex = (page - 1) * size;
  const paginated = filtered.slice(startIndex, startIndex + size);

  console.log(`Mock Upstream: Returned ${paginated.length} offers for supplier ${supplierId}`);
  return res.json({
    items: paginated,
    pagination: {
      page,
      size,
      total: filtered.length,
    },
  });
});

// GET /s2s/v1/offers/:id
app.get("/s2s/v1/offers/:id", requireS2SToken, (req, res) => {
  const offer = MOCK_OFFERS.find((o) => o.id === req.params.id);
  if (!offer) {
    return res.status(404).json({ error: `Offer ${req.params.id} not found` });
  }
  return res.json(offer);
});

const PORT = 8080;
app.listen(PORT, () => {
  console.log(`🎯 Mock Upstream Server running at http://localhost:${PORT}`);
  console.log(`   Tokens simulated:`);
  console.log(`     - Inbound Agent Token: "agent-token-supp-100" (supplier_id: supp-100)`);
  console.log(`     - Inbound Agent Token: "agent-token-supp-200" (supplier_id: supp-200)`);
  console.log(`     - S2S Client ID:       "${VALID_CLIENT_ID}" / "${VALID_CLIENT_SECRET}"`);
});
```

---

## 🧪 Testing the Mock Server with `curl`

Once you start the mock server (`npm run mock` or `tsx mock-upstream/server.ts`), verify it works:

### 1. Test Client Credentials:
```bash
curl -X POST http://localhost:8080/oauth/token \
  -u "mcp-supplier-client:super-secret-key-123" \
  -d "grant_type=client_credentials"
```
*Expected*: `{"access_token":"mock-s2s-token-upstream-secret-999","token_type":"Bearer","expires_in":3600}`

### 2. Test Inbound Token Introspection:
```bash
curl -X POST http://localhost:8080/oauth/introspect \
  -d "token=agent-token-supp-100"
```
*Expected*: `{"active":true,"sub":"agent-user-01","supplier_id":"supp-100",...}`

### 3. Test Protected Offer Endpoint with S2S Token:
```bash
curl -X GET "http://localhost:8080/s2s/v1/offers?supplier_id=supp-100" \
  -H "Authorization: Bearer mock-s2s-token-upstream-secret-999"
```
*Expected*: JSON list containing the 3 mock offers for `supp-100`.

---

Next Step: **[07. Testing, Verification & Debugging](./07-testing-and-verification.md)**
