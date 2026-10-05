import Anthropic from '@anthropic-ai/sdk';
import { searchQuestions, parseQuery } from './search';
import { diffSyllabus, getSyllabusCourses, getNotesByCourse, getCourse } from './db';
import type { QuestionHit, SyllabusDiff } from './types';

export type ChatSource = {
  kind: 'question' | 'syllabus' | 'notes';
  label: string;
  detail: string;
};

export type ChatReply = {
  answer: string;
  sources: ChatSource[];
  mode: 'claude' | 'local';
  retrieved: number;
  tookMs: number;
};

const MODEL = 'claude-opus-5';

type Retrieval = {
  intent: 'questions' | 'syllabus-change' | 'notes';
  hits: QuestionHit[];
  diff: SyllabusDiff | null;
  noteMatches: { title: string; kind: string; pages: number; course: string }[];
  explanation: string[];
};

function retrieve(question: string): Retrieval {
  const parsed = parseQuery(question);

  if (parsed.intent === 'syllabus-change') {
    // Prefer an explicit course code; otherwise pick the tracked course whose
    // name/keywords best overlap the question.
    const tracked0 = getSyllabusCourses().map((c) => c.code);
    let courseCode =
      parsed.filters.courseCode ??
      parsed.filters.courseCodes?.find((c) => tracked0.includes(c)) ??
      null;
    if (!courseCode) {
      const tracked = getSyllabusCourses();
      let best: { code: string; score: number } | null = null;
      for (const t of tracked) {
        const haystack = `${t.code} ${t.title}`.toLowerCase();
        let score = 0;
        for (const term of parsed.terms) if (haystack.includes(term)) score += 1;
        if (!best || score > best.score) best = { code: t.code, score };
      }
      if (best && best.score > 0) courseCode = best.code;
    }
    const diff = courseCode ? diffSyllabus(courseCode) : null;
    // Searching the resolved course code surfaces its most-repeated questions,
    // which is more useful alongside a diff than matching the question's wording.
    const hits = searchQuestions(courseCode ?? question, 4).hits;
    return { intent: 'syllabus-change', hits, diff, noteMatches: [], explanation: parsed.explanation };
  }

  const result = searchQuestions(question, 8);

  let noteMatches: Retrieval['noteMatches'] = [];
  const courseForNotes = parsed.filters.courseCode ?? result.hits[0]?.courseCode;
  if (courseForNotes) {
    noteMatches = getNotesByCourse(courseForNotes).map((n) => ({
      title: n.title, kind: n.kind, pages: n.pages, course: n.course_code,
    }));
  }

  return {
    intent: parsed.intent,
    hits: result.hits,
    diff: null,
    noteMatches: noteMatches.slice(0, 3),
    explanation: result.query.explanation,
  };
}

function buildSources(r: Retrieval): ChatSource[] {
  const sources: ChatSource[] = [];
  const seenPapers = new Set<string>();

  if (r.diff) {
    sources.push({
      kind: 'syllabus',
      label: `${r.diff.courseCode} scheme ${r.diff.to.academic_year}`,
      detail: `Effective ${r.diff.to.effective_from}`,
    });
    sources.push({
      kind: 'syllabus',
      label: `${r.diff.courseCode} scheme ${r.diff.from.academic_year}`,
      detail: `Effective ${r.diff.from.effective_from}`,
    });
  }
  for (const hit of r.hits) {
    if (seenPapers.has(hit.paperLabel)) continue;
    seenPapers.add(hit.paperLabel);
    sources.push({
      kind: 'question',
      label: hit.paperLabel,
      detail: `${hit.courseTitle} · ${hit.examType} ${hit.month} ${hit.year}`,
    });
  }
  for (const n of r.noteMatches) {
    sources.push({ kind: 'notes', label: n.title, detail: `${n.kind} · ${n.pages} pages · ${n.course}` });
  }
  return sources.slice(0, 6);
}

/** Deterministic answer assembled from retrieved rows — no model call needed. */
function localAnswer(question: string, r: Retrieval): string {
  if (r.diff) {
    const d = r.diff;
    const lines: string[] = [];
    lines.push(
      `Comparing the ${d.to.academic_year} scheme for ${d.courseCode} (${d.courseTitle}) against ${d.from.academic_year}:`
    );
    if (d.added.length) {
      lines.push('');
      lines.push(`**Added (${d.added.length})**`);
      for (const a of d.added) lines.push(`+ Unit ${a.unit} — ${a.topic}`);
    }
    if (d.removed.length) {
      lines.push('');
      lines.push(`**Removed (${d.removed.length})**`);
      for (const a of d.removed) lines.push(`- Unit ${a.unit} — ${a.topic}`);
    }
    if (d.newUnits.length) {
      lines.push('');
      lines.push(`**New unit${d.newUnits.length > 1 ? 's' : ''}**`);
      for (const u of d.newUnits) lines.push(`• Unit ${u.unit}: ${u.unitTitle} (${u.hours} hours)`);
    }
    lines.push('');
    lines.push(
      `${d.unchangedCount} topics are unchanged, so previous years' questions on those are still worth practising.`
    );
    if (r.hits.length) {
      lines.push('');
      lines.push(`Related questions already in the archive: ${r.hits.length} — see the sources below.`);
    }
    return lines.join('\n');
  }

  if (!r.hits.length) {
    return `I could not find anything matching that in the archive yet. Try a broader phrase (a topic name like "deadlock" or "normalization"), or browse the department pages to see what has been indexed so far.`;
  }

  const years = [...new Set(r.hits.map((h) => h.year))].sort((a, b) => b - a);
  const courses = [...new Set(r.hits.map((h) => h.courseCode))];
  const topicCount = new Map<string, number>();
  for (const h of r.hits) for (const t of h.topics) topicCount.set(t, (topicCount.get(t) ?? 0) + 1);
  const topTopics = [...topicCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);

  const lines: string[] = [];
  lines.push(
    `Found ${r.hits.length} matching question${r.hits.length === 1 ? '' : 's'} across ${courses.join(', ')} ` +
    `spanning ${years[years.length - 1]}–${years[0]}.`
  );
  lines.push('');
  lines.push('**What keeps coming up**');
  for (const [topic, count] of topTopics) {
    lines.push(`• ${topic} — appears in ${count} of these questions`);
  }
  lines.push('');
  lines.push('**Highest-scoring matches**');
  for (const h of r.hits.slice(0, 4)) {
    lines.push(`${h.courseCode} ${h.examType} ${h.year} · Q${h.number} (${h.marks} marks)`);
    lines.push(`   "${h.text}"`);
  }
  const repeated = topTopics[0];
  if (repeated && repeated[1] > 1) {
    lines.push('');
    lines.push(
      `Study order suggestion: start with **${repeated[0]}** — it is the most repeated theme in these papers, ` +
      `then work outward to the lower-frequency topics above.`
    );
  }
  if (r.noteMatches.length) {
    lines.push('');
    lines.push(`Notes available for this course: ${r.noteMatches.map((n) => n.title).join('; ')}.`);
  }
  return lines.join('\n');
}

function buildContext(r: Retrieval): string {
  const parts: string[] = [];
  if (r.diff) {
    const d = r.diff;
    parts.push(`SYLLABUS COMPARISON for ${d.courseCode} (${d.courseTitle})`);
    parts.push(`Older scheme: ${d.from.academic_year}, effective ${d.from.effective_from}`);
    parts.push(`Newer scheme: ${d.to.academic_year}, effective ${d.to.effective_from}`);
    parts.push(`Topics added: ${d.added.map((a) => `Unit ${a.unit} — ${a.topic}`).join('; ') || 'none'}`);
    parts.push(`Topics removed: ${d.removed.map((a) => `Unit ${a.unit} — ${a.topic}`).join('; ') || 'none'}`);
    parts.push(`New units: ${d.newUnits.map((u) => `Unit ${u.unit} ${u.unitTitle} (${u.hours}h)`).join('; ') || 'none'}`);
    parts.push(`Unchanged topic count: ${d.unchangedCount}`);
    parts.push('');
  }
  if (r.hits.length) {
    parts.push('RETRIEVED EXAM QUESTIONS');
    for (const h of r.hits) {
      parts.push(
        `- [${h.courseCode} ${h.courseTitle} | ${h.examType} ${h.month} ${h.year} | Q${h.number} | ` +
        `${h.marks} marks | Unit ${h.unit} | topics: ${h.topics.join(', ')}]\n  ${h.text}`
      );
    }
    parts.push('');
  }
  if (r.noteMatches.length) {
    parts.push('AVAILABLE NOTES');
    for (const n of r.noteMatches) parts.push(`- ${n.title} (${n.kind}, ${n.pages} pages, ${n.course})`);
  }
  return parts.join('\n');
}

const SYSTEM_PROMPT = `You are the study assistant for ConceptQuery, a topic-aware retrieval platform for previous year question papers and academic notes at Ramaiah Institute of Technology.

Answer using ONLY the retrieved context provided in the user message. The context comes from a database of past exam papers and syllabus schemes.

Rules:
- Cite specifics: course codes, exam names, years, marks. Students use these to find the paper.
- If the context does not contain the answer, say so plainly and suggest a better search phrase. Never invent a question, topic, year, or syllabus change.
- When several papers repeat a topic, say so — repetition is the single most useful signal for exam prep.
- Give a concrete study order when the student is clearly revising.
- Be concise and direct. Short paragraphs or bullets, no preamble, no filler encouragement.`;

export async function answerQuestion(question: string): Promise<ChatReply> {
  const started = performance.now();
  const r = retrieve(question);
  const sources = buildSources(r);
  const retrieved = r.hits.length + (r.diff ? 1 : 0) + r.noteMatches.length;

  if (!process.env.ANTHROPIC_API_KEY) {
    return {
      answer: localAnswer(question, r),
      sources,
      mode: 'local',
      retrieved,
      tookMs: Math.round(performance.now() - started),
    };
  }

  try {
    const client = new Anthropic();
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 8000,
      output_config: { effort: 'low' },
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Student question: ${question}\n\n--- RETRIEVED CONTEXT ---\n${buildContext(r)}\n--- END CONTEXT ---`,
        },
      ],
    });

    if (response.stop_reason === 'refusal') {
      return {
        answer: localAnswer(question, r),
        sources, mode: 'local', retrieved,
        tookMs: Math.round(performance.now() - started),
      };
    }

    const answer = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('\n')
      .trim();

    return {
      answer: answer || localAnswer(question, r),
      sources,
      mode: answer ? 'claude' : 'local',
      retrieved,
      tookMs: Math.round(performance.now() - started),
    };
  } catch (error) {
    // The archive answer is still useful when the model call fails, so degrade to it.
    if (error instanceof Anthropic.AuthenticationError) {
      console.error('[chat] ANTHROPIC_API_KEY rejected — falling back to local answer');
    } else if (error instanceof Anthropic.RateLimitError) {
      console.error('[chat] rate limited — falling back to local answer');
    } else if (error instanceof Anthropic.APIError) {
      console.error(`[chat] API error ${error.status} — falling back to local answer`);
    } else {
      console.error('[chat] unexpected error — falling back to local answer', error);
    }
    return {
      answer: localAnswer(question, r),
      sources,
      mode: 'local',
      retrieved,
      tookMs: Math.round(performance.now() - started),
    };
  }
}

export function suggestedQuestions(): string[] {
  const tracked = getSyllabusCourses();
  const course = tracked[0] ? getCourse(tracked[0].code) : undefined;
  return [
    'Show me last 3 years questions on binary tree',
    course ? `How has the ${course.title} syllabus changed from last year?` : 'How has the syllabus changed?',
    'Deadlock questions from CS501',
    'What should I revise first for Operating Systems?',
    'Normalization questions worth 10 marks',
  ];
}
