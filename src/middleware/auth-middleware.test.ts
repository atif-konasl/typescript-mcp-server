import type { NextFunction, Response, Request } from "express"
import { describe, beforeEach, vi, it, expect } from "vitest"
import { TokenIntrospector } from "../auth/introspector.js"
import {
  type AgentSession,
  RequestContext,
} from "../context/request-context.js"
import { createAuthMiddleware } from "./auth-middleware.js"

describe("createAuthMiddleware", () => {
  let mockRes: Response
  let mockNext: NextFunction
  let mockInterospector: TokenIntrospector

  const validSession: AgentSession = {
    token: "valid-token-123",
    userId: "user-42",
    supplierId: "supp-100",
    scopes: ["offers:read"],
    expiresAt: 1740000000000,
  }

  beforeEach(() => {
    vi.resetAllMocks()

    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    } as unknown as Response

    mockNext = vi.fn()

    mockInterospector = {
      verify: vi.fn(),
    } as unknown as TokenIntrospector
  })

  it("should return 401 when no authorization headers are provided", async () => {
    const middleware = createAuthMiddleware(mockInterospector)
    const req = { headers: {} } as Request

    await middleware(req, mockRes, mockNext)
    expect(mockRes.status).toHaveBeenCalledWith(401)
    expect(mockRes.json).toHaveBeenCalledWith({
      jsonrpc: "2.0",
      id: null,
      error: {
        code: -32001,
        message: "Authentication failed: token invalid or expired",
      },
    })
    expect(mockNext).not.toHaveBeenCalled()
  })

  it("should return 401 when empty authroization headers are provided", async () => {
    const middleware = createAuthMiddleware(mockInterospector)
    const req = { headers: { authorization: "Bearer " } } as Request

    await middleware(req, mockRes, mockNext)
    expect(mockRes.status).toHaveBeenCalledWith(401)
    expect(mockRes.json).toHaveBeenCalledWith({
      jsonrpc: "2.0",
      id: null,
      error: {
        code: -32001,
        message: "Authentication failed: token invalid or expired",
      },
    })
    expect(mockNext).not.toHaveBeenCalled()
  })

  it("should return 401 when token verification fails", async () => {
    vi.mocked(mockInterospector.verify).mockResolvedValue(null)
    const middleware = createAuthMiddleware(mockInterospector)
    const req = {
      headers: { authorization: "Bearer invalid-token" },
    } as Request

    await middleware(req, mockRes, mockNext)

    expect(mockInterospector.verify).toHaveBeenCalledWith("invalid-token")
    expect(mockRes.status).toHaveBeenCalledWith(401)
    expect(mockNext).not.toHaveBeenCalled()
  })

  it("should authenticate valid Bearer token and populate RequestContext", async () => {
    vi.mocked(mockInterospector.verify).mockResolvedValue(validSession)
    let sessionInsideNext: AgentSession | undefined
    const nextFn = vi.fn(() => {
      sessionInsideNext = RequestContext.current()
    })

    const middleware = createAuthMiddleware(mockInterospector)
    const req = { headers: { authorization: "Bearer valid-token" } } as Request

    await middleware(req, mockRes, nextFn)

    expect(mockInterospector.verify).toHaveBeenCalledWith("valid-token")
    expect(nextFn).toHaveBeenCalledTimes(1)
    expect(sessionInsideNext).toEqual(validSession)
  })
})
