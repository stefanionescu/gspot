import { test, expect } from 'bun:test';
import { nextSettingsProblems } from '#cli/parsers/nextjs.ts';
import { NEXT_CONFIG_CASES } from '#tests/config/cli/parsers/nextjs.ts';

test.each([...NEXT_CONFIG_CASES])('Next configuration parsing preserves $name', ({ source, expected }) => {
    expect(nextSettingsProblems('next.config.ts', source)).toStrictEqual([...expected]);
});
