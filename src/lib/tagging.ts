const LISTING_ROOT_ANCESTOR_SCAN_MAX = 25;
const itemLink = 'a[href*="/marketplace/item/"]';

export function tagListings(scope: Document | HTMLElement): HTMLElement[] {
  const roots = new Set<HTMLElement>();
  for (const anchor of scope.querySelectorAll<HTMLAnchorElement>(itemLink)) {
    const id = anchor.pathname.match(/\/marketplace\/item\/([^/]+)/)?.[1];
    if (!id) continue;
    anchor.dataset.msItemId = id;
    let cur: HTMLElement | null = anchor;
    for (let i = 0; i < LISTING_ROOT_ANCESTOR_SCAN_MAX && cur; i++, cur = cur.parentElement) {
      if (cur === scope || !scope.contains(cur) || cur.matches('body, html, [role="main"]')) break;
      if (roots.has(cur)) break;
      if (!cur.parentElement || cur.querySelector('[role="main"]')) break;
      const siblings = Array.from(cur.parentElement.children)
        .filter(el => el.tagName === cur!.tagName && !el.hasAttribute('data-ms-spacer'));
      // Small result sets still have a repeated card shape.
      const repeated = siblings.length >= 6 || (siblings.length > 1 &&
        siblings.every(el => el.matches(itemLink) || el.querySelector(itemLink)));
      if (!repeated || (cur === anchor && !siblings.every(el => el.matches(itemLink)))) continue;
      const links = cur.querySelectorAll<HTMLAnchorElement>(itemLink);
      if (Array.from(links).some(a => a.pathname !== anchor.pathname)) break;
      cur.dataset.msListingRoot = '1';
      roots.add(cur);
      break;
    }
  }
  return [...roots];
}
