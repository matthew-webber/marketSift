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

it('toggles show-only filters, counts them on the badge and offers a state override', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  const send = vi.mocked((await import('wxt/browser')).browser.runtime.sendMessage);
  send.mockClear();
  const location = { centerLabel: 'Oakland, California', radiusMiles: 40, detectedState: 'CA', requiredState: 'CA',
    outside: new Set<string>(), cardStates: new Map<string, string>() };
  const render = (state: typeof defaults) => act(() => root.render(createElement(Widget, { state, shown: 2, total: 5, location })));
  const toggle = (label: string) => Array.from(host.querySelectorAll<HTMLButtonElement>('button')).find(b => b.textContent === label)!;
  try {
    await render(defaults);
    await act(() => host.querySelector<HTMLButtonElement>('.trigger')!.click());
    expect(host.querySelector('select')).toBeNull();
    await act(() => toggle('Within radius').click());
    expect(send).toHaveBeenLastCalledWith({ type: 'marketsift:update', change: { set: { inRadius: true } } });
    await render({ ...defaults, justListed: true, sameState: true });
    expect(host.querySelector('.badge')?.textContent).toBe('2');
    expect(toggle('Just listed').getAttribute('aria-pressed')).toBe('true');
    expect(host.querySelector('.status')?.textContent).toBe('Oakland, California · within 40 mi');
    const select = host.querySelector('select')!;
    expect(select.options[0]!.textContent).toBe('Auto (CA)');
    await act(() => {
      select.value = 'NV';
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(send).toHaveBeenLastCalledWith({ type: 'marketsift:update', change: { set: { stateOverride: 'NV' } } });
  } finally {
    await act(() => root.unmount());
    host.remove();
    vi.unstubAllGlobals();
  }
});
