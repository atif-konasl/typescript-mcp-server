# Why Does `AsyncLocalStorage` Need a `run()` Function?

When first encountering `AsyncLocalStorage`, almost every developer asks the same intuitive question:

> *"Why do I have to wrap my code inside a callback function like `storage.run(session, callback)`? Why can't I just write something simple like `storage.set(session)` and then `storage.get()`?"*

This guide explains the two fundamental reasons why the `run()` function must exist: **Execution Boundary Definition** and **Eliminating Parameter Drilling**.

---

## 1. Reason 1: Defining Execution Boundaries (Why `storage.set()` Cannot Work)

Imagine for a moment that `AsyncLocalStorage` allowed a standard setter method:

```typescript
// ❌ HYPOTHETICAL CODE (Does not exist in Node.js):
app.get("/offer", async (req, res) => {
  storage.set(aliceSession); // Set session
  
  const data = await fetchFromDatabase(); // Pauses...
  
  const s = storage.get();
  res.json(data);
});
```

### The Unanswerable Questions:
If `storage.set()` existed, how could Node.js possibly answer these questions?
1. **When does this session end?**  
   Does it end at the end of the function? What if the function spawns a background timer or an un-awaited Promise?
2. **What happens when another request arrives during `await`?**  
   Because Node.js runs on a **single thread**, while Alice's request is paused waiting for the database, Bob's request arrives. If Bob calls `storage.set(bobSession)`, he would overwrite Alice!

### The Boundary Box:
By requiring a **callback function**, `run(session, callback)` creates a strict **boundary box**:

```
┌────────────────────────────────────────────────────────┐
│  storage.run(session, async () => {                   │
│                                                        │
│    // 1. BOUNDARY START                                │
│    //    Node binds `session` to this async ID         │
│                                                        │
│    await stepOne();                                    │
│    await stepTwo();                                    │
│                                                        │
│    // 2. BOUNDARY END                                  │
│    //    When this promise resolves or rejects,        │
│    //    Node automatically cleans up the context!     │
│  });                                                   │
└────────────────────────────────────────────────────────┘
```

Without the callback, Node's C++ engine has no way to know **where the scope begins and where it ends**.

---

## 2. Reason 2: Eliminating "Parameter Drilling"

The second major purpose of `run()` is architectural: it prevents you from having to pass `session` as an argument through every function layer in your application.

### ❌ Without `run()`: The Parameter Drilling Nightmare
Every intermediate function must accept `session` as a parameter, even if it has no interest in using it, simply to forward it down to a deeper function:

```typescript
// Layer 0: Route handler
app.post("/mcp", async (req, res) => {
  const session = await authenticate(req);
  await handleMcpTool(req.body, session); // 1. Must pass session
});

// Layer 1: MCP Tool Router
async function handleMcpTool(body: any, session: AgentSession) {
  await executeTool(body.name, body.arguments, session); // 2. Must pass session
}

// Layer 2: Tool Dispatcher
async function executeTool(name: string, args: any, session: AgentSession) {
  if (name === "list_offers") {
    await listOffers(args.supplierId, session); // 3. Must pass session
  }
}

// Layer 3: Business Logic
async function listOffers(supplierId: string, session: AgentSession) {
  await supplierClient.getOffers(supplierId, session); // 4. Must pass session
}

// Layer 4: HTTP Client (The ONLY function that actually needs the token!)
async function getOffers(supplierId: string, session: AgentSession) {
  await fetch(`/offers?supplierId=${supplierId}`, {
    headers: { Authorization: `Bearer ${session.token}` }
  });
}
```

> **The Problem**: Layers 1, 2, and 3 are completely polluted with `session`. If you ever change the session structure, you have to rewrite the signatures of 4 different functions!

---

### ✅ With `RequestContext.run()`: Set Once at the Edge, Access Anywhere

With `RequestContext.run()`, you establish the context once at the entry point (the HTTP middleware). Intermediate layers remain completely clean:

```typescript
// Layer 0: Express Middleware / Route Handler
app.post("/mcp", (req, res) => {
  const session = authenticate(req);

  // Wrap the execution once:
  RequestContext.run(session, async () => {
    await handleMcpTool(req.body); // Clean! No session passed!
  });
});

// Layer 1: MCP Tool Router (Clean signature)
async function handleMcpTool(body: any) {
  await executeTool(body.name, body.arguments);
}

// Layer 2: Tool Dispatcher (Clean signature)
async function executeTool(name: string, args: any) {
  if (name === "list_offers") {
    await listOffers(args.supplierId);
  }
}

// Layer 3: Business Logic (Clean signature)
async function listOffers(supplierId: string) {
  await supplierClient.getOffers(supplierId);
}

// Layer 4: HTTP Client (Pulls context on demand!)
async function getOffers(supplierId: string) {
  // 🎯 Magically pulls the correct session for the current async execution chain:
  const session = RequestContext.require();

  await fetch(`/offers?supplierId=${supplierId}`, {
    headers: { Authorization: `Bearer ${session.token}` }
  });
}
```

---

## 3. Dissecting the `run` Signature

```typescript
run<T>(session: AgentSession, callback: () => Promise<T>): Promise<T> {
  return storage.run(session, callback);
}
```

| Part | What It Represents | Why It's There |
|---|---|---|
| **`<T>`** | Return Type Mirror | Preserves the exact return type of whatever function you run inside `callback`. |
| **`session: AgentSession`** | The Data Payload | The authenticated agent state to attach to this async chain. |
| **`callback: () => Promise<T>`** | The Execution Scope | The asynchronous work to perform while the session is active. |
| **`return storage.run(...)`** | Node.js Engine Call | Registers the session in Node's C++ runtime for this chain and invokes `callback()`. |

---

## 💡 Summary

| Without `run()` | With `run()` |
|---|---|
| No scope boundary ➔ Data leaks across concurrent requests | Strict boundary box ➔ Safe async isolation |
| `session` passed manually through 5 layers of functions | Set once at top; read only where needed via `RequestContext.current()` |
| High coupling between route handlers and business logic | Clean, decoupled, maintainable code architecture |
