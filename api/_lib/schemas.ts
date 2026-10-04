// Output schemas for structured AI responses. Every response is also passed
// through the sanitisers in shared/ai.ts before it reaches the student.

import { z } from 'zod';

export const AssessSchema = z.object({
  methodId: z.string().describe('One of the approved method ids, or "unclear".'),
  quotes: z.array(z.string()).describe('Up to 2 short exact quotes copied from the student’s working or answer that show the method.'),
  confidence: z.enum(['high', 'medium', 'low']),
  noticed: z
    .string()
    .describe('Optional: one short tentative observation addressed to the student as "you" (max 25 words), only if it adds something beyond naming the method. Otherwise an empty string.'),
});

export const InterpretSchema = z.object({
  pack: z.enum(['speed', 'cancel', 'proportion', 'none']),
  speed: z
    .object({
      mode: z.enum(['distance', 'time']),
      a: z.number(),
      b: z.number(),
      s1: z.number(),
      s2: z.number(),
      unit: z.enum(['km', 'mi']),
      who: z.string(),
    })
    .nullable(),
  cancel: z.object({ form: z.enum(['sum', 'product', 'quad']), a: z.number(), b: z.number() }).nullable(),
  proportion: z
    .object({
      ctx: z.enum(['taxi', 'gym', 'plumber', 'generic']),
      fee: z.number(),
      rate: z.number(),
      x1: z.number(),
      x2: z.number(),
    })
    .nullable(),
  missing: z.array(z.string()).describe('What information is missing or unclear, in plain words. Empty if complete.'),
});

export const ReflectSchema = z.object({
  mentionsCondition: z.boolean().describe('True only if the student’s text names the condition that decides whether the method works.'),
  quote: z.string().describe('An exact quote from the student’s text that names the condition, or empty string.'),
  feedback: z.string().describe('Two short sentences at most, written for a 12–15 year old. Friendly, specific and honest; no empty praise; never give away the final answer.'),
  hintId: z.enum(['none', 'h1', 'h2', 'h3']).describe('Which approved hint would help next, or "none".'),
});

export const SummarySchema = z.object({
  summary: z.string().describe('3–4 sentences, second person, grounded only in the facts and quotes given.'),
  evidence: z
    .array(z.object({ quote: z.string().describe('Exact quote from the student’s texts.'), point: z.string().describe('What this quote shows, one sentence.') }))
    .describe('Up to 3 items.'),
  nextStep: z.string().describe('One concrete next step, one sentence.'),
});

export const ReadBoardSchema = z.object({
  working: z
    .string()
    .describe('Everything written on the board, transcribed exactly as written, one line per line of working. Plain text maths: x^2, /, *, sqrt(). Keep the student’s mistakes; never correct, complete or solve anything. Use [?] for a part you cannot read.'),
  answer: z.string().describe('The final answer only if the student clearly marked one (e.g. "= 45", "Ans", boxed or underlined). Otherwise an empty string.'),
  legible: z.boolean().describe('False if the board is blank, is only scribbles, or cannot be read.'),
});
