import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { writeFile } from 'node:fs/promises';
import { getTable } from '#cli/settings/scopes.ts';
import { testdir, createFileTree } from 'testdirs';
import { readSettings } from '#cli/settings/read.ts';
import { openSession } from '#cli/planning/session.ts';
import { getSettingValue } from '#cli/settings/inherit.ts';
import { readConfigurations } from '#cli/manifests/read.ts';
import { validateKeys } from '#cli/settings/validation/keys.ts';
import { buildAvailableSettings } from '#cli/settings/available.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { createTemporaryFolder } from '#cli/system/files/folders.ts';
import { PURGECSS_SAFELIST_TABLES } from '#tests/config/settings/inherit.ts';

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
    expect(
        inherited.scopes.map(({ path, configurations }) => [path, configurations.some(({ name }) => name === 'site')]),
    ).toStrictEqual([
        ['', true],
        ['app', true],
        ['app/deep', true],
        ['sibling', false],
    ]);
    for (const path of ['', 'app', 'app/deep']) {
        const scope = inherited.scopes.find((scope) => scope.path === path)!;
        expect(getTable(scope.settings, 'tools.purgecss').safelist).toStrictEqual([]);
    }
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
        validateKeys(defaults, settings, new Map([['api', defaults]]), buildAvailableSettings([], 'basic')),
    ).toStrictEqual([]);
});

test('a first list written in a scope replaces the shipped default for that scope and its children', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['supabase'], {
            tables: '[[scope]]\npath = "app"\nsupabase.schemas = ["api"]\n',
        }),
        'app/deep/schema.sql': '',
    });
    const { settings, scopes } = await openSession(sandbox.path);
    const [root, app] = scopes;
    expect(getSettingValue(root!.availableSettings, settings, 'supabase.schemas', '')?.value).toStrictEqual(['public']);
    for (const scope of ['app', 'app/deep'])
        expect(getSettingValue(app!.availableSettings, settings, 'supabase.schemas', scope)?.value).toStrictEqual([
            'api',
        ]);
});
