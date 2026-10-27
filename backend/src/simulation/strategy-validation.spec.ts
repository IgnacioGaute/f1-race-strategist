import { validateStrategy } from './strategy-validation';

const rules = { totalLaps: 10, availableCompounds: ['SOFT', 'HARD'] };

const codes = (problems: { code: string }[]) => problems.map((p) => p.code);

describe('validateStrategy', () => {
  it('accepts a strategy that covers the race with available compounds', () => {
    expect(
      validateStrategy(
        [
          { compound: 'SOFT', laps: 4 },
          { compound: 'HARD', laps: 6 },
        ],
        rules,
      ),
    ).toEqual([]);
  });

  it('rejects an empty strategy', () => {
    expect(codes(validateStrategy([], rules))).toEqual(['STRATEGY_EMPTY']);
  });

  it('rejects unknown compounds, saying which stint and which compounds exist', () => {
    const problems = validateStrategy([{ compound: 'ULTRA', laps: 10 }], rules);
    expect(problems).toEqual([
      expect.objectContaining({
        code: 'COMPOUND_UNAVAILABLE',
        params: { stint: 1, compound: 'ULTRA', available: ['SOFT', 'HARD'] },
      }),
    ]);
  });

  it('rejects strategies that are shorter or longer than the race', () => {
    expect(validateStrategy([{ compound: 'SOFT', laps: 9 }], rules)).toEqual([
      expect.objectContaining({
        code: 'LAPS_MISMATCH',
        params: { assigned: 9, total: 10 },
      }),
    ]);
    expect(validateStrategy([{ compound: 'SOFT', laps: 11 }], rules)).toEqual([
      expect.objectContaining({
        code: 'LAPS_MISMATCH',
        params: { assigned: 11, total: 10 },
      }),
    ]);
  });

  it('rejects non-integer or non-positive laps', () => {
    const problems = validateStrategy(
      [
        { compound: 'SOFT', laps: 0 },
        { compound: 'HARD', laps: 9.5 },
        { compound: 'HARD', laps: 0.5 },
      ],
      rules,
    );
    expect(
      problems
        .filter((p) => p.code === 'LAPS_NOT_INTEGER')
        .map((p) => p.params?.stint),
    ).toEqual([1, 2, 3]);
  });
});
