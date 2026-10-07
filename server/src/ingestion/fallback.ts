import { z } from 'zod';
import { generateJson } from '../llm/provider.js';
import { LOW_CONFIDENCE, type Segment } from './segment.js';

const llmQuestions = z.object({
  questions: z.array(
    z.object({
      label: z.string().describe('Question number as printed, e.g. "1(a)", "2(b)(ii)", "Q3"'),
      text: z.string().describe('Full question text, OCR errors corrected only where obvious'),
      marks: z.number().int().nullable(),
      co: z.string().nullable().describe('Course outcome, e.g. "CO2", if printed'),
      bloom: z.string().nullable().describe("Bloom's level, e.g. \"L3\", if printed"),
    }),
  ),
});

const SYSTEM = `You split university exam papers into individual questions.
The text may come from OCR and contain recognition errors and table columns (marks, CO, Bloom's level) mixed into lines.
Rules:
- One entry per answerable question or sub-question (1(a), 1(b), ...). Keep a shared stem with each part that needs it.
- Skip headers, instructions, "OR" separators, page numbers and MCQ answer options.
- For multiple-choice questions, include the options in the question text.
- Never invent questions or text that is not in the input. Fix only obvious OCR errors.`;

/** "1(a)(ii)" / "Q2 b" / "3" -> parts of the label */
function parseLabel(label: string) {
  const m = label.match(/(\d{1,2})\s*[.)]?\s*\(?\s*([a-h])?\s*\)?\s*\(?\s*((?:x|ix|iv|v?i{1,3}|v))?\s*\)?/i);
  const q = m?.[1] ? +m[1] : undefined;
  const part = m?.[2]?.toLowerCase();
  const sub = m?.[3]?.toLowerCase();
  return { q, part, sub, label: q ? `Q${q}${part ? `(${part})` : ''}${sub ? `(${sub})` : ''}` : label };
}

async function askModel(text: string, context: string): Promise<Segment[]> {
  const { data } = await generateJson({
    task: 'segment',
    system: SYSTEM,
    prompt: `${context}\n\nPaper text:\n"""\n${text.slice(0, 24_000)}\n"""`,
    schema: llmQuestions,
  });
  return data.questions
    .filter((q) => q.text.trim().length > 3)
    .map((q) => {
      const l = parseLabel(q.label);
      return {
        ...l,
        text: q.text.trim(),
        marks: q.marks ?? undefined,
        co: q.co?.toUpperCase().replace(/\s/g, '') ?? undefined,
        bloom: q.bloom ?? undefined,
        page: 1,
        // The model's split replaces the parser's; it is good but unverified, so mark it.
        confidence: 0.75,
        flags: ['llm-segmented'],
      };
    });
}

/** The whole paper defeated the parser (CIE layouts, bad OCR): let the model split all of it. */
export async function segmentWholeWithModel(bodyText: string): Promise<Segment[]> {
  return askModel(bodyText, 'Split this whole exam paper into questions.');
}

/**
 * Only the low-confidence questions go to the model. Consecutive weak
 * questions are sent together as one region, since the usual failure is one
 * question swallowing its neighbour. Good questions are kept as parsed.
 */
export async function repairLowConfidence(segments: Segment[]): Promise<{ segments: Segment[]; regionsRepaired: number }> {
  const out: Segment[] = [];
  let regionsRepaired = 0;
  let i = 0;
  while (i < segments.length) {
    if (segments[i]!.confidence >= LOW_CONFIDENCE) {
      out.push(segments[i++]!);
      continue;
    }
    const region: Segment[] = [];
    while (i < segments.length && segments[i]!.confidence < LOW_CONFIDENCE) region.push(segments[i++]!);
    const text = region.map((s) => `${s.label} ${s.text}${s.marks !== undefined ? ` (${s.marks} marks)` : ''}`).join('\n');
    const fixed = await askModel(text, 'These questions were extracted from part of an exam paper but may be merged, split wrongly or garbled. Re-split and clean them.');
    const page = region[0]!.page;
    const unit = region[0]!.unit;
    out.push(...fixed.map((s) => ({ ...s, page, unit })));
    regionsRepaired++;
  }
  return { segments: out, regionsRepaired };
}
