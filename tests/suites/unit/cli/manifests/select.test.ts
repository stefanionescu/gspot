import { test, expect } from 'bun:test';
import { matchFields } from '#tests/setup/matchers.ts';
import type { GspotError } from '#cli/system/errors.ts';
import { readConfigurations } from '#cli/manifests/read.ts';
import { buildConfiguration } from '#tests/setup/cli/manifests.ts';
import { selectConfigurations, listSelectedConfigurations } from '#cli/manifests/select.ts';

test('adds required configurations, dependencies first, in order of first mention', () => {
    const configurationsByName = new Map([
        ['app', buildConfiguration('app', { requires: ['client', 'server'] })],
        ['client', buildConfiguration('client', { requires: ['base'] })],
        ['server', buildConfiguration('server', { requires: ['base'] })],
        ['base', buildConfiguration('base')],
    ]);
    const ids = selectConfigurations(['app', 'client'], configurationsByName).map(
        (configuration) => configuration.name,
    );
    expect(ids).toStrictEqual(['base', 'client', 'server', 'app']);
});

test('an unknown configuration names the near matches', () => {
    expect(() => selectConfigurations(['bassh'], readConfigurations())).toThrow(
        matchFields<GspotError>({
            code: 'arguments',
            message:
                'There is no configuration called bassh. Did you mean bash? See https://generativespotting.com/reference/configurations/ for the available configurations.',
        }),
    );
});

test('configurations selected in several scopes appear once in first-seen order', () => {
    const bash = buildConfiguration('bash');
    const typescript = buildConfiguration('typescript');
    const selected = listSelectedConfigurations([
        { configurations: [bash, typescript] },
        { configurations: [typescript, bash] },
    ]);
    expect(selected.map(({ name }) => name)).toStrictEqual(['bash', 'typescript']);
});
