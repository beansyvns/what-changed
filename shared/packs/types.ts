// The contract every checked concept pack implements. Packs hold all reference
// answers, allowed variations and hint tiers; the AI never invents these.

export type PackId = 'speed' | 'cancel' | 'proportion';

export type Signal = 'sound' | 'assumption' | 'unsure';
/** shortcut: the target method whose validity depends on a condition. */
export type MethodKind = 'shortcut' | 'sound' | 'alternative' | 'unclear';

export interface MethodOption<P = unknown> {
  id: string;
  kind: MethodKind;
  /** Short student-facing label for the "which is closest?" picker. */
  label: string;
  /** Tentative restatement, e.g. "It looks like you added the two speeds and halved the total." */
  restate: string;
  /** Description given to the AI so it can map working to this category. */
  aiHint: string;
  /** Whether this method gives the right answer for a given case. */
  worksFor: (p: P) => boolean;
}

export interface ChoiceOption {
  id: string;
  label: string;
}

export interface ChoiceQuestion {
  question: string;
  options: ChoiceOption[];
  correct: string;
  explain: string;
}

export interface Diagnostic {
  question: string;
  options: { id: string; label: string; signal: Signal }[];
}

/** A piece of question text; marked pieces carry the condition that changes between cases. */
export type Part = string | { mark: string };

export interface Described {
  parts: Part[];
  /** Plain text version of the whole question. */
  text: string;
}

export type AnswerStatus = 'empty' | 'unparsed' | 'ambiguous' | 'correct' | 'partial' | 'shortcut' | 'wrong';

export interface AnswerCheck {
  status: AnswerStatus;
  /** How the app read the answer, shown back to the student. */
  read: string;
  /** Neutral explanation of the check, shown after clarification. */
  note: string;
}

export interface Solution {
  display: string;
  steps: string[];
}

export interface Hint {
  tier: 1 | 2 | 3;
  id: string;
  label: string;
  text: string;
}

export interface SlipStep {
  id: string;
  label: string;
  kind: 'number' | 'expr';
  expected: number | string;
  unit?: string;
}

export interface Statement {
  id: string;
  text: string;
  kind: 'both' | 'depends';
  why: string;
}

export interface SampleWork {
  answer: string;
  working: string;
}

export interface Focus<P> {
  id: string;
  /** e.g. "averaging the two speeds" */
  name: string;
  works: (p: P) => boolean;
  /** Value the method produces for a case, as display text. */
  result: (p: P) => string;
}

export interface ConceptPack<P> {
  id: PackId;
  title: string;
  distinction: string;
  subject: string;
  blurb: string;
  /** The condition question this pack is about. */
  coreQuestion: string;
  /** One-sentence learning distinction for the report. */
  rule: string;
  answerKind: 'number' | 'expression';
  example: P;
  sampleWork: SampleWork;
  methods: MethodOption<P>[];
  /** Validate params from an untrusted source (own entry / AI). */
  validate(raw: unknown): P | null;
  describe(p: P): Described;
  unitLabel(p: P): string;
  solve(p: P): Solution;
  /** The method whose condition this case tests. Defaults to the shortcut. */
  focus(methodId?: string): Focus<P>;
  /** A related case with one meaningful change that flips whether the focus method works. */
  contrast(p: P, focusId?: string): P;
  /** Plain-language "why" for one case, using its actual numbers (2–3 short sentences). */
  explainCase(p: P, focusId?: string): string[];
  whatChanged(a: P, b: P): ChoiceQuestion;
  /** A change that does NOT break the sound method (avoid "every change matters"). */
  preserve(p: P): { change: string } & ChoiceQuestion;
  /** Pack-specific test prediction, asked for both cases. */
  testPrediction(p: P): ChoiceQuestion;
  statements: Statement[];
  ruleQuestion: ChoiceQuestion;
  diagnostic(p: P): Diagnostic;
  hints(p: P, role: 'repair' | 'transfer'): Hint[];
  prerequisite: { title: string; body: string[] };
  slipSteps(p: P): SlipStep[];
  checkAnswer(p: P, answer: string, exclusions?: string): AnswerCheck;
  /** Deterministic reading of the working (used in demo mode and as an AI cross-check). */
  detectMethod(p: P, working: string, answer: string): { methodId: string; quotes: string[] };
  transfers: P[];
  followup(t: P): P;
  harder: P;
  /** Try to read a typed question into checked params; null if unsupported. */
  parseQuestion(text: string): { params: P | null; partial?: Partial<P>; missing?: string[] } | null;
  key(p: P): string;
}
