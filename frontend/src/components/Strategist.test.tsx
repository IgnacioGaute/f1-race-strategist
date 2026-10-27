import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MESSAGES } from "@/i18n/messages";
import { api, ApiError } from "@/lib/api";
import type {
  RaceContext,
  RaceSummary,
  SavedSimulationDetail,
  SimulationResponse,
  SimulationResult,
  Tyre,
} from "@/lib/types";
import { Strategist } from "./Strategist";

// Controlled backend answers: no network, no real API.

const t = MESSAGES.es;
const RACE_ID = "race-01";
const LAPS = 4;
const STRATEGY = [
  { compound: "MEDIUM", laps: 2 },
  { compound: "HARD", laps: 2 },
];

const raceSummary: RaceSummary = {
  id: RACE_ID,
  name: "Test Grand Prix",
  round: 1,
  date: "2026-03-01",
  laps: LAPS,
  circuitName: "Test Circuit",
  country: "Testland",
  rainProbability: 0,
};

function tyre(compound: string): Tyre {
  return { compound, pace: 0.5, degradation: 0.05, wetPerformance: 0.1, optimalRainIntensity: { min: 0, max: 0.1 } };
}

const context: RaceContext = {
  race: {
    id: RACE_ID,
    name: raceSummary.name,
    round: 1,
    date: raceSummary.date,
    laps: LAPS,
    rainProbability: 0,
    circuitId: "circuit-01",
    temperature: 25,
    circuit: {
      id: "circuit-01",
      name: raceSummary.circuitName,
      country: raceSummary.country,
      type: "permanent",
      laps: LAPS,
      lengthKm: 5,
      baseLapTime: 90,
      pitStopLoss: 20,
      tyreWear: 1,
      overtakingDifficulty: 0.5,
    },
  },
  weather: { raceId: RACE_ID, summary: "Dry", forecast: [{ fromLap: 1, toLap: LAPS, temperature: 25, rainIntensity: 0 }] },
  simulationParameters: {
    raceId: RACE_ID,
    lapTimeVariance: 0,
    pitStopLoss: 20,
    tyreChangeTime: 2.5,
    fuelEffectPerLap: 0.05,
    safetyCarProbability: 0,
    minimumPitStops: 1,
  },
  tyres: [tyre("MEDIUM"), tyre("HARD")],
  grid: [],
};

const result: SimulationResult = {
  modelVersion: "test",
  totalTimeSeconds: 382.5,
  lapTimeTotalSeconds: 360,
  pitStopTotalSeconds: 22.5,
  pitStopCount: 1,
  meetsMinimumPitStops: true,
  timeBreakdown: { base: 360, compound: 0, tyreWear: 0, fuel: 0, rain: 0, pitStops: 22.5 },
  stints: STRATEGY.map((stint, i) => ({
    stintNumber: i + 1,
    compound: stint.compound,
    startLap: i * 2 + 1,
    endLap: i * 2 + 2,
    laps: 2,
    timeSeconds: 180,
    averageLapTimeSeconds: 90,
    tyreWearSeconds: 0,
    rainPenaltySeconds: 0,
  })),
  pitStops: [
    {
      stopNumber: 1,
      inLap: 2,
      fromCompound: "MEDIUM",
      toCompound: "HARD",
      pitLaneLossSeconds: 20,
      tyreChangeSeconds: 2.5,
      totalLossSeconds: 22.5,
    },
  ],
  laps: Array.from({ length: LAPS }, (_, i) => ({
    lap: i + 1,
    stintNumber: i < 2 ? 1 : 2,
    compound: i < 2 ? "MEDIUM" : "HARD",
    tyreAge: i % 2,
    rainIntensity: 0,
    lapTimeSeconds: 90 + i * 0.1,
    components: { base: 90, compound: 0, tyreWear: 0, fuel: 0, rain: 0 },
  })),
  parametersUsed: {
    totalLaps: LAPS,
    baseLapTimeSeconds: 90,
    circuitTyreWearMultiplier: 1,
    pitStopLossSeconds: 20,
    tyreChangeTimeSeconds: 2.5,
    fuelEffectPerLapSeconds: 0.05,
    rainPenaltySecondsPerIntensity: 30,
    minimumPitStops: 1,
  },
  assumptions: [],
};

const simulation: SimulationResponse = {
  raceId: RACE_ID,
  raceName: raceSummary.name,
  circuitName: raceSummary.circuitName,
  strategy: STRATEGY,
  result,
};

const savedA: SavedSimulationDetail = {
  id: "00000000-0000-4000-8000-000000000001",
  createdAt: "2026-10-27T12:00:00.000Z",
  raceId: RACE_ID,
  raceName: raceSummary.name,
  modelVersion: result.modelVersion,
  totalTimeSeconds: result.totalTimeSeconds,
  pitStopCount: 1,
  strategy: STRATEGY,
  result,
};

interface PendingSave {
  resolve: (saved: SavedSimulationDetail) => void;
  reject: (error: unknown) => void;
}

let pendingSaves: PendingSave[];

beforeEach(() => {
  pendingSaves = [];
  vi.spyOn(api, "listRaces").mockResolvedValue([raceSummary]);
  vi.spyOn(api, "getRaceContext").mockResolvedValue(context);
  vi.spyOn(api, "listSavedSimulations").mockResolvedValue([]);
  // Every run gets the same answer: two runs of one configuration look identical.
  vi.spyOn(api, "simulate").mockImplementation(() => Promise.resolve(simulation));
  // Saves stay pending until the test settles them.
  vi.spyOn(api, "saveSimulation").mockImplementation(
    () => new Promise((resolve, reject) => pendingSaves.push({ resolve, reject })),
  );
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

/** The race select's button: its name is the field label followed by the value (the step bar has a bare "Carrera"). */
function raceSelect() {
  return screen.findByRole("button", { name: new RegExp(`^${t.races.label} .+`) });
}

/** Opens the race select and picks the test race. */
async function chooseRace() {
  fireEvent.click(await raceSelect());
  fireEvent.click(await screen.findByRole("option", { name: new RegExp(raceSummary.name) }));
}

/** Clicks the bottom "next" button of the visible step. */
async function next() {
  const button = await screen.findByRole("button", { name: t.wizard.next });
  await waitFor(() => expect(button).toHaveProperty("disabled", false));
  fireEvent.click(button);
}

/** Renders the screen, picks the race, walks the steps and runs one simulation with the default strategy. */
async function simulateOnce() {
  render(<Strategist />);
  fireEvent.click(screen.getByRole("button", { name: t.home.create }));
  await chooseRace();
  await next(); // race → circuit
  await next(); // circuit → strategy
  fireEvent.click(await screen.findByRole("button", { name: t.strategy.simulate }));
  return screen.findByRole("button", { name: t.result.save });
}

/** Starts saving the current run (A) and then runs a new simulation (B) before the save answers. */
async function saveAThenSimulateB() {
  fireEvent.click(await simulateOnce());
  expect(screen.getByRole("button", { name: t.result.saving })).toHaveProperty("disabled", true);

  // Back to the strategy step for a second run.
  fireEvent.click(screen.getByRole("button", { name: t.wizard.editStrategy }));
  fireEvent.click(await screen.findByRole("button", { name: t.strategy.simulate }));
  await waitFor(() => expect(api.simulate).toHaveBeenCalledTimes(2));
  return screen.findByRole("button", { name: t.result.save });
}

describe("Strategist save flow", () => {
  it("does not mark a newer run as saved when an older save succeeds", async () => {
    await saveAThenSimulateB();

    await act(async () => pendingSaves[0].resolve(savedA));

    // The history still refreshes: run A was stored.
    await waitFor(() => expect(api.listSavedSimulations).toHaveBeenCalledTimes(2));
    const saveB = screen.getByRole("button", { name: t.result.save });
    expect(saveB).toHaveProperty("disabled", false);
    expect(screen.queryByText(t.result.saved)).toBeNull();

    // B can still be saved on its own.
    fireEvent.click(saveB);
    expect(api.saveSimulation).toHaveBeenCalledTimes(2);
  });

  it("ignores an error that belongs to an older save", async () => {
    await saveAThenSimulateB();

    await act(async () =>
      pendingSaves[0].reject(new ApiError("SAVE_FAILED", { status: 503, serverMessage: "No se pudo guardar." })),
    );

    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByRole("button", { name: t.result.save })).toHaveProperty("disabled", false);
    expect(api.listSavedSimulations).toHaveBeenCalledTimes(1);
  });

  it("reports a confirmed failure as not saved", async () => {
    fireEvent.click(await simulateOnce());

    await act(async () => pendingSaves[0].reject(new ApiError("SAVE_FAILED", { status: 503 })));

    const alert = screen.getByRole("alert");
    expect(alert.textContent).toContain(t.result.saveErrorSuffix);
    expect(screen.getByRole("button", { name: t.result.retrySave })).toHaveProperty("disabled", false);
  });

  it("does not claim the save failed when the connection was lost", async () => {
    fireEvent.click(await simulateOnce());

    await act(async () => pendingSaves[0].reject(new ApiError("CLIENT_TIMEOUT")));

    const alert = screen.getByRole("alert");
    expect(alert.textContent).toContain(t.result.saveUnknownSuffix);
    expect(alert.textContent).not.toContain(t.result.saveErrorSuffix);
    // The history is reloaded so the user can check whether the row exists.
    await waitFor(() => expect(api.listSavedSimulations).toHaveBeenCalledTimes(2));
  });
});

describe("Saved simulations", () => {
  it("scrolls to the saved simulation opened with the view button", async () => {
    const scrollIntoView = vi.fn();
    // jsdom does not implement scrolling.
    Object.defineProperty(Element.prototype, "scrollIntoView", { value: scrollIntoView, configurable: true });
    vi.spyOn(api, "listSavedSimulations").mockResolvedValue([savedA]);
    vi.spyOn(api, "getSavedSimulation").mockResolvedValue(savedA);
    try {
      // The saved simulations are the home screen: no step needed.
      render(<Strategist />);
      const viewPrefix = t.history.viewAria(savedA.raceName, "");
      fireEvent.click(await screen.findByRole("button", { name: (name) => name.startsWith(viewPrefix) }));

      await screen.findByRole("button", { name: t.history.close });
      expect(scrollIntoView).toHaveBeenCalled();
    } finally {
      Reflect.deleteProperty(Element.prototype, "scrollIntoView");
    }
  });
});

describe("Step-by-step flow", () => {
  it("opens on the saved simulations and shows the steps only when creating one", async () => {
    render(<Strategist />);

    expect(await screen.findByRole("heading", { level: 2, name: t.history.heading })).toBeTruthy();
    expect(screen.queryByRole("navigation", { name: t.wizard.label })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: t.home.create }));
    expect(screen.getByRole("navigation", { name: t.wizard.label })).toBeTruthy();
    expect(screen.queryByRole("heading", { level: 2, name: t.history.heading })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: t.home.exit }));
    expect(screen.queryByRole("navigation", { name: t.wizard.label })).toBeNull();
  });

  it("does not let the user move on before choosing a race", async () => {
    render(<Strategist />);
    fireEvent.click(screen.getByRole("button", { name: t.home.create }));
    await raceSelect();

    expect(screen.getByRole("button", { name: t.wizard.next })).toHaveProperty("disabled", true);
    // Later steps are locked in the step bar too.
    expect(screen.getByRole("button", { name: new RegExp(t.wizard.steps.strategy) })).toHaveProperty("disabled", true);
    expect(screen.getByRole("button", { name: new RegExp(t.wizard.steps.result) })).toHaveProperty("disabled", true);
  });

  it("shows the result step after simulating and moves focus to its heading", async () => {
    await simulateOnce();

    const heading = screen.getByRole("heading", { level: 2, name: /Resultado/ });
    expect(document.activeElement).toBe(heading);
    // Only the current step is on screen.
    expect(screen.queryByRole("button", { name: t.strategy.simulate })).toBeNull();
    expect(screen.getByRole("button", { name: new RegExp(t.wizard.steps.result) }).getAttribute("aria-current")).toBe(
      "step",
    );
  });
});

describe("Race select", () => {
  it("can be used with the keyboard and closes with Escape", async () => {
    vi.spyOn(api, "listRaces").mockResolvedValue([raceSummary, { ...raceSummary, id: "race-02", round: 2, name: "Second Grand Prix" }]);
    render(<Strategist />);
    fireEvent.click(screen.getByRole("button", { name: t.home.create }));

    const trigger = await raceSelect();
    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    const list = screen.getByRole("listbox");
    expect(trigger.getAttribute("aria-expanded")).toBe("true");

    fireEvent.keyDown(list, { key: "Escape" });
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(document.activeElement).toBe(trigger);

    // Open again, move to the second race and choose it with Enter.
    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    fireEvent.keyDown(screen.getByRole("listbox"), { key: "ArrowDown" });
    fireEvent.keyDown(screen.getByRole("listbox"), { key: "Enter" });

    expect(screen.queryByRole("listbox")).toBeNull();
    expect(trigger.textContent).toContain("Second Grand Prix");
    expect(screen.getByRole("button", { name: t.wizard.next })).toHaveProperty("disabled", false);
  });
});
