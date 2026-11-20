const CURRENCY_PRICE_RE =
  /(?:(?:US|CA|AU)?\$\s*[\d,.]+|(?:USD|CAD|AUD|EUR|GBP)\s*[\d,.]+|[€£]\s*[\d,.]+|\d[\d,.]*)/i

export function parseListingPrice(
  value: string | null | undefined
): number | null {
  const text = String(value ?? '').trim()
  if (!text) return null
  if (/^free$/i.test(text)) return 0

  const match = text.match(CURRENCY_PRICE_RE)
  if (!match) return null

  const numeric = match[0].replace(/[^0-9.]/g, '')
  if (!numeric || numeric === '.') return null

  const parsed = Number.parseFloat(numeric)
  return Number.isFinite(parsed) ? parsed : null
}
