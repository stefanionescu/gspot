import { test, expect, describe } from 'bun:test';
import { selectForScope } from '#cli/repository/selection/public.ts';
import { parseConfigurationManifest } from '#tests/harness/tooling.ts';
import { selectConfigurations, sourceConfigurations, configurationManifests } from '#cli/configurations/public.ts';

import {
    PROJECT_CHOICES,
    OPENAPI_FRAMEWORKS,
    PROJECT_SELECTIONS,
    CONFIGURATION_CATEGORIES,
} from '#tests/config/cli/configurations/select.ts';

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

test.each(CONFIGURATION_CATEGORIES)(
    '%s retains its %s category in root, inherited and manual child selections',
    (name, kind) => {
        const manifests = configurationManifests();
        const policy = {
            configurations: [name, 'site'],
            removed_configurations: [],
            scope: {
                app: { configurations: [], removed_configurations: [] },
                manual: { configurations: [name, 'site'], removed_configurations: [] },
                sibling: { configurations: [], removed_configurations: [name] },
            },
        };
        for (const scope of ['', 'app', 'app/deep', 'manual']) {
            const selected = selectForScope(policy, scope, manifests);
            expect(selected.find(({ configuration }) => configuration.name === name)?.configuration.kind).toBe(kind);
            const sources = sourceConfigurations(selected).map(({ configuration }) => configuration.name);
            expect(sources).not.toContain(name);
            expect(sources).toContain('site');
        }
        expect(
            selectForScope(policy, 'sibling', manifests).map(({ configuration }) => configuration.name),
        ).not.toContain(name);
    },
);
