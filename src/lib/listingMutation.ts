// SmartBrowse can insert decorations inside a listing as well as controls outside it.
const decorations = [
  'market-sift', '[data-ms-spacer]', '[data-sb-effect-chrome]',
  '[data-sb-out-of-scope-header]', '[data-sb-quick-action-spacer]',
  '.sb-action-trigger', '.sb-overlay', '.sb-qa-button', '.sb-qa-menu', '.sb-qa-toast',
].join(',');
const listing = '[data-ms-listing-root], a[href*="/marketplace/item/"]';

export function affectsListings(record: MutationRecord) {
  const target = record.target instanceof Element ? record.target : record.target.parentElement;
  if (!target || target.closest(decorations)) return false;
  const insideListing = Boolean(target.closest(listing));
  if (record.type !== 'childList') return insideListing;
  return [...record.addedNodes, ...record.removedNodes].some(node => {
    if (!(node instanceof Element)) return insideListing && node.nodeType === Node.TEXT_NODE;
    if (node.matches(decorations)) return false;
    return insideListing || node.matches(listing) || Boolean(node.querySelector(listing));
  });
}
