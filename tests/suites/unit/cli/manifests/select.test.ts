import { expect, test } from 'bun:test';

import { readConfigurations } from '#cli/manifests/read.ts';
import { expandSuggestions, selectConfigurations } from '#cli/manifests/select.ts';
import type { GspotError } from '#cli/system/errors.ts';
import type { Configuration } from '#cli/types/manifests.ts';
import { matchFields } from '#tests/setup/matchers.ts';

test('adds required configurations, dependencies first, in order of first mention', () => {
    const selected = selectConfigurations(['nextjs', 'react']);
    const names = selected.map(({ name }) => name);
    for (const [index, { requires }] of selected.entries())
        expect(names.slice(0, index)).toStrictEqual(expect.arrayContaining(requires) as string[]);
    const required = new Set(selected.flatMap(({ requires }) => requires));
    expect(names.filter((name) => !required.has(name))).toStrictEqual(['nextjs']);
    expect(names.indexOf('react')).toBeLessThan(names.indexOf('nextjs'));
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

test('a suggested configuration joins only when its files are detected', () => {
    const suggesting = readConfigurations()
        .values()
        .find(({ suggests }) => suggests.length > 0) as Configuration;
    const suggested = suggesting.suggests[0] as string;
    expect(expandSuggestions([suggesting.name], new Set())).toStrictEqual([suggesting.name]);
    expect(expandSuggestions([suggesting.name], new Set([suggested]))).toStrictEqual([suggesting.name, suggested]);
});
