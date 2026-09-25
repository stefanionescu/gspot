import { configurationManifests } from '#cli/configurations/manifests.ts';
import { selectConfigurations } from '#cli/configurations/select.ts';
import { testManifest } from '#tests/support/cli/manifests.ts';
import { describe, expect, test } from 'bun:test';

describe('selectConfigurations', () => {
    test('pulls required configurations in, dependencies first, in order of first mention', () => {
        const manifests = new Map([
            ['app', testManifest('app', ['client', 'server'])],
            ['client', testManifest('client', ['base'])],
            ['server', testManifest('server', ['base'])],
            ['base', testManifest('base')],
        ]);
        const ids = selectConfigurations(['app', 'client'], manifests).map((entry) => entry.configuration.name);
        expect(ids).toStrictEqual(['base', 'client', 'server', 'app']);
    });

    test('a recommended configuration is not pulled in by selection; init adds it and a person can drop it', () => {
        const manifests = configurationManifests();
        const ids = selectConfigurations(['bash'], manifests).map((entry) => entry.configuration.name);
        expect(ids).not.toContain('naming');
    });

    test('an unknown configuration names the near matches', () => {
        expect(() => selectConfigurations(['bassh'], configurationManifests())).toThrow('Did you mean `bash`');
    });

    test('a circular requires fails with the chain', () => {
        const map = new Map([
            ['a', testManifest('a', ['b'])],
            ['b', testManifest('b', ['a'])],
        ]);
        expect(() => selectConfigurations(['a'], map)).toThrow('a -> b -> a');
    });
});
