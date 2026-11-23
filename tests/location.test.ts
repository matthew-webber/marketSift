import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  detectLocationFromPage, findOutOfScopeSection, haversineMiles, hasJustListedBadge, locationsShareCity,
  parseCardLocationFromAriaLabel, parseCardLocationFromTextLines, parseDistanceAwayMiles, parseLocationSummary,
  parseRadiusValueMiles, parseStaticMapCenter, radiusHideThresholdMiles,
} from '../src/lib/location';
import { lookupLocation, stateOf } from '../src/lib/places';

const storage: Record<string, unknown> = {};
const sendMessage = vi.fn();
vi.mock('wxt/browser', () => ({ browser: {
  runtime: { sendMessage: (message: unknown) => sendMessage(message) },
  storage: { local: {
    get: async (key: string) => ({ [key]: storage[key] }),
    set: async (value: Record<string, unknown>) => Object.assign(storage, value),
  } },
} }));

beforeEach(() => { document.body.innerHTML = ''; });

describe('card locations', () => {
  it('reads the aria-label first, then the bottom-most City, ST line', () => {
    expect(parseCardLocationFromAriaLabel('Fender Telecaster (With Case), $325, North Charleston, SC, listing 185'))
      .toEqual({ key: 'north charleston, sc', state: 'SC' });
    expect(parseCardLocationFromAriaLabel('Desk, $20')).toBeNull();
    expect(parseCardLocationFromTextLines('$40\nLamp, OK\nReno, NV')).toEqual({ key: 'reno, nv', state: 'NV' });
    expect(parseCardLocationFromTextLines('$40\nModel 12345, XX')).toBeNull();
  });
  it('parses distance labels and radius summaries', () => {
    expect(parseDistanceAwayMiles('$5\n12 miles away')).toBe(12);
    expect(parseDistanceAwayMiles('16.0934 km away')).toBeCloseTo(10);
    expect(parseLocationSummary('Oakland, California · Within 40 miles'))
      .toEqual({ centerLabel: 'Oakland, California', radiusMiles: 40 });
    expect(parseRadiusValueMiles('20 miles')).toBe(20);
    expect(parseStaticMapCenter('url("https://x/static_map.php?v=1&amp;center=37.8%2C-122.27&zoom=9")'))
      .toEqual({ lat: 37.8, lng: -122.27 });
  });
  it('measures distance with a grace margin and compares cities across state spellings', () => {
    expect(haversineMiles({ lat: 37.8044, lng: -122.2712 }, { lat: 37.3382, lng: -121.8863 })).toBeCloseTo(38.2, 0);
    expect(radiusHideThresholdMiles(10)).toBe(12);
    expect(radiusHideThresholdMiles(100)).toBe(110);
    expect(locationsShareCity('Oakland, CA', 'Oakland, California')).toBe(true);
    expect(stateOf('Oakland, California')).toBe('CA');
    expect(stateOf('Nowhere')).toBe('');
  });
});

describe('places', () => {
  const entries = new Map([['ca|oakland', [37.8, -122.27] as const], ['nj|deptford', [39.8, -75.1] as const],
    ['ca|la canada flintridge', [34.2, -118.2] as const]]);
  it('accepts codes or names, strips descriptors and diacritics', () => {
    expect(lookupLocation(entries, 'Oakland, CA')).toEqual([37.8, -122.27]);
    expect(lookupLocation(entries, 'oakland, california')).toEqual([37.8, -122.27]);
    expect(lookupLocation(entries, 'Deptford Township, NJ')).toEqual([39.8, -75.1]);
    expect(lookupLocation(entries, 'La Cañada Flintridge, CA')).toEqual([34.2, -118.2]);
    expect(lookupLocation(entries, 'Oakland, ZZ')).toBeNull();
  });
});

it('matches only a whole Just listed badge', () => {
  const card = document.createElement('div');
  card.innerHTML = '<span>Just listed sofa</span>';
  expect(hasJustListedBadge(card)).toBe(false);
  card.innerHTML += '<span><span>​Just  listed​</span></span>';
  expect(hasJustListedBadge(card)).toBe(true);
});

it('finds the outside-your-search section and the page location', () => {
  document.body.innerHTML = `<div role="navigation" aria-label="Marketplace sidebar"><span>Location</span>
    <span>Oakland, California</span><span>Within 40 mi</span></div>
    <div role="main"><div class="near"></div>
    <div class="far"><div><span>Results from outside your search</span></div><a href="/marketplace/item/9">x</a></div></div>`;
  expect(findOutOfScopeSection(document)).toBe(document.querySelector('.far'));
  expect(detectLocationFromPage()).toEqual({ centerLabel: 'Oakland, California', radiusMiles: 40 });
  document.body.insertAdjacentHTML('beforeend', `<div role="dialog" aria-label="Change location">
    <input role="combobox" value="Reno, Nevada"><span>20 miles</span>
    <div style="background-image: url('https://x/static_map.php?center=39.5%2C-119.8')"></div></div>`);
  expect(detectLocationFromPage()).toEqual({ centerLabel: 'Reno, Nevada', radiusMiles: 20, center: { lat: 39.5, lng: -119.8 } });
});

describe('location context', () => {
  const card = (id: string, place: string, extra = '') =>
    `<div><a href="/marketplace/item/${id}" aria-label="Item ${id}, $5, ${place}, listing ${id}"><span>$5</span>${extra}</a></div>`;
  it('excludes far, out-of-section and different-state cards and fails open on unknown places', async () => {
    const { resolveLocationContext, resetLocationContext } = await import('../src/lib/locationContext');
    const { apply, clearEffects } = await import('../src/lib/apply');
    const { defaults } = await import('../src/lib/state');
    resetLocationContext();
    sendMessage.mockImplementation(async ({ locations }: { locations: string[] }) => ({ results: Object.fromEntries(
      locations.map(key => [key, ({ 'oakland, california': [37.80, -122.27], 'san jose, ca': [37.34, -121.89],
        'sacramento, ca': [38.58, -121.49], 'reno, nv': [39.53, -119.81] } as Record<string, [number, number]>)[key.toLowerCase()] ?? null])) }));
    document.body.innerHTML = `<div id="seo_filters">Oakland, California · Within 40 miles</div><div role="main">
      <div class="grid">${card('1', 'Oakland, CA', '<span>Just listed</span>')}${card('2', 'San Jose, CA')}
      ${card('3', 'Sacramento, CA')}${card('4', 'Reno, NV')}${card('5', 'Atlantis, CA')}${card('6', 'Nowhere')}</div>
      <div class="far"><div><span>Results from outside your search</span></div>
      <div class="grid2">${card('7', 'San Jose, CA')}${card('8', 'Atlantis, CA')}</div></div></div>`;
    const state = { ...defaults, inRadius: true, sameState: true };
    const scope = document.querySelector<HTMLElement>('[role="main"]')!;
    // Pass 1 geocodes the centre, pass 2 the cards, pass 3 has every answer.
    let late = 0;
    for (const expected of [1, 2]) {
      await resolveLocationContext(scope, state, () => { late++; });
      await vi.waitFor(() => expect(late).toBe(expected));
    }
    const ctx = await resolveLocationContext(scope, state, () => { late++; });
    expect(sendMessage).toHaveBeenCalledTimes(2);
    expect(ctx).toMatchObject({ centerLabel: 'Oakland, California', radiusMiles: 40, detectedState: 'CA', requiredState: 'CA' });
    expect([...ctx.outside].sort()).toEqual(['3', '4', '8']);
    expect(storage.marketsiftLocation).toEqual({ centerLabel: 'Oakland, California', center: { lat: 37.8, lng: -122.27 }, radiusMiles: 40 });
    const shown = () => [...scope.querySelectorAll('[data-ms-listing-root]:not(.ms-hidden) a')].map(a => a.getAttribute('href')!.split('/')[3]);
    apply(scope, state, ctx);
    expect(shown()).toEqual(['1', '2', '5', '6', '7']);
    apply(scope, { ...state, inRadius: false }, ctx);
    expect(shown()).toEqual(['1', '2', '3', '5', '6', '7', '8']);
    apply(scope, { ...state, inRadius: false, stateOverride: 'NV' }, { ...ctx, requiredState: 'NV' });
    expect(shown()).toEqual(['4', '6']);
    expect(apply(scope, { ...defaults, justListed: true })).toEqual({ shown: 1, total: 8 });
    clearEffects();
  });
});
