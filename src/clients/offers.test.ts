import { describe, it, vi, expect } from "vitest"
import { NewOffersClient } from "./offers.js"
import { mock } from "node:test"

describe("NewOffersClient", () => {
  it("should initialize client with listOffers and getOffer methods", async() => {
    const client = await NewOffersClient({
      axiosConfigDefaults: {
        baseURL: "http://api.local" 
      }
    })

    expect(client).toBeDefined()
    expect(typeof client.listOffers).toBe("function")
    expect(typeof client.getOffer).toBe("function")
  })

  it("should apply default timeout of 5000ms", async() => {
    const client = await NewOffersClient();
    expect(client.defaults.timeout).toBe(5000)
  })

  it("should allow overrriding timeout and other axios defaults", async() => {
    const client = await NewOffersClient({
      axiosConfigDefaults: {
        baseURL: "http://custom-upstream.local",
        timeout: 1000,
      }
    })

    expect(client.defaults.baseURL).toBe("http://custom-upstream.local")
    expect(client.defaults.timeout).toBe(1000)
  })

  it("should register tokenProvider interceptor when provided", async () => {
    const mockInterceptor = vi.fn().mockImplementation((config) => {
      config.headers = config.headers || {}
      config.headers["Authorization"] = "Bearer valid-token"
      return config
    })

    const client = await NewOffersClient(undefined, mockInterceptor)

    client.defaults.adapter = vi.fn().mockResolvedValue({
      data: { items: [], total: 0, page: 1, size: 20 },
      status: 200,
      statusText: "OK",
      headers: {},
      config: {},
    })

    await client.listOffers();
    expect(mockInterceptor).toHaveBeenCalledTimes(1);
  })

  it("should send correct query params when calling listOffers", async () => {
    const client = await NewOffersClient()

    const mockAdapter = vi.fn().mockResolvedValue({
      data: { items: [], total: 0, page: 1, size: 20 },
      status: 200,
      statusText: "OK",
      headers: {},
      config: {},
    })
    client.defaults.adapter = mockAdapter

    await client.listOffers({
      supplier_id: "supp-100",
      page: 2,
      size: 10,
    })

    expect(mockAdapter).toHaveBeenCalledWith(
      expect.objectContaining({
        url: "/s2s/v1/offers",
        method: "get",
        params: {
          supplier_id: "supp-100",
          page: 2,
          size: 10,
        },
      })
    )
  })
})