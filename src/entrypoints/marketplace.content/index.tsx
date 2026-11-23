import { createRoot } from 'react-dom/client';
import { createShadowRootUi } from 'wxt/utils/content-script-ui/shadow-root';
import { affectsListings } from '../../lib/listingMutation';
import { apply, clearEffects } from '../../lib/apply';
import { needsLocation, type FocusContext } from '../../lib/focus';
import { resolveLocationContext } from '../../lib/locationContext';
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
    // Drops a location pass that a newer refresh has overtaken.
    let generation = 0;
    if (ctx.isInvalid) return;
    function schedule() {
      if (timer === undefined) timer = window.setTimeout(refresh, 150);
    }
    async function refresh() {
      clearTimeout(timer);
      timer = undefined;
      const run = ++generation;
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
      let focus: FocusContext | undefined;
      if (needsLocation(state)) {
        // Cards hidden by the previous pass stay hidden while this resolves.
        try {
          focus = await resolveLocationContext(getMainScope(), state, schedule);
        } catch (error) {
          console.error(error);
        }
        if (run !== generation || ctx.isInvalid) return;
      }
      const counts = apply(getMainScope(), state, focus);
      ui.mounted?.render(<Widget state={state} {...counts} location={focus} />);
    }
    const observer = new MutationObserver(records => {
      if (!isMarketplaceContext() || !state.widgetVisible) {
        if (active) void refresh();
        return;
      }
      const changed = records.some(affectsListings);
      if (changed || !ui.shadowHost.isConnected) schedule();
    });
    observer.observe(document.body, { childList: true, characterData: true, subtree: true,
      attributes: true, attributeFilter: ['href', 'aria-label', 'alt'] });
    ctx.addEventListener(window, 'wxt:locationchange', () => void refresh());
    const unsubscribe = subscribe(next => { state = next; void refresh(); });
    ctx.onInvalidated(() => { clearTimeout(timer); observer.disconnect(); unsubscribe(); clearEffects(); });
    void refresh();
  },
});
