import { extractListing } from './extract';
import { matches } from './filters';
import { keepByFocus, showOnlyCount, type FocusContext } from './focus';
import type { State } from './state';
import { tagListings } from './tagging';

const rules = `
  .ms-hidden { display: none !important }
  [data-ms-layout] { display: flex !important; flex-wrap: wrap !important }
  [data-ms-listing-root][style*="--ms-order"] { order: var(--ms-order) !important }
  [data-ms-spacer] { flex: 0 0 100%; width: 100%; grid-column: 1 / -1; pointer-events: none }
`;

function resetCard(root: HTMLElement) {
  root.classList.remove('ms-hidden');
  root.style.removeProperty('--ms-order');
  root.removeAttribute('data-ms-listing-root');
}

function resetCards() {
  document.querySelectorAll<HTMLElement>('[data-ms-listing-root]').forEach(resetCard);
  for (const key of ['data-ms-layout', 'data-ms-item-id']) {
    document.querySelectorAll('[' + key + ']').forEach(el => el.removeAttribute(key));
  }
}

export function clearEffects() {
  resetCards();
  document.querySelectorAll('[data-ms-spacer], style[data-ms-styles]').forEach(el => el.remove());
}

export function apply(scope: Document | HTMLElement, state: State, focus?: FocusContext) {
  // Restore the unfiltered layout before reading visible text or measuring height.
  const filtering = state.filters.some(f => f.enabled) || showOnlyCount(state) > 0;
  if (!filtering && state.sort === 'none') {
    clearEffects();
    const total = tagListings(scope).length;
    return { shown: total, total };
  }
  const roots = tagListings(scope);
  const current = new Set(roots);
  document.querySelectorAll<HTMLElement>('[data-ms-listing-root]').forEach(root => {
    if (!current.has(root)) resetCard(root);
    else if (root.classList.contains('ms-hidden')) root.classList.remove('ms-hidden');
  });
  const parents = new Set(roots.map(root => root.parentElement));
  document.querySelectorAll<HTMLElement>('[data-ms-layout]').forEach(parent => {
    if (state.sort === 'none' || !parents.has(parent)) parent.removeAttribute('data-ms-layout');
  });
  if (state.sort === 'none') roots.forEach(root => root.style.removeProperty('--ms-order'));
  if (!document.querySelector('style[data-ms-styles]')) {
    const style = document.createElement('style');
    style.dataset.msStyles = '';
    style.textContent = rules;
    document.head.append(style);
  }
  // Keep spacer nodes stable so other extensions don't see a new listing page
  // on every pass. Exclude them from the baseline height measurement.
  const unused = new Set(document.querySelectorAll<HTMLElement>('[data-ms-spacer]'));
  for (const spacer of unused) spacer.style.display = 'none';
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
      // Unranked siblings include Facebook's infinite-scroll sentinel. Keep
      // loaded cards before it, even while a subsequent page is being tagged.
      cards.forEach(({ root }, index) => {
        const rank = String(index - cards.length);
        if (root.style.getPropertyValue('--ms-order') !== rank) root.style.setProperty('--ms-order', rank);
      });
    }
    const rejected = filtering ? cards.filter(({ root, listing }) =>
      !matches(listing, state) || !keepByFocus(root, state, focus)) : [];
    shown += cards.length - rejected.length;
    if (!rejected.length) continue;
    const fullHeight = parent.getBoundingClientRect().height;
    rejected.forEach(({ root }) => root.classList.add('ms-hidden'));
    if (parent.getBoundingClientRect().height >= fullHeight && fullHeight > 0) continue;
    const spacer = parent.querySelector<HTMLElement>(':scope > [data-ms-spacer]') ?? document.createElement('div');
    unused.delete(spacer);
    spacer.dataset.msSpacer = '';
    spacer.setAttribute('aria-hidden', 'true');
    spacer.style.order = '2147483647';
    spacer.style.display = '';
    spacer.style.height = '0px';
    if (spacer.parentElement !== parent) parent.append(spacer);
    // CSS order puts the spacer last in flex/grid. In normal flow move it only
    // when Facebook has actually appended cards after it.
    else if (group.some(root => spacer.compareDocumentPosition(root) & Node.DOCUMENT_POSITION_FOLLOWING)) parent.append(spacer);
    // Include any extra grid/flex row gap introduced by the spacer itself.
    spacer.style.height = Math.max(0, fullHeight - parent.getBoundingClientRect().height) + 'px';
  }
  for (const spacer of unused) spacer.remove();
  return { shown, total: roots.length };
}
