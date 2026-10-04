import { cancelPack } from './cancel.js';
import { proportionPack } from './proportion.js';
import { speedPack } from './speed.js';
import type { ConceptPack, PackId } from './types.js';

// Packs are generic over their params; the app treats params as opaque values
// that only the owning pack reads.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyPack = ConceptPack<any>;

export const PACKS: Record<PackId, AnyPack> = {
  speed: speedPack,
  cancel: cancelPack,
  proportion: proportionPack,
};

export const PACK_ORDER: PackId[] = ['speed', 'cancel', 'proportion'];

export function getPack(id: string): AnyPack | null {
  return (PACKS as Record<string, AnyPack>)[id] ?? null;
}

export function isPackId(id: unknown): id is PackId {
  return typeof id === 'string' && id in PACKS;
}
