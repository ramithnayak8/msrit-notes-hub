import { z } from 'zod';

const bool = z
  .enum(['true', 'false', '1', '0'])
  .transform((v) => v === 'true' || v === '1');

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().default(4000),
  CLIENT_ORIGIN: z.string().default('http://localhost:3000'),
  // Public base URL of this API, used in email links.
  API_PUBLIC_URL: z.string().optional(),
  MONGODB_URI: z.string().min(1),
  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
  ALLOWED_EMAIL_DOMAIN: z.string().default('msrit.edu'),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  MAIL_FROM: z.string().default('ConceptQuery <no-reply@conceptquery.local>'),
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().default('gemini-flash-latest'),
  GROQ_API_KEY: z.string().optional(),
  GROQ_MODEL: z.string().default('llama-3.3-70b-versatile'),
  // Local development only: use the Claude Code CLI on your own logged-in account (see llm/provider.ts).
  USE_CLAUDE_CODE: bool.default(false),
  CLAUDE_CODE_MODEL: z.string().default('sonnet'),
  CLAUDE_CODE_BIN: z.string().optional(),
  RUN_WORKER: bool.default(true),
  // Proxies in front of the API that append to X-Forwarded-For, so rate limits see the student's IP.
  // 1 behind one proxy (Render, a load balancer); 2 when the site is on Vercel and forwards /api to a proxied host.
  TRUST_PROXY: z.coerce.number().int().min(0).default(1),
  // The study assistant writes its answers with Gemini/Groq (never Claude Code) from retrieved archive data.
  // Off: answers are composed from retrieval alone, as before.
  ASSISTANT_LLM: bool.default(true),
  // A fast model, since a student is waiting (about 1s for Flash-Lite against 30s+ for Flash). Gemini only; Groq uses GROQ_MODEL.
  ASSISTANT_MODEL: z.string().default('gemini-flash-lite-latest'),
  ASSISTANT_TIMEOUT_MS: z.coerce.number().int().min(1000).default(12_000),
  // AI answers per signed-in student per day, and for the whole site per day (keep under the free tier).
  ASSISTANT_USER_DAILY: z.coerce.number().int().min(0).default(20),
  ASSISTANT_GLOBAL_DAILY: z.coerce.number().int().min(0).default(500),
});

// Empty strings in .env mean "not set".
const raw = Object.fromEntries(Object.entries(process.env).filter(([, v]) => v !== ''));
const parsed = schema.safeParse(raw);
if (!parsed.success) {
  console.error('Invalid environment:\n' + z.prettifyError(parsed.error));
  process.exit(1);
}

export const config = parsed.data;
export const isProd = config.NODE_ENV === 'production';
