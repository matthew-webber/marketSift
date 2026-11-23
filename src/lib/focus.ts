import { hasJustListedBadge } from './location';
import type { State } from './state';

/** Location facts resolved before the synchronous apply pass. */
export interface FocusContext {
  centerLabel: string;
  radiusMiles: number | null;
  /** State of the Marketplace location Facebook is showing, uppercase. */
  detectedState: string;
  /** The state Same state requires: the override, else the detected one. */
  requiredState: string;
  /** Item ids judged outside the current radius. */
  outside: ReadonlySet<string>;
  /** Uppercase state per item id, where the card's location parsed. */
  cardStates: ReadonlyMap<string, string>;
}

export const showOnlyCount = (state: State) => Number(state.justListed) + Number(state.inRadius) + Number(state.sameState);
export const needsLocation = (state: State) => state.inRadius || state.sameState;

export function itemIdOf(root: HTMLElement) {
  const anchor = root.matches('a[data-ms-item-id]') ? root : root.querySelector<HTMLElement>('a[data-ms-item-id]');
  return anchor?.dataset.msItemId ?? null;
}

/**
 * Each enabled show-only filter can only veto. Anything a filter can't judge,
 * such as a card with no readable location, stays visible.
 */
export function keepByFocus(root: HTMLElement, state: State, ctx?: FocusContext) {
  if (state.justListed && !hasJustListedBadge(root)) return false;
  if (!ctx || !needsLocation(state)) return true;
  const id = itemIdOf(root);
  if (!id) return true;
  if (state.inRadius && ctx.radiusMiles && ctx.outside.has(id)) return false;
  const cardState = ctx.cardStates.get(id);
  return !(state.sameState && ctx.requiredState && cardState && cardState !== ctx.requiredState);
}
