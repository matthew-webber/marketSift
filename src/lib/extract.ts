import { parseListingPrice } from './price';

const currency = /(?:(?:US|CA|AU)?\$|USD|CAD|AUD|EUR|GBP|[€£])\s*[\d,.]+/i;
const distance = /^\d+(?:\.\d+)?\s*(?:km|mi|miles?|kilometers?)\s+away$/i;
const location = /^.+,\s*[A-Z]{2}$/;

export function extractListing(root: HTMLElement) {
  const anchor = root.matches('a') ? root : root.querySelector('a[data-ms-item-id]');
  const label = anchor?.getAttribute('aria-label') ?? '';
  const card = root.innerText || root.textContent || '';
  const candidates = Array.from(root.querySelectorAll<HTMLElement>('[dir="auto"], .item-price'))
    .map(el => el.textContent.trim());
  const priceLabels = [
    root.querySelector('[data-testid*="price"], .item-price')?.textContent.trim(),
    ...candidates,
    ...card.split('\n').map(line => line.trim()),
  ];
  const priceLabel = priceLabels.find(value => value && (/^free\b(?:\s*\$|$)/i.test(value) || value.match(currency)?.index === 0));
  const display = priceLabel && /^free\b/i.test(priceLabel) ? 'Free'
    : priceLabel?.match(currency)?.[0] ?? label.match(currency)?.[0]
      ?? (/[,·|]\s*free(?:\s*[,·|]|$)/i.test(label) ? 'Free' : card.match(currency)?.[0]);
  const labelledBy = (root.getAttribute('aria-labelledby') || anchor?.getAttribute('aria-labelledby') || '')
    .split(/\s+/).map(id => id && document.getElementById(id)?.textContent).filter(Boolean).join(' ');
  const alt = root.querySelector('img[alt]')?.getAttribute('alt')?.trim();
  const place = [...candidates, ...card.split('\n')].find(text => location.test(text.trim()))?.trim();
  const suffix = ' in ' + place;
  const title = root.querySelector('[data-testid="marketplace_feed_item_title"], [data-testid="marketplace_listing_item_title"], [data-testid="marketplace_seller_profile_item_title"], .item-title')?.textContent.trim()
    || labelledBy || (root.getAttribute('aria-label') || label).split(/[·|,]/)[0]?.trim()
    || (place && alt?.toLowerCase().endsWith(suffix.toLowerCase()) ? alt.slice(0, -suffix.length) : alt)
    || candidates.find(text => text && !currency.test(text) && !distance.test(text) &&
      !location.test(text) && !/^(free|sponsored|just listed)$/i.test(text)) || '';
  return { title, card, price: parseListingPrice(display) };
}
