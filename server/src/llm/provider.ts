import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { GoogleGenAI } from '@google/genai';
import Groq from 'groq-sdk';
import { z } from 'zod';
import { config } from '../config.js';
import { logger } from '../lib/logger.js';

/**
 * The language model is called during ingestion (segmentation fallback,
 * topic tagging) and, through API keys only, to word the study assistant's
 * answers from retrieved data. Search itself never calls it. Every call asks
 * for JSON matching a schema and the reply is validated with Zod, so a
 * malformed answer is an error we can retry, not bad data in the database.
 */
export type JsonRequest<T> = {
  system: string;
  prompt: string;
  schema: z.ZodType<T>;
  /** Short label for logs and usage counts. */
  task: string;
  /** For calls a person is waiting on: a faster model (Gemini only) and a hard time limit. */
  live?: { model?: string; timeoutMs: number };
};

interface Provider {
  name: string;
  generateJson<T>(req: JsonRequest<T>): Promise<T>;
}

class GeminiProvider implements Provider {
  name = 'gemini';
  private client = new GoogleGenAI({ apiKey: config.GEMINI_API_KEY! });

  async generateJson<T>(req: JsonRequest<T>): Promise<T> {
    const res = await this.client.models.generateContent({
      model: req.live?.model ?? config.GEMINI_MODEL,
      contents: req.prompt,
      config: {
        // Speed comes from the model choice: thinking options differ between Gemini generations, and a wrong one is a 400.
        ...(req.live && { abortSignal: AbortSignal.timeout(req.live.timeoutMs) }),
        systemInstruction: req.system,
        responseMimeType: 'application/json',
        // Constrained decoding: the model can only produce JSON of this shape.
        responseJsonSchema: z.toJSONSchema(req.schema, { target: 'draft-7' }),
        temperature: 0,
      },
    });
    return req.schema.parse(JSON.parse(res.text ?? ''));
  }
}

class GroqProvider implements Provider {
  name = 'groq';
  private client = new Groq({ apiKey: config.GROQ_API_KEY! });

  async generateJson<T>(req: JsonRequest<T>): Promise<T> {
    const schema = JSON.stringify(z.toJSONSchema(req.schema, { target: 'draft-7' }));
    const res = await this.client.chat.completions.create(
      {
        model: config.GROQ_MODEL,
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: `${req.system}\n\nReply with JSON only, matching this JSON Schema:\n${schema}` },
          { role: 'user', content: req.prompt },
        ],
      },
      req.live && { timeout: req.live.timeoutMs, maxRetries: 0 },
    );
    return req.schema.parse(JSON.parse(res.choices[0]?.message.content ?? ''));
  }
}

/**
 * A model served by Ollama on this machine or the LAN. Costs nothing, works
 * offline, and Ollama's structured outputs constrain the reply to the schema.
 * Slower than the hosted models on a CPU, so it gets its own time limit.
 */
class OllamaProvider implements Provider {
  name = 'ollama';

  async generateJson<T>(req: JsonRequest<T>): Promise<T> {
    const timeoutMs = Math.max(req.live?.timeoutMs ?? 0, config.OLLAMA_TIMEOUT_MS);
    const res = await fetch(`${config.OLLAMA_URL.replace(/\/$/, '')}/api/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      signal: AbortSignal.timeout(req.live ? timeoutMs : 600_000),
      body: JSON.stringify({
        model: config.OLLAMA_MODEL,
        stream: false,
        format: z.toJSONSchema(req.schema, { target: 'draft-7' }),
        options: { temperature: 0, num_ctx: 8192 },
        messages: [
          { role: 'system', content: req.system },
          { role: 'user', content: req.prompt },
        ],
      }),
    });
    if (!res.ok) throw new Error(`ollama ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const out = (await res.json()) as { message?: { content?: string } };
    return req.schema.parse(JSON.parse(out.message?.content ?? ''));
  }
}

/**
 * LOCAL DEVELOPMENT ONLY. Runs the Claude Code CLI in headless mode
 * (`claude -p`) on the developer's own logged-in account, so the model runs
 * on that person's Claude plan instead of an API key. It only works on a
 * machine where `claude` is installed and logged in, so it is off unless
 * USE_CLAUDE_CODE=true, and a deployed server uses an API provider instead.
 */
class ClaudeCodeProvider implements Provider {
  name = 'claude-code';

  async generateJson<T>(req: JsonRequest<T>): Promise<T> {
    const args = [
      '-p',
      '--output-format', 'json',
      // Structured output: Claude Code validates the reply against this schema.
      '--json-schema', JSON.stringify(z.toJSONSchema(req.schema, { target: 'draft-7' })),
      // A plain text-in, JSON-out call: no tools, no MCP servers, no project settings or memory.
      '--tools', '',
      '--strict-mcp-config',
      '--setting-sources', '',
      '--no-session-persistence',
      '--model', config.CLAUDE_CODE_MODEL,
      '--system-prompt', req.system,
    ];
    // Without an API key in its environment, the CLI uses the saved login.
    const env = { ...process.env };
    delete env.ANTHROPIC_API_KEY;
    const stdout = await new Promise<string>((resolve, reject) => {
      const child = execFile(claudeBinary(), args, { cwd: tmpdir(), env, timeout: 240_000, maxBuffer: 16 * 1024 * 1024, windowsHide: true }, (err, out, errOut) =>
        err ? reject(new Error(`claude -p failed: ${err.message} ${String(errOut).slice(0, 300)}`)) : resolve(out),
      );
      child.stdin?.end(req.prompt);
    });
    const out = JSON.parse(stdout) as { is_error?: boolean; subtype?: string; result?: string; structured_output?: unknown };
    if (out.is_error || out.structured_output === undefined) throw new Error(`claude -p returned ${out.subtype ?? 'an error'}: ${String(out.result).slice(0, 300)}`);
    return req.schema.parse(out.structured_output);
  }
}

/** The CLI's native binary (the npm `claude` command is a .cmd shim on Windows, which execFile can't run). */
function claudeBinary() {
  if (config.CLAUDE_CODE_BIN) return config.CLAUDE_CODE_BIN;
  if (process.platform === 'win32' && process.env.APPDATA) {
    const exe = join(process.env.APPDATA, 'npm', 'node_modules', '@anthropic-ai', 'claude-code', 'bin', 'claude.exe');
    if (existsSync(exe)) return exe;
  }
  return 'claude';
}

const providers: Provider[] = [
  ...(config.USE_CLAUDE_CODE ? [new ClaudeCodeProvider()] : []),
  ...(config.GEMINI_API_KEY ? [new GeminiProvider()] : []),
  ...(config.GROQ_API_KEY ? [new GroqProvider()] : []),
  ...(config.OLLAMA_MODEL ? [new OllamaProvider()] : []),
];

export const llmAvailable = () => providers.length > 0;
/** API-key providers only: what may answer students at request time (Claude Code is a personal login, for local ingestion only). */
const apiProviders = providers.filter((p) => p.name !== 'claude-code');
export const answerLlmAvailable = () => apiProviders.length > 0;
export const llmProviders = () => providers.map((p) => p.name);

export class LlmUnavailableError extends Error {}

/** Free tiers often answer 503 "high demand" or 429; those are worth waiting out. */
const ATTEMPTS = 4;

/**
 * Try each configured provider in order, retrying with growing waits (2s, 4s, 8s) on errors or a bad answer.
 * `apiOnly` skips Claude Code; `attempts` caps retries for calls a person is waiting on.
 */
export async function generateJson<T>(req: JsonRequest<T>, opts: { apiOnly?: boolean; attempts?: number } = {}): Promise<{ data: T; provider: string }> {
  const chain = opts.apiOnly ? apiProviders : providers;
  const attempts = opts.attempts ?? ATTEMPTS;
  if (!chain.length) throw new LlmUnavailableError('No language model API key configured');
  let lastErr: unknown;
  for (const p of chain) {
    for (let attempt = 1; attempt <= attempts; attempt++) {
      const t = Date.now();
      try {
        const data = await p.generateJson(req);
        logger.debug({ provider: p.name, task: req.task, ms: Date.now() - t }, 'LLM call');
        return { data, provider: p.name };
      } catch (err) {
        lastErr = err;
        logger.warn({ provider: p.name, task: req.task, attempt, err: (err as Error).message?.slice(0, 300) }, 'LLM call failed');
        if (attempt < attempts) await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
      }
    }
  }
  throw lastErr;
}
