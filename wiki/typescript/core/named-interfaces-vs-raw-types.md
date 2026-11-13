# Named Interfaces vs. Raw Inline Types in TypeScript

When writing TypeScript classes like `TokenIntrospector`, you have two choices for defining data structures: using **named interfaces** or using **raw inline types**.

```typescript
// Approach A: Raw Inline Types
private cache = new Map<string, { session: AgentSession; expiresAt: number }>();
const body = (await response.json()) as { active: boolean; sub?: string; supplier_id?: string };

// Approach B: Named Interfaces (Best Practice)
interface CacheEntry {
  session: AgentSession;
  expiresAt: number;
}

interface IntrospectionResponse {
  active: boolean;
  sub?: string;
  supplier_id?: string;
  scope?: string;
  exp?: number;
}
```

This guide explains the architectural and maintainability reasons why experienced TypeScript engineers favor **named interfaces** for non-trivial data structures.

---

## 1. Separation of Contracts (External vs. Storage vs. Domain)

In enterprise services, data flows through three distinct conceptual tiers:

```
[External OAuth2 Server]
         │
         │  1. External Contract (RFC 7662 Payload)
         ▼
 ┌──────────────────────────────┐
 │  IntrospectionResponse       │ ──▶ External API schema (sub, supplier_id, active, exp)
 └──────────────┬───────────────┘
                │
                │  Mapped into:
                ▼
 ┌──────────────────────────────┐
 │  AgentSession                │ ──▶ Internal Domain Model (userId, supplierId, token)
 └──────────────┬───────────────┘
                │
                │  Stored inside:
                ▼
 ┌──────────────────────────────┐
 │  CacheEntry                  │ ──▶ Infrastructure Storage Model (session + expiresAt)
 └──────────────────────────────┘
```

### The Architectural Benefit:

- **`IntrospectionResponse`** reflects the wire-format of the external auth server.
- **`AgentSession`** reflects what our MCP server and tool handlers actually care about.
- **`CacheEntry`** reflects the internal storage needs of our cache.

Keeping these three boundaries explicitly named guarantees that if the external auth server changes its payload (e.g. renaming `sub` to `account_id`), only the `IntrospectionResponse` interface and its single mapping line change. The rest of the codebase remains 100% insulated.

---

## 2. Cleaner Function Signatures & Reusability (DRY)

When breaking classes into small, testable helper functions, raw inline types quickly become repetitive and unreadable.

### ❌ With Raw Inline Types (Cluttered & Repetitive):

```typescript
private getFromCache(token: string): { session: AgentSession; expiresAt: number } | null {
  // ...
}

private saveToCache(key: string, entry: { session: AgentSession; expiresAt: number }): void {
  // ...
}

private parseClaims(body: { active: boolean; sub?: string; supplier_id?: string; scope?: string; exp?: number }): AgentSession {
  // ...
}
```

### ✅ With Named Interfaces (Clean & Self-Documenting):

```typescript
private getFromCache(token: string): CacheEntry | null {
  // ...
}

private saveToCache(key: string, entry: CacheEntry): void {
  // ...
}

private parseClaims(body: IntrospectionResponse): AgentSession {
  // ...
}
```

---

## 3. Human-Readable Error Messages & IDE Tooltips

Named interfaces drastically improve developer experience when reading tooltips or debugging compile-time errors in VS Code.

### A. Hover Tooltips in VS Code

- **Raw Inline**:
  ```text
  (property) TokenIntrospector.cache: Map<string, { session: AgentSession; expiresAt: number; }>
  ```
- **Named Interface**:
  ```text
  (property) TokenIntrospector.cache: Map<string, CacheEntry>
  ```

### B. Compiler Error Clarity

If you mistakenly assign a string to `expiresAt`:

- **With Raw Inline**:
  ```text
  Type '{ session: AgentSession; expiresAt: string; }' is not assignable to type '{ session: AgentSession; expiresAt: number; }'.
    Types of property 'expiresAt' are incompatible.
      Type 'string' is not assignable to type 'number'.
  ```
- **With Named Interface**:
  ```text
  Type 'string' is not assignable to type 'number'.
    The expected type comes from property 'expiresAt' which is declared here on type 'CacheEntry'.
  ```
  The compiler directly tells you which interface failed and links you straight to its definition.

---

## 4. Refactoring Agility (Single Point of Truth)

Suppose you decide to upgrade your in-memory cache to support LRU eviction or performance metrics:

```typescript
interface CacheEntry {
  session: AgentSession
  expiresAt: number
  hitCount: number // 👈 Added in ONE place!
  lastAccessed: number // 👈 Added in ONE place!
}
```

- **With a Named Interface**: You update `interface CacheEntry` once. TypeScript automatically checks all usages across your class and alerts you where `hitCount` needs to be initialized.
- **With Raw Inline Types**: You would have to manually find, review, and update every place where the anonymous object literal `{ session: AgentSession; expiresAt: number }` was copy-pasted.

---

## 💡 Mentor Rule of Thumb: When to Use Each

| Use Raw Inline Types When:                                           | Use Named `interface` / `type` When:                         |
| -------------------------------------------------------------------- | ------------------------------------------------------------ |
| A variable is strictly local to 2–3 lines of code (e.g. `{ x, y }`). | The data represents an **external API request or response**. |
| A simple tuple (e.g. `[number, string]`).                            | The type is used across multiple function signatures.        |
| Quick one-off object destructuring.                                  | The data represents a persistent entity or cache model.      |
| The type will **never** be used anywhere else in the file.           | You want clean hover tooltips and readable compiler errors.  |
