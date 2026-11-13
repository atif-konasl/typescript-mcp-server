import OfferClientDefinition from "@/gen/supplier-offers.openapi-runtime.json" with { type: "json" }
import type { Client as OffersClient } from "@/types/supplier-offers.gen.d.ts"
import type { AxiosRequestInterceptor } from "@/auth/client-credentials.js"
import { OpenAPIClientAxios, type OpenAPIClientAxiosOptions } from "openapi-client-axios"

const DEFAULT_TIMEOUT = 5000; // 5 seconds

export type OfferClientConfiguration = Omit<OpenAPIClientAxiosOptions, "definition" | "axiosInstance">;

export async function NewOffersClient(
  options?: OfferClientConfiguration,
  tokenProvider?: AxiosRequestInterceptor,
): Promise<OffersClient> {
  const api = new OpenAPIClientAxios({
    ...options,
    axiosConfigDefaults: {
      timeout: DEFAULT_TIMEOUT,
      ...options?.axiosConfigDefaults
    },
    definition: OfferClientDefinition,
  })

  const client = await api.init<OffersClient>()
  
  if (tokenProvider) {
    client.interceptors.request.use(tokenProvider)
  }

  return client 
}
