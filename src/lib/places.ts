/**
 * Offline US place lookup for the radius and state filters.
 *
 * `public/us-places.json` is copied from api-smartbrowse-for-marketplace's
 * `data/us-places.json`, built by its `scripts/build-places-dataset.js` from
 * the US Census 2024 Gazetteer (public domain). Its keys are `st|city`, using
 * the normalization below, so the two copies must stay in step.
 */

export const US_STATES = [
  ['AL', 'Alabama'], ['AK', 'Alaska'], ['AZ', 'Arizona'], ['AR', 'Arkansas'], ['CA', 'California'],
  ['CO', 'Colorado'], ['CT', 'Connecticut'], ['DE', 'Delaware'], ['DC', 'District of Columbia'],
  ['FL', 'Florida'], ['GA', 'Georgia'], ['HI', 'Hawaii'], ['ID', 'Idaho'], ['IL', 'Illinois'],
  ['IN', 'Indiana'], ['IA', 'Iowa'], ['KS', 'Kansas'], ['KY', 'Kentucky'], ['LA', 'Louisiana'],
  ['ME', 'Maine'], ['MD', 'Maryland'], ['MA', 'Massachusetts'], ['MI', 'Michigan'], ['MN', 'Minnesota'],
  ['MS', 'Mississippi'], ['MO', 'Missouri'], ['MT', 'Montana'], ['NE', 'Nebraska'], ['NV', 'Nevada'],
  ['NH', 'New Hampshire'], ['NJ', 'New Jersey'], ['NM', 'New Mexico'], ['NY', 'New York'],
  ['NC', 'North Carolina'], ['ND', 'North Dakota'], ['OH', 'Ohio'], ['OK', 'Oklahoma'], ['OR', 'Oregon'],
  ['PA', 'Pennsylvania'], ['PR', 'Puerto Rico'], ['RI', 'Rhode Island'], ['SC', 'South Carolina'],
  ['SD', 'South Dakota'], ['TN', 'Tennessee'], ['TX', 'Texas'], ['UT', 'Utah'], ['VT', 'Vermont'],
  ['VA', 'Virginia'], ['WA', 'Washington'], ['WV', 'West Virginia'], ['WI', 'Wisconsin'], ['WY', 'Wyoming'],
] as const;

const byName = new Map<string, string>(US_STATES.map(([abbr, name]) => [name.toLowerCase(), abbr.toLowerCase()]));
byName.set('washington dc', 'dc').set('washington d c', 'dc');
const abbrs = new Set([...byName.values(), 'as', 'gu', 'mp', 'vi']);

const descriptor = /\s+(city and borough|charter township|zona urbana|barrio-pueblo|urban county|cdp|ccd|city|town|village|borough|municipality|comunidad|township|plantation|precinct|barrio|district|gore|grant|location|purchase|reservation|subbarrio|subarea)$/i;

/** Diacritics out, lowercase, punctuation collapsed to spaces. */
export function normalizeCityName(value: string) {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/['’.]/g, '').replace(/[^a-z0-9-]+/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Lowercase two-letter code for "CA", "ca" or "California"; '' otherwise. */
export function normalizeStateToken(value: string) {
  const token = normalizeCityName(value);
  if (token.length === 2 && abbrs.has(token)) return token;
  return byName.get(token) ?? '';
}

/** Uppercase state code from the text after the last comma of "City, State". */
export function stateOf(label: string | null | undefined) {
  const text = label ?? '';
  const comma = text.lastIndexOf(',');
  return comma < 0 ? '' : normalizeStateToken(text.slice(comma + 1)).toUpperCase();
}

export function parseLocationString(raw: string) {
  const text = raw.trim();
  const comma = text.lastIndexOf(',');
  if (!text || text.length > 100 || comma <= 0) return null;
  const state = normalizeStateToken(text.slice(comma + 1));
  const city = normalizeCityName(text.slice(0, comma)).replace(/^the\s+/, '');
  return state && city ? { city, state } : null;
}

export type PlaceEntries = ReadonlyMap<string, readonly [number, number]>;

/** Resolves "City, ST" or "City, State" to [lat, lng], or null. */
export function lookupLocation(entries: PlaceEntries, raw: string) {
  const parsed = parseLocationString(raw);
  if (!parsed) return null;
  const exact = entries.get(parsed.state + '|' + parsed.city);
  if (exact) return exact;
  const stripped = parsed.city.replace(descriptor, '').trim();
  return stripped && stripped !== parsed.city ? entries.get(parsed.state + '|' + stripped) ?? null : null;
}
