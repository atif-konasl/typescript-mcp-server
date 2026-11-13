import express, { type Request, type Response } from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { MOCK_OFFERS } from "./fixtures.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.MOCK_PORT ? Number(process.env.MOCK_PORT) : 8080;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Read OpenAPI spec from disk
const openapiSpecPath = path.join(__dirname, "openapi.json");
const openapiSpec = JSON.parse(fs.readFileSync(openapiSpecPath, "utf-8"));

// -------------------------------------------------------------
// 1. Swagger / OpenAPI Spec Endpoints
// -------------------------------------------------------------
app.get("/openapi.json", (_req: Request, res: Response) => {
  res.json(openapiSpec);
});

app.get("/swagger.json", (_req: Request, res: Response) => {
  res.json(openapiSpec);
});

// -------------------------------------------------------------
// 2. Outbound S2S OAuth 2.0 Token Endpoint (/oauth/token)
// -------------------------------------------------------------
app.post("/oauth/token", (req: Request, res: Response) => {
  const grantType = req.body?.grant_type || req.query?.grant_type;
  const _clientId = req.body?.client_id || req.headers["x-client-id"];
  const _clientSecret = req.body?.client_secret || req.headers["x-client-secret"];

  if (grantType !== "client_credentials") {
    res.status(400).json({
      error: "unsupported_grant_type",
      error_description: "grant_type must be client_credentials",
    });
    return;
  }

  // Issue mock S2S access token
  res.json({
    access_token: `mock-s2s-token-${Date.now()}`,
    token_type: "Bearer",
    expires_in: 3600,
    scope: req.body?.scope || "offers.read",
  });
});

// -------------------------------------------------------------
// 3. Inbound RFC 7662 Token Introspection Endpoint (/oauth/introspect)
// -------------------------------------------------------------
app.post("/oauth/introspect", (req: Request, res: Response) => {
  const token = req.body?.token;

  if (!token || typeof token !== "string") {
    res.status(400).json({ error: "missing_token" });
    return;
  }

  // Tokens starting with "invalid" or "expired" simulate rejected tokens
  if (token.startsWith("invalid") || token.startsWith("expired")) {
    res.json({ active: false });
    return;
  }

  // Active session bound to supp-100 by default (or supp-200 if specified in token)
  const supplierId = token.includes("supp-200") ? "supp-200" : "supp-100";
  const nowInSeconds = Math.floor(Date.now() / 1000);

  res.json({
    active: true,
    sub: "agent-user-007",
    supplier_id: supplierId,
    scope: "offers:read offers:write",
    exp: nowInSeconds + 3600,
    iat: nowInSeconds,
  });
});

// -------------------------------------------------------------
// 4. S2S Offers Endpoint: List Offers (/s2s/v1/offers)
// -------------------------------------------------------------
app.get("/s2s/v1/offers", (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({
      error: "UNAUTHORIZED",
      message: "Missing or invalid Bearer token in Authorization header",
    });
    return;
  }

  const supplierId = (req.query.supplier_id as string) || (req.query["filter[supplier_id]"] as string);
  const status = req.query.status as string;
  const page = Math.max(1, Number(req.query.page) || 1);
  const size = Math.min(100, Math.max(1, Number(req.query.size) || 20));

  let filtered = [...MOCK_OFFERS];

  if (supplierId) {
    filtered = filtered.filter((o) => o.supplier_id === supplierId);
  }

  if (status) {
    filtered = filtered.filter((o) => o.status.toUpperCase() === status.toUpperCase());
  }

  const total = filtered.length;
  const startIndex = (page - 1) * size;
  const items = filtered.slice(startIndex, startIndex + size);

  res.json({
    items,
    total,
    page,
    size,
  });
});

// -------------------------------------------------------------
// 5. S2S Offers Endpoint: Get Offer by ID (/s2s/v1/offers/:id)
// -------------------------------------------------------------
app.get("/s2s/v1/offers/:id", (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({
      error: "UNAUTHORIZED",
      message: "Missing or invalid Bearer token in Authorization header",
    });
    return;
  }

  const { id } = req.params;
  const offer = MOCK_OFFERS.find((o) => o.id === id);

  if (!offer) {
    res.status(404).json({
      error: "NOT_FOUND",
      message: `Offer with ID '${id}' was not found`,
    });
    return;
  }

  res.json(offer);
});

// -------------------------------------------------------------
// Start Mock Server
// -------------------------------------------------------------
app.listen(PORT, () => {
  console.log(`[mock-upstream] Server running at http://localhost:${PORT}`);
  console.log(`[mock-upstream] OpenAPI Spec at http://localhost:${PORT}/openapi.json`);
});
