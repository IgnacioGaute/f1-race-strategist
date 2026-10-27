"use client";

import type { ReactNode } from "react";
import { lookup } from "@/i18n/messages";
import { useI18n } from "@/i18n/useI18n";
import type { SimulationResult } from "@/lib/types";
import { LapCharts } from "./LapChart";
import { CountUp } from "./reactbits/CountUp";
import { StrategyBar } from "./StrategyBar";
import { TyreBadge } from "./TyreBadge";

interface SimulationResultViewProps {
  title: string;
  result: SimulationResult;
  /** Shown above the result (stale warning, save status...). */
  notice?: ReactNode;
  actions?: ReactNode;
}

/**
 * The detailed breakdown shows seconds with three decimals; an effect that rounds
 * to 0,000 s is shown as "no effect" instead of a signed value.
 */
const NO_EFFECT_SECONDS = 0.0005;

export function SimulationResultView({ title, result, notice, actions }: SimulationResultViewProps) {
  const { t, fmt } = useI18n();
  const r = t.result;
  const { timeBreakdown: b, parametersUsed: p } = result;
  const perStop = p.pitStopLossSeconds + p.tyreChangeTimeSeconds;
  const effects: { label: string; help: string; value: number }[] = [
    { label: r.rowCompound, help: r.helpCompound, value: b.compound },
    { label: r.rowWear, help: r.helpWear, value: b.tyreWear },
    { label: r.rowFuel, help: r.helpFuel, value: b.fuel },
    { label: r.rowRain, help: r.helpRain, value: b.rain },
    { label: r.rowPits, help: r.helpPits(result.pitStopCount, fmt.seconds(perStop)), value: b.pitStops },
  ];
  // Translated texts for known model versions; otherwise the backend's own list.
  const assumptions =
    lookup(t.assumptions, result.modelVersion)?.(p.rainPenaltySecondsPerIntensity) ?? result.assumptions;

  return (
    <section className="result" aria-label={title}>
      <div className="result-header">
        <h3>{title}</h3>
        {actions}
      </div>
      {notice}

      <dl className="kpis">
        <div className="kpi kpi-main">
          <dt>{r.total}</dt>
          <dd className="kpi-value">
            <CountUp value={result.totalTimeSeconds} format={fmt.raceTime} />
          </dd>
        </div>
        <div className="kpi">
          <dt>{r.stops}</dt>
          <dd className="kpi-value">{result.pitStopCount}</dd>
          {!result.meetsMinimumPitStops && <dd className="warn-text">{r.belowMin(p.minimumPitStops)}</dd>}
        </div>
        <div className="kpi">
          <dt>{r.pitTime}</dt>
          <dd className="kpi-value">{fmt.seconds(result.pitStopTotalSeconds, 1)}</dd>
        </div>
      </dl>

      <StrategyBar stints={result.stints} pitStops={result.pitStops} totalLaps={p.totalLaps} />

      <section className="card" aria-labelledby="breakdown-heading">
        <h4 id="breakdown-heading" className="card-title">
          {r.breakdownHeading}
        </h4>
        <p className="muted receipt-lead">{r.breakdownLead}</p>
        <ul className="receipt">
          <li className="receipt-row receipt-base">
            <span className="receipt-sign" aria-hidden="true" />
            <span className="receipt-label">
              {r.rowBase}
              <span className="receipt-help">{r.helpBase(p.totalLaps, fmt.raceTime(p.baseLapTimeSeconds))}</span>
            </span>
            <span className="receipt-value mono">{fmt.raceTime(b.base)}</span>
          </li>
          {effects.map((effect) => {
            const none = Math.abs(effect.value) < NO_EFFECT_SECONDS;
            const tone = none ? "none" : effect.value > 0 ? "slower" : "faster";
            return (
              <li key={effect.label} className={`receipt-row receipt-${tone}`}>
                <span className="receipt-sign" aria-hidden="true">
                  {none ? "·" : effect.value > 0 ? "+" : "−"}
                </span>
                <span className="receipt-label">
                  {effect.label}
                  <span className="receipt-help">{effect.help}</span>
                </span>
                <span className="receipt-value">
                  <span className="mono">{none ? fmt.seconds(0) : fmt.signedSeconds(effect.value)}</span>
                  <span className="receipt-chip">{none ? r.noEffect : tone === "slower" ? r.slower : r.faster}</span>
                </span>
              </li>
            );
          })}
          <li className="receipt-row receipt-total">
            <span className="receipt-sign" aria-hidden="true">
              =
            </span>
            <span className="receipt-label">{r.rowTotal}</span>
            <span className="receipt-value mono">{fmt.raceTime(result.totalTimeSeconds)}</span>
          </li>
        </ul>
        <p className="muted small note">{r.breakdownRounding}</p>
      </section>

      <section className="card" aria-labelledby="chart-heading">
        <h4 id="chart-heading" className="card-title">
          {r.chartHeading}
        </h4>
        <p className="muted receipt-lead">{r.chartLead}</p>
        <LapCharts result={result} />
      </section>

      <details className="card result-details">
        <summary>{r.detailsSummary}</summary>

        <h4 className="card-title">{r.stintsHeading}</h4>
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">#</th>
                <th scope="col">{r.colCompound}</th>
                <th scope="col">{r.colLaps}</th>
                <th scope="col" className="num">
                  {r.colStintTime}
                </th>
                <th scope="col" className="num">
                  {r.colAverage}
                </th>
                <th scope="col" className="num">
                  {r.colWear}
                </th>
                <th scope="col" className="num">
                  {r.colRain}
                </th>
              </tr>
            </thead>
            <tbody>
              {result.stints.map((stint) => (
                <tr key={stint.stintNumber}>
                  <td className="num">{stint.stintNumber}</td>
                  <td>
                    <TyreBadge compound={stint.compound} />
                  </td>
                  <td className="num">
                    {stint.startLap}–{stint.endLap}
                  </td>
                  <td className="num">{fmt.raceTime(stint.timeSeconds)}</td>
                  <td className="num">{fmt.raceTime(stint.averageLapTimeSeconds)}</td>
                  <td className="num">{fmt.signedSeconds(stint.tyreWearSeconds)}</td>
                  <td className="num">{fmt.signedSeconds(stint.rainPenaltySeconds)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="muted small note">{r.stintsNote}</p>

        <h4 className="card-title">{r.pitsHeading}</h4>
        {result.pitStops.length === 0 ? (
          <p className="muted">{r.noPits}</p>
        ) : (
          <ol className="pit-list">
            {result.pitStops.map((stop) => (
              <li key={stop.stopNumber} className="pit-item">
                <span className="pit-number mono">P{stop.stopNumber}</span>
                <span className="pit-body">
                  <span className="pit-change">
                    <TyreBadge compound={stop.fromCompound} compact />
                    <span aria-hidden="true">→</span>
                    <TyreBadge compound={stop.toCompound} compact />
                  </span>
                  <span className="pit-detail">
                    {r.colInLap}: <span className="mono">{stop.inLap}</span> · {r.colPitLoss}:{" "}
                    <span className="mono">{fmt.seconds(stop.pitLaneLossSeconds)}</span> · {r.colTyreChange}:{" "}
                    <span className="mono">{fmt.seconds(stop.tyreChangeSeconds)}</span>
                  </span>
                </span>
                <span className="pit-total mono">
                  <span className="visually-hidden">{r.colTotal}: </span>
                  {fmt.seconds(stop.totalLossSeconds)}
                </span>
              </li>
            ))}
          </ol>
        )}

        <h4 className="card-title">{r.assumptionsHeading(result.modelVersion)}</h4>
        <ul className="assumption-list">
          {assumptions.map((assumption) => (
            <li key={assumption}>{assumption}</li>
          ))}
        </ul>
      </details>
      <p className="fictional-note">{r.fictional}</p>
    </section>
  );
}
