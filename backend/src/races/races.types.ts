import type {
  Driver,
  RaceDetails,
  SimulationParameters,
  Team,
  Tyre,
  WeatherForecast,
} from '../f1-api/f1-api.types';

export interface RaceSummary {
  id: string;
  name: string;
  round: number;
  date: string;
  laps: number;
  circuitName: string;
  country: string;
  rainProbability: number;
}

export interface GridTeam {
  team: Team;
  drivers: Driver[];
}

/** Everything the strategy screen and the simulation need for one race. */
export interface RaceContext {
  race: RaceDetails;
  weather: WeatherForecast;
  simulationParameters: SimulationParameters;
  tyres: Tyre[];
  grid: GridTeam[];
}
