# Understanding `tsconfig.json`: `target`, `module`, `moduleResolution`, and `lib`

When configuring TypeScript for a modern backend (like our MCP Server), these four settings in `tsconfig.json` form the core foundation of how your code is analyzed, compiled, and resolved:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2022"]
  }
}
```

---

## 🧭 The Mental Model (How They Work Together)

To never confuse them again, remember what question each setting answers:

| Option                 | The Question It Answers                                      | Real-World Analogy                                                   |
| ---------------------- | ------------------------------------------------------------ | -------------------------------------------------------------------- |
| **`target`**           | _"How new or old is the JavaScript engine running my code?"_ | The engine inside the car (V8 engine in Node 20).                    |
| **`module`**           | _"What syntax should imports and exports be compiled into?"_ | The grammar of the language (English vs. French).                    |
| **`moduleResolution`** | _"How does TypeScript look up and find the files I import?"_ | The GPS / map algorithm used to locate addresses.                    |
| **`lib`**              | _"What global variables and APIs exist in my environment?"_  | The built-in dictionary of known words (`Array`, `Error`, `window`). |

---

## 1. `target`: The JavaScript Output Version

```json
"target": "ES2022"
```

### What it does:

Determines the **version of ECMAScript (JavaScript)** the compiler outputs in `dist/`.

- If your code uses a newer feature (like class fields or top-level `await`) and `target` is set to an older version (e.g. `ES5`), TypeScript will **downlevel** it: writing large, clunky polyfill functions to emulate that feature in ancient JavaScript engines.
- Since Node.js 18, 20, and 22 natively support **ES2022**, setting `"target": "ES2022"` tells TypeScript:
  > _"Node already knows how to run modern JavaScript natively. Don't downlevel or bloat my code with compatibility helpers."_

---

## 2. `module`: The Import/Export Syntax Format

```json
"module": "NodeNext"
```

### What it does:

Determines **what module system syntax** is emitted in the compiled output.

Historically, the JavaScript ecosystem has two competing module systems:

1. **CommonJS (CJS)**: Legacy Node.js format using `require()` and `module.exports`.
2. **ECMAScript Modules (ESM)**: Official web standard using `import` and `export`.

### What does `"NodeNext"` mean?

Node.js is now a "dual-module" runtime (it supports both ESM and CJS in the same project). Setting `"module": "NodeNext"` instructs TypeScript to mirror modern Node.js module rules:

- Files are treated as **ESM** if `package.json` contains `"type": "module"`, or if the file ends in `.mts`.
- Files are treated as **CJS** if the file ends in `.cts`.
- Allows using top-level `await` inside ESM files.

---

## 3. `moduleResolution`: The File Lookup Algorithm

```json
"moduleResolution": "NodeNext"
```

### What it does:

When you write:

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { config } from "./config.js"
```

TypeScript must answer: _"Where on my disk does this file actually live?"_

The `moduleResolution` setting determines the **strategy / algorithm** used to resolve that import path.

### The Evolution of Resolution Strategies:

1. **`node10` (Legacy / Classic)**:
   - The original Node.js CommonJS resolution.
   - Looks for `node_modules/<pkg>/index.js` or checks the `"main"` field in `package.json`.
   - **Flaw**: Does not understand modern `package.json` `"exports"` maps or modern ESM rules.
2. **`NodeNext` (Modern Node.js)**:
   - Matches the exact resolution algorithm used by Node.js 16+.
   - Respects conditional `"exports"` in `package.json` (e.g., packages exposing different entry points for `import` vs `require`).
   - Understands subpath imports (`@modelcontextprotocol/sdk/server/mcp.js`).
   - Requires relative imports in ESM code to include file extensions (`./config.js`).
3. **`Bundler` (Vite, esbuild, Webpack)**:
   - Used for frontend bundlers where you want bundler-style imports without strictly enforcing Node's native ESM file extension rules.

> [!IMPORTANT]
> Because `@modelcontextprotocol/sdk` uses modern `package.json` `"exports"` subpaths, using `"moduleResolution": "NodeNext"` is **required** to properly find and type-check MCP SDK imports.

---

## 4. `lib`: Built-in Type Declarations

```json
"lib": ["ES2022"]
```

### What it does:

Defines which **global API type definitions** TypeScript automatically loads into memory.

TypeScript only type-checks; it does **not** inject runtime polyfills. `lib` tells the compiler what built-in objects it can assume exist globally at runtime.

### Why not include `"DOM"`?

- If you were building a React or Vue frontend, you would configure:
  ```json
  "lib": ["ES2022", "DOM", "DOM.Iterable"]
  ```
  This tells TypeScript that browser globals like `document`, `window`, and `localStorage` exist.
- However, our MCP Server is a **pure Node.js backend**. There is no browser window or HTML DOM!
- By setting `"lib": ["ES2022"]` (and omitting `"DOM"`), TypeScript will flag an immediate error if you accidentally try to use `window` or `document` in your backend code.
- It includes types for all standard ECMAScript 2022 features:
  - `Array.prototype.at()`
  - `Object.hasOwn()`
  - `Promise.allSettled()`
  - `Error.cause`

---

## 📊 Summary Comparison

```
┌────────────────────────────────────────────────────────────────────────┐
│                              TypeScript                                │
├───────────────────────────────┬────────────────────────────────────────┤
│ target: "ES2022"              │ Code generated: Native modern JS       │
│ module: "NodeNext"            │ Module output: Modern Node ESM         │
│ moduleResolution: "NodeNext"  │ Algorithm: Modern package.json exports │
│ lib: ["ES2022"]               │ Global types: Pure backend ES2022 APIs │
└───────────────────────────────┴────────────────────────────────────────┘
```

These four settings guarantee that your TypeScript environment perfectly mirrors your Node 20+ runtime with zero bloat, accurate type checking for the MCP SDK, and native performance.
