// Deterministic classification policy. The AI only proposes a method reading
// (with evidence quotes); the category and the learning path are decided here,
// from the checked answer, the confirmed method and the diagnostic answer.

import type { AnswerStatus, MethodKind, Signal } from './packs/types.js';

export type Category =
  | 'no_attempt'
  | 'ambiguous'
  | 'right_sound'
  | 'valid_alternative'
  | 'right_flawed'
  | 'right_unclear'
  | 'wrong_slip'
  | 'wrong_assumption'
  | 'wrong_unclear';

export type Path = 'clarify' | 'extend' | 'slip' | 'explore';

export interface ClassifyInput {
  status: AnswerStatus;
  hasWorking: boolean;
  /** Kind of the method the student confirmed (or 'unclear'). */
  methodKind: MethodKind;
  /** Whether that method gives the right answer for this case. */
  methodWorks: boolean;
  signal: Signal | null;
}

export function classify(i: ClassifyInput): Category {
  if (i.status === 'empty') return i.hasWorking ? 'ambiguous' : 'no_attempt';
  if (i.status === 'ambiguous' || i.status === 'unparsed') return 'ambiguous';

  if (i.status === 'correct') {
    if (i.methodKind === 'sound') return i.signal === 'assumption' ? 'right_flawed' : 'right_sound';
    if (i.methodKind === 'alternative') return i.methodWorks && i.signal !== 'assumption' ? 'valid_alternative' : 'right_flawed';
    // The shortcut happened to work here: right answer, but the condition is untested.
    if (i.methodKind === 'shortcut') return 'right_flawed';
    return 'right_unclear';
  }

  if (i.status === 'partial') return i.methodKind === 'unclear' ? 'right_unclear' : 'right_flawed';

  if (i.status === 'shortcut') {
    // Needs the shortcut answer AND evidence of the assumption (method or diagnostic).
    if (i.methodKind === 'shortcut' || i.signal === 'assumption') return 'wrong_assumption';
    return 'wrong_unclear';
  }

  // status === 'wrong'
  if (i.methodKind === 'sound' || (i.methodKind === 'alternative' && i.methodWorks)) return 'wrong_slip';
  return 'wrong_unclear';
}

export function pathFor(c: Category): Path {
  switch (c) {
    case 'ambiguous':
      return 'clarify';
    case 'right_sound':
    case 'valid_alternative':
      return 'extend';
    case 'wrong_slip':
      return 'slip';
    default:
      return 'explore';
  }
}

export const CATEGORY_LABEL: Record<Category, string> = {
  no_attempt: 'Not attempted yet',
  ambiguous: 'Answer needs clarifying',
  right_sound: 'Right answer, sound method',
  valid_alternative: 'Right answer, valid alternative method',
  right_flawed: 'Right answer, but the method depends on a condition',
  right_unclear: 'Right answer, method unclear',
  wrong_slip: 'Sound method, calculation slip',
  wrong_assumption: 'Method relies on an assumption that doesn’t hold here',
  wrong_unclear: 'Different answer, method unclear',
};

export const PATH_LABEL: Record<Path, string> = {
  clarify: 'Clarify the answer first',
  extend: 'Extend: test your method on a changed case',
  slip: 'Find the slip, then test the method',
  explore: 'Explore what changed',
};
