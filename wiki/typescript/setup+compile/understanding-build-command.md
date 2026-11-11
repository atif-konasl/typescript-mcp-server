# Understanding the Build Command: `tsup` Deep Dive

This guide breaks down the following build script defined in your `package.json`:

```json
"scripts": {
  "build": "tsup src/index.ts --format esm --dts --clean"
}
```

---

## ⚡ High-Level Summary

In one sentence:
> **This command takes your TypeScript source code starting at `src/index.ts`, compiles and bundles it into modern ECMAScript Module (`esm`) JavaScript in `dist/`, generates `.d.ts` type declaration files, and cleans up old build artifacts before doing so.**

---

## 🔍 Detailed Flag-by-Flag Breakdown

```
tsup   src/index.ts   --format esm   --dts   --clean
 ▲          ▲              ▲           ▲       ▲
 │          │              │           │       └─ 5. Wipe old dist/ folder first
 │          │              │           └───────── 4. Generate TypeScript (.d.ts) files
 │          │              └───────────────────── 3. Output as modern ESM (import/export)
 │          └──────────────────────────────────── 2. The entry point file
 └─────────────────────────────────────────────── 1. The bundler CLI tool
```

---

### 1. `tsup` (The Bundler)
- **What is it?** `tsup` is a zero-config, ultra-fast TypeScript bundler created by Egoist.
- **Under the hood**: It is powered by **`esbuild`** (a bundler written in Go that compiles code 10x to 100x faster than traditional tools like Webpack, Rollup, or `tsc`).
- **Why use it instead of just `tsc` (TypeScript Compiler)?**
  - `tsc` only transpiles files 1-to-1 without bundling.
  - `tsup` bundles your code, tree-shakes unused exports, resolves imports, and produces a clean, production-ready output file in milliseconds.

---

### 2. `src/index.ts` (The Entry Point)
- Specifies the root file of your application.
- `tsup` reads `src/index.ts`, analyzes all its `import` statements (e.g., `import { config } from "./config.js"`), and traverses your entire codebase dependency tree to bundle all internal modules into the output.
- **Output target**: By default, it generates `dist/index.js`.

---

### 3. `--format esm` (Output Module Format)
- Node.js historically used **CommonJS** (`require()` and `module.exports`).
- Modern JavaScript and Node.js (v16+) use standard **ESM (ECMAScript Modules)** (`import` and `export`).
- `--format esm` explicitly tells `tsup` to emit modern ESM syntax.
- **Why this matters for your MCP server**:
  - The `@modelcontextprotocol/sdk` package is published as modern ESM.
  - Node.js 20+ runs ESM natively when `"type": "module"` is configured in `package.json`.
  - ESM enables top-level `await` and static analysis for better tree-shaking (removing unused code).

> [!NOTE]
> If you needed to support legacy CommonJS environments, `tsup` allows building both simultaneously: `--format esm,cjs`. For our modern MCP server, `esm` is all we need.

---

### 4. `--dts` (Declaration Files Generation)
- **The problem with fast compilers**: Tools like `esbuild` and `swc` achieve their extreme speed by simply stripping out TypeScript types without type-checking or generating `.d.ts` files.
- **The solution**: Passing `--dts` instructs `tsup` to spin up the official TypeScript compiler (`tsc`) in the background specifically to extract and emit **type definition files** (`dist/index.d.ts`).
- **Why this is useful**:
  - If your package is imported by other projects or tests, TypeScript knows the exact types, interfaces, and function signatures.
  - Your IDE (VS Code, Cursor, WebStorm) gets instant IntelliSense and auto-complete from the generated `.d.ts` file.

---

### 5. `--clean` (Wipe Output Directory)
- Before creating a new build, `tsup` removes everything currently inside the `dist/` directory.
- **Why is this critical?**
  - Without `--clean`, if you rename `src/old-client.ts` to `src/new-client.ts`, the old `dist/old-client.js` file remains in `dist/`.
  - This often leads to "ghost bugs" where Node.js accidentally imports stale, deleted files.
  - `--clean` guarantees a 100% fresh, reproducible build every single time.

---

## 🏗️ What the Build Output Looks Like

When you execute:
```bash
npm run build
```

Your project directory goes from this:
```
src/
├── index.ts
├── config.ts
├── auth/
│   └── introspector.ts
├── oauth/
│   └── client-credentials.ts
├── clients/
│   └── supplier-client.ts
└── tools/
    ├── list-offers.ts
    └── get-offer.ts
```

To this:
```
dist/
├── index.js       # The bundled ESM JavaScript file (production runtime)
└── index.d.ts     # The bundled TypeScript type definitions
```

You can then run the built application in production with zero TypeScript dependencies:
```bash
node dist/index.js
```

---

## ⚖️ Comparison: `tsup` vs `tsc` vs `tsx`

Understanding the role of each tool in your TypeScript toolbox:

| Tool | Primary Purpose | Speed | When to Use |
|---|---|---|---|
| **`tsup`** | Production Bundler | ⚡⚡ Blazing fast (`esbuild`) | `npm run build` (Prepares code for production deployment) |
| **`tsx`** | Dev Runtime Executor | ⚡⚡ Blazing fast | `npm run dev` (Runs `.ts` files on the fly during development with hot reload) |
| **`tsc`** | Type Checker | 🐢 Slower (checks all types) | `npm run type-check` (`tsc --noEmit`) to verify strict type correctness |

---

## 💡 Mentor Recommendation: Production vs. Development Workflow

- **During Development**: Use `tsx watch src/index.ts`. It executes TypeScript in memory without writing files to disk, giving you sub-second reloads whenever you save a file.
- **For Production**: Run `npm run build` (which executes `tsup`). This compiles your code down to clean, optimized JavaScript in `dist/`, which Node.js can execute directly with maximum performance.
