# Why Vitest Over Jest: Architecture & Design Decisions

This guide documents the technical reasons why **Vitest** was selected as the testing framework for this project instead of the traditional industry default, **Jest**.

---

## ⚡ Executive Summary

> **Vitest was engineered specifically for the modern TypeScript and ECMAScript Module (ESM) era. While Jest carries 10+ years of legacy CommonJS baggage, Vitest provides zero-config TypeScript compilation, sub-second execution speeds via `esbuild`, and native compatibility with modern Node 20+ runtime APIs.**

---

## 1. The ESM & TypeScript "Configuration Hell" with Jest 🤯

Our MCP Server codebase uses modern Node.js standards:

- `"type": "module"` in `package.json`
- `"moduleResolution": "NodeNext"` in `tsconfig.json`
- Subpath imports like `@modelcontextprotocol/sdk/server/mcp.js`

### The Jest Problem:

Jest was created in 2014, when **CommonJS (`require()`)** was the only module system in Node.js. Making Jest work in a modern TypeScript ESM project requires:

1. Installing extra compilers: `ts-jest` or `@babel/preset-typescript`.
2. Running Node with experimental flags: `NODE_OPTIONS=--experimental-vm-modules jest`.
3. Writing complex module path mappers in `jest.config.js` because Jest frequently fails to resolve `package.json` `"exports"` subpaths used by modern libraries like the Model Context Protocol SDK.

### The Vitest Solution:

**Zero configuration.** Vitest was built ESM-first. It resolves modern package exports and compiles TypeScript out of the box without any third-party plugins.

---

## 2. Speed & Transpilation Architecture ⚡

The difference in execution speed between Jest and Vitest is night and day:

```
Jest Transpilation Pipeline:
Source TS File ──▶ [ts-jest / tsc] ──▶ Full AST Analysis ──▶ Slower Execution (3–10s startup)

Vitest Transpilation Pipeline:
Source TS File ──▶ [esbuild in Go] ──▶ Strips types in memory ──▶ Blazing Fast (<100ms startup)
```

- **Jest**: Relies on either the standard TypeScript compiler (`tsc`) or Babel to parse and type-check every file before execution, making cold test starts noticeably sluggish.
- **Vitest**: Leverages **`esbuild`** (written in Go) to transpile code in memory. Tests start and execute in milliseconds, and watch mode feels instant.

---

## 3. Native Support for Modern Node.js APIs 🌐

Our MCP Server relies on modern Node 20+ built-ins:

- `globalThis.fetch` (HTTP requests)
- `node:crypto` (Token hashing)
- `node:async_hooks` / `AsyncLocalStorage` (Request context isolation)

### Why this matters:

- In **Jest**, the test environment often runs in a custom virtual environment (or older JSDOM) that historically stripped or failed to support global `fetch`, requiring developers to install polyfills like `whatwg-fetch` or `isomorphic-fetch`.
- In **Vitest**, tests run in a pristine `node` environment where `fetch`, `Headers`, and `AsyncLocalStorage` work exactly as they do in production.

---

## 4. Zero Learning Curve (Jest-Compatible API) 🤝

Vitest did not reinvent the wheel for its test assertion syntax. It adopted Jest's exact API, meaning there is zero learning curve:

```typescript
// Jest:
describe("TokenIntrospector", () => {
  it("verifies tokens", () => {
    const fn = jest.fn()
    expect(fn).toHaveBeenCalled()
  })
})

// Vitest:
describe("TokenIntrospector", () => {
  it("verifies tokens", () => {
    const fn = vi.fn() // 👈 Only change: "jest" becomes "vi"!
    expect(fn).toHaveBeenCalled()
  })
})
```

---

## ⚖️ Feature Comparison Matrix

| Criteria                       | Jest                                    | Vitest (Our Choice)                     |
| ------------------------------ | --------------------------------------- | --------------------------------------- |
| **TypeScript Support**         | Requires `ts-jest` or `@babel/core`     | Built-in out of the box                 |
| **ESM (`"type": "module"`)**   | Experimental & prone to resolution bugs | First-class native citizen              |
| **Compiler Engine**            | `tsc` / Babel (Slow)                    | `esbuild` in Go (10x–20x faster)        |
| **Node 20+ Globals (`fetch`)** | Often requires polyfills                | 100% native support                     |
| **Watch Mode**                 | Slow on medium/large codebases          | Instantaneous smart caching             |
| **Configuration Complexity**   | High (15–30 lines of babel/jest config) | Minimal (5 lines in `vitest.config.ts`) |

---

## 💡 Conclusion

Choosing Vitest allows us to focus entirely on writing business logic for our MCP tools and authentication flows rather than debugging module resolution errors and Babel transformers.
