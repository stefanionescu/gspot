import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { expect, test } from 'bun:test';
import { createFileTree } from 'testdirs';

import { openSession } from '#cli/engine/session.ts';
import { readConfigurations } from '#cli/manifests/read.ts';
import { buildAvailableSettings } from '#cli/settings/available.ts';
import { parseSettings } from '#cli/settings/parse.ts';
import { getTable } from '#cli/settings/tables.ts';
import { validateKeys } from '#cli/settings/validation/keys.ts';
import { getSettingValue } from '#cli/settings/values/inherit.ts';
import { createTemporaryFolder } from '#cli/system/files/temporary.ts';
import { POSTGRES_ORIGIN, PURGECSS_SAFELIST_TABLES } from '#tests/config/settings/parse.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';

test('an empty PurgeCSS safelist is inherited, and a scope value applies to its children', async () => {
    await using sandbox = await createGitSandbox({});
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
        expect(getTable(scope.settings, 'site').allowed_classes).toStrictEqual([]);
    }
    const overridden = PURGECSS_SAFELIST_TABLES.replace(
        'path = "app"\n',
        'path = "app/"\nsite.allowed_classes = { value = ["keep"], reason = "The reviewed stylesheet keeps its dynamic selectors." }\n',
    );
    await writeFile(
        join(sandbox.path, 'gspot.toml'),
        buildSandboxSettings(['site'], { level: 'all', tables: overridden }),
    );
    const session = await openSession(sandbox.path);
    expect(
        session.scopes
            .filter(({ path }) => path !== 'sibling')
            .map(({ path, settings }) => [path, getTable(settings, 'site').allowed_classes]),
    ).toStrictEqual([
        ['', []],
        ['app', ['keep']],
        ['app/deep', ['keep']],
    ]);
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
    const unwritten = parseSettings(buildSandboxSettings(['naming']), sandbox.path);
    expect(getSettingValue(defaults, unwritten, 'naming.banned_words', '')?.value).toStrictEqual([
        'dispatcher',
        'orchestrator',
    ]);
    const settings = parseSettings(
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
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['supabase'], {
            tables: '[[scope]]\npath = "app"\nsupabase.schemas = ["api"]\n',
        }),
        'app/deep/schema.sql': '',
    });
    const { settings, scopes } = await openSession(sandbox.path);
    const [, app] = scopes;
    for (const scope of ['app', 'app/deep'])
        expect(getSettingValue(app!.availableSettings, settings, 'supabase.schemas', scope)?.value).toStrictEqual([
            'api',
        ]);
});

test("a written false overrides a configuration's true default", async () => {
    const source = buildSandboxSettings(['postgres'], { rules: true });
    await using sandbox = await createGitSandbox({ 'gspot.toml': source });
    const initial = await openSession(sandbox.path);
    expect(
        getSettingValue(initial.scopes[0]!.availableSettings, initial.settings, 'postgres.assume_in_transaction', ''),
    ).toMatchObject({ value: true, origin: POSTGRES_ORIGIN });
    await writeFile(join(sandbox.path, 'gspot.toml'), `${source}[postgres]\nassume_in_transaction = false\n`);
    const corrected = await openSession(sandbox.path);
    expect(
        getSettingValue(
            corrected.scopes[0]!.availableSettings,
            corrected.settings,
            'postgres.assume_in_transaction',
            '',
        ),
    ).toMatchObject({ value: false, origin: { kind: 'root', name: 'gspot.toml' } });
});

test('an inherited default names the configuration that declares it', async () => {
    await using sandbox = await createGitSandbox({ 'gspot.toml': buildSandboxSettings(['supabase'], { rules: true }) });
    const { settings, scopes } = await openSession(sandbox.path);
    expect(getSettingValue(scopes[0]!.availableSettings, settings, 'sql.dialect', '')).toMatchObject({
        origin: POSTGRES_ORIGIN,
    });
});

test.each([
    { written: 'a general limit', tables: '[limits]\nmax_function_lines = 59\n', expected: 'the shipped value' },
    {
        written: 'a general and a Bash limit',
        tables: '[limits]\nmax_function_lines = 59\n[limits.bash]\nmax_function_lines = { value = 50, reason = "Long installers." }\n',
        expected: 50,
    },
])('with $written in gspot.toml, the Bash function limit is $expected', async ({ tables, expected }) => {
    await using shipped = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['bash'], { rules: true }),
        'run.sh': '',
    });
    const defaults = await openSession(shipped.path);
    const shippedLimit = getSettingValue(
        defaults.scopes[0]!.availableSettings,
        defaults.settings,
        'limits.bash.max_function_lines',
        '',
    )?.value;
    expect(shippedLimit).toBeNumber();
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['bash'], { rules: true, tables }),
        'run.sh': '',
    });
    const { settings, scopes } = await openSession(sandbox.path);
    const available = scopes[0]!.availableSettings;
    expect({
        general: getSettingValue(available, settings, 'limits.max_function_lines', '')?.value,
        bash: getSettingValue(available, settings, 'limits.bash.max_function_lines', '')?.value,
    }).toStrictEqual({ general: 59, bash: typeof expected === 'number' ? expected : shippedLimit });
});

test("a scope's rules keep other rules and replace all options of the same rule", async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['css'], {
            rules: true,
            tables: '[tools.stylelint.rules]\nselector-max-id = 0\ncolor-named = ["never", { severity = "error" }]\n[[scope]]\npath = "app"\nconfigurations = []\ntools.stylelint.rules.color-named = ["always-where-possible"]\n',
        }),
        'app/site.css': '',
    });
    const { settings, scopes } = await openSession(sandbox.path);
    const [root, app] = scopes;
    expect(getSettingValue(app!.availableSettings, settings, 'tools.stylelint.rules', 'app')?.value).toStrictEqual({
        'selector-max-id': 0,
        'color-named': ['always-where-possible'],
    });
    expect(getSettingValue(root!.availableSettings, settings, 'tools.stylelint.rules', '')?.value).toStrictEqual({
        'selector-max-id': 0,
        'color-named': ['never', { severity: 'error' }],
    });
});
