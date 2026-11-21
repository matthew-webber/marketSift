import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { Widget } from '../src/entrypoints/marketplace.content/Widget';
import { defaults } from '../src/lib/state';

vi.mock('wxt/browser', () => ({ browser: { runtime: { sendMessage: vi.fn() } } }));

it('keeps filtering on close and cancel, and pauses only on Remove', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  const send = (await import('wxt/browser')).browser.runtime.sendMessage;
  const trigger = () => host.querySelector<HTMLButtonElement>('.trigger')!;
  const menu = () => host.querySelector('[role="menu"]');
  const rightClick = () => act(() => {
    trigger().dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
  });
  try {
    await act(() => root.render(createElement(Widget, { state: defaults, shown: 3, total: 3 })));
    await act(() => trigger().click());
    await act(() => host.querySelector<HTMLButtonElement>('[aria-label="Close panel"]')!.click());
    expect(host.querySelector('.panel')).toBeNull();
    expect(document.activeElement).toBe(trigger());
    await rightClick();
    const items = menu()!.querySelectorAll<HTMLButtonElement>('[role="menuitem"]');
    expect(Array.from(items, el => el.textContent)).toEqual(['Remove', 'Cancel']);
    await act(() => items[1]!.click());
    expect(menu()).toBeNull();
    expect(send).not.toHaveBeenCalled();
    await rightClick();
    await act(() => menu()!.querySelector('button')!.click());
    expect(send).toHaveBeenCalledWith({ type: 'marketsift:update', change: { set: { widgetVisible: false } } });
  } finally {
    await act(() => root.unmount());
    host.remove();
    vi.unstubAllGlobals();
  }
});
