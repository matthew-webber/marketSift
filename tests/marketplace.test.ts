import { beforeEach, describe, expect, it, vi } from 'vitest';
import fixture from './fixtures/marketplace.html?raw';
import { apply, clearEffects } from '../src/lib/apply';
import { extractListing } from '../src/lib/extract';
import { matches } from '../src/lib/filters';
import { parseListingPrice } from '../src/lib/price';
import { getMainScope } from '../src/lib/scope';
import { tagListings } from '../src/lib/tagging';
import { changeState, defaults, type Filter } from '../src/lib/state';
import { isMarketplaceContext } from '../src/lib/marketplaceContext';

vi.mock('wxt/browser', () => ({ browser: {} }));
beforeEach(() => { clearEffects(); document.body.innerHTML = fixture; });
const rule = (term: string, mode: Filter['mode'] = 'show', enabled = true): Filter =>
  ({ id: term, term, mode, enabled });

describe('prices', () => {
  it.each([['Free', 0], ['US$1,200.50', 1200.5], ['GBP 22', 22], ['pending', null], ['', null]])(
    'parses %s', (text, price) => expect(parseListingPrice(String(text))).toBe(price));
  it('uses the current price on a discounted card', () => {
    const roots = tagListings(getMainScope());
    expect(roots.map(extractListing).find(card => card.title.includes('Price Drop'))?.price).toBe(189);
  });
});

it('applies AND, hide precedence, disabled terms, normalization and match target', () => {
  const listing = { title: 'Wood Desk', card: 'Wood Desk in Oakland' };
  const state = { ...defaults, filters: [rule('WOOD'), rule('d\u200besk'), rule('oak', 'hide', false)] };
  expect(matches(listing, state)).toBe(true);
  expect(matches(listing, { ...state, filters: [...state.filters, rule(' desk ', 'hide')] })).toBe(false);
  state.filters.push(rule('in   Oakland'));
  expect(matches(listing, state)).toBe(false);
  expect(matches(listing, { ...state, matchOn: 'card' })).toBe(true);
});
it('ignores blank and duplicate terms', () => {
  const state = changeState(defaults, { add: rule('Red   Chair') });
  expect(changeState(state, { add: rule('red chair', 'hide') })).toBe(state);
  expect(changeState(state, { add: rule('   ') })).toBe(state);
});
it('tags fixture roots without modifying SmartBrowse markers', () => {
  const roots = tagListings(getMainScope());
  expect(roots).toHaveLength(7);
  expect(roots.every(root => root.parentElement?.className === 'marketplace-grid')).toBe(true);
  clearEffects();
  expect(document.querySelector('[data-ms-item-id]')).toBeNull();
  expect(document.querySelector('[data-sb-item-id]')).toBeTruthy();
});
it('stops at scope, role main descendants and the 25-step limit', () => {
  const grid = document.querySelector('.marketplace-grid') as HTMLElement;
  const card = grid.firstElementChild as HTMLElement;
  expect(tagListings(card)).toEqual([]);
  card.append(Object.assign(document.createElement('div'), { role: 'main' }));
  expect(tagListings(grid)).not.toContain(card);
  card.lastElementChild!.remove();
  card.innerHTML = '<div>'.repeat(25) + '<a href="/marketplace/item/deep">Deep</a>' + '</div>'.repeat(25);
  expect(tagListings(grid)).not.toContain(card);
});
it('sorts both ways with stable ties, merges new cards and restores native styles', () => {
  const grid = document.querySelector('.marketplace-grid') as HTMLElement;
  grid.innerHTML = ['$5', 'Pending', '$5', 'Free', '$80', '$3'].map((price, i) =>
    `<div><a href="/marketplace/item/${i}"><span dir="auto">${price}</span></a></div>`).join('');
  const order = () => [...grid.children].map(el => Number((el as HTMLElement).style.getPropertyValue('--ms-order')));
  apply(grid, { ...defaults, sort: 'price-asc' });
  expect(order()).toEqual([2, 5, 3, 0, 4, 1]);
  grid.insertAdjacentHTML('beforeend', '<div><a href="/marketplace/item/new"><span dir="auto">$9</span></a></div>');
  apply(grid, { ...defaults, sort: 'price-desc' });
  expect(order()).toEqual([2, 6, 3, 5, 0, 4, 1]);
  apply(grid, defaults);
  expect(grid.querySelector('[style*="--ms-order"]')).toBeNull();
  expect(grid.hasAttribute('data-ms-layout')).toBe(false);
});
it('compensates for lost height and leaves the spacer last', () => {
  const grid = document.querySelector('.marketplace-grid') as HTMLElement;
  vi.spyOn(grid, 'getBoundingClientRect').mockImplementation(() =>
    ({ height: grid.querySelector('.ms-hidden') ? 120 : 500 } as DOMRect));
  const state = { ...defaults, filters: [rule('Standing Desk')] };
  expect(apply(grid, state)).toEqual({ shown: 1, total: 7 });
  expect(apply(grid, state)).toEqual({ shown: 1, total: 7 });
  const spacer = grid.lastElementChild as HTMLElement;
  expect(spacer.dataset.msSpacer).toBeDefined();
  expect(spacer.style.order).toBe('2147483647');
  expect(spacer.style.height).toBe('380px');
  clearEffects();
  expect(grid.querySelector('.ms-hidden, [data-ms-spacer]')).toBeNull();
});
it('gates Facebook SPA routes', () => {
  const route = (pathname: string) => isMarketplaceContext({ hostname: 'www.facebook.com', pathname });
  expect(route('/marketplace/search')).toBe(true);
  expect(route('/marketplaces')).toBe(false);
  expect(route('/')).toBe(false);
});
