import { HttpException, HttpStatus } from '@nestjs/common';
import type { ValidationError } from 'class-validator';
import {
  MAX_LAPS_PER_STINT,
  MAX_STINTS,
} from '../simulation/dto/simulation-request.dto';
import { type ApiProblem, apiException } from './api-error';

/**
 * ValidationPipe exceptionFactory: turns class-validator errors into coded
 * problems with readable messages (instead of "stints.0.laps must be...").
 */
export function invalidRequest(errors: ValidationError[]): HttpException {
  const problems: ApiProblem[] = [];
  const visit = (error: ValidationError, parentPath: string[]) => {
    const path = [...parentPath, error.property];
    if (error.constraints) {
      problems.push(toProblem(path, Object.keys(error.constraints)));
    }
    error.children?.forEach((child) => visit(child, path));
  };
  errors.forEach((error) => visit(error, []));

  return apiException(
    HttpStatus.BAD_REQUEST,
    'INVALID_REQUEST',
    'La solicitud no es válida.',
    { problems },
  );
}

function toProblem(path: string[], constraints: string[]): ApiProblem {
  const failed = (name: string) => constraints.includes(name);
  const field = path.join('.');

  if (failed('whitelistValidation')) {
    return {
      code: 'UNKNOWN_FIELD',
      message: `El campo "${field}" no está permitido.`,
      params: { field },
    };
  }
  if (field === 'raceId') {
    return {
      code: 'INVALID_RACE_ID',
      message: 'El identificador de carrera no es válido.',
    };
  }
  if (field === 'stints') {
    if (failed('isArray')) {
      return {
        code: 'STINTS_NOT_A_LIST',
        message: 'Los tramos deben enviarse como lista.',
      };
    }
    if (failed('arrayMinSize')) {
      return {
        code: 'STRATEGY_EMPTY',
        message: 'La estrategia necesita al menos un tramo.',
      };
    }
    return {
      code: 'TOO_MANY_STINTS',
      message: `La estrategia admite como máximo ${MAX_STINTS} tramos.`,
      params: { max: MAX_STINTS },
    };
  }

  if (path[0] === 'stints' && path.length >= 2) {
    const stint = Number(path[1]) + 1;
    if (path.length === 2) {
      return {
        code: 'STINT_INVALID',
        message: `Tramo ${stint}: debe tener compuesto y vueltas.`,
        params: { stint },
      };
    }
    if (path[2] === 'compound') {
      return {
        code: 'COMPOUND_INVALID',
        message: `Tramo ${stint}: el compuesto no es válido.`,
        params: { stint },
      };
    }
    if (path[2] === 'laps') {
      // One problem per field, the most basic failure first.
      if (failed('isInt')) {
        return {
          code: 'LAPS_NOT_INTEGER',
          message: `Tramo ${stint}: las vueltas deben ser un número entero.`,
          params: { stint },
        };
      }
      if (failed('min')) {
        return {
          code: 'LAPS_BELOW_MIN',
          message: `Tramo ${stint}: debe tener al menos 1 vuelta.`,
          params: { stint },
        };
      }
      return {
        code: 'LAPS_ABOVE_MAX',
        message: `Tramo ${stint}: no puede superar ${MAX_LAPS_PER_STINT} vueltas.`,
        params: { stint, max: MAX_LAPS_PER_STINT },
      };
    }
  }

  return {
    code: 'INVALID_FIELD',
    message: `El campo "${field}" no es válido.`,
    params: { field },
  };
}
