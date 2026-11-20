import type { State } from './state';

export function normalize(value: string) {
  return value.replace(/[\u200b-\u200d\ufeff]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
}

export function matches(listing: { title: string; card: string }, state: State) {
  const text = normalize(listing[state.matchOn]);
  return state.filters.every(filter => {
    const term = normalize(filter.term);
    return !filter.enabled || !term || text.includes(term) === (filter.mode === 'show');
  });
}
