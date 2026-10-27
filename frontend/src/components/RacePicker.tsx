"use client";

import { type CSSProperties, type KeyboardEvent, useEffect, useId, useRef, useState } from "react";
import { useI18n } from "@/i18n/useI18n";
import type { RaceSummary } from "@/lib/types";

interface RacePickerProps {
  races: RaceSummary[];
  selectedId: string;
  onSelect: (raceId: string) => void;
}

/** Round, name, circuit, date, laps and rain: the same summary in the button and in each option. */
function RaceSummaryRow({ race }: { race: RaceSummary }) {
  const { t, fmt } = useI18n();
  return (
    <span className="race-row">
      <span className="race-row-round mono">R{race.round}</span>
      <span className="race-row-main">
        <span className="race-row-name">{race.name}</span>
        <span className="race-row-circuit">
          {race.circuitName} · {race.country}
        </span>
      </span>
      <span className="race-row-meta">
        <span className="mono">{fmt.date(race.date)}</span>
        <span>
          <span className="mono">{race.laps}</span> {t.info.laps}
        </span>
      </span>
      <span className="race-row-rain" title={t.info.rainProbability}>
        <span className="visually-hidden">{t.info.rainProbability}: </span>
        <span className="race-row-rain-value">
          <RainIcon />
          <span className="mono">{fmt.percent(race.rainProbability)}</span>
        </span>
        <span className="race-row-rain-track" aria-hidden="true">
          <span className="race-row-rain-fill" style={{ width: `${Math.round(race.rainProbability * 100)}%` }} />
        </span>
      </span>
    </span>
  );
}

/** Cloud with rain drops; marks the figure as rain probability. Decorative: the text label is read instead. */
function RainIcon() {
  return (
    <svg className="race-row-rain-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="M7 15a4 4 0 1 1 .9-7.9A5.5 5.5 0 0 1 18.5 9 3.5 3.5 0 0 1 17.5 15z" />
      <path d="M8 18l-1 2.5M12 18l-1 2.5M16 18l-1 2.5" />
    </svg>
  );
}

/** Gap kept between the open list and the edge of the window. */
const LIST_EDGE_GAP = 16;
/** Gap between the button and the open list. */
const LIST_GAP = 6;
/** Below this much room under the button, the list opens upwards if there is more room above. */
const LIST_MIN_HEIGHT = 240;
const LIST_MAX_HEIGHT = 420;

function ChevronIcon() {
  return (
    <svg className="race-select-chevron" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true">
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

/**
 * Custom select (ARIA listbox pattern) so each race can show its whole summary,
 * which a native <select> cannot style. Keyboard: arrows, Home/End, Enter/Space,
 * Escape, and typing a letter jumps to the next race starting with it.
 */
export function RacePicker({ races, selectedId, onSelect }: RacePickerProps) {
  const { t } = useI18n();
  const baseId = useId();
  const labelId = `${baseId}-label`;
  const listId = `${baseId}-list`;
  const optionId = (index: number) => `${baseId}-option-${index}`;

  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  // The list is position: fixed, placed against the button and fitted to the window
  // when it opens: a fixed element never makes the page longer, so it cannot add a scrollbar.
  const [placement, setPlacement] = useState<CSSProperties>({});
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const selectedIndex = races.findIndex((race) => race.id === selectedId);
  const selected = selectedIndex >= 0 ? races[selectedIndex] : undefined;

  function openList(index = selectedIndex >= 0 ? selectedIndex : 0) {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (rect) {
      const below = window.innerHeight - rect.bottom - LIST_GAP - LIST_EDGE_GAP;
      const above = rect.top - LIST_GAP - LIST_EDGE_GAP;
      const up = below < LIST_MIN_HEIGHT && above > below;
      setPlacement({
        left: rect.left,
        width: rect.width,
        maxHeight: Math.max(0, Math.min(LIST_MAX_HEIGHT, up ? above : below)),
        ...(up ? { bottom: window.innerHeight - rect.top + LIST_GAP } : { top: rect.bottom + LIST_GAP }),
      });
    }
    setActiveIndex(index);
    setOpen(true);
  }

  function close(returnFocus: boolean) {
    setOpen(false);
    if (returnFocus) triggerRef.current?.focus();
  }

  function choose(index: number) {
    const race = races[index];
    if (race) onSelect(race.id);
    close(true);
  }

  // Focus the list when it opens, so the keyboard drives it right away. Without
  // preventScroll the browser would scroll the page to the list.
  useEffect(() => {
    if (open) listRef.current?.focus({ preventScroll: true });
  }, [open]);

  // Keep the active option visible by scrolling only the list: scrollIntoView
  // would also scroll the page, vertically and even sideways.
  useEffect(() => {
    const list = listRef.current;
    const option = document.getElementById(`${baseId}-option-${activeIndex}`);
    if (!open || !list || !option) return;
    const top = option.offsetTop;
    const bottom = top + option.offsetHeight;
    if (top < list.scrollTop) list.scrollTop = top;
    else if (bottom > list.scrollTop + list.clientHeight) list.scrollTop = bottom - list.clientHeight;
  }, [open, activeIndex, baseId]);

  // A click outside closes the list without choosing. So do scrolling the page and
  // resizing the window: the fixed list would otherwise drift away from its button.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) setOpen(false);
    };
    const onScroll = (event: Event) => {
      // Scrolling inside the list itself is expected.
      if (event.target instanceof Node && listRef.current?.contains(event.target)) return;
      setOpen(false);
    };
    const onResize = () => setOpen(false);
    document.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
    };
  }, [open]);

  function onTriggerKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      openList();
    }
  }

  function onListKeyDown(event: KeyboardEvent<HTMLUListElement>) {
    const last = races.length - 1;
    const moves: Record<string, number> = {
      ArrowDown: Math.min(last, activeIndex + 1),
      ArrowUp: Math.max(0, activeIndex - 1),
      Home: 0,
      End: last,
    };
    if (event.key in moves) {
      event.preventDefault();
      setActiveIndex(moves[event.key]);
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      choose(activeIndex);
    } else if (event.key === "Escape") {
      event.preventDefault();
      close(true);
    } else if (event.key === "Tab") {
      close(false);
    } else if (event.key.length === 1 && /\S/.test(event.key)) {
      // Type-ahead: next race whose name starts with the typed letter.
      const letter = event.key.toLowerCase();
      for (let step = 1; step <= races.length; step++) {
        const index = (activeIndex + step) % races.length;
        if (races[index].name.toLowerCase().startsWith(letter)) {
          setActiveIndex(index);
          break;
        }
      }
    }
  }

  return (
    <div ref={rootRef} className="race-select">
      <span id={labelId} className="field-label">
        {t.races.label}
      </span>
      <button
        ref={triggerRef}
        type="button"
        className="race-select-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-labelledby={`${labelId} ${baseId}-value`}
        onClick={() => (open ? close(false) : openList())}
        onKeyDown={onTriggerKeyDown}
      >
        <span id={`${baseId}-value`} className="race-select-value">
          {selected ? <RaceSummaryRow race={selected} /> : <span className="race-select-placeholder">{t.races.placeholder}</span>}
        </span>
        <ChevronIcon />
      </button>

      {open && (
        <ul
          ref={listRef}
          id={listId}
          className="race-select-list"
          style={placement}
          role="listbox"
          aria-labelledby={labelId}
          aria-activedescendant={optionId(activeIndex)}
          tabIndex={-1}
          onKeyDown={onListKeyDown}
        >
          {races.map((race, index) => (
            <li
              key={race.id}
              id={optionId(index)}
              role="option"
              aria-selected={race.id === selectedId}
              className={index === activeIndex ? "race-option is-active" : "race-option"}
              onPointerMove={() => setActiveIndex(index)}
              onClick={() => choose(index)}
            >
              <RaceSummaryRow race={race} />
              <svg className="race-option-check" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" aria-hidden="true">
                <path d="M5 12l5 5 9-10" />
              </svg>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
