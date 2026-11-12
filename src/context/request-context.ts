import { AsyncLocalStorage } from "node:async_hooks";

export interface AgentSession {
    token: string
    userId: string
    supplierId: string
    scopes: string[]
    expiresAt: number | undefined
}

const storage = new AsyncLocalStorage<AgentSession>()

export const RequestContext = {
    run<T>(session: AgentSession, callback: () => T): T {
        return storage.run(session, callback)
    },

    current(): AgentSession | undefined {
        return storage.getStore()
    },

    require(): AgentSession {
        const session = storage.getStore();
        if(!session) {
            throw new Error("Unauthorized: No authenticated agent session found.");
        }
        return session
    }
}

