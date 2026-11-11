import crypto from "node:crypto"
import { AgentSession } from "../context/request-context.js"

export class TokenIntrospector {
    private cache = new Map<string, { session: AgentSession; expiresAt: number }>();

    constructor(
        private introspectionUrl: string,
        private cacheTtlSeconds: number = 300
    ) {}

    async verify(token: string, now: number = Date.now()): Promise<AgentSession | null> {
        return null
    }
}