import { test, expect, describe } from 'bun:test';
import { selectConfigurations } from '#cli/configurations/select.ts';
import { parseConfigurationManifest } from '#tests/harness/tooling.ts';
import { configurationManifests } from '#cli/configurations/manifests.ts';

describe('selectConfigurations', () => {
    test('pulls required configurations in, dependencies first, in order of first mention', () => {
        const manifests = new Map([
            ['app', parseConfigurationManifest('app', { requires: ['client', 'server'] })],
            ['client', parseConfigurationManifest('client', { requires: ['base'] })],
            ['server', parseConfigurationManifest('server', { requires: ['base'] })],
            ['base', parseConfigurationManifest('base')],
        ]);
        const ids = selectConfigurations(['app', 'client'], manifests).map((entry) => entry.configuration.name);
        expect(ids).toStrictEqual(['base', 'client', 'server', 'app']);
    });

    test('an unknown configuration names the near matches', () => {
        expect(() => selectConfigurations(['bassh'], configurationManifests())).toThrow('Did you mean `bash`');
    });

    test('a circular requires fails with the chain', () => {
        const map = new Map([
            ['a', parseConfigurationManifest('a', { requires: ['b'] })],
            ['b', parseConfigurationManifest('b', { requires: ['a'] })],
        ]);
        expect(() => selectConfigurations(['a'], map)).toThrow('a -> b -> a');
    });
});
