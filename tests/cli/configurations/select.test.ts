import { test, expect, describe } from 'bun:test';
import { parseConfigurationManifest } from '#tests/harness/tooling.ts';
import { configurationManifests } from '#cli/configurations/manifests.ts';
import { selectForScope, selectConfigurations } from '#cli/configurations/select.ts';
import { PROJECT_CHOICES, OPENAPI_FRAMEWORKS, PROJECT_SELECTIONS } from '#tests/config/cli/configurations/select.ts';

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

test.each(PROJECT_SELECTIONS)('scope %s retains configuration %s: %s', (scope, name, selected) => {
    const names = selectForScope(PROJECT_CHOICES, scope, configurationManifests()).map(
        (manifest) => manifest.configuration.name,
    );
    expect(names.includes(name)).toBe(selected);
    expect(names).toContain('gspot');
});

test.each(OPENAPI_FRAMEWORKS)('%s keeps %s required and OpenAPI suggested', (framework, language) => {
    const manifests = configurationManifests();
    for (const scope of ['', 'api']) {
        const policy = {
            configurations: [framework],
            removed_configurations: [],
            scope: { api: { configurations: [], removed_configurations: [] } },
        };
        const names = selectForScope(policy, scope, manifests).map(({ configuration }) => configuration.name);
        expect(names).toContain(language);
        expect(names).not.toContain('openapi');
        expect(manifests.get(framework)!.configuration.suggests).toContain('openapi');
        const chosen = selectForScope({ ...policy, configurations: [framework, 'openapi'] }, scope, manifests);
        expect(chosen.map(({ configuration }) => configuration.name)).toContain('openapi');
    }
});
