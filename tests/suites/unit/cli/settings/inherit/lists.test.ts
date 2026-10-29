import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { writeFile } from 'node:fs/promises';
import { getTable } from '#cli/settings/scopes.ts';
import { testdir, createFileTree } from 'testdirs';
import { readSettings } from '#cli/settings/read.ts';
import { openSession } from '#cli/planning/session.ts';
import { getSettingValue } from '#cli/settings/inherit.ts';
import { validateKeys } from '#cli/settings/validation/keys.ts';
import { buildAvailableSettings } from '#cli/settings/available.ts';
import { createTemporaryFolder } from '#cli/system/files/folders.ts';
import { readConfigurations } from '#cli/configurations/manifests.ts';
import { buildSandboxSettings, buildSelectedAvailableSettings } from '#tests/setup/cli/settings.ts';

import {
    REPLACED_LIST_DEFAULTS,
    PURGECSS_SAFELIST_TABLES,
    PURGECSS_SCOPE_CONFIGURATIONS,
    PURGECSS_SIBLING_CONFIGURATIONS,
} from '#tests/config/settings/inherit.ts';

test('an empty PurgeCSS safelist is inherited, and a scope value applies to its children', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildSandboxSettings(['site'], { level: 'all', tables: PURGECSS_SAFELIST_TABLES }),
        'index.html': '<!doctype html><title>Site</title>',
        'app/index.html': '<!doctype html><title>App</title>',
        'app/deep/index.html': '<!doctype html><title>Deep</title>',
        'sibling/index.html': '<!doctype html><title>Sibling</title>',
    });
    const inherited = await openSession(sandbox.path);
    for (const path of ['', 'app', 'app/deep']) {
        const scope = inherited.scopes.find((scope) => scope.path === path)!;
        expect(scope.configurations.map((configuration) => configuration.name)).toStrictEqual(
            PURGECSS_SCOPE_CONFIGURATIONS,
        );
        expect(getTable(scope.settings, 'tools.purgecss').safelist).toStrictEqual([]);
    }
    expect(
        inherited.scopes
            .find(({ path }) => path === 'sibling')!
            .configurations.map((configuration) => configuration.name),
    ).toStrictEqual(PURGECSS_SIBLING_CONFIGURATIONS);
    const overridden = PURGECSS_SAFELIST_TABLES.replace(
        'path = "app"\n',
        'path = "app/"\ntools.purgecss.safelist = { value = ["keep"], reason = "The reviewed stylesheet keeps its dynamic selectors." }\n',
    );
    await writeFile(
        join(sandbox.path, 'gspot.toml'),
        buildSandboxSettings(['site'], { level: 'all', tables: overridden }),
    );
    const session = await openSession(sandbox.path);
    expect(
        session.scopes
            .filter(({ path }) => path !== 'sibling')
            .map(({ path, settings }) => [path, getTable(settings, 'tools.purgecss').safelist]),
    ).toStrictEqual([
        ['', []],
        ['app', ['keep']],
        ['app/deep', ['keep']],
    ]);
    expect(() => getTable(session.scopes.find(({ path }) => path === 'sibling')!.settings, 'tools.purgecss')).toThrow(
        'The selected scope has no tools.purgecss settings.',
    );
});

test('a root list replaces configuration defaults, and a scope list adds to the root list', () => {
    using sandbox = createTemporaryFolder();
    const naming = readConfigurations().get('naming')!;
    const configurations = [naming];
    for (const [index, terms] of [['dispatcher'], ['dispatcher', 'orchestrator']].entries()) {
        configurations.push({
            ...naming,
            name: `naming-${String(index)}`,
            defaults: { 'naming.banned_words': terms },
        });
    }
    const defaults = buildAvailableSettings(configurations, 'basic');
    const unwritten = readSettings(buildSandboxSettings(['naming']), sandbox.path);
    expect(getSettingValue(defaults, unwritten, 'naming.banned_words', '')?.value).toStrictEqual([
        'dispatcher',
        'orchestrator',
    ]);
    const settings = readSettings(
        buildSandboxSettings(['naming'], {
            rules: true,
            tables: '[naming]\nbanned_words = ["dispatcher", "manager"]\n[[scope]]\npath = "api"\nnaming.banned_words = ["handler"]\n',
        }),
        sandbox.path,
    );
    expect(getSettingValue(defaults, settings, 'naming.banned_words', '')?.value).toStrictEqual([
        'dispatcher',
        'manager',
    ]);
    expect(getSettingValue(defaults, settings, 'naming.banned_words', 'api')?.value).toStrictEqual([
        'dispatcher',
        'manager',
        'handler',
    ]);
    expect(
        validateKeys(defaults, settings, new Map([['api', defaults]]), buildSelectedAvailableSettings([])),
    ).toStrictEqual([]);
});

test.each(REPLACED_LIST_DEFAULTS)(
    'a written $key list replaces its shipped default',
    ({ key, configurations, tables, value }) => {
        using sandbox = createTemporaryFolder();
        const availableSettings = buildSelectedAvailableSettings(configurations);
        const settings = readSettings(buildSandboxSettings(configurations, { tables }), sandbox.path);
        expect(getSettingValue(availableSettings, settings, key, '')?.value).toStrictEqual(value);
    },
);

test('a first list written in a scope replaces the shipped default for that scope and its children', () => {
    using sandbox = createTemporaryFolder();
    const availableSettings = buildSelectedAvailableSettings(['supabase']);
    const settings = readSettings(
        buildSandboxSettings(['supabase'], {
            tables: '[[scope]]\npath = "app"\nsupabase.schemas = ["api"]\n',
        }),
        sandbox.path,
    );
    expect(getSettingValue(availableSettings, settings, 'supabase.schemas', '')?.value).toStrictEqual(['public']);
    for (const scope of ['app', 'app/deep'])
        expect(getSettingValue(availableSettings, settings, 'supabase.schemas', scope)?.value).toStrictEqual(['api']);
});
