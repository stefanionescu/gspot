import { test, expect, describe } from 'bun:test';
import { buildManifest } from '#tests/setup/builders.ts';
import { readManifests } from '#cli/configurations/manifests.ts';
import { selectConfigurations } from '#cli/configurations/select.ts';

describe('selectConfigurations', () => {
    test('adds required configurations, dependencies first, in order of first mention', () => {
        const manifests = new Map([
            ['app', { ...buildManifest('app', { requires: ['client', 'server'] }), tools: [] }],
            ['client', { ...buildManifest('client', { requires: ['base'] }), tools: [] }],
            ['server', { ...buildManifest('server', { requires: ['base'] }), tools: [] }],
            ['base', { ...buildManifest('base'), tools: [] }],
        ]);
        const ids = selectConfigurations(['app', 'client'], manifests).map((entry) => entry.configuration.name);
        expect(ids).toStrictEqual(['base', 'client', 'server', 'app']);
    });

    test('an unknown configuration names the near matches', () => {
        expect(() => selectConfigurations(['bassh'], readManifests())).toThrow('Did you mean `bash`');
    });
});
