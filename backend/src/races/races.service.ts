import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { apiException } from '../common/api-error';
import { F1ApiClient } from '../f1-api/f1-api.client';
import { F1ApiError } from '../f1-api/f1-api.error';
import type { Driver, Team, WeatherForecast } from '../f1-api/f1-api.types';
import type { GridTeam, RaceContext, RaceSummary } from './races.types';

@Injectable()
export class RacesService {
  constructor(private readonly f1Api: F1ApiClient) {}

  async listRaces(): Promise<RaceSummary[]> {
    const [races, circuits] = await Promise.all([
      this.f1Api.getRaces(),
      this.f1Api.getCircuits(),
    ]);
    const circuitsById = new Map(circuits.map((c) => [c.id, c]));

    return races
      .map((race) => {
        const circuit = circuitsById.get(race.circuitId);
        if (!circuit) {
          throw inconsistent(
            '/api/races',
            `race ${race.id} references unknown circuit ${race.circuitId}`,
          );
        }
        return {
          id: race.id,
          name: race.name,
          round: race.round,
          date: race.date,
          laps: race.laps,
          circuitName: circuit.name,
          country: circuit.country,
          rainProbability: race.rainProbability,
        };
      })
      .sort((a, b) => a.round - b.round);
  }

  async getRaceContext(raceId: string): Promise<RaceContext> {
    try {
      const [race, weather, simulationParameters, tyres, teams, drivers] =
        await Promise.all([
          this.f1Api.getRace(raceId),
          this.f1Api.getWeather(raceId),
          this.f1Api.getSimulationParameters(raceId),
          this.f1Api.getTyres(),
          this.f1Api.getTeams(),
          this.f1Api.getDrivers(),
        ]);

      assertWeatherCoversRace(weather, race.laps);
      if (tyres.length === 0) {
        throw inconsistent('/api/tyres', 'no tyre compounds available');
      }

      return {
        race,
        weather,
        simulationParameters,
        tyres,
        grid: buildGrid(teams, drivers),
      };
    } catch (error) {
      if (error instanceof F1ApiError && error.kind === 'not_found') {
        throw apiException(
          HttpStatus.NOT_FOUND,
          'RACE_NOT_FOUND',
          `No existe la carrera "${raceId}".`,
          { params: { raceId }, cause: error },
        );
      }
      throw error;
    }
  }
}

const logger = new Logger(RacesService.name);

function inconsistent(path: string, detail: string): F1ApiError {
  logger.error(`Inconsistent F1 API data from ${path}: ${detail}`);
  return new F1ApiError(
    'invalid_response',
    path,
    `Inconsistent F1 API data: ${detail}`,
  );
}

/** The simulation needs one rain value per lap, so segments must tile 1..laps. */
function assertWeatherCoversRace(
  weather: WeatherForecast,
  totalLaps: number,
): void {
  const segments = [...weather.forecast].sort((a, b) => a.fromLap - b.fromLap);
  let nextLap = 1;
  for (const segment of segments) {
    if (segment.fromLap !== nextLap || segment.toLap < segment.fromLap) {
      throw inconsistent(
        '/weather',
        `forecast segment ${segment.fromLap}-${segment.toLap} does not continue from lap ${nextLap}`,
      );
    }
    nextLap = segment.toLap + 1;
  }
  if (nextLap !== totalLaps + 1) {
    throw inconsistent(
      '/weather',
      `forecast covers laps 1-${nextLap - 1}, race has ${totalLaps}`,
    );
  }
}

function buildGrid(teams: Team[], drivers: Driver[]): GridTeam[] {
  const driversByTeam = new Map<string, Driver[]>(
    teams.map((team) => [team.id, []]),
  );
  for (const driver of drivers) {
    const teamDrivers = driversByTeam.get(driver.teamId);
    if (!teamDrivers) {
      throw inconsistent(
        '/api/drivers',
        `driver ${driver.id} references unknown team ${driver.teamId}`,
      );
    }
    teamDrivers.push(driver);
  }
  return teams
    .map((team) => ({ team, drivers: driversByTeam.get(team.id) ?? [] }))
    .sort((a, b) => b.team.carPerformance - a.team.carPerformance);
}
