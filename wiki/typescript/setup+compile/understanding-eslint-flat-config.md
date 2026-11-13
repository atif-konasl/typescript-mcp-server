# Modern TypeScript Linting with ESLint Flat Config

This guide explains the linter configuration added to your TypeScript project, how modern ESLint Flat Config (`eslint.config.js`) works, and how to understand and resolve lint warnings.

---

## 🎯 1. Compiler vs. Linter: What's the Difference?

| Tool                            | Primary Job                       | What It Catches                                                      | Example                                              |
| ------------------------------- | --------------------------------- | -------------------------------------------------------------------- | ---------------------------------------------------- |
| **TypeScript Compiler (`tsc`)** | **Type Safety & Soundness**       | Type mismatches, invalid property access, missing imports            | Passing `number` where `string` is expected          |
| **Linter (`eslint`)**           | **Code Quality & Best Practices** | Dead code, unused imports, dangerous patterns, stylistic consistency | Unused variables, unhandled promises, implicit `any` |

The TypeScript compiler does not complain about an unused `import { before } from "node:test"` or an empty catch block. A linter catches these immediately to keep your codebase clean, maintainable, and bug-free.

---

## 🏗️ 2. The Architecture of ESLint Flat Config (`eslint.config.js`)

Starting with ESLint v9, the legacy `.eslintrc.*` system was replaced by **Flat Config**.

In [eslint.config.js](file:///Users/atifanowar/Workspace/personal-projects/typescript/typescript-mcp-server/eslint.config.js):

```javascript
// @ts-check
import eslint from "@eslint/js"
import tseslint from "typescript-eslint"

export default tseslint.config(
  eslint.configs.recommended, // 👈 Core JavaScript best practices
  ...tseslint.configs.recommended, // 👈 Recommended TypeScript rules & parser
  {
    ignores: ["dist/**", "node_modules/**", "coverage/**", "**/*.d.ts"],
  },
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
        },
      ],
    },
  },
)
```

### Key Highlights of Flat Config:

1. **Native ESM**: Uses standard `import` and `export default` because your project has `"type": "module"`.
2. **`tseslint.config(...)` Helper**: Provides type-checking and autocompletion for rules directly inside the configuration file (`// @ts-check`).
3. **No more `--ext .ts`**: In legacy ESLint, you had to pass `--ext .ts`. In Flat Config, `typescript-eslint` automatically registers file patterns (`**/*.ts`, `**/*.tsx`, `**/*.mts`, `**/*.cts`) and associates them with the TypeScript AST parser.
4. **Clean Ignores**: Global ignores like `dist/**` and `node_modules/**` are declared at top-level objects with `ignores`.

---

## 🛠️ 3. Project Scripts

In [package.json](file:///Users/atifanowar/Workspace/personal-projects/typescript/typescript-mcp-server/package.json):

```json
"scripts": {
  "lint": "eslint .",
  "lint:fix": "eslint . --fix"
}
```

- **`npm run lint`**: Analyzes all files in the project and reports errors and warnings.
- **`npm run lint:fix`**: Automatically fixes fixable issues (like spacing, formatting, or trivial stylistic repairs).

---

## 🔍 4. Analyzing the Current Warnings

Running `npm run lint` currently reports **4 warnings**:

```text
/src/auth/client-credentials.test.ts
   4:10  warning  'before' is defined but never used. Allowed unused vars must match /^_/u  @typescript-eslint/no-unused-vars
  29:69  warning  Unexpected any. Specify a different type                                  @typescript-eslint/no-explicit-any

/src/auth/introspector.ts
  70:18  warning  'error' is defined but never used                                         @typescript-eslint/no-unused-vars

/src/config.ts
  6:7   warning  'configSchema' is assigned a value but never used. Allowed unused vars must match /^_/u  @typescript-eslint/no-unused-vars
```

### How to address each warning:

#### 1. Dead Import in `client-credentials.test.ts`

- **Issue**: Line 4 has `import { before } from "node:test"` which is never used (Vitest's `beforeEach` is already imported from `"vitest"`).
- **Fix**: Remove the unused `import { before } from "node:test"`.

#### 2. `as any` in `client-credentials.test.ts`

- **Issue**: Line 29 casts `mockPostInstance as any`.
- **Why it warns**: `any` bypasses TypeScript checks.
- **Tip**: In tests, `as any` or `as unknown as AxiosInstance` is common when mocking. Because we configured `@typescript-eslint/no-explicit-any` as `"warn"` (not `"error"`), it alerts you without breaking the build.

#### 3. Unused `error` in `introspector.ts`

- **Issue**: Line 70 has `catch (error) { ... }` where `error` is not referenced inside the catch block.
- **Fix**: Either prefix it with an underscore (`catch (_error)`) or use standard omitted catch syntax (`catch { ... }`).

#### 4. `configSchema` in `config.ts`

- **Issue**: `const configSchema = z.object({ ... })` is declared, but only the inferred type or parse result is used.
- **Fix**: Prefix with underscore (`const _configSchema = ...`) or export it if you plan to reuse the schema elsewhere.
