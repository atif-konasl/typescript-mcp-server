# Why TypeScript Uses Unions & Mutually Exclusive Types

This guide explores the design philosophy behind **Mutually Exclusive Types (XOR Unions)**, why libraries like `openapi-client-axios` use them, and why TypeScript developers rely so heavily on Union types.

---

## 🎯 1. The Real-World Problem: Conflicting Configuration

Consider the constructor signature of `OpenAPIClientAxios`:

```typescript
export type OpenAPIClientAxiosOptions = {
  definition: Document | string;
  // ... base options
} & (
  | { axiosConfigDefaults?: AxiosRequestConfig; axiosInstance?: never } // Mode 1: Create
  | { axiosConfigDefaults?: never; axiosInstance?: AxiosInstance }       // Mode 2: Adopt
);
```

### Why can't we pass both?

Imagine a library that allowed both simultaneously in plain JavaScript:

```javascript
const myAxios = axios.create({
  timeout: 1000,
  headers: { "X-Tenant": "123" }
});

new OpenAPIClientAxios({
  axiosInstance: myAxios,
  axiosConfigDefaults: {
    timeout: 8000,
    headers: { "X-Tenant": "456" }
  }
});
```

At runtime, this presents an intractable conflict:
- **If `axiosConfigDefaults` overwrites `myAxios.defaults`**: It silently mutates your pre-existing Axios instance, causing unexpected bugs in every other service sharing that Axios client.
- **If `axiosInstance` ignores `axiosConfigDefaults`**: Developers will wonder why their configured `timeout: 8000` is silently discarded.
- **If the library tries to deep-merge them**: Merging complex Axios settings (like interceptor pipelines, SSL certificates, proxy agents, and auth headers) is notoriously prone to subtle bugs.

The library author recognized there are only **two mutually exclusive intents**:
1. **Creation Mode**: *"I want `OpenAPIClientAxios` to create a fresh Axios instance using these defaults (`axiosConfigDefaults`)."*
2. **Adoption Mode (Inversion of Control)**: *"I already have an enterprise-configured Axios instance (with mTLS, custom proxies, or APM tracing). Just attach your OpenAPI operations to it (`axiosInstance`)."*

Passing both is a logical contradiction.

---

## 🛡️ 2. "Make Illegal States Unrepresentable"

In dynamic languages (like Python or vanilla JavaScript), libraries enforce this via runtime assertions:

```javascript
// Runtime check (dynamic)
if (opts.axiosInstance && opts.axiosConfigDefaults) {
  throw new Error("Cannot specify both axiosInstance and axiosConfigDefaults!");
}
```

The flaw with runtime checks is that **the developer only discovers the bug when the server crashes during execution**—frequently in production.

### The `never` Type Trick for XOR in TypeScript

TypeScript does not have a built-in `xor` operator, but you can build one using union types and the `never` keyword:

```typescript
type ExclusiveConfig =
  | { axiosConfigDefaults?: AxiosRequestConfig; axiosInstance?: never }
  | { axiosConfigDefaults?: never; axiosInstance?: AxiosInstance };
```

Here is what happens when someone tries to pass both:

```typescript
const badConfig: ExclusiveConfig = {
  axiosConfigDefaults: { timeout: 5000 },
  axiosInstance: axios.create(), // ❌ Error: Type 'AxiosInstance' is not assignable to type 'never'.
};
```

By encoding this rule into the type system, **the invalid state becomes impossible to write**. The compiler stops the developer right inside the code editor.

---

## 🧩 3. The Algebraic Type System: Sums vs. Products

To understand why TypeScript relies so heavily on unions, we must look at how modern type systems are designed.

TypeScript’s type system is based on **Algebraic Data Types (ADTs)**:

| Concept | TypeScript Syntax | Meaning | Real-world Analogy |
|---|---|---|---|
| **Product Type** | `A & B` (or `interface`) | Value has `A` **AND** `B` | A car has an engine **and** wheels. |
| **Sum Type (Union)** | `A \| B` | Value has `A` **OR** `B` | A traffic light is Red **or** Yellow **or** Green. |

### The Anti-Pattern: "The Bag of Optionals"

In traditional object-oriented systems without unions, developers frequently create monolithic interfaces with many optional fields:

```typescript
// ❌ Dangerous: Bag of optionals
interface ApiResponse<T> {
  isLoading: boolean;
  data?: T;
  error?: Error;
}
```

This model permits several impossible states:
- `isLoading: true` while `data` is already populated.
- Both `data` AND `error` exist at the same time.
- `isLoading: false`, but both `data` and `error` are `undefined`.

The developer must write defensive checks everywhere:
```typescript
if (response.data && !response.error && !response.isLoading) {
  // Defensive guardrail
}
```

### The Clean Solution: Discriminated Unions

With union types, each state is modeled precisely as it occurs in reality:

```typescript
// ✨ Clean: Discriminated Union
type ApiResponse<T> =
  | { status: "loading" }
  | { status: "success"; data: T }
  | { status: "error"; error: Error };
```

Now, TypeScript's **Control Flow Analysis** guarantees type safety automatically:

```typescript
function handleResponse<T>(res: ApiResponse<T>) {
  switch (res.status) {
    case "loading":
      // Here, res has neither data nor error
      break;

    case "success":
      // TypeScript automatically knows `res.data` exists!
      console.log(res.data);
      break;

    case "error":
      // TypeScript automatically knows `res.error` exists!
      console.error(res.error.message);
      break;
  }
}
```

---

## 🏛️ 4. Real-World Applications in our MCP Server

We use this pattern in multiple places across our Model Context Protocol architecture:

### 1. Inbound Authentication Session
An incoming request is either authenticated with a valid session, or it is unauthenticated:

```typescript
type InboundAuthResult =
  | { success: true; session: AgentSession }
  | { success: false; errorCode: number; errorMessage: string };
```

### 2. Standard MCP Tool Response Envelope
Every MCP tool returns a standardized response envelope:

```typescript
type McpToolResponse<T> =
  | { ok: true; data: T; error: null; meta: Record<string, unknown> }
  | { ok: false; data: null; error: McpErrorEnvelope; meta: Record<string, unknown> };
```

When `ok` is `true`, `data` is guaranteed to be non-null. When `ok` is `false`, `error` is guaranteed to exist.

---

## 💡 Summary

1. **Mutually Exclusive Types (`XOR`)** exist to prevent contradictory runtime states (e.g. creating a new instance vs adopting an existing one).
2. **Unions reflect the real world**: Real software moves between distinct, discrete states. Unions model those states explicitly.
3. **Compile-Time Guarantees**: Using unions moves error detection from customer runtime crashes into instant feedback in your code editor.
