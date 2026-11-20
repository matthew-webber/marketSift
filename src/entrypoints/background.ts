import { browser } from 'wxt/browser';
import { changeState, getState, type Change } from '../lib/state';

export default defineBackground(() => {
  // Serialize toolbar and panel edits from every tab against the latest state.
  let pending = Promise.resolve();
  function save(change: Change) {
    const write = pending.then(async () => {
      const state = await getState();
      await browser.storage.local.set({ marketsift: changeState(state, change) });
    });
    pending = write.catch(console.error);
    return write;
  }
  browser.action.onClicked.addListener(() => save({ set: { widgetVisible: true } }));
  browser.runtime.onMessage.addListener((message, _sender, respond) => {
    if (message?.type !== 'marketsift:update') return;
    void save(message.change).then(() => respond(true), () => respond(false));
    return true;
  });
});
