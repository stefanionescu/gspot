// Fourteen days is stricter than the shipped seven-day minimum.
export const TWO_WEEKS_SECONDS = 1_209_600;

export const AGE_CASES = [
    { name: 'absent', source: undefined, expected: 604_800 },
    { name: 'weaker', source: '[install]\nminimumReleaseAge = 3600\n', expected: 604_800 },
    { name: 'stricter', source: '[install]\nminimumReleaseAge = 1209600\n', expected: TWO_WEEKS_SECONDS },
] as const;
