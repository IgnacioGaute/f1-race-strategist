"use client";

import { lookup } from "@/i18n/messages";
import { useI18n } from "@/i18n/useI18n";
import { barPosition, lapCenter, lapSpanStyle, lapTicks } from "@/lib/chart";
import { compoundStyle } from "@/lib/tyres";
import type { RaceContext, Tyre, WeatherSegment } from "@/lib/types";
import { TeamCrest } from "./TeamCrest";
import { compoundLabel } from "./TyreBadge";

type DataRole = "calc" | "warning";

/** Marks how a value is used: in the time calculation, or only to raise a warning. */
export function RoleTag({ role }: { role: DataRole }) {
  const { t } = useI18n();
  return role === "calc" ? (
    <abbr className="role-tag role-calc" title={t.info.tagCalcTitle}>
      {t.info.tagCalc}
    </abbr>
  ) : (
    <abbr className="role-tag role-warning" title={t.info.tagWarningTitle}>
      {t.info.tagWarning}
    </abbr>
  );
}

function Fact({ label, value, role }: { label: string; value: string; role?: DataRole }) {
  return (
    <div className="fact">
      <dt>
        <span>{label}</span> {role && <RoleTag role={role} />}
      </dt>
      <dd>{value}</dd>
    </div>
  );
}

/** One parameter as a row: name on the left, value aligned on the right. */
function ParamRow({ label, value, role }: { label: string; value: string; role?: DataRole }) {
  return (
    <div className="param-row">
      <dt>
        {label} {role && <RoleTag role={role} />}
      </dt>
      <dd className="mono">{value}</dd>
    </div>
  );
}

/**
 * Lap ruler under lap-based strips: first lap, every ten laps and the last one
 * (only the first and last when the ruler is narrow; see .lap-ruler-frame).
 * Uses the bar scale: middle labels sit in the middle of their lap, and the
 * first and last ones on the bar's edges (start of lap 1, end of the last lap).
 */
export function LapRuler({ totalLaps }: { totalLaps: number }) {
  const { t } = useI18n();
  const position = (lap: number) =>
    lap === 1 ? 0 : lap === totalLaps ? 1 : lapCenter(lap, totalLaps);
  return (
    <div className="lap-ruler-frame" aria-hidden="true">
      <div className="lap-ruler">
        {lapTicks(totalLaps).map((lap) => (
          <span key={lap} style={{ left: barPosition(position(lap)) }}>
            {t.lapAxis}
            {lap}
          </span>
        ))}
      </div>
    </div>
  );
}

/**
 * Forecast on the lap scale, so it lines up with strategy bars of the same race;
 * intensity sets how blue a segment is. Short segments may clip their label; the
 * strip's accessible name lists every segment.
 */
export function WeatherStrip({
  forecast,
  totalLaps,
  compact = false,
}: {
  forecast: WeatherSegment[];
  totalLaps: number;
  compact?: boolean;
}) {
  const { t, fmt } = useI18n();
  const rainLabel = (segment: WeatherSegment) =>
    t.info.rainSegment({
      from: segment.fromLap,
      to: segment.toLap,
      intensity: segment.rainIntensity === 0 ? null : fmt.number(segment.rainIntensity),
    });
  return (
    <div
      className={compact ? "lap-bar weather-strip weather-strip-compact" : "lap-bar weather-strip"}
      role="img"
      aria-label={`${t.info.forecastPrefix}: ${forecast.map(rainLabel).join("; ")}`}
    >
      {forecast.map((segment) => (
        <div
          key={segment.fromLap}
          className={segment.rainIntensity > 0 ? "weather-segment is-wet" : "weather-segment"}
          title={rainLabel(segment)}
          style={{
            ...lapSpanStyle(segment.fromLap, segment.toLap, totalLaps),
            backgroundColor:
              segment.rainIntensity > 0
                ? `color-mix(in srgb, var(--rain) ${Math.round(35 + segment.rainIntensity * 65)}%, var(--rain-dark))`
                : undefined,
          }}
        >
          <span className="segment-label">{rainLabel(segment)}</span>
        </div>
      ))}
    </div>
  );
}

/** Circuit, weather, parameters and the championship grid. */
export function RaceInfo({ context }: { context: RaceContext }) {
  const { t, fmt } = useI18n();
  const { race, weather, simulationParameters: params, grid } = context;
  const { circuit } = race;
  const ranked = [...grid].sort((a, b) => b.team.carPerformance - a.team.carPerformance);

  return (
    <div className="race-info">
      <p className="legend">
        <RoleTag role="calc" /> {t.info.legendCalc} · <RoleTag role="warning" /> {t.info.legendWarning} ·{" "}
        {t.info.legendNone}
      </p>

      <section className="card circuit-card" aria-labelledby="circuit-heading">
        <p className="kicker">
          {t.info.circuitSubtitle({
            country: circuit.country,
            type: lookup(t.circuitTypes, circuit.type) ?? circuit.type,
            round: race.round,
            date: fmt.date(race.date),
          })}
        </p>
        <h3 id="circuit-heading" className="circuit-name">
          {circuit.name}
        </h3>
        <dl className="facts">
          <Fact label={t.info.laps} value={String(race.laps)} role="calc" />
          <Fact label={t.info.baseLap} value={fmt.raceTime(circuit.baseLapTime)} role="calc" />
          <Fact label={t.info.tyreWear} value={`× ${fmt.number(circuit.tyreWear)}`} role="calc" />
          <Fact label={t.info.rainProbability} value={fmt.percent(race.rainProbability)} />
          <Fact label={t.info.temperature} value={`${race.temperature} °C`} />
        </dl>
      </section>

      <section className="card" aria-labelledby="rain-heading">
        <div className="card-head">
          <h4 id="rain-heading" className="card-title">
            {t.info.rainHeading} <RoleTag role="calc" />
          </h4>
          <p className="card-head-note">
            <span className="muted">{t.info.providerSummary}</span> <q lang="en">{weather.summary}</q>
          </p>
        </div>
        <WeatherStrip forecast={weather.forecast} totalLaps={race.laps} />
        <LapRuler totalLaps={race.laps} />
        <p className="muted small note">{t.info.rainNote}</p>
      </section>

      <details className="card params">
        <summary>{t.info.detailsSummary}</summary>
        <div className="param-groups">
          <section className="param-group" aria-labelledby="params-calc-heading">
            <h4 id="params-calc-heading" className="param-group-title">
              {t.info.paramsCalc} <RoleTag role="calc" />
            </h4>
            <dl className="param-list">
              <ParamRow label={t.info.pitLoss} value={fmt.seconds(params.pitStopLoss, 1)} />
              <ParamRow label={t.info.tyreChange} value={fmt.seconds(params.tyreChangeTime, 1)} />
              <ParamRow label={t.info.fuelEffect} value={`${fmt.seconds(params.fuelEffectPerLap)} ${t.info.perLap}`} />
              <ParamRow label={t.info.minStops} value={String(params.minimumPitStops)} role="warning" />
            </dl>
          </section>
          <section className="param-group" aria-labelledby="params-context-heading">
            <h4 id="params-context-heading" className="param-group-title">
              {t.info.paramsContext}
            </h4>
            <dl className="param-list">
              <ParamRow label={t.info.lapVariance} value={`± ${fmt.seconds(params.lapTimeVariance, 2)}`} />
              <ParamRow label={t.info.safetyCar} value={fmt.percent(params.safetyCarProbability)} />
              <ParamRow label={t.info.length} value={`${fmt.number(circuit.lengthKm, 3)} km`} />
              <ParamRow label={t.info.overtaking} value={fmt.percent(circuit.overtakingDifficulty)} />
            </dl>
          </section>
        </div>

        <h4 className="param-group-title forecast-title">{t.info.forecastCaption}</h4>
        <div className="table-scroll">
          <table className="data-table forecast-table">
            <thead>
              <tr>
                <th scope="col">{t.info.forecastLaps}</th>
                <th scope="col">{t.info.forecastIntensity}</th>
                <th scope="col" className="num">
                  {t.info.forecastTemperature}
                </th>
              </tr>
            </thead>
            <tbody>
              {weather.forecast.map((segment) => (
                <tr key={segment.fromLap}>
                  <td className="mono">
                    {t.lapAxis}
                    {segment.fromLap}–{segment.toLap}
                  </td>
                  <td>
                    <span className="intensity">
                      <span className="intensity-track" aria-hidden="true">
                        <span className="intensity-fill" style={{ width: `${Math.round(segment.rainIntensity * 100)}%` }} />
                      </span>
                      <span className="mono">{fmt.number(segment.rainIntensity)}</span>
                      {segment.rainIntensity === 0 && <span className="muted">{t.info.dry}</span>}
                    </span>
                  </td>
                  <td className="num">{segment.temperature} °C</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>

      {ranked.length > 0 && (
        <details className="card grid-details">
          <summary>{t.info.gridSummary}</summary>
          <div className="table-scroll">
            <table className="data-table grid-table">
              <thead>
                <tr>
                  <th scope="col">{t.info.gridTeam}</th>
                  <th scope="col" className="num">
                    {t.info.gridCar}
                  </th>
                  <th scope="col">{t.info.gridDrivers}</th>
                </tr>
              </thead>
              <tbody>
                {ranked.map(({ team, drivers }) => (
                  <tr key={team.id}>
                    <th scope="row">
                      <span className="grid-team">
                        <TeamCrest team={team} size={20} />
                        {team.name}
                      </span>
                    </th>
                    <td className="num">{fmt.number(team.carPerformance, 3)}</td>
                    <td>
                      {drivers.map((driver) => (
                        <div key={driver.id} className="grid-driver">
                          <span className="mono">#{driver.number}</span> {driver.name}{" "}
                          <span className="muted mono">
                            {fmt.number(driver.pace, 3)} · {fmt.number(driver.consistency)}
                          </span>
                        </div>
                      ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </div>
  );
}

/** Compound cards shown next to the strategy editor, to compare while choosing. */
export function TyrePanel({ tyres, circuitTyreWear }: { tyres: Tyre[]; circuitTyreWear: number }) {
  const { t, fmt } = useI18n();
  return (
    <aside className="card tyre-panel" aria-labelledby="tyres-heading">
      <h3 id="tyres-heading" className="card-title">
        {t.tyres.heading} <RoleTag role="calc" />
      </h3>
      <ul className="tyre-list" aria-label={t.tyres.caption}>
        {tyres.map((tyre) => {
          const style = compoundStyle(tyre.compound);
          const { min, max } = tyre.optimalRainIntensity;
          return (
            <li key={tyre.compound} className="tyre-item">
              <div className="tyre-item-head">
                <span className="tyre-dot tyre-dot-large" style={{ borderColor: style.color, color: style.color }} aria-hidden="true">
                  {style.letter}
                </span>
                <span className="tyre-item-name">{compoundLabel(tyre.compound, t.compounds)}</span>
                <span className="tyre-pace mono" title={t.tyres.pace}>
                  <span className="visually-hidden">{t.tyres.pace}: </span>
                  {fmt.signedSeconds(tyre.pace, 2)}
                </span>
              </div>
              {/* Short labels on screen; the full description stays available as a tooltip. */}
              <dl className="tyre-stats">
                <div title={`${t.tyres.degradation} (${fmt.number(tyre.degradation, 3)} × ${fmt.number(circuitTyreWear)})`}>
                  <dt>{t.tyres.wearShort}</dt>
                  <dd className="mono">{fmt.seconds(tyre.degradation * circuitTyreWear)}</dd>
                </div>
                <div title={t.tyres.optimalRain}>
                  <dt>{t.tyres.rainShort}</dt>
                  <dd className="mono">
                    {fmt.number(min)}–{fmt.number(max)}
                  </dd>
                </div>
                <div title={t.tyres.wet}>
                  <dt>{t.tyres.wetShort}</dt>
                  <dd className="mono">{fmt.percent(tyre.wetPerformance)}</dd>
                </div>
              </dl>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
