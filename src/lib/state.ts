import { browser } from 'wxt/browser';
import { normalize } from './filters';

export const docks = ['top-left', 'top-right', 'bottom-left', 'bottom-right'] as const;
export type Mode = 'show' | 'hide';
export interface Filter { id: string; term: string; mode: Mode; enabled: boolean }
export interface State {
  widgetVisible: boolean;
  dock: typeof docks[number];
  sort: 'none' | 'price-asc' | 'price-desc';
  matchOn: 'title' | 'card';
  filters: Filter[];
  /** Show only cards with Facebook's "Just listed" badge. */
  justListed: boolean;
  /** Show only cards inside the radius Marketplace is showing. */
  inRadius: boolean;
  /** Show only cards in the required state. */
  sameState: boolean;
  /** Uppercase state code Same state requires, or '' for the detected one. */
  stateOverride: string;
}
export const defaults: State = { widgetVisible: true, dock: 'top-right', sort: 'none', matchOn: 'title', filters: [],
  justListed: false, inRadius: false, sameState: false, stateOverride: '' };
export type Change = { set: Partial<Omit<State, 'filters'>> } | { add: Filter } |
  { toggle: string } | { flip: string } | { remove: string } | { clear: true };

export function changeState(state: State, action: Change): State {
  if ('set' in action) return { ...state, ...action.set };
  if ('clear' in action) return { ...state, filters: [] };
  if ('add' in action) {
    const term = normalize(action.add.term);
    if (!term || state.filters.some(f => normalize(f.term) === term)) return state;
    return { ...state, filters: [...state.filters, action.add] };
  }
  if ('remove' in action) return { ...state, filters: state.filters.filter(f => f.id !== action.remove) };
  return { ...state, filters: state.filters.map(f => {
    if ('toggle' in action && f.id === action.toggle) return { ...f, enabled: !f.enabled };
    if ('flip' in action && f.id === action.flip) return { ...f, mode: f.mode === 'hide' ? 'show' : 'hide' };
    return f;
  }) };
}
export async function getState(): Promise<State> {
  return { ...defaults, ...((await browser.storage.local.get('marketsift')).marketsift as Partial<State>) };
}
export function subscribe(listener: (state: State) => void) {
  const changed: Parameters<typeof browser.storage.onChanged.addListener>[0] = (changes, area) => {
    if (area === 'local' && changes.marketsift) listener({ ...defaults, ...(changes.marketsift.newValue as Partial<State>) });
  };
  browser.storage.onChanged.addListener(changed);
  return () => browser.storage.onChanged.removeListener(changed);
}
export function update(change: Change) {
  return browser.runtime.sendMessage({ type: 'marketsift:update', change });
}
