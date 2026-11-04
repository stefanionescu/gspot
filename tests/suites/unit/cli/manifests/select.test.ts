import { test, expect } from 'bun:test';
import { matchFields } from '#tests/setup/matchers.ts';
import type { GspotError } from '#cli/system/errors.ts';
import { selectConfigurations } from '#cli/manifests/select.ts';

test('adds required configurations, dependencies first, in order of first mention', () => {
    const ids = selectConfigurations(['nextjs', 'react']).map((configuration) => configuration.name);
    expect(ids).toStrictEqual(['javascript', 'typescript', 'react', 'react-dom', 'nextjs']);
});

test('an unknown configuration names the near matches', () => {
    expect(() => selectConfigurations(['bassh'])).toThrow(
        matchFields<GspotError>({
            name: 'GspotError',
            code: 'arguments',
            message: expect.stringMatching(/\bbash\b/u) as string,
        }),
    );
});
