import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { RACE_ID_MAX_LENGTH, RACE_ID_PATTERN } from '../../races/race-id.pipe';

/** Generous sanity bounds; the exact race distance is checked against API data. */
export const MAX_STINTS = 20;
export const MAX_LAPS_PER_STINT = 200;

// User-facing messages for these rules live in common/validation-problems.ts.

export class StintDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(32)
  compound!: string;

  @IsInt()
  @Min(1)
  @Max(MAX_LAPS_PER_STINT)
  laps!: number;
}

export class SimulationRequestDto {
  @IsString()
  @MaxLength(RACE_ID_MAX_LENGTH)
  @Matches(RACE_ID_PATTERN)
  raceId!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_STINTS)
  @ValidateNested({ each: true })
  @Type(() => StintDto)
  stints!: StintDto[];
}
