import { TokenIntrospector } from "../auth/introspector.js";
import { Request, Response, NextFunction } from "express";
import { RequestContext } from "../context/request-context.js";

export function createAuthMiddleware(introspector: TokenIntrospector) {
    return async (req: Request, res: Response, nextFn: NextFunction) => {
        const authHeader = req.headers["authorization"] || req.headers["x-auth-token"]
        let token : string | undefined

        if (typeof authHeader === "string") {
            token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : authHeader.trim()
        }

        if (token == "" || token == undefined) {
            return res.status(401).json({
                jsonrpc: "2.0",
                id: null,
                error: { code: -32001, message: "Authentication failed: token invalid or expired" }
            })
        }

        const session = await introspector.verify(token)
        if (!session) {
            return res.status(401).json({
                jsonrpc: "2.0",
                id: null,
                error: { code: -32001, message: "Authentication failed: token invalid or expired" }
            })
        }

        RequestContext.run(session, () => { nextFn() })
    }
}