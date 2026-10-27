import { HttpStatus, Injectable, PipeTransform } from '@nestjs/common';
import { apiException } from '../common/api-error';

/** Same constraint the F1 API declares for its raceId path parameter. */
export const RACE_ID_PATTERN = /^[a-z0-9-]+$/;
export const RACE_ID_MAX_LENGTH = 64;

@Injectable()
export class RaceIdPipe implements PipeTransform<string, string> {
  transform(value: string): string {
    if (value.length > RACE_ID_MAX_LENGTH || !RACE_ID_PATTERN.test(value)) {
      throw apiException(
        HttpStatus.BAD_REQUEST,
        'INVALID_RACE_ID',
        'El identificador de carrera solo admite minúsculas, números y guiones.',
      );
    }
    return value;
  }
}
