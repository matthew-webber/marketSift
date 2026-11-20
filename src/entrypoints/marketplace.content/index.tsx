import { createRoot } from 'react-dom/client';
import { createShadowRootUi } from 'wxt/utils/content-script-ui/shadow-root';
import { affectsListings } from '../../lib/listingMutation';
import { apply, clearEffects } from '../../lib/apply';
import { getMainScope } from '../../lib/scope';
import { isMarketplaceContext } from '../../lib/marketplaceContext';
import { getState, subscribe } from '../../lib/state';
import { Widget } from './Widget';
import './widget.css';

export default defineContentScript({
  matches: ['*://*.facebook.com/*'],
  cssInjectionMode: 'ui',
  async main(ctx) {
    const ui = await createShadowRootUi(ctx, {
      name: 'market-sift', position: 'inline', anchor: 'body',
      onMount: container => createRoot(container),
      onRemove: root => root?.unmount(),
    });
    let active = false;
    let timer: number | undefined;
    let state = await getState();
    if (ctx.isInvalid) return;
    function refresh() {
      clearTimeout(timer);
      timer = undefined;
      if (!isMarketplaceContext() || !state.widgetVisible) {
        if (active) {
          clearEffects();
          ui.remove();
          active = false;
        }
        return;
      }
      active = true;
      if (!ui.mounted) ui.mount();
      else if (!ui.shadowHost.isConnected) document.body.append(ui.shadowHost);
      const counts = apply(getMainScope(), state);
      ui.mounted?.render(<Widget state={state} {...counts} />);
    }
    const observer = new MutationObserver(records => {
      if (!isMarketplaceContext() || !state.widgetVisible) {
        if (active) refresh();
        return;
      }
      const changed = records.some(affectsListings);
      if ((changed || !ui.shadowHost.isConnected) && timer === undefined) timer = window.setTimeout(refresh, 150);
    });
    observer.observe(document.body, { childList: true, characterData: true, subtree: true,
      attributes: true, attributeFilter: ['href', 'aria-label', 'alt'] });
    ctx.addEventListener(window, 'wxt:locationchange', refresh);
    const unsubscribe = subscribe(next => { state = next; refresh(); });
    ctx.onInvalidated(() => { clearTimeout(timer); observer.disconnect(); unsubscribe(); clearEffects(); });
    refresh();
  },
});
