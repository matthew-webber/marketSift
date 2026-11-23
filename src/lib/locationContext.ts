import { browser } from 'wxt/browser';
import type { FocusContext } from './focus';
import { itemIdOf } from './focus';
import {
  detectLocationFromPage, findOutOfScopeSection, haversineMiles, locationsShareCity,
  parseCardLocationFromAriaLabel, parseCardLocationFromTextLines, parseDistanceAwayMiles,
  radiusHideThresholdMiles, type LatLng,
} from './location';
import { stateOf } from './places';
import type { State } from './state';
import { tagListings } from './tagging';

/** The last Marketplace location seen, so pages that don't show it still work. */
export const LOCATION_KEY = 'marketsiftLocation';
interface Stored { centerLabel: string; center: LatLng | null; radiusMiles: number | null }
type Card = { key: string | null; state: string; miles: number | null };

let stored: Stored | undefined;
// Hidden cards have no innerText, so keep what was parsed while they were visible.
const cards = new Map<string, Card>();
const places = new Map<string, LatLng | null>();
const inFlight = new Set<string>();

/** Test seam. */
export function resetLocationContext() {
  stored = undefined;
  cards.clear();
  places.clear();
  inFlight.clear();
}

async function loadStored(): Promise<Stored> {
  if (stored) return stored;
  try {
    const value = (await browser.storage.local.get(LOCATION_KEY))[LOCATION_KEY] as Partial<Stored> | undefined;
    stored = { centerLabel: value?.centerLabel ?? '', center: value?.center ?? null, radiusMiles: value?.radiusMiles ?? null };
  } catch {
    stored = { centerLabel: '', center: null, radiusMiles: null };
  }
  return stored;
}

/**
 * Cache-first lookup. Misses go to the background worker and call `onLate`
 * when they land, so a later pass can use them.
 */
function geocode(keys: Iterable<string>, onLate: () => void) {
  const misses = [...new Set(keys)].filter(key => key && !places.has(key) && !inFlight.has(key));
  for (let i = 0; i < misses.length; i += 50) {
    const batch = misses.slice(i, i + 50);
    batch.forEach(key => inFlight.add(key));
    void Promise.resolve()
      .then(() => browser.runtime.sendMessage({ type: 'marketsift:geocode', locations: batch }))
      .then((response: { results?: Record<string, [number, number] | null> } | undefined) => {
        // A failed request stays uncached so a later pass retries it.
        if (!response?.results) return;
        for (const key of batch) {
          const value = response.results[key];
          if (value !== undefined) places.set(key, value ? { lat: value[0], lng: value[1] } : null);
        }
        onLate();
      })
      .catch(() => {})
      .finally(() => batch.forEach(key => inFlight.delete(key)));
  }
}

function readCard(root: HTMLElement, id: string): Card {
  const cached = cards.get(id);
  if (cached) return cached;
  const anchor = root.matches('a') ? root : root.querySelector('a[data-ms-item-id]');
  let location = parseCardLocationFromAriaLabel(anchor?.getAttribute('aria-label'));
  let miles: number | null = null;
  if (!location) {
    const text = root.innerText || root.textContent;
    location = parseCardLocationFromTextLines(text);
    miles = parseDistanceAwayMiles(text);
  }
  const card = { key: location?.key ?? null, state: location?.state ?? '', miles };
  if (card.key || card.miles !== null) {
    if (cards.size > 4000) cards.clear();
    cards.set(id, card);
  }
  return card;
}

async function syncLocation(onLate: () => void) {
  const current = await loadStored();
  const detected = detectLocationFromPage(document);
  const next: Stored = { ...current };
  if (detected.centerLabel && detected.centerLabel !== current.centerLabel) {
    next.centerLabel = detected.centerLabel;
    // Facebook alternates "Oakland, California" and "Oakland, CA"; keep the coordinates.
    if (!locationsShareCity(detected.centerLabel, current.centerLabel)) next.center = null;
  }
  if (detected.center) next.center = detected.center;
  if (detected.radiusMiles) next.radiusMiles = detected.radiusMiles;
  if (next.centerLabel && !next.center) {
    const center = places.get(next.centerLabel);
    if (center) next.center = center;
    else if (center === undefined) geocode([next.centerLabel], onLate);
  }
  if (JSON.stringify(next) !== JSON.stringify(current)) {
    stored = next;
    try { await browser.storage.local.set({ [LOCATION_KEY]: next }); } catch {}
  }
  return next;
}

/**
 * Collects what the radius and state filters need for the listings in
 * `scope`. Radius verdicts follow SmartBrowse's strict radius: Facebook's own
 * distance label wins, the same city is inside, and anything that can't be
 * placed stays visible. Cards in Facebook's "outside your search" section are
 * excluded unless they are confidently within the radius.
 */
export async function resolveLocationContext(scope: Document | HTMLElement, state: State, onLate: () => void): Promise<FocusContext> {
  const location = await syncLocation(onLate);
  const detectedState = stateOf(location.centerLabel);
  const outsideSection = findOutOfScopeSection(scope);
  const cardStates = new Map<string, string>();
  const judged: { id: string; card: Card; flagged: boolean }[] = [];
  for (const root of tagListings(scope)) {
    const id = itemIdOf(root);
    if (!id) continue;
    const card = readCard(root, id);
    if (card.state) cardStates.set(id, card.state);
    judged.push({ id, card, flagged: Boolean(outsideSection?.contains(root)) });
  }
  const outside = new Set<string>();
  const radius = location.radiusMiles;
  if (state.inRadius && radius) {
    const center = location.center;
    const sameCity = (card: Card) => locationsShareCity(card.key, location.centerLabel);
    if (center) geocode(judged.filter(({ card }) => card.miles === null && card.key && !sameCity(card)).map(({ card }) => card.key!), onLate);
    const distance = (card: Card) => {
      if (card.miles !== null) return card.miles;
      if (!card.key) return null;
      if (sameCity(card)) return 0;
      const place = center && places.get(card.key);
      return place ? haversineMiles(center, place) : null;
    };
    const threshold = radiusHideThresholdMiles(radius);
    for (const { id, card, flagged } of judged) {
      const miles = distance(card);
      // No grace margin inside Facebook's own section: it already says the card is outside.
      if (flagged ? miles === null || miles > radius : miles !== null && miles > threshold) outside.add(id);
    }
  }
  return {
    centerLabel: location.centerLabel, radiusMiles: radius, detectedState,
    requiredState: state.stateOverride || detectedState, outside, cardStates,
  };
}
