import { test, expect } from 'bun:test';
import { buildConfiguration } from '#tests/setup/builders.ts';
import { selectConfigurations } from '#cli/configurations/select.ts';
import { readConfigurations } from '#cli/configurations/manifests.ts';

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
    expect(() => selectConfigurations(['bassh'], readConfigurations())).toThrow('Did you mean `bash`');
});
