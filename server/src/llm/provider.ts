import { GoogleGenAI } from '@google/genai';
import Groq from 'groq-sdk';
import { z } from 'zod';
import { config } from '../config.js';
import { logger } from '../lib/logger.js';

/**
 * The language model is only ever called during ingestion (segmentation
 * fallback, topic tagging), never while answering a search. Every call asks
 * for JSON matching a schema and the reply is validated with Zod, so a
 * malformed answer is an error we can retry, not bad data in the database.
 */
export type JsonRequest<T> = {
  system: string;
  prompt: string;
  schema: z.ZodType<T>;
  /** Short label for logs and usage counts. */
  task: string;
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
      model: config.GEMINI_MODEL,
      contents: req.prompt,
      config: {
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
    const res = await this.client.chat.completions.create({
      model: config.GROQ_MODEL,
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: `${req.system}\n\nReply with JSON only, matching this JSON Schema:\n${schema}` },
        { role: 'user', content: req.prompt },
      ],
    });
    return req.schema.parse(JSON.parse(res.choices[0]?.message.content ?? ''));
  }
}

const providers: Provider[] = [
  ...(config.GEMINI_API_KEY ? [new GeminiProvider()] : []),
  ...(config.GROQ_API_KEY ? [new GroqProvider()] : []),
];

export const llmAvailable = () => providers.length > 0;
export const llmProviders = () => providers.map((p) => p.name);

export class LlmUnavailableError extends Error {}

/** Free tiers often answer 503 "high demand" or 429; those are worth waiting out. */
const ATTEMPTS = 4;

/** Try each configured provider in order, retrying with growing waits (2s, 4s, 8s) on errors or a bad answer. */
export async function generateJson<T>(req: JsonRequest<T>): Promise<{ data: T; provider: string }> {
  if (!providers.length) throw new LlmUnavailableError('No language model API key configured');
  let lastErr: unknown;
  for (const p of providers) {
    for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
      const t = Date.now();
      try {
        const data = await p.generateJson(req);
        logger.debug({ provider: p.name, task: req.task, ms: Date.now() - t }, 'LLM call');
        return { data, provider: p.name };
      } catch (err) {
        lastErr = err;
        logger.warn({ provider: p.name, task: req.task, attempt, err: (err as Error).message?.slice(0, 300) }, 'LLM call failed');
        if (attempt < ATTEMPTS) await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
      }
    }
  }
  throw lastErr;
}
