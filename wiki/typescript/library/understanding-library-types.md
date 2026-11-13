# Deciphering TypeScript Library Declarations (`.d.ts` / `.d.cts`)

When you inspect third-party library source code (like Zod, Express, or `@modelcontextprotocol/sdk`), you are looking at TypeScript **declaration files** (`.d.ts` or `.d.cts`).

At first glance, they can look intimidating with cryptic symbols like `<`, `>`, `?`, `|`, `&`, `$`, and `extends`. This guide gives you the mental tools, tips, and tricks to decode them effortlessly.

---

## 🔬 Dissecting a Real-World Example

Let's take the exact line from your Zod inspection:

```typescript
export declare function string<T = unknown>(
  params?: string | core.$ZodStringParams,
): ZodCoercedString<T>
```

Here is the anatomy of this declaration broken into its 6 parts:

```
export declare function string <T = unknown> (params?: string | core.$ZodStringParams) : ZodCoercedString<T>;
  │         │              │          │             │    │             │                       │
  │         │              │          │             │    │             │                       └─ 6. Return Type
  │         │              │          │             │    │             └─ 5. Type B (Options Object)
  │         │              │          │             │    └─ 4. Union Operator ("OR")
  │         │              │          │             └─ 3. Optional Parameter ("?")
  │         │              │          └─ 2. Generic Type Parameter with Default
  │         │              └─ 1. Function Name
  │         └─ Exists in runtime JavaScript
  └─ Accessible to importers
```

---

## 🧰 The Essential Operators & Symbols Cheat Sheet

### 1. The Union Operator (`|`) ➔ _"OR"_

The union operator means: **"The value can be ANY of these types."**

In our Zod example:

```typescript
params?: string | core.$ZodStringParams
```

This tells you that when you call `z.coerce.string(...)`, you have two choices for what to pass as the argument:

- **Choice A (`string`)**: A simple custom error message:
  ```typescript
  z.coerce.string("Must be a string")
  ```
- **Choice B (`core.$ZodStringParams`)**: An advanced options object (let's see how to inspect that below!).

---

### 2. The Optional Operator (`?`) ➔ _"May be omitted"_

When placed after a parameter name or property name, it means: **"You don't have to provide this."**

- In function parameters:
  ```typescript
  function number(params?: ...): ...
  ```
  You can call it with zero arguments: `z.coerce.number()`, or with arguments: `z.coerce.number({ message: "Invalid" })`.
- In interface properties:
  ```typescript
  interface User {
    id: string // Required!
    email?: string // Optional! (can be string or undefined)
  }
  ```

---

### 3. Generics: `<T>`, `<T = Default>`, and `<T extends Constraint>`

Generics are **type variables** (placeholders). Just like functions accept runtime values as arguments, types accept other types as arguments!

#### Pattern A: Default Generic Type (`<T = unknown>`)

```typescript
export declare function string<T = unknown>(...): ZodCoercedString<T>;
```

- If you don't specify `<T>`, it automatically defaults to `unknown`.
- You usually don't need to pass `T` manually; TypeScript infers it for you.

#### Pattern B: Generic Constraints (`<T extends string>`)

```typescript
function uppercase<T extends string>(val: T): string
```

- The `extends` keyword here means: **"T must be at least a string (or a string literal like 'ACTIVE' | 'INACTIVE'). It cannot be a number or boolean."**

---

### 4. The Intersection Operator (`&`) ➔ _"AND"_

Combines multiple types into one unified type containing **all** properties from both.

```typescript
type Timestamps = { createdAt: Date; updatedAt: Date }
type User = { id: string; name: string }

type UserWithTimestamps = User & Timestamps
// Result has: id, name, createdAt, updatedAt
```

---

### 5. The `extends` Keyword: Finding Hidden Methods!

When reading library interfaces, `extends` is your best friend:

```typescript
export interface ZodCoercedNumber<T = unknown> extends schemas._ZodNumber<
  core.$ZodNumberInternals<T>
> {}
```

> [!TIP]
> Notice the body `{}` is completely empty!  
> Does that mean `ZodCoercedNumber` has no methods? **No!**  
> Because it **`extends schemas._ZodNumber`**, it inherits every single method that `_ZodNumber` has!

When you see `extends OtherType`, **Cmd + Click** (or F12) on `_ZodNumber` to jump to its declaration. You will instantly see all the chained methods available:

- `.min(value)`
- `.max(value)`
- `.int()`
- `.positive()`
- `.default(value)`

---

## 🕵️ How to Unmask "Internal" Library Types (like `$ZodStringParams`)

Libraries often use naming conventions like:

- Types starting with `$` (e.g. `$ZodStringParams`, `$ZodTypeInternals`)
- Types starting with `_` (e.g. `_ZodString`, `_ZodNumber`)

### Why do library authors do this?

This is a standard convention in libraries to say:

> _"This is internal plumbing used to construct the library. You don't need to import this directly in your daily code."_

### How to see what options an internal type accepts:

If you want to know: _"What can I actually pass into `core.$ZodStringParams`?"_:

1. In your editor, **Cmd + Click** on `$ZodStringParams`.
2. It jumps directly to its interface definition:
   ```typescript
   export type $ZodStringParams = {
     errorMap?: ZodErrorMap
     invalid_type_error?: string
     required_error?: string
     description?: string
   }
   ```
3. **Mystery solved!** You now know you can pass:
   ```typescript
   z.coerce.string({
     invalid_type_error: "Must be text!",
     description: "Supplier identification code",
   })
   ```

---

## 🚀 Pro-Tips for Navigating `.d.ts` in Your IDE (VS Code / Cursor / WebStorm)

### Tip 1: Quick Hover (The "Non-Destructive" Peek)

Don't jump files right away. Hover your mouse over the function name (`number` or `string`). Your editor will display a tooltip showing:

- The full function signature.
- Any JSDoc comments/documentation written by the library author.

### Tip 2: "Go to Type Definition" vs "Go to Definition"

- **Go to Definition** (`F12` / `Cmd + Click`): Jumps to the implementation or function declaration.
- **Go to Type Definition**: Jumps specifically to the type interface of what the function returns!

### Tip 3: Use TypeScript's Utility Types to Inspect Complex Types

If a library function's return type is deeply nested or confusing, you can use built-in TypeScript utility types in a scratch line to inspect it:

```typescript
// 1. See what arguments the function takes:
type StringArgs = Parameters<typeof z.coerce.string>

// 2. See what the function returns:
type StringReturn = ReturnType<typeof z.coerce.string>

// 3. See the inferred TypeScript data type of a Zod schema:
type Config = z.infer<typeof configSchema>
```

---

## 🎯 Summary

| Symbol                | What It Means                                          | How to Read It                                            |
| --------------------- | ------------------------------------------------------ | --------------------------------------------------------- |
| **`declare`**         | "This exists in JS at runtime; trust me on the types." | Compiler hint.                                            |
| **`?`**               | Optional                                               | `arg?: string` means you can pass `undefined` or omit it. |
| **`                   | `**                                                    | Union ("OR")                                              | Can be `TypeA` OR `TypeB`. |
| **`&`**               | Intersection ("AND")                                   | Has all properties of both types.                         |
| **`<T = Default>`**   | Generic type placeholder                               | Defaults to `Default` if not specified.                   |
| **`extends`**         | Inheritance or constraint                              | Inherits all parent properties and methods.               |
| **`$` or `_` prefix** | Internal library plumbing                              | Safe to ignore unless you want to peek under the hood.    |
