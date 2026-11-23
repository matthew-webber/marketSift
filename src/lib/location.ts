/**
 * Location parsing for the show-only filters, ported from SmartBrowse's
 * strict-radius parser. US listings only: cards carry "City, ST", and the
 * Marketplace centre/radius comes from Facebook's own location UI.
 */
import { normalizeStateToken } from './places';

export type LatLng = { lat: number; lng: number };
export type Detected = { centerLabel?: string; radiusMiles?: number; center?: LatLng };

const KM_PER_MILE = 1.60934;
const cityStateEnd = /,\s*([^,$]{2,60}?),\s*([A-Za-z]{2})(?:,\s*listing\s+\d+)?\s*$/;
const cityStateLine = /^([^,$\d][^,$]{0,59}),\s*([A-Za-z]{2})$/;
const distanceAway = /^(\d+(?:\.\d+)?)\s*(mi|mile|miles|km|kilometer|kilometers)\s+away$/i;
const withinRadius = /within\s+(\d+(?:\.\d+)?)\s*(mi|mile|miles|km|kilometer|kilometers)\b/i;
const radiusOnly = /^(\d+(?:\.\d+)?)\s*(mile|miles|km|kilometer|kilometers)$/i;

const space = (value: string | null | undefined) => (value ?? '').normalize('NFKC').replace(/\s+/g, ' ').trim();
const toMiles = (value: number, unit: string) =>
  !Number.isFinite(value) || value <= 0 ? null : /^k/i.test(unit) ? value / KM_PER_MILE : value;
const round = (miles: number) => Math.round(miles * 10) / 10;

/** "City, ST" with a real US state code becomes a normalized "city, st" key. */
function cardLocation(cityRaw: string, stateRaw: string) {
  const state = stateRaw.toLowerCase();
  const city = space(cityRaw);
  if (stateRaw.length !== 2 || normalizeStateToken(state) !== state) return null;
  if (!city || /\d{4,}/.test(city) || /[$€£]/.test(city)) return null;
  return { key: city.toLowerCase() + ', ' + state, state: state.toUpperCase() };
}

/** "Fender Telecaster, $325, North Charleston, SC, listing 185…" */
export function parseCardLocationFromAriaLabel(label: string | null | undefined) {
  const match = space(label).match(cityStateEnd);
  return match ? cardLocation(match[1]!, match[2]!) : null;
}

/** Scans bottom-up so a title ending in ", XX" doesn't win over the location line. */
export function parseCardLocationFromTextLines(text: string | null | undefined) {
  const lines = (text ?? '').split(/\r?\n+/);
  for (let i = lines.length - 1; i >= 0; i--) {
    const match = space(lines[i]).match(cityStateLine);
    const location = match && cardLocation(match[1]!, match[2]!);
    if (location) return location;
  }
  return null;
}

/** Facebook's own "12 miles away" label, in miles. */
export function parseDistanceAwayMiles(text: string | null | undefined) {
  for (const line of (text ?? '').split(/\r?\n+/)) {
    const match = space(line).match(distanceAway);
    if (match) return toMiles(Number(match[1]), match[2]!);
  }
  return null;
}

/** "North Charleston, South Carolina · Within 40 miles" */
export function parseLocationSummary(text: string | null | undefined): Detected {
  const normalized = space(text);
  const result: Detected = {};
  const label = space(normalized.split('·')[0]!.replace(withinRadius, ''));
  if (label.includes(',')) result.centerLabel = label;
  const match = normalized.match(withinRadius);
  const miles = match && toMiles(Number(match[1]), match[2]!);
  if (miles) result.radiusMiles = round(miles);
  return result;
}

/** A location dialog radius value such as "20 miles" or "40 km". */
export function parseRadiusValueMiles(text: string | null | undefined) {
  const match = space(text).match(radiusOnly);
  const miles = match && toMiles(Number(match[1]), match[2]!);
  return miles ? round(miles) : null;
}

/** The centre from the location dialog's `static_map.php?…&center=lat%2Clng` URL. */
export function parseStaticMapCenter(url: string | null | undefined): LatLng | null {
  const text = (url ?? '').replace(/&amp;/g, '&');
  if (!text.includes('static_map.php')) return null;
  const match = text.match(/[?&]center=(-?\d+(?:\.\d+)?)(?:%2C|,)(-?\d+(?:\.\d+)?)/i)
    ?? text.match(/[?&]marker_list(?:\[0\]|%5B0%5D)=(-?\d+(?:\.\d+)?)(?:%2C|,)(-?\d+(?:\.\d+)?)/i);
  const lat = Number(match?.[1]), lng = Number(match?.[2]);
  if (!match || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180 || (lat === 0 && lng === 0)) return null;
  return { lat, lng };
}

export function haversineMiles(a: LatLng, b: LatLng) {
  const rad = (deg: number) => deg * Math.PI / 180;
  const sLat = Math.sin(rad(b.lat - a.lat) / 2), sLng = Math.sin(rad(b.lng - a.lng) / 2);
  const h = sLat * sLat + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * sLng * sLng;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h)) / KM_PER_MILE;
}

/** A little grace so city-centroid imprecision doesn't hide boundary listings. */
export function radiusHideThresholdMiles(radiusMiles: number) {
  return radiusMiles + Math.max(2, radiusMiles * 0.1);
}

/** "North Charleston, SC" and "North Charleston, South Carolina" share a city. */
export function locationsShareCity(a: string | null | undefined, b: string | null | undefined) {
  const city = (value: string | null | undefined) => space(value).split(',')[0]!.toLowerCase();
  return Boolean(city(a) && city(a) === city(b));
}

/**
 * Facebook pads the badge with zero-width characters. Match the whole span so
 * a listing titled "Just listed sofa" doesn't count.
 */
export function hasJustListedBadge(root: HTMLElement) {
  return Array.from(root.querySelectorAll('span')).some(span =>
    span.textContent.replace(/[​-‍⁠﻿]/g, '').replace(/\s+/g, ' ').trim().toLowerCase() === 'just listed');
}

/** Facebook's own "Results from outside your search" section, if present. */
export function findOutOfScopeSection(scope: ParentNode): HTMLElement | null {
  const header = Array.from(scope.querySelectorAll('span'))
    .find(span => span.textContent.includes('Results from outside your search'));
  let current: HTMLElement | null = header ?? null;
  while (current && !current.previousElementSibling) current = current.parentElement;
  return current;
}

function findLocationDialog(doc: Document) {
  for (const dialog of doc.querySelectorAll<HTMLElement>('[role="dialog"], dialog')) {
    if (/location/i.test(dialog.getAttribute('aria-label') ?? '')) return dialog;
    // A localized label still has a location combobox next to a static map.
    if (dialog.querySelector('[style*="static_map.php"]') &&
      dialog.querySelector('input[role="combobox"], [role="combobox"] input')) return dialog;
  }
  return null;
}

function detectFromDialog(dialog: HTMLElement): Detected {
  const result: Detected = {};
  for (const input of dialog.querySelectorAll<HTMLInputElement>('input[role="combobox"], [role="combobox"] input, input[aria-label]')) {
    const value = (input.value || input.getAttribute('value') || '').trim();
    if (value.includes(',') && value.length <= 90) { result.centerLabel = value; break; }
  }
  for (const span of dialog.querySelectorAll('span')) {
    const miles = parseRadiusValueMiles(span.textContent);
    if (miles !== null) { result.radiusMiles = miles; break; }
  }
  const map = dialog.querySelector<HTMLElement>('[style*="static_map.php"]');
  const center = map && parseStaticMapCenter(map.style.backgroundImage || map.getAttribute('style'));
  if (center) result.center = center;
  return result;
}

function textSegments(root: Node) {
  const walker = (root.ownerDocument ?? document).createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const segments: string[] = [];
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = space(node.textContent);
    if (text) segments.push(text);
  }
  return segments;
}

function isCenterLabel(segment: string) {
  const label = space(segment.split('·')[0]);
  return Boolean(label) && label.length <= 90 && label.includes(',') && !/within\s+\d/i.test(label)
    && !/^(filters?|location|marketplace|radius|sort by)$/i.test(label);
}

function detectFromSegments(segments: string[]): Detected {
  for (const segment of segments) {
    const direct = parseLocationSummary(segment);
    if (direct.centerLabel && direct.radiusMiles) return direct;
  }
  for (let i = 0; i < segments.length; i++) {
    const radiusMiles = parseLocationSummary('Placeholder, State · ' + segments[i]).radiusMiles
      ?? parseRadiusValueMiles(segments[i]);
    if (!radiusMiles) continue;
    // The centre label sits a few text nodes before the radius in the sidebar.
    for (let j = i - 1; j >= Math.max(0, i - 8); j--) {
      if (isCenterLabel(segments[j]!)) return { centerLabel: space(segments[j]!.split('·')[0]), radiusMiles };
    }
    return { radiusMiles };
  }
  return {};
}

const pageRoots = ['[aria-label*="Marketplace"][role="navigation"]', '[aria-label*="Marketplace"][role="complementary"]',
  '[aria-label*="Marketplace"]', '[role="navigation"]', '[role="complementary"]'];

/** Reads the centre and radius Facebook is showing right now. */
export function detectLocationFromPage(doc: Document = document): Detected {
  const dialog = findLocationDialog(doc);
  if (dialog) return detectFromDialog(dialog);
  const seo = doc.querySelector('#seo_filters');
  const fromSeo = seo ? parseLocationSummary(seo.textContent) : {};
  if (fromSeo.centerLabel && fromSeo.radiusMiles) return fromSeo;
  const roots = new Set(pageRoots.flatMap(selector => Array.from(doc.querySelectorAll(selector))));
  for (const root of roots.size ? roots : [doc.body]) {
    const detected = detectFromSegments(textSegments(root));
    if (detected.centerLabel || detected.radiusMiles) return { ...detected, ...fromSeo };
  }
  return fromSeo;
}
