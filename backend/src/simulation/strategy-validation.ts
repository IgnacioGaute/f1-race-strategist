import type { ApiProblem } from '../common/api-error';
import type { StrategyStint } from './simulation.types';

export interface StrategyRules {
  totalLaps: number;
  availableCompounds: readonly string[];
}

/**
 * Business rules that need race data. Shape rules (non-empty list, positive
 * integer laps, bounds) are enforced earlier by the request DTO.
 * Returns user-facing problems; an empty list means the strategy is valid.
 */
export function validateStrategy(
  stints: readonly StrategyStint[],
  rules: StrategyRules,
): ApiProblem[] {
  const problems: ApiProblem[] = [];
  if (stints.length === 0) {
    problems.push({
      code: 'STRATEGY_EMPTY',
      message: 'La estrategia necesita al menos un tramo.',
    });
    return problems;
  }

  stints.forEach((stint, index) => {
    const stintNumber = index + 1;
    if (!rules.availableCompounds.includes(stint.compound)) {
      problems.push({
        code: 'COMPOUND_UNAVAILABLE',
        message: `Tramo ${stintNumber}: el compuesto "${stint.compound}" no está disponible (disponibles: ${rules.availableCompounds.join(', ')}).`,
        params: {
          stint: stintNumber,
          compound: stint.compound,
          available: [...rules.availableCompounds],
        },
      });
    }
    if (!Number.isInteger(stint.laps) || stint.laps < 1) {
      problems.push({
        code: 'LAPS_NOT_INTEGER',
        message: `Tramo ${stintNumber}: las vueltas deben ser un entero positivo.`,
        params: { stint: stintNumber },
      });
    }
  });

  const assignedLaps = stints.reduce((sum, stint) => sum + stint.laps, 0);
  if (assignedLaps !== rules.totalLaps) {
    problems.push({
      code: 'LAPS_MISMATCH',
      message: `La estrategia cubre ${assignedLaps} vueltas, pero la carrera tiene ${rules.totalLaps}.`,
      params: { assigned: assignedLaps, total: rules.totalLaps },
    });
  }
  return problems;
}
