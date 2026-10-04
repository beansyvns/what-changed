// The AI task contract shared by the browser and the server, plus the
// deterministic "checked" implementations used in demo mode and as fallbacks.
// Every AI result is passed through the same sanitisers before it is shown:
// method ids must be approved, quotes must really appear in the student's text.

import { getPack, isPackId, PACK_ORDER } from './packs/index.js';
import type { PackId } from './packs/types.js';
import { isQuoteOf } from './text.js';

export const LIMITS = {
  answer: 200,
  working: 1500,
  text: 1200,
  question: 600,
  bodyBytes: 12000,
  /** A whiteboard snapshot as a data URL (a downscaled JPEG is usually 30–150 kB). */
  image: 600_000,
  imageBodyBytes: 620_000,
};

/** Only small PNG/JPEG data URLs are accepted as whiteboard images. */
export const IMAGE_DATA_URL = /^data:image\/(?:png|jpeg);base64,[A-Za-z0-9+/]+=*$/;

export type Confidence = 'high' | 'medium' | 'low';

export interface AssessRequest {
  task: 'assess_attempt';
  pack: PackId;
  params: unknown;
  answer: string;
  working: string;
}
export interface AssessResult {
  methodId: string;
  quotes: string[];
  confidence: Confidence;
  /** One short neutral observation, tentative wording. Empty when none. */
  noticed: string;
}

export interface InterpretRequest {
  task: 'interpret_question';
  text: string;
}
export interface InterpretResult {
  pack: PackId | null;
  params: unknown | null;
  missing: string[];
}

export type ReflectStage = 'compare' | 'repair' | 'transfer';
export interface ReflectRequest {
  task: 'reflect_feedback';
  pack: PackId;
  params: unknown;
  stage: ReflectStage;
  prompt: string;
  text: string;
}
export interface ReflectResult {
  mentionsCondition: boolean;
  quote: string;
  feedback: string;
  hintId: 'none' | 'h1' | 'h2' | 'h3';
}

export interface SummaryFacts {
  originalStatus: string;
  category: string;
  confirmedMethod: string;
  predictionsCorrect: number;
  predictionsTotal: number;
  repairStatus: string | null;
  hintsUsed: number;
  transferOutcome: string;
  transferQuestion: string;
}
export interface SummaryRequest {
  task: 'session_summary';
  pack: PackId;
  facts: SummaryFacts;
  /** The student's own words, labelled by where they were written. */
  texts: { label: string; text: string }[];
}
export interface SummaryResult {
  summary: string;
  evidence: { quote: string; point: string }[];
  nextStep: string;
}

export interface ReadBoardRequest {
  task: 'read_board';
  pack: PackId;
  params: unknown;
  /** The whiteboard as a PNG/JPEG data URL. */
  image: string;
}
export interface ReadBoardResult {
  /** The working as written on the board, line by line. The student checks and edits it. */
  working: string;
  /** The final answer if one is clearly marked on the board, else empty. */
  answer: string;
  /** False when the board is blank or can't be read. */
  legible: boolean;
}

export type TutorRequest = AssessRequest | InterpretRequest | ReflectRequest | SummaryRequest | ReadBoardRequest;
export type TutorTask = TutorRequest['task'];
export const TASKS: TutorTask[] = ['assess_attempt', 'interpret_question', 'reflect_feedback', 'session_summary', 'read_board'];

// ---------------- Request validation (server and client) ----------------

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : '');

export function parseTutorRequest(raw: unknown): TutorRequest | string {
  if (!raw || typeof raw !== 'object') return 'Request body must be a JSON object.';
  const r = raw as Record<string, unknown>;
  switch (r.task) {
    case 'assess_attempt': {
      if (!isPackId(r.pack)) return 'Unknown concept pack.';
      const params = getPack(r.pack)!.validate(r.params);
      if (!params) return 'Question parameters are not valid for this pack.';
      return { task: 'assess_attempt', pack: r.pack, params, answer: str(r.answer, LIMITS.answer), working: str(r.working, LIMITS.working) };
    }
    case 'interpret_question': {
      const text = str(r.text, LIMITS.question).trim();
      if (!text) return 'Question text is empty.';
      return { task: 'interpret_question', text };
    }
    case 'reflect_feedback': {
      if (!isPackId(r.pack)) return 'Unknown concept pack.';
      const params = getPack(r.pack)!.validate(r.params);
      if (!params) return 'Question parameters are not valid for this pack.';
      const stage = r.stage === 'compare' || r.stage === 'repair' || r.stage === 'transfer' ? r.stage : null;
      if (!stage) return 'Unknown stage.';
      const text = str(r.text, LIMITS.text).trim();
      if (!text) return 'Nothing to give feedback on yet.';
      return { task: 'reflect_feedback', pack: r.pack, params, stage, prompt: str(r.prompt, 300), text };
    }
    case 'session_summary': {
      if (!isPackId(r.pack)) return 'Unknown concept pack.';
      const f = (r.facts ?? {}) as Record<string, unknown>;
      const facts: SummaryFacts = {
        originalStatus: str(f.originalStatus, 40),
        category: str(f.category, 40),
        confirmedMethod: str(f.confirmedMethod, 120),
        predictionsCorrect: Math.max(0, Math.min(20, Number(f.predictionsCorrect) || 0)),
        predictionsTotal: Math.max(0, Math.min(20, Number(f.predictionsTotal) || 0)),
        repairStatus: f.repairStatus == null ? null : str(f.repairStatus, 40),
        hintsUsed: Math.max(0, Math.min(20, Number(f.hintsUsed) || 0)),
        transferOutcome: str(f.transferOutcome, 60),
        transferQuestion: str(f.transferQuestion, 300),
      };
      const texts = Array.isArray(r.texts)
        ? r.texts
            .slice(0, 8)
            .map((t) => ({ label: str((t as Record<string, unknown>)?.label, 60), text: str((t as Record<string, unknown>)?.text, LIMITS.text) }))
            .filter((t) => t.text.trim())
        : [];
      return { task: 'session_summary', pack: r.pack, facts, texts };
    }
    case 'read_board': {
      if (!isPackId(r.pack)) return 'Unknown concept pack.';
      const params = getPack(r.pack)!.validate(r.params);
      if (!params) return 'Question parameters are not valid for this pack.';
      if (typeof r.image !== 'string' || r.image.length > LIMITS.image || !IMAGE_DATA_URL.test(r.image)) return 'The whiteboard image is missing or too large.';
      return { task: 'read_board', pack: r.pack, params, image: r.image };
    }
    default:
      return 'Unknown task.';
  }
}

// ---------------- Sanitisers: applied to every AI output ----------------

const clip = (s: unknown, max: number) => (typeof s === 'string' ? s.replace(/\s+/g, ' ').trim().slice(0, max) : '');

export function sanitizeAssess(req: AssessRequest, raw: Partial<AssessResult> | null | undefined): AssessResult {
  const pack = getPack(req.pack)!;
  const ids = pack.methods.map((m) => m.id);
  const source = `${req.working}\n${req.answer}`;
  let methodId = typeof raw?.methodId === 'string' && ids.includes(raw.methodId) ? raw.methodId : 'unclear';
  const quotes = (Array.isArray(raw?.quotes) ? raw!.quotes : [])
    .map((q) => clip(q, 160).replace(/^["'“”‘’]+|["'“”‘’]+$/g, ''))
    .filter((q) => isQuoteOf(q, source))
    .slice(0, 2);
  let confidence: Confidence = raw?.confidence === 'high' || raw?.confidence === 'medium' ? raw.confidence : 'low';
  // A method claim with no verifiable evidence is downgraded.
  if (methodId !== 'unclear' && quotes.length === 0) confidence = 'low';
  if (!req.working.trim() && !req.answer.trim()) methodId = 'unclear';
  return { methodId, quotes, confidence, noticed: clip(raw?.noticed, 220) };
}

export function sanitizeInterpret(raw: Partial<InterpretResult> | null | undefined): InterpretResult {
  const missing = (Array.isArray(raw?.missing) ? raw!.missing : []).map((m) => clip(m, 100)).filter(Boolean).slice(0, 4);
  if (!raw || !isPackId(raw.pack)) return { pack: null, params: null, missing };
  const params = getPack(raw.pack)!.validate(raw.params);
  return { pack: raw.pack, params, missing: params ? [] : missing.length ? missing : ['some numbers in the question'] };
}

export function sanitizeReflect(req: ReflectRequest, raw: Partial<ReflectResult> | null | undefined): ReflectResult {
  const quote = clip(raw?.quote, 200).replace(/^["'“”‘’]+|["'“”‘’]+$/g, '');
  const validQuote = quote && isQuoteOf(quote, req.text) ? quote : '';
  const mentionsCondition = !!raw?.mentionsCondition && !!validQuote;
  // Never push a hint at a student who already named the condition, and never
  // reveal the worked explanation unasked: the student chooses "Show explanation".
  const proposed = raw?.hintId === 'h1' || raw?.hintId === 'h2' || raw?.hintId === 'h3' ? raw.hintId : 'none';
  const hintId = mentionsCondition ? 'none' : proposed === 'h3' ? 'h2' : proposed;
  return {
    mentionsCondition,
    quote: validQuote,
    feedback: clip(raw?.feedback, 320) || 'Thanks — compare your explanation with the two cases above.',
    hintId,
  };
}

export function sanitizeSummary(req: SummaryRequest, raw: Partial<SummaryResult> | null | undefined): SummaryResult {
  const all = req.texts.map((t) => t.text).join('\n');
  const evidence = (Array.isArray(raw?.evidence) ? raw!.evidence : [])
    .map((e) => ({ quote: clip(e?.quote, 200).replace(/^["'“”‘’]+|["'“”‘’]+$/g, ''), point: clip(e?.point, 200) }))
    .filter((e) => e.quote && e.point && isQuoteOf(e.quote, all))
    .slice(0, 3);
  const fallback = checkedSummary(req);
  return {
    summary: clip(raw?.summary, 600) || fallback.summary,
    evidence,
    nextStep: clip(raw?.nextStep, 240) || fallback.nextStep,
  };
}

export function sanitizeReadBoard(raw: Partial<ReadBoardResult> | null | undefined): ReadBoardResult {
  // Keep line breaks (the working is shown line by line) but strip anything odd.
  const working = (typeof raw?.working === 'string' ? raw.working : '')
    .replace(/\r\n?/g, '\n')
    .replace(/[^\S\n]+/g, ' ')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .join('\n')
    .slice(0, LIMITS.working);
  const answer = clip(raw?.answer, LIMITS.answer);
  return { working, answer, legible: !!raw?.legible && !!(working || answer) };
}

// ---------------- Checked (deterministic) implementations ----------------

/** Words that show a student is talking about the condition that matters in each pack. */
export const CONDITION_WORDS: Record<PackId, RegExp> = {
  speed: /\b(time|times|hours?|longer|equal|same\s+(?:amount\s+of\s+)?time|weight\w*|total\s+distance|total\s+time|slower)\b/i,
  cancel: /\b(factors?|multipl\w*|added|adding|add|plus|sum|term|terms|times|whole\s+(?:top|bottom))\b/i,
  proportion: /\b(fee|fixed|zero|\$?0\b|once|starting|start|base|proportional|per\s+(?:km|hour|month|unit))\b/i,
};

function sentenceWith(text: string, re: RegExp): string {
  const sentences = text.split(/(?<=[.!?])\s+|\n+/).map((s) => s.trim()).filter(Boolean);
  const hit = sentences.find((s) => re.test(s));
  return hit ? hit.slice(0, 200) : '';
}

export function checkedAssess(req: AssessRequest): AssessResult {
  const pack = getPack(req.pack)!;
  const d = pack.detectMethod(req.params, req.working, req.answer);
  return sanitizeAssess(req, { methodId: d.methodId, quotes: d.quotes, confidence: d.quotes.length ? 'medium' : 'low', noticed: '' });
}

export function checkedInterpret(text: string): InterpretResult {
  let best: InterpretResult = { pack: null, params: null, missing: [] };
  for (const id of PACK_ORDER) {
    const r = getPack(id)!.parseQuestion(text);
    if (!r) continue;
    if (r.params) return { pack: id, params: r.params, missing: [] };
    if (!best.pack) best = { pack: id, params: null, missing: r.missing ?? [] };
  }
  return best;
}

export function checkedReflect(req: ReflectRequest): ReflectResult {
  const re = CONDITION_WORDS[req.pack];
  const quote = sentenceWith(req.text, re);
  if (quote)
    return {
      mentionsCondition: true,
      quote,
      feedback: 'You pointed at the condition that changes between the cases. Check it against the visual: does it explain why one case works and the other doesn’t?',
      hintId: 'none',
    };
  return {
    mentionsCondition: false,
    quote: '',
    feedback:
      req.stage === 'transfer'
        ? 'Try naming the condition you checked before choosing a method.'
        : 'Your explanation doesn’t name what changed between the cases yet. Look at the highlighted part of each question — what is different, and why does it matter?',
    hintId: 'h1',
  };
}

export function checkedSummary(req: SummaryRequest): SummaryResult {
  const pack = getPack(req.pack)!;
  const f = req.facts;
  const parts: string[] = [];
  if (f.originalStatus === 'no attempt') parts.push('You skipped the first question, and that’s okay.');
  else parts.push(f.originalStatus === 'correct' ? 'Your first answer was right.' : `Your first answer wasn’t right yet — you used “${f.confirmedMethod.toLowerCase()}”.`);
  if (f.predictionsTotal) parts.push(f.predictionsCorrect === f.predictionsTotal ? 'In “Test it” you guessed right.' : 'In “Test it” the result surprised you — that’s how you learn when a shortcut works.');
  if (f.repairStatus) parts.push(f.repairStatus === 'correct' ? 'Your revised attempt was right.' : 'Your revised attempt is still worth another look.');
  parts.push(`On your own question: ${f.transferOutcome.toLowerCase()}.`);
  const re = CONDITION_WORDS[req.pack];
  const evidence = req.texts
    .map((t) => ({ t, q: sentenceWith(t.text, re) }))
    .filter((x) => x.q)
    .slice(0, 2)
    .map((x) => ({ quote: x.q, point: `Here you named what makes the method work.` }));
  const next =
    /independently/i.test(f.transferOutcome) ? 'Try a harder one, or another topic.' : `Next time, check first: ${pack.coreQuestion.charAt(0).toLowerCase() + pack.coreQuestion.slice(1)}`;
  return { summary: parts.join(' '), evidence, nextStep: next };
}

/** Without AI nothing can read a drawing: say so, and the student types their working instead. */
export function checkedReadBoard(): ReadBoardResult {
  return { working: '', answer: '', legible: false };
}

export function runChecked(req: TutorRequest): AssessResult | InterpretResult | ReflectResult | SummaryResult | ReadBoardResult {
  switch (req.task) {
    case 'assess_attempt':
      return checkedAssess(req);
    case 'interpret_question':
      return checkedInterpret(req.text);
    case 'reflect_feedback':
      return checkedReflect(req);
    case 'session_summary':
      return checkedSummary(req);
    case 'read_board':
      return checkedReadBoard();
  }
}
