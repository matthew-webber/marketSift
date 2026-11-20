export function getMainScope(): Document | HTMLElement {
  const collection = '[aria-label="Collection of Marketplace items"]';
  return document.querySelector<HTMLElement>(collection + '[role="main"]')
    ?? document.querySelector<HTMLElement>(collection)
    ?? document.querySelector<HTMLElement>('[role="main"]')
    ?? document;
}
