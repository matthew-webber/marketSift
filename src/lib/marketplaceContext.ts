/**
 * Content scripts load across facebook.com so they survive Facebook's soft
 * navigations. Runtime DOM work must still stay scoped to Marketplace.
 *
 * Non-Facebook hosts are local sandboxes or tests and remain in scope.
 */
export function isMarketplaceContext(
  loc: { hostname: string; pathname: string } = window.location
): boolean {
  if (!/(^|\.)facebook\.com$/i.test(loc.hostname || '')) return true
  return /^\/marketplace(\/|$)/i.test(loc.pathname || '')
}
