"use client";

import { type FormEvent, type ReactNode, useEffect, useRef, useState } from "react";
import { describeError } from "@/i18n/describe-error";
import { useI18n } from "@/i18n/useI18n";
import { api, isOutcomeUnknown } from "@/lib/api";
import { defaultStints, type EditableStint, strategyKey, toStrategy } from "@/lib/strategy";
import type { LoadState, RaceContext, RaceSummary, SavedSimulationDetail, SimulationResponse } from "@/lib/types";
import { RaceInfo, TyrePanel } from "./RaceInfo";
import { RacePicker } from "./RacePicker";
import { Magnet } from "./reactbits/Magnet";
import { SavedSimulations } from "./SavedSimulations";
import { SimulationResultView } from "./SimulationResultView";
import { ErrorMessage, Loading } from "./StatusMessage";
import { StrategyEditor, StrategyPreview } from "./StrategyEditor";

const STEPS = ["race", "circuit", "strategy", "result"] as const;
type Step = (typeof STEPS)[number];
/** "home" is the saved-simulations list; the numbered steps only show while creating one. */
type View = Step | "home";

/** Heading of each view: labels its section and receives focus when the view opens. */
const HEADING_IDS: Record<View, string> = {
  race: "race-heading",
  circuit: "circuit-step-heading",
  strategy: "strategy-heading",
  result: "result-heading",
  home: "history-heading",
};

/** "1. Elegí una carrera" → step number styled apart; the text stays the same. */
function StepHeading({ id, text }: { id: string; text: string }) {
  const match = /^(\d+\.)\s*(.*)$/.exec(text);
  return (
    // Focus target when the step changes, so screen readers announce the new step.
    <h2 id={id} className="step-heading" tabIndex={-1}>
      {match ? (
        <>
          <span className="step-number">{match[1]}</span> {match[2]}
        </>
      ) : (
        text
      )}
    </h2>
  );
}

function ArrowIcon({ direction }: { direction: "back" | "next" }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true">
      <path d={direction === "back" ? "M15 5l-7 7 7 7" : "M9 5l7 7-7 7"} />
    </svg>
  );
}

/** Back / next buttons at the bottom of a step. */
function StepNav({
  backLabel,
  onBack,
  nextLabel,
  onNext,
  nextDisabled = false,
  children,
}: {
  backLabel?: string;
  onBack?: () => void;
  nextLabel?: string;
  onNext?: () => void;
  nextDisabled?: boolean;
  children?: ReactNode;
}) {
  return (
    <div className="step-nav">
      {onBack && backLabel ? (
        <button type="button" className="button button-secondary" onClick={onBack}>
          <ArrowIcon direction="back" /> {backLabel}
        </button>
      ) : (
        <span />
      )}
      {children}
      {onNext && nextLabel && (
        <button type="button" className="button button-light" onClick={onNext} disabled={nextDisabled}>
          {nextLabel} <ArrowIcon direction="next" />
        </button>
      )}
    </div>
  );
}

interface SimulationRun {
  /** Unique per run, even when two runs use the same race and strategy. */
  id: number;
  response: SimulationResponse;
  /** Identifies the race + strategy that produced this result. */
  key: string;
}

/** Save status of one run; `runId` ties it to the run that started the save. */
type SaveState =
  | { status: "idle" }
  | { status: "saving"; runId: number }
  | { status: "saved"; runId: number; saved: SavedSimulationDetail }
  | { status: "error"; runId: number; error: unknown; outcomeUnknown: boolean };

export function Strategist() {
  const { t } = useI18n();
  const [racesReload, setRacesReload] = useState(0);
  const [races, setRaces] = useState<LoadState<RaceSummary[]>>({ status: "loading" });
  const [raceId, setRaceId] = useState("");
  const [context, setContext] = useState<LoadState<RaceContext>>({ status: "idle" });
  const [stints, setStints] = useState<EditableStint[]>([]);
  const [simulation, setSimulation] = useState<LoadState<SimulationRun>>({ status: "idle" });
  const [save, setSave] = useState<SaveState>({ status: "idle" });
  const [historyVersion, setHistoryVersion] = useState(0);
  const [view, setView] = useState<View>("home");

  // Responses that arrive after the user picked another race are ignored.
  const contextRequest = useRef(0);
  const simulationRequest = useRef(0);
  const navRef = useRef<HTMLElement>(null);
  // Last view the focus effect handled; skips the initial render (even when
  // Strict Mode runs effects twice) so the page does not open with a focused heading.
  const shownView = useRef<View>(view);

  useEffect(() => {
    let cancelled = false;
    api
      .listRaces()
      .then((data) => {
        if (!cancelled) setRaces({ status: "ready", data });
      })
      .catch((error: unknown) => {
        if (!cancelled) setRaces({ status: "error", error });
      });
    return () => {
      cancelled = true;
    };
  }, [racesReload]);

  // After a step change, bring the step into view and move focus to its heading.
  useEffect(() => {
    if (shownView.current === view) return;
    shownView.current = view;
    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
    const heading = document.getElementById(HEADING_IDS[view]);
    // In the steps the sticky step bar is the top; on the home screen, its heading.
    const top = view === "home" ? heading : navRef.current;
    top?.scrollIntoView?.({ block: "start", behavior: reduceMotion ? "auto" : "smooth" });
    heading?.focus({ preventScroll: true });
  }, [view]);

  function retryRaces() {
    setRaces({ status: "loading" });
    setRacesReload((n) => n + 1);
  }

  function loadContext(id: string) {
    const requestId = ++contextRequest.current;
    setContext({ status: "loading" });
    api
      .getRaceContext(id)
      .then((data) => {
        if (contextRequest.current !== requestId) return;
        setContext({ status: "ready", data });
        setStints(defaultStints(data.race.laps, data.tyres));
      })
      .catch((error: unknown) => {
        if (contextRequest.current === requestId) setContext({ status: "error", error });
      });
  }

  function selectRace(id: string) {
    if (id === raceId) return;
    // A new race invalidates the strategy and any previous result.
    setRaceId(id);
    setStints([]);
    simulationRequest.current++;
    setSimulation({ status: "idle" });
    setSave({ status: "idle" });
    if (id) {
      loadContext(id);
    } else {
      contextRequest.current++;
      setContext({ status: "idle" });
    }
  }

  const raceContext = context.status === "ready" ? context.data : null;
  const totalLaps = raceContext?.race.laps ?? 0;
  const strategy = raceContext ? toStrategy(stints, totalLaps) : null;
  const currentKey = strategy ? strategyKey(raceId, strategy) : null;
  const run = simulation.status === "ready" ? simulation.data : null;
  const isStale = run !== null && run.key !== currentKey;
  const simulating = simulation.status === "loading";

  const available: Record<Step, boolean> = {
    race: true,
    circuit: raceId !== "",
    strategy: raceContext !== null,
    result: raceContext !== null && simulation.status !== "idle",
  };

  function go(next: View) {
    if (next !== "home" && !available[next]) return;
    setView(next);
  }

  /** Opens the steps for a brand-new simulation, discarding any unfinished one. */
  function createSimulation() {
    selectRace("");
    setView("race");
  }

  function simulate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!strategy || simulating) return;
    const requestId = ++simulationRequest.current;
    const key = strategyKey(raceId, strategy);
    setSimulation({ status: "loading" });
    setSave({ status: "idle" });
    setView("result");
    api
      .simulate(raceId, strategy)
      .then((response) => {
        if (simulationRequest.current === requestId) {
          setSimulation({ status: "ready", data: { id: requestId, response, key } });
        }
      })
      .catch((error: unknown) => {
        if (simulationRequest.current === requestId) setSimulation({ status: "error", error });
      });
  }

  function saveResult() {
    if (!run || save.status === "saving") return;
    const runId = run.id;
    // A new run or race resets `save`, so an answer for an older run is dropped
    // here. The request itself is not aborted: the server may still write it.
    const settle = (next: SaveState) =>
      setSave((current) => (current.status === "saving" && current.runId === runId ? next : current));
    setSave({ status: "saving", runId });
    // The backend recomputes the result from the strategy; it never trusts our numbers.
    api
      .saveSimulation(run.response.raceId, run.response.strategy)
      .then((saved) => {
        settle({ status: "saved", runId, saved });
        // Refreshed even if the user moved on: the history has a new row either way.
        setHistoryVersion((n) => n + 1);
      })
      .catch((error: unknown) => {
        const outcomeUnknown = isOutcomeUnknown(error);
        settle({ status: "error", runId, error, outcomeUnknown });
        // The write may have happened, so show the history as it is now.
        if (outcomeUnknown) setHistoryVersion((n) => n + 1);
      });
  }

  const selectedRace = races.status === "ready" ? races.data.find((r) => r.id === raceId) : undefined;
  const saveLabel =
    save.status === "saving"
      ? t.result.saving
      : save.status === "saved"
        ? t.result.savedButton
        : save.status === "error"
          ? t.result.retrySave
          : t.result.save;
  const stepIndex = (step: Step) => STEPS.indexOf(step) + 1;
  const progress = (step: Step) => <p className="kicker">{t.wizard.stepOf(stepIndex(step), STEPS.length)}</p>;

  return (
    <>
      <section className="step home" aria-labelledby={HEADING_IDS.home} hidden={view !== "home"}>
        <div className="home-head">
          <div className="home-title">
            <StepHeading id={HEADING_IDS.home} text={t.history.heading} />
            <p className="step-intro">{t.home.intro}</p>
          </div>
          <button type="button" className="button button-create" onClick={createSimulation}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true">
              <path d="M12 5v14M5 12h14" />
            </svg>
            {t.home.create}
          </button>
        </div>
        <SavedSimulations version={historyVersion} />
      </section>

      <div className="wizard" hidden={view === "home"}>
        <nav ref={navRef} className="wizard-nav" aria-label={t.wizard.label}>
          <ol className="wizard-steps">
            {STEPS.map((step) => (
              <li key={step}>
                <button
                  type="button"
                  className="wizard-step"
                  aria-current={view === step ? "step" : undefined}
                  disabled={!available[step]}
                  onClick={() => go(step)}
                >
                  <span className="wizard-step-number" aria-hidden="true">
                    {stepIndex(step)}
                  </span>
                  <span>{t.wizard.steps[step]}</span>
                </button>
              </li>
            ))}
          </ol>
          <button type="button" className="wizard-exit" onClick={() => go("home")}>
            <ArrowIcon direction="back" /> {t.home.exit}
          </button>
        </nav>

        <section className="step" aria-labelledby={HEADING_IDS.race} hidden={view !== "race"}>
          {progress("race")}
          <StepHeading id={HEADING_IDS.race} text={t.races.heading} />
          {races.status === "loading" && <Loading label={t.races.loading} />}
          {races.status === "error" && <ErrorMessage error={races.error} onRetry={retryRaces} />}
          {races.status === "ready" && races.data.length === 0 && <p className="muted">{t.races.empty}</p>}
          {races.status === "ready" && races.data.length > 0 && (
            <RacePicker races={races.data} selectedId={raceId} onSelect={selectRace} />
          )}
          <StepNav nextLabel={t.wizard.next} onNext={() => go("circuit")} nextDisabled={!raceId}>
            <p className="step-nav-note" aria-live="polite">
              {selectedRace ? t.wizard.chosen(selectedRace.name) : t.wizard.chooseFirst}
            </p>
          </StepNav>
        </section>

        <section className="step" aria-labelledby={HEADING_IDS.circuit} hidden={view !== "circuit"}>
          {progress("circuit")}
          <StepHeading id={HEADING_IDS.circuit} text={`2. ${selectedRace?.name ?? t.info.fallbackHeading}`} />
          {context.status === "loading" && <Loading label={t.info.loading} />}
          {context.status === "error" && <ErrorMessage error={context.error} onRetry={() => loadContext(raceId)} />}
          {raceContext && <RaceInfo context={raceContext} />}
          <StepNav
            backLabel={t.wizard.back}
            onBack={() => go("race")}
            nextLabel={t.wizard.next}
            onNext={() => go("strategy")}
            nextDisabled={!raceContext}
          />
        </section>

        <section className="step" aria-labelledby={HEADING_IDS.strategy} hidden={view !== "strategy"}>
          {progress("strategy")}
          <StepHeading id={HEADING_IDS.strategy} text={t.strategy.heading} />
          {raceContext && (
            <>
              <p className="step-intro">{t.strategy.intro}</p>
              <StrategyPreview stints={stints} forecast={raceContext.weather.forecast} totalLaps={totalLaps} />
              <div className="strategy-layout">
                <form className="strategy-form" onSubmit={simulate}>
                  <StrategyEditor
                    totalLaps={totalLaps}
                    tyres={raceContext.tyres}
                    minimumPitStops={raceContext.simulationParameters.minimumPitStops}
                    stints={stints}
                    onChange={setStints}
                    disabled={simulating}
                  />
                  <Magnet className="simulate-magnet" disabled={!strategy || simulating}>
                    <button type="submit" className="button button-primary" disabled={!strategy || simulating}>
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M5 4v16M5 4h11l-2 4 2 4H5" />
                      </svg>
                      {simulating ? t.strategy.simulating : t.strategy.simulate}
                    </button>
                  </Magnet>
                  {!strategy && <p className="muted inline-hint">{t.strategy.incompleteHint(totalLaps)}</p>}
                </form>
                <TyrePanel tyres={raceContext.tyres} circuitTyreWear={raceContext.race.circuit.tyreWear} />
              </div>
            </>
          )}
          <StepNav backLabel={t.wizard.back} onBack={() => go("circuit")} />
        </section>

        <section className="step" aria-labelledby={HEADING_IDS.result} aria-busy={simulating} hidden={view !== "result"}>
          {progress("result")}
          <StepHeading id={HEADING_IDS.result} text={t.result.heading} />
          {simulation.status === "loading" && <Loading label={t.result.loading} />}
          {simulation.status === "error" && <ErrorMessage error={simulation.error} />}
          {run && (
            <SimulationResultView
              title={`${run.response.raceName} · ${run.response.circuitName}`}
              result={run.response.result}
              notice={
                <>
                  {isStale && (
                    <p className="status status-warning" role="status">
                      {t.result.stale}
                    </p>
                  )}
                  {save.status === "saved" && (
                    <p className="status status-ok" role="status">
                      {t.result.saved}
                    </p>
                  )}
                  {save.status === "error" && (
                    <p className={`status ${save.outcomeUnknown ? "status-warning" : "status-error"}`} role="alert">
                      {describeError(save.error, t).message}{" "}
                      {save.outcomeUnknown ? t.result.saveUnknownSuffix : t.result.saveErrorSuffix}
                    </p>
                  )}
                </>
              }
              actions={
                <button
                  type="button"
                  className="button button-light"
                  onClick={saveResult}
                  disabled={save.status === "saving" || save.status === "saved"}
                >
                  {saveLabel}
                </button>
              }
            />
          )}
          <StepNav
            backLabel={t.wizard.editStrategy}
            onBack={() => go("strategy")}
            nextLabel={t.home.viewSaved}
            onNext={() => go("home")}
          />
        </section>
      </div>
    </>
  );
}
