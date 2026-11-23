import { browser } from 'wxt/browser';
import { lookupLocation, type PlaceEntries } from '../lib/places';
import { changeState, getState, type Change } from '../lib/state';

// Loaded on first use, and again whenever the service worker restarts.
let places: Promise<PlaceEntries> | undefined;
function loadPlaces() {
  places ??= fetch(browser.runtime.getURL('/us-places.json'))
    .then(response => response.json())
    .then((data: { entries: Record<string, [number, number]> }) => new Map(Object.entries(data.entries)));
  places.catch(() => { places = undefined; });
  return places;
}

/** Answers "City, ST" lookups from the bundled Census place list; nothing leaves the browser. */
async function geocode(locations: unknown) {
  if (!Array.isArray(locations)) return {};
  const entries = await loadPlaces();
  const results: Record<string, readonly [number, number] | null> = {};
  for (const key of locations.slice(0, 50)) {
    if (typeof key === 'string') results[key] = lookupLocation(entries, key);
  }
  return { results };
}

export default defineBackground(() => {
  // Serialize toolbar and panel edits from every tab against the latest state.
  let pending = Promise.resolve();
  function save(change: Change) {
    const write = pending.then(async () => {
      const state = await getState();
      await browser.storage.local.set({ marketsift: changeState(state, change) });
    });
    pending = write.catch(console.error);
    return write;
  }
  browser.action.onClicked.addListener(() => save({ set: { widgetVisible: true } }));
  browser.runtime.onMessage.addListener((message, _sender, respond) => {
    if (message?.type === 'marketsift:geocode') {
      void geocode(message.locations).then(respond, () => respond({}));
      return true;
    }
    if (message?.type !== 'marketsift:update') return;
    void save(message.change).then(() => respond(true), () => respond(false));
    return true;
  });
});
