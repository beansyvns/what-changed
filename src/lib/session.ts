// Session state: everything the report is built from. Nothing here is sent
// anywhere or saved; refreshing the page starts over.

import type { AssessResult, ReflectResult, SummaryResult } from '../../shared/ai';
import type { AnyPack } from '../../shared/packs/index';
import { getPack } from '../../shared/packs/index';
import type { AnswerCheck, PackId, Signal } from '../../shared/packs/types';
import type { Category, Path } from '../../shared/policy';
import type { Source } from './api';

export type Stage = 'attempt' | 'confirm' | 'slip' | 'compare' | 'transfer';

export interface Attempt {
  answer: string;
  working: string;
  exclusions: string;
}

export interface PredictionRecord {
  label: string;
  predicted: string;
  actual: string;
  correct: boolean;
}

export interface CompareRecord {
  /** The one prediction made before the reveal. */
  prediction: PredictionRecord;
  /** The reason the student picked for when the method works. */
  reason: { label: string; correct: boolean };
  /** Optional: the reason in their own words. */
  evidence: string;
  feedback?: ReflectResult & { source: Source };
}

export type TransferOutcome = 'independent' | 'hint' | 'explanation' | 'not_yet';

export interface TransferRecord {
  params: unknown;
  attempt: Attempt;
  check: AnswerCheck;
  hintsUsed: number;
  sawExplanation: boolean;
  outcome: TransferOutcome;
  reflection: string;
  /** The whiteboard, if the student drew their working (JPEG data URL, in memory only). */
  board?: string;
  feedback?: ReflectResult & { source: Source };
  followup?: { params: unknown; prediction: string; predictionCorrect: boolean; check: AnswerCheck };
}

export interface Session {
  packId: PackId;
  params: unknown;
  source: 'example' | 'own' | 'harder';
  stage: Stage;
  attempt: Attempt;
  /** The first attempt's whiteboard, if the student drew their working (JPEG data URL, kept in memory only). */
  board?: string;
  check?: AnswerCheck;
  noAttempt?: boolean;
  assess?: AssessResult & { source: Source; note?: string };
  confirmed?: { methodId: string; how: 'agreed' | 'picked' };
  diagnostic?: { optionId: string; label: string; signal: Signal };
  category?: Category;
  path?: Path;
  slip?: { firstWrong: string | null; fixed: boolean };
  compare?: CompareRecord;
  transfer?: TransferRecord;
  summary?: SummaryResult & { source: Source; note?: string };
}

export const OUTCOME_LABEL: Record<TransferOutcome, string> = {
  independent: 'Completed independently',
  hint: 'Completed with a hint',
  explanation: 'Completed after explanation',
  not_yet: 'Not yet',
};

export function newSession(packId: PackId, params: unknown, source: Session['source']): Session {
  return { packId, params, source, stage: 'attempt', attempt: { answer: '', working: '', exclusions: '' } };
}

export function packOf(s: Session): AnyPack {
  return getPack(s.packId)!;
}

/** Stages this session will go through, given its path. */
export function stagesFor(s: Session): Stage[] {
  if (s.noAttempt) return ['attempt', 'compare', 'transfer'];
  switch (s.path) {
    case 'extend':
      return ['attempt', 'confirm', 'compare', 'transfer'];
    case 'slip':
      return ['attempt', 'confirm', 'slip', 'compare', 'transfer'];
    default:
      return ['attempt', 'confirm', 'compare', 'transfer'];
  }
}

export const STAGE_LABEL: Record<Stage, string> = {
  attempt: 'Try it',
  confirm: 'Check',
  slip: 'Find the slip',
  compare: 'Test it',
  transfer: 'Your turn',
};

/** One plain sentence at the top of each step: what you do here, and why. */
export const STAGE_INTRO: Record<Stage, string> = {
  attempt: 'Solve the question your way and show your working. It’s not marked — it just shows the app how you think.',
  confirm: 'Make sure the app understood what you did.',
  slip: 'Your method is right! Let’s find the small mistake.',
  compare: 'Here’s a question that’s almost the same. Will your method still work?',
  transfer: 'A new question with the same idea. Use what you just found.',
};

export function nextStage(s: Session): Stage | 'report' {
  const list = stagesFor(s);
  const i = list.indexOf(s.stage);
  return i >= 0 && i < list.length - 1 ? list[i + 1] : 'report';
}

/** The transfer problem: the first one that isn't the question just practised. */
export function transferParams(s: Session): unknown {
  const pack = packOf(s);
  const k = pack.key(s.params);
  const contrastKey = pack.key(pack.contrast(s.params));
  return pack.transfers.find((t) => pack.key(t) !== k && pack.key(t) !== contrastKey) ?? pack.transfers[0];
}
