import { extractListing } from './extract';
import { matches } from './filters';
import type { State } from './state';
import { tagListings } from './tagging';

const rules = `
  .ms-hidden { display: none !important }
  [data-ms-layout] { display: flex !important; flex-wrap: wrap !important }
  [data-ms-listing-root][style*="--ms-order"] { order: var(--ms-order) !important }
  [data-ms-spacer] { flex: 0 0 100%; width: 100%; grid-column: 1 / -1; pointer-events: none }
`;

export function clearEffects() {
  document.querySelectorAll<HTMLElement>('[data-ms-listing-root]').forEach(root => {
    root.classList.remove('ms-hidden');
    root.style.removeProperty('--ms-order');
    root.removeAttribute('data-ms-listing-root');
  });
  for (const key of ['data-ms-layout', 'data-ms-item-id']) {
    document.querySelectorAll('[' + key + ']').forEach(el => el.removeAttribute(key));
  }
  document.querySelectorAll('[data-ms-spacer], style[data-ms-styles]').forEach(el => el.remove());
}

export function apply(scope: Document | HTMLElement, state: State) {
  // Restore the unfiltered layout before reading visible text or measuring height.
  clearEffects();
  const roots = tagListings(scope);
  const filtering = state.filters.some(f => f.enabled);
  if (!filtering && state.sort === 'none') return { shown: roots.length, total: roots.length };
  const style = document.createElement('style');
  style.dataset.msStyles = '';
  style.textContent = rules;
  document.head.append(style);
  const groups = new Map<HTMLElement, HTMLElement[]>();
  for (const root of roots) {
    const parent = root.parentElement!;
    const group = groups.get(parent) ?? [];
    group.push(root);
    groups.set(parent, group);
  }
  let shown = 0;
  for (const [parent, group] of groups) {
    const cards = group.map(root => ({ root, listing: extractListing(root) }));
    if (state.sort !== 'none') {
      if (!/flex|grid/.test(getComputedStyle(parent).display)) parent.dataset.msLayout = '';
      const direction = state.sort === 'price-asc' ? 1 : -1;
      cards.sort((a, b) => {
        const left = a.listing.price, right = b.listing.price;
        if (left === null || right === null) return Number(left === null) - Number(right === null);
        return direction * (left - right);
      });
      cards.forEach(({ root }, index) => root.style.setProperty('--ms-order', String(index)));
    }
    const rejected = filtering ? cards.filter(({ listing }) => !matches(listing, state)) : [];
    shown += cards.length - rejected.length;
    if (!rejected.length) continue;
    const fullHeight = parent.getBoundingClientRect().height;
    rejected.forEach(({ root }) => root.classList.add('ms-hidden'));
    if (parent.getBoundingClientRect().height >= fullHeight && fullHeight > 0) continue;
    const spacer = document.createElement('div');
    spacer.dataset.msSpacer = '';
    spacer.setAttribute('aria-hidden', 'true');
    spacer.style.order = '2147483647';
    parent.append(spacer);
    // Include any extra grid/flex row gap introduced by the spacer itself.
    spacer.style.height = Math.max(0, fullHeight - parent.getBoundingClientRect().height) + 'px';
  }
  return { shown, total: roots.length };
}
