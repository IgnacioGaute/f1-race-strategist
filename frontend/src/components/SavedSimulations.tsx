"use client";

import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/i18n/useI18n";
import { api } from "@/lib/api";
import { lapSpanStyle } from "@/lib/chart";
import { compoundStyle } from "@/lib/tyres";
import type { LoadState, SavedSimulationDetail, SavedSimulationSummary, StrategyStint } from "@/lib/types";
import { SimulationResultView } from "./SimulationResultView";
import { ErrorMessage, Loading } from "./StatusMessage";
import { compoundLabel } from "./TyreBadge";

/** Each stint with its first and last lap. */
function withLapRanges(strategy: readonly StrategyStint[]) {
  let nextLap = 1;
  return strategy.map((stint) => {
    const from = nextLap;
    nextLap += stint.laps;
    return { ...stint, from, to: nextLap - 1 };
  });
}

/** Proportional mini bar of a saved strategy, with the compound letter in each segment. */
function MiniStrategy({ strategy }: { strategy: StrategyStint[] }) {
  const { t } = useI18n();
  const segments = withLapRanges(strategy);
  const totalLaps = segments.reduce((sum, s) => sum + s.laps, 0);
  const description = segments
    .map((s) => t.result.barSegment(compoundLabel(s.compound, t.compounds), s.from, s.to))
    .join(", ");
  return (
    <span className="mini-strategy lap-bar" role="img" aria-label={t.result.barAria(description)}>
      {segments.map((s) => {
        const style = compoundStyle(s.compound);
        return (
          <span
            key={s.from}
            className="mini-segment"
            style={{ ...lapSpanStyle(s.from, s.to, totalLaps), background: style.color }}
          >
            <span className="segment-label">
              {style.letter} {s.laps}
            </span>
          </span>
        );
      })}
    </span>
  );
}

/** Compact history. `version` changes whenever a new simulation is saved. */
export function SavedSimulations({ version }: { version: number }) {
  const { t, fmt } = useI18n();
  const h = t.history;
  const [reload, setReload] = useState(0);
  const [list, setList] = useState<LoadState<SavedSimulationSummary[]>>({ status: "loading" });
  const [detail, setDetail] = useState<LoadState<SavedSimulationDetail>>({ status: "idle" });
  const detailRequest = useRef(0);
  const detailRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .listSavedSimulations()
      .then((data) => {
        if (!cancelled) setList({ status: "ready", data });
      })
      .catch((error: unknown) => {
        if (!cancelled) setList({ status: "error", error });
      });
    return () => {
      cancelled = true;
    };
  }, [version, reload]);

  // "Ver" brings the opened simulation into view (and its loading or error message before that).
  useEffect(() => {
    if (detail.status === "idle") return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    detailRef.current?.scrollIntoView?.({ behavior: reduce ? "auto" : "smooth", block: "start" });
  }, [detail.status]);

  function retry() {
    setList({ status: "loading" });
    setReload((n) => n + 1);
  }

  function open(id: string) {
    const requestId = ++detailRequest.current;
    setDetail({ status: "loading" });
    api
      .getSavedSimulation(id)
      .then((data) => {
        if (detailRequest.current === requestId) setDetail({ status: "ready", data });
      })
      .catch((error: unknown) => {
        if (detailRequest.current === requestId) setDetail({ status: "error", error });
      });
  }

  return (
    <div>
      {list.status === "loading" && <Loading label={h.loading} />}
      {list.status === "error" && <ErrorMessage error={list.error} onRetry={retry} />}
      {list.status === "ready" && list.data.length === 0 && <p className="muted">{h.empty}</p>}
      {list.status === "ready" && list.data.length > 0 && (
        <ul className="history-list">
          {list.data.map((item) => {
            const date = fmt.dateTime(item.createdAt);
            return (
              <li
                key={item.id}
                className="history-item"
                aria-current={detail.status === "ready" && detail.data.id === item.id}
              >
                <div className="history-main">
                  <span className="history-race">{item.raceName}</span>
                  <span className="history-meta">
                    <span className="visually-hidden">{h.colDate}: </span>
                    {date} · {h.colStops}: {item.pitStopCount}
                  </span>
                  <span className="visually-hidden">{h.colStrategy}: </span>
                  <MiniStrategy strategy={item.strategy} />
                </div>
                <div className="history-side">
                  <span className="history-total mono">
                    <span className="visually-hidden">{h.colTotal}: </span>
                    {fmt.raceTime(item.totalTimeSeconds)}
                  </span>
                  <button
                    type="button"
                    className="button button-secondary"
                    onClick={() => open(item.id)}
                    disabled={detail.status === "loading"}
                    aria-label={h.viewAria(item.raceName, date)}
                  >
                    {h.view}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <div ref={detailRef} className="history-detail">
        {detail.status === "loading" && <Loading label={h.loadingDetail} />}
        {detail.status === "error" && <ErrorMessage error={detail.error} />}
        {detail.status === "ready" && (
          <SimulationResultView
            title={h.savedTitle(detail.data.raceName, fmt.dateTime(detail.data.createdAt))}
            result={detail.data.result}
            actions={
              <button type="button" className="button button-secondary" onClick={() => setDetail({ status: "idle" })}>
                {h.close}
              </button>
            }
          />
        )}
      </div>
    </div>
  );
}
