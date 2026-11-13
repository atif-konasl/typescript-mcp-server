# Understanding `ConstructorParameters` and `Omit` in Factory Functions

When wrapping third-party libraries, you frequently encounter type expressions like this:

```typescript
export type OfferClientConfiguration = Omit<
  ConstructorParameters<typeof OpenAPIClientAxios>[0],
  "definition"
>;
```

This guide breaks down **why** this pattern exists, **how** TypeScript evaluates it piece by piece, and the **design principles** behind it.

---

## 🎯 1. The Core Problem It Solves

Look at the constructor of `OpenAPIClientAxios`:

```typescript
export class OpenAPIClientAxios {
  constructor(opts: OpenAPIClientAxiosOptions);
}
```

Inside `OpenAPIClientAxiosOptions`, the `definition` field is **mandatory**:

```typescript
type OpenAPIClientAxiosOptions = {
  definition: Document | string; // 👈 REQUIRED!
  axiosConfigDefaults?: AxiosRequestConfig;
  withServer?: number | string | Server;
  // ... other options
};
```

### The Factory Function Conflict

In our application, we created a specialized factory: `NewOffersClient`.  
Inside `NewOffersClient`, **we already know the definition**:

```typescript
import OfferClientDefinition from "@/gen/supplier-offers.openapi-runtime.json";

export async function NewOffersClient(options?: OfferClientConfiguration) {
  const api = new OpenAPIClientAxios({
    ...options,
    definition: OfferClientDefinition, // 👈 The factory supplies this!
  });
  return api.init();
}
```

### What happens if we DON'T use `Omit<..., "definition">`?

If `options` accepted the raw library type, every caller would be forced to supply `definition`:

```typescript
// ❌ TypeScript Error: Property 'definition' is missing in type '{ baseURL: string }'
const client = await NewOffersClient({
  axiosConfigDefaults: { baseURL: "http://localhost:8080" },
});
```

That defeats the purpose of `NewOffersClient`! A specialized Offers client factory should encapsulate the schema internally so callers don't need to know or care where `supplier-offers.openapi-runtime.json` lives.

---

## 🔬 2. Step-by-Step Breakdown of the TypeScript Syntax

Let's dissect the expression from the inside out:

```typescript
Omit<ConstructorParameters<typeof OpenAPIClientAxios>[0], "definition">
```

### Step 1: `typeof OpenAPIClientAxios`
In TypeScript, a class identifier has two meanings:
1. `OpenAPIClientAxios` (as a type) ➔ represents an **instance** of the class (`const client: OpenAPIClientAxios`).
2. `typeof OpenAPIClientAxios` ➔ represents the **class constructor function itself** (the `new` callable object).

### Step 2: `ConstructorParameters<T>`
`ConstructorParameters<T>` is a built-in TypeScript utility type. It inspects a constructor function and extracts its arguments as a **tuple**:

```typescript
// If the constructor signature is:
constructor(opts: OpenAPIClientAxiosOptions);

// ConstructorParameters<typeof OpenAPIClientAxios> produces:
[opts: OpenAPIClientAxiosOptions]
```

### Step 3: `[0]` (Tuple Indexing)
Just like indexing an array in JavaScript (`arr[0]`), `[0]` accesses the type of the **first argument** in the tuple:

```typescript
ConstructorParameters<typeof OpenAPIClientAxios>[0]
// Evaluates to ➔ OpenAPIClientAxiosOptions
```

### Step 4: `Omit<T, "definition">`
`Omit<T, K>` constructs a new type by taking all properties from `T` and removing the keys `K`:

```typescript
Omit<OpenAPIClientAxiosOptions, "definition">
```

**Result**: A type containing all configuration options accepted by `OpenAPIClientAxios` (`axiosConfigDefaults`, `withServer`, `transformOperationName`, etc.) **except** `definition`!

---

## 🏛️ 3. Why Not Just Import the Interface Directly?

You might wonder: *"Why not just do this?"*

```typescript
import type { OpenAPIClientAxiosOptions } from "openapi-client-axios";

export type OfferClientConfiguration = Omit<OpenAPIClientAxiosOptions, "definition">;
```

Both work, but using `ConstructorParameters<typeof Class>[0]` offers key advantages:

| Approach | Resilience | Coupling |
|---|---|---|
| **Direct Import** (`OpenAPIClientAxiosOptions`) | Breaks if library renames the interface, makes it unexported, or moves it in a patch release. | Couples your code to the author's internal naming choice. |
| **`ConstructorParameters<typeof Class>[0]`** | 100% resilient as long as the class constructor exists. Single source of truth. | Couples only to the public constructor contract. |

---

## ⚠️ 4. Resolving TS2344: CommonJS vs. Native ESM Interop

If you write:
```typescript
import OpenAPIClientAxios from "openapi-client-axios";

export type OfferClientConfiguration = Omit<
  ConstructorParameters<typeof OpenAPIClientAxios>[0],
  "definition"
>;
```
You may encounter this TypeScript compiler error:

> **TS2344**: `Type 'typeof import(".../node_modules/openapi-client-axios/index")' does not satisfy the constraint 'abstract new (...args: any) => any'. Type provides no match for the signature 'new (...args: any): any'.`

### Why this happens
Our project uses modern native **ECMAScript Modules (`ESM`)** (`"type": "module"` and `"moduleResolution": "NodeNext"`), whereas `openapi-client-axios` is packaged as a legacy **CommonJS** module.

Under NodeNext, Node's ESM loader treats the default import (`import OpenAPIClientAxios from "openapi-client-axios"`) as the **entire CommonJS module namespace object** (`module.exports = { default: ..., OpenAPIClientAxios: ... }`). Because a module object is not a `new`-callable constructor function, `ConstructorParameters<...>` fails!

### The Two Solutions

#### Solution A: Use Named Import (Recommended)
Import the class constructor directly using a named import:
```typescript
import { OpenAPIClientAxios } from "openapi-client-axios";

export type OfferClientConfiguration = Omit<
  ConstructorParameters<typeof OpenAPIClientAxios>[0],
  "definition"
>;
```

#### Solution B: Import `OpenAPIClientAxiosOptions` directly
Because `openapi-client-axios` exports the options type as a named type, you can omit `"definition"` directly without needing `ConstructorParameters`:
```typescript
import { OpenAPIClientAxios, type OpenAPIClientAxiosOptions } from "openapi-client-axios";

export type OfferClientConfiguration = Omit<OpenAPIClientAxiosOptions, "definition">;
```

---

## ⚡ 5. Resolving TS2345: The Mutually Exclusive Union Problem

When you initialize `OpenAPIClientAxios`:

```typescript
const api = new OpenAPIClientAxios({
  ...options,
  axiosConfigDefaults: {
    timeout: DEFAULT_TIMEOUT,
    ...options?.axiosConfigDefaults,
  },
  definition: OfferClientDefinition,
});
```

You may see this detailed TypeScript compiler error:

> **TS2345**: `Argument of type '{ axiosConfigDefaults: ...; axiosInstance?: AxiosInstance | undefined; }' is not assignable to parameter of type 'OpenAPIClientAxiosOptions'.`  
> `Types of property 'axiosInstance' are incompatible.`  
> `Type 'AxiosInstance | undefined' is not assignable to type 'undefined'.`

### Why this happens

In `openapi-client-axios`, the options type is declared as an **XOR (mutually exclusive) union**:

```typescript
export type OpenAPIClientAxiosOptions = {
  definition: Document | string;
  // base options...
} & (
  | { axiosConfigDefaults?: AxiosRequestConfig; axiosInstance?: never }
  | { axiosConfigDefaults?: never; axiosInstance?: AxiosInstance }
);
```

The library forces you into one of two exclusive modes:
1. **Mode 1**: Provide `axiosConfigDefaults` (and `axiosInstance` must be `never` / absent).
2. **Mode 2**: Provide a pre-existing `axiosInstance` (and `axiosConfigDefaults` must be `never` / absent).

When your factory code explicitly sets `axiosConfigDefaults`, it picks **Mode 1**.  
However, because `options` can be *either* Mode 1 or Mode 2, spreading `...options` into the object brings along an optional `axiosInstance?: AxiosInstance | undefined`.  
TypeScript checks Mode 1, sees that `axiosInstance` might be an `AxiosInstance` instead of `never`, and throws TS2345!

### The Clean Solution: Omit `"axiosInstance"`

Since `NewOffersClient` always configures the HTTP client through `axiosConfigDefaults`, omit `"axiosInstance"` alongside `"definition"`:

```typescript
export type OfferClientConfiguration = Omit<
  OpenAPIClientAxiosOptions,
  "definition" | "axiosInstance"
>;
```

Once `"axiosInstance"` is omitted from `options`, TypeScript is certain that `options` will never carry an incompatible `axiosInstance`. The object matches Mode 1 cleanly with **zero type errors and zero type assertions**!

---

## 💡 Summary

By writing:

```typescript
export type OfferClientConfiguration = Omit<
  ConstructorParameters<typeof OpenAPIClientAxios>[0],
  "definition"
>;
```

You achieve:
1. **Encapsulation**: The caller never needs to provide the OpenAPI schema; `NewOffersClient` handles it internally.
2. **Full Option Pass-through**: Callers can still configure timeouts, base URLs, headers, or proxies with full autocomplete and type validation.
3. **Zero Maintenance**: If `openapi-client-axios` adds new constructor options in future updates, your type automatically supports them without code changes.
