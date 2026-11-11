import { z } from "zod";
import dotenv from "dotenv";

dotenv.config();

const configSchema = z.object({
    PORT: z.coerce.number().default(8000),
    HOST: z.string().default("0.0.0.0"),
    UPSTREAM_BASE_URL: z.url(),
    UPSTREAM_CLIENT_ID: z.string().min(1),
    UPSTREAM_CLIENT_SECRET: z.string().min(1),
    UPSTREAM_OAUTH_TOKEN_URL: z.url(),
    INBOUND_AUTH_ENABLED: z.coerce.boolean().default(true),
    INTRORESPTION_URL: z.url(),
    TOKEN_CACHE_TTL_SECONDS: z.coerce.number().default(1800),
})

