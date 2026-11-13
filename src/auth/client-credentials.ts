import axios, { type InternalAxiosRequestConfig } from "axios"
import { clientCredentials } from "axios-oauth-client"
import axiosTokenProvider from "axios-token-interceptor"

export interface OAuthClientCredentialsOptions {
  readonly tokenUrl: string
  readonly clientId: string
  readonly clientSecret: string
  readonly scope?: string
  readonly gracePeriodSeconds?: number
}

export interface TokenResponse {
  readonly access_token: string
  readonly token_type?: string
  readonly expires_in?: number
  readonly scope?: string
}

export type AxiosRequestInterceptor = (
  config: InternalAxiosRequestConfig,
) => Promise<InternalAxiosRequestConfig>

const DEFAULT_GRACE_PERIOD_SECONDS = 30

export function createOAuthInterceptor(
  options: OAuthClientCredentialsOptions,
): AxiosRequestInterceptor {
  const {
    tokenUrl,
    clientId,
    clientSecret,
    scope,
    gracePeriodSeconds = DEFAULT_GRACE_PERIOD_SECONDS,
  } = options

  const getCredentials: (scope?: string) => Promise<TokenResponse> =
    clientCredentials(axios.create(), tokenUrl, clientId, clientSecret, scope)

  const getToken = axiosTokenProvider.tokenCache<TokenResponse>(
    getCredentials,
    {
      getMaxAge: (response: TokenResponse): number => {
        const expiresInSeconds = response.expires_in ?? 3600 //fallback to 1 hour
        const safeLifeTimeSeconds = Math.max(
          expiresInSeconds - gracePeriodSeconds,
          10,
        )
        return safeLifeTimeSeconds * 1000
      },
    },
  )

  const provider = axiosTokenProvider({
    getToken,
    headerFormatter: (tokenData: unknown) => {
      const token = (tokenData as TokenResponse | null)?.access_token
      return token ? `Bearer ${token}` : ""
    },
  })

  return async (config) => {
    return (await provider(config)) as InternalAxiosRequestConfig
  }
}
