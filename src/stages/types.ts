import type { Session } from '../lib/session';

export interface StageProps {
  s: Session;
  update: (patch: Partial<Session>) => void;
  /** Move on. The patch is applied first so the next stage is chosen from fresh state. */
  next: (patch?: Partial<Session>) => void;
}
