import { test, expect } from 'bun:test';
import { matchFields } from '#tests/setup/matchers.ts';
import type { GspotError } from '#cli/system/errors.ts';
import { selectConfigurations } from '#cli/configurations/select.ts';
import { readConfigurations } from '#cli/configurations/manifests.ts';
import { buildConfiguration } from '#tests/setup/cli/configurations.ts';

test('adds required configurations, dependencies first, in order of first mention', () => {
    const configurations = new Map([
        ['app', buildConfiguration('app', { requires: ['client', 'server'] })],
        ['client', buildConfiguration('client', { requires: ['base'] })],
        ['server', buildConfiguration('server', { requires: ['base'] })],
        ['base', buildConfiguration('base')],
    ]);
    const ids = selectConfigurations(['app', 'client'], configurations).map((entry) => entry.name);
    expect(ids).toStrictEqual(['base', 'client', 'server', 'app']);
});

test('an unknown configuration names the near matches', () => {
    expect(() => selectConfigurations(['bassh'], readConfigurations())).toThrow(
        matchFields<GspotError>({
            code: 'arguments',
            message:
                'There is no configuration called `bassh`. Did you mean `bash`? Run `gspot list configurations` to see the available configurations.',
        }),
    );
});
