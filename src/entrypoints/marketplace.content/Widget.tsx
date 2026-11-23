import { useEffect, useRef, useState } from 'react';
import { needsLocation, showOnlyCount, type FocusContext } from '../../lib/focus';
import { US_STATES } from '../../lib/places';
import { docks, update, type Mode, type State } from '../../lib/state';

const showOnly = [['justListed', 'Just listed'], ['inRadius', 'Within radius'], ['sameState', 'Same state']] as const;

function locationStatus(state: State, location?: FocusContext) {
  if (!location) return 'Reading the Marketplace location…';
  const notes = [location.centerLabel
    ? location.centerLabel + (location.radiusMiles ? ` · within ${location.radiusMiles} mi` : '')
    : 'Marketplace location not detected.'];
  if (state.inRadius && !location.radiusMiles) notes.push('Open the Marketplace location menu so Within radius can read the radius.');
  if (state.sameState && !location.requiredState) notes.push('Choose a state below.');
  return notes.join(' ');
}

export function Widget({ state, shown, total, location }: { state: State; shown: number; total: number; location?: FocusContext }) {
  const [open, setOpen] = useState<'panel' | 'menu' | null>(null);
  const [term, setTerm] = useState('');
  const [mode, setMode] = useState<Mode>('hide');
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const wrapper = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const dragged = useRef(false);
  const active = state.filters.filter(f => f.enabled).length + showOnlyCount(state);
  function close() {
    setOpen(null);
    trigger.current?.focus();
  }
  useEffect(() => {
    if (!open) return;
    function outside(e: PointerEvent) {
      if (wrapper.current && !e.composedPath().includes(wrapper.current)) setOpen(null);
    }
    function escape(e: KeyboardEvent) {
      if (e.key === 'Escape') close();
    }
    document.addEventListener('pointerdown', outside, true);
    document.addEventListener('keydown', escape, true);
    return () => {
      document.removeEventListener('pointerdown', outside, true);
      document.removeEventListener('keydown', escape, true);
    };
  }, [open]);
  return <div className={'widget ' + state.dock} ref={wrapper}>
    <button ref={trigger} className="trigger" data-active={active > 0 || state.sort !== 'none'}
      aria-label="MarketSift filters and sort" aria-expanded={open !== null} title="MarketSift · Right-click for options"
      onContextMenu={e => {
        e.preventDefault();
        e.stopPropagation();
        setOpen('menu');
      }}
      style={{ transform: `translate(${offset.x}px, ${offset.y}px)` }}
      onPointerDown={e => {
        if (e.button !== 0 || !e.isPrimary) return;
        start.current = { x: e.clientX, y: e.clientY };
        dragged.current = false;
        e.currentTarget.setPointerCapture(e.pointerId);
      }}
      onPointerMove={e => {
        if (!start.current) return;
        const x = e.clientX - start.current.x, y = e.clientY - start.current.y;
        if (Math.hypot(x, y) >= 4) dragged.current = true;
        if (dragged.current) setOffset({ x, y });
      }}
      onPointerCancel={() => { start.current = null; setOffset({ x: 0, y: 0 }); }}
      onPointerUp={e => {
        if (!start.current) return;
        dragged.current ||= Math.hypot(e.clientX - start.current.x, e.clientY - start.current.y) >= 4;
        if (dragged.current) {
          const dock = `${e.clientY < innerHeight / 2 ? 'top' : 'bottom'}-${e.clientX < innerWidth / 2 ? 'left' : 'right'}` as State['dock'];
          void update({ set: { dock } });
        }
        start.current = null;
        setOffset({ x: 0, y: 0 });
      }}
      onClick={e => { if (!dragged.current || e.detail === 0) setOpen(open === 'panel' ? null : 'panel'); dragged.current = false; }}>
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden="true"><path d="M3 5h18l-7 8v5l-4 2v-7z"/></svg>
      {active > 0 && <span className="badge">{active}</span>}
    </button>
    {open === 'menu' && <div className="context-menu" role="menu" aria-label="MarketSift options"
      onKeyDown={e => {
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
          e.preventDefault();
          const items = e.currentTarget.querySelectorAll('button');
          (e.target === items[0] ? items[1] : items[0])?.focus();
        }
      }}>
      <button role="menuitem" className="remove" onClick={() => update({ set: { widgetVisible: false } })}>Remove</button>
      <button role="menuitem" autoFocus onClick={close}>Cancel</button>
    </div>}
    {open === 'panel' && <section className="panel" aria-label="MarketSift">
      <header><div><h2>MarketSift</h2><small aria-live="polite">Showing {shown} of {total}</small></div>
        <div className="docks" aria-label="Dock position">{docks.map((dock, i) =>
          <button key={dock} title={'Dock ' + dock} aria-label={'Dock ' + dock} aria-pressed={state.dock === dock}
            onClick={() => update({ set: { dock } })}>{['◤', '◥', '◣', '◢'][i]}</button>)}</div>
        <button className="close" title="Close panel" aria-label="Close panel"
          onClick={close}>×</button>
      </header>
      <fieldset><legend>Sort</legend><div className="segments">{(['none', 'price-asc', 'price-desc'] as const).map((sort, i) =>
        <button key={sort} aria-pressed={state.sort === sort} onClick={() => update({ set: { sort } })}>
          {['Off', 'Price ↑', 'Price ↓'][i]}</button>)}</div></fieldset>
      <fieldset><legend>Show only</legend><div className="segments">{showOnly.map(([key, label]) =>
        <button key={key} aria-pressed={state[key]} onClick={() => update({ set: { [key]: !state[key] } })}>{label}</button>)}</div>
        {needsLocation(state) && <small className="status" aria-live="polite">{locationStatus(state, location)}</small>}
        {state.sameState && <label className="state">State<select value={state.stateOverride}
          onChange={e => update({ set: { stateOverride: e.target.value } })}>
          <option value="">Auto{location?.detectedState ? ` (${location.detectedState})` : ''}</option>
          {US_STATES.map(([abbr, name]) => <option key={abbr} value={abbr}>{name}</option>)}
        </select></label>}
      </fieldset>
      <fieldset><legend>Match on</legend>{(['title', 'card'] as const).map(matchOn =>
        <label key={matchOn}><input type="radio" name="match" checked={state.matchOn === matchOn}
          onChange={() => update({ set: { matchOn } })}/>{matchOn === 'title' ? 'Title' : 'Whole card'}</label>)}</fieldset>
      <fieldset><legend>Filters</legend><form onSubmit={e => {
        e.preventDefault();
        if (term.trim()) {
          void update({ add: { id: crypto.randomUUID(), term: term.trim(), mode, enabled: true } });
          setTerm('');
        }
      }}>
        <button className="mode" type="button" title="Switch filter mode" onClick={() => setMode(mode === 'hide' ? 'show' : 'hide')}>{mode}</button>
        <input aria-label="Filter term" placeholder="Add a term" value={term} onChange={e => setTerm(e.target.value)}/>
        <button type="submit" aria-label="Add filter" disabled={!term.trim()}>↵</button>
      </form>
      {state.filters.length > 0 && <><ul>{state.filters.map(f => <li key={f.id} data-enabled={f.enabled}>
        <button className="mode" title={'Change mode for ' + f.term} onClick={() => update({ flip: f.id })}>{f.mode}</button>
        <button className="term" aria-pressed={f.enabled} onClick={() => update({ toggle: f.id })}>{f.term}</button>
        <button aria-label={'Remove ' + f.term} onClick={() => update({ remove: f.id })}>×</button>
      </li>)}</ul><button className="clear" onClick={() => update({ clear: true })}>Clear all</button></>}
      </fieldset>
    </section>}
  </div>;
}
