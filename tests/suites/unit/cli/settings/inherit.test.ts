import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { writeFile } from 'node:fs/promises';
import { openSession } from '#cli/session.ts';
import { getTable } from '#cli/settings/scopes.ts';
import { GspotError } from '#cli/system/errors.ts';
import { testdir, createFileTree } from 'testdirs';
import { parseSettings } from '#cli/settings/read.ts';
import { validateKeys } from '#cli/settings/validation/keys.ts';
import { buildAvailableSettings } from '#cli/settings/available.ts';
import { selectConfigurations } from '#cli/configurations/select.ts';
import { createTemporaryFolder } from '#cli/system/files/folders.ts';
import { readConfigurations } from '#cli/configurations/manifests.ts';
import { findSetting, getSettingValue } from '#cli/settings/inherit.ts';
import type { AvailableSettings } from '#cli/types/settings/inheritance.ts';
import { buildSandboxSettings, validateSettingsText } from '#tests/setup/cli/settings.ts';

import {
    CONFLICTING_SETTINGS,
    REPLACED_LIST_DEFAULTS,
    CSS_HTML_NAMING_SETTINGS,
    PURGECSS_SAFELIST_TABLES,
    CONFLICTING_DEFAULT_ERRORS,
    PURGECSS_SCOPE_CONFIGURATIONS,
    PURGECSS_SIBLING_CONFIGURATIONS,
} from '#tests/config/settings/inherit.ts';

test('[naming.css] and [naming.html.folders] accept max_words, max_characters, and cases', () => {
    using sandbox = createTemporaryFolder();
    const settings = parseSettings(CSS_HTML_NAMING_SETTINGS, sandbox.path);
    const availableSettings = buildSelectedAvailableSettings(['css', 'html', 'naming']);
    const namingRules = { max_words: 3, max_characters: 20, cases: ['kebab'] };
    for (const table of ['naming.css', 'naming.css.files', 'naming.html.folders']) {
        for (const [name, value] of Object.entries(namingRules)) {
            expect(getSettingValue(availableSettings, settings, `${table}.${name}`)?.value).toStrictEqual(value);
        }
    }
    expect(findSetting(availableSettings, 'naming.css.functions.max_words')).toBeUndefined();
    expect(findSetting(availableSettings, 'naming.html.types.max_characters')).toBeUndefined();
});

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
        const scope = inherited.scopes.find(({ folder }) => folder.path === path)!;
        expect(scope.configurations.map((configuration) => configuration.name)).toStrictEqual(
            PURGECSS_SCOPE_CONFIGURATIONS,
        );
        expect(getTable(scope.settings, 'tools.purgecss').safelist).toStrictEqual([]);
    }
    expect(
        inherited.scopes
            .find(({ folder }) => folder.path === 'sibling')!
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
            .filter(({ folder }) => folder.path !== 'sibling')
            .map(({ folder, settings }) => [folder.path, getTable(settings, 'tools.purgecss').safelist]),
    ).toStrictEqual([
        ['', []],
        ['app', ['keep']],
        ['app/deep', ['keep']],
    ]);
    expect(() =>
        getTable(session.scopes.find(({ folder }) => folder.path === 'sibling')!.settings, 'tools.purgecss'),
    ).toThrow('The selected scope has no tools.purgecss settings.');
});

test('two configurations with different defaults are an error until gspot.toml sets the value', () => {
    using sandbox = createTemporaryFolder();

    const source = buildSandboxSettings(['sql'], { rules: true });
    const settings = parseSettings(source, sandbox.path);
    expect(validateKeys(CONFLICTING_SETTINGS, settings, new Map(), buildSelectedAvailableSettings([]))).toStrictEqual([
        ...CONFLICTING_DEFAULT_ERRORS,
    ]);
    const corrected = parseSettings(`${source}[tools.sqlfluff]\ndialect = "sqlite"\n`, sandbox.path);
    expect(validateKeys(CONFLICTING_SETTINGS, corrected, new Map(), buildSelectedAvailableSettings([]))).toStrictEqual(
        [],
    );
    expect(getSettingValue(CONFLICTING_SETTINGS, corrected, 'tools.sqlfluff.dialect')).toMatchObject({
        value: 'sqlite',
        source: 'gspot.toml',
    });
});

test('the conflict is reported at the scope that selects both configurations', () => {
    using sandbox = createTemporaryFolder();

    const settings = parseSettings(
        buildSandboxSettings([], { rules: true, scopes: [{ path: 'db', configurations: ['sql'] }] }),
        sandbox.path,
    );
    expect(
        validateKeys(
            buildSelectedAvailableSettings([]),
            settings,
            new Map([['db', CONFLICTING_SETTINGS]]),
            buildSelectedAvailableSettings([]),
        ),
    ).toStrictEqual([{ path: ['scope', 0, 'configurations'], message: CONFLICTING_SETTINGS.errors[0]!.message }]);
});

test('a scope value settles the scopes below it, and a sibling scope still reports the conflict', () => {
    using sandbox = createTemporaryFolder();

    const settings = parseSettings(
        buildSandboxSettings([], {
            rules: true,
            tables: '\n[[scope]]\npath = "app"\nconfigurations = ["sql"]\ntools.sqlfluff.dialect = "sqlite"\n[[scope]]\npath = "app/db"\nconfigurations = ["sql"]\n[[scope]]\npath = "other"\nconfigurations = ["sql"]\n',
        }),
        sandbox.path,
    );
    const scopes = new Map(Object.keys(settings.scopes).map((path) => [path, CONFLICTING_SETTINGS]));
    expect(
        validateKeys(buildSelectedAvailableSettings([]), settings, scopes, buildSelectedAvailableSettings([])),
    ).toStrictEqual([{ path: ['scope', 2, 'configurations'], message: CONFLICTING_SETTINGS.errors[0]!.message }]);
    expect(getSettingValue(CONFLICTING_SETTINGS, settings, 'tools.sqlfluff.dialect', 'app/db')).toMatchObject({
        value: 'sqlite',
        source: '[scope "app"]',
    });
});

test("a written false overrides a configuration's true default", () => {
    using sandbox = createTemporaryFolder();
    const availableSettings = buildSelectedAvailableSettings(['postgres']);
    const source = buildSandboxSettings(['postgres'], { rules: true });
    const settings = parseSettings(source, sandbox.path);
    expect(getSettingValue(availableSettings, settings, 'tools.squawk.assume_in_transaction')).toMatchObject({
        value: true,
        source: 'configuration postgres',
    });
    const corrected = parseSettings(`${source}[tools.squawk]\nassume_in_transaction = false\n`, sandbox.path);
    expect(getSettingValue(availableSettings, corrected, 'tools.squawk.assume_in_transaction')).toMatchObject({
        value: false,
        source: 'gspot.toml',
    });
});

test('an inherited default names the configuration that declares it', () => {
    using sandbox = createTemporaryFolder();
    const availableSettings = buildSelectedAvailableSettings(['supabase']);
    const settings = parseSettings(buildSandboxSettings(['supabase'], { rules: true }), sandbox.path);
    expect(validateKeys(availableSettings, settings, new Map(), buildSelectedAvailableSettings([]))).toStrictEqual([]);
    expect(getSettingValue(availableSettings, settings, 'tools.sqlfluff.dialect')).toMatchObject({
        value: 'postgres',
        source: 'configuration postgres',
    });
});

test('a per-language key maps to its base setting', () => {
    const baseSettings = buildSelectedAvailableSettings(['structure', 'bash', 'naming', 'format', 'prose']);

    expect(findSetting(baseSettings, 'limits.bash.function_lines')?.setting.name).toBe('limits.function_lines');
    expect(findSetting(baseSettings, 'limits.python.file_lines')?.language).toBe('python');
    expect(findSetting(baseSettings, 'naming.python.parameters.max_words')?.category).toBe('parameters');
    expect(findSetting(baseSettings, 'limits.nope')).toBeUndefined();
});

test('limits that no check reads are refused', () => {
    const availableSettings = buildSelectedAvailableSettings(['structure', 'sql', 'bash']);
    expect(findSetting(availableSettings, 'limits.sql.function_lines')).toBeUndefined();
    expect(findSetting(availableSettings, 'limits.bash.cyclomatic_complexity')).toBeUndefined();
    expect(findSetting(availableSettings, 'limits.sql.function_parameters')).toBeUndefined();
    const errors = validateSettingsText(
        buildSandboxSettings(['sql', 'bash'], {
            rules: true,
            tables: '[limits.sql]\nfunction_lines = 60\n[limits.bash]\ncyclomatic_complexity = 8\n',
        }),
    );
    expect(errors).toStrictEqual([
        'gspot.toml:6: limits.bash.cyclomatic_complexity: `limits.bash.cyclomatic_complexity` is not a limit any check reads. The limits that bash reads are `file_lines`, `function_lines`, `block_nesting`, `function_branches`, `function_assignments`, `trivial_function_statements`.',
        'gspot.toml:4: limits.sql.function_lines: `limits.sql.function_lines` is not a limit any check reads. The limits that sql reads are `file_lines`.',
    ]);
});

test('a value comes from the configuration default, then the root table, then the scope table', () => {
    using sandbox = createTemporaryFolder();
    const baseSettings = buildSelectedAvailableSettings(['structure', 'bash', 'naming', 'format', 'prose']);

    const settings = parseSettings(
        buildSandboxSettings(['bash'], {
            rules: true,
            tables: '[limits]\nfile_lines = 250\n[[scope]]\npath = "api"\nlimits.file_lines = 200\n',
        }),
        sandbox.path,
    );
    expect(getSettingValue(baseSettings, settings, 'limits.file_lines')?.value).toBe(250);
    expect(getSettingValue(baseSettings, settings, 'limits.file_lines', 'api')?.value).toBe(200);
    expect(getSettingValue(baseSettings, settings, 'limits.function_lines')?.source).toBe('configuration structure');
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
    const defaults = buildAvailableSettings(configurations, 'recommended');
    const unwritten = parseSettings(buildSandboxSettings(['naming']), sandbox.path);
    expect(getSettingValue(defaults, unwritten, 'naming.banned_words')?.value).toStrictEqual([
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
    expect(getSettingValue(defaults, settings, 'naming.banned_words')?.value).toStrictEqual(['dispatcher', 'manager']);
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
        const settings = parseSettings(buildSandboxSettings(configurations, { tables }), sandbox.path);
        expect(getSettingValue(availableSettings, settings, key)?.value).toStrictEqual(value);
    },
);

test('a first list written in a scope replaces the shipped default for that scope and its children', () => {
    using sandbox = createTemporaryFolder();
    const availableSettings = buildSelectedAvailableSettings(['supabase']);
    const settings = parseSettings(
        buildSandboxSettings(['supabase'], {
            tables: '[[scope]]\npath = "app"\nsupabase.schemas = ["api"]\n',
        }),
        sandbox.path,
    );
    expect(getSettingValue(availableSettings, settings, 'supabase.schemas')?.value).toStrictEqual(['public']);
    for (const scope of ['app', 'app/deep'])
        expect(getSettingValue(availableSettings, settings, 'supabase.schemas', scope)?.value).toStrictEqual(['api']);
});

test("a scope's rules keep other rules and replace the whole options of the same rule", () => {
    using sandbox = createTemporaryFolder();
    const availableSettings = buildSelectedAvailableSettings(['css']);
    const settings = parseSettings(
        buildSandboxSettings(['css'], {
            rules: true,
            tables: '[tools.stylelint.rules]\nselector-max-id = 0\ncolor-named = ["never", { severity = "error" }]\n[[scope]]\npath = "app"\nconfigurations = []\ntools.stylelint.rules.color-named = ["always-where-possible"]\n',
        }),
        sandbox.path,
    );
    expect(getSettingValue(availableSettings, settings, 'tools.stylelint.rules', 'app')?.value).toStrictEqual({
        'selector-max-id': 0,
        'color-named': ['always-where-possible'],
    });
    expect(getSettingValue(availableSettings, settings, 'tools.stylelint.rules')?.value).toStrictEqual({
        'selector-max-id': 0,
        'color-named': ['never', { severity: 'error' }],
    });
});

test('naming cases equal to the shipped default need no reason, and other cases do', () => {
    const text = buildSandboxSettings(['typescript'], { tables: '[naming.typescript.files]\n cases = ["kebab"]\n' });
    parseSettings(text, process.cwd());
    expect(() => parseSettings(text.replace('["kebab"]', '["camel"]'), process.cwd())).toThrow(
        new GspotError(
            'settings',
            'gspot.toml:4: naming.typescript.files.cases.reason: naming.typescript.files.cases needs a reason. Write it as naming.typescript.files.cases = { value = [...], reason = "..." }, or run gspot set naming.typescript.files.cases ... --reason "<why>".',
        ),
    );
});

// eslint-disable-next-line gspot/no-trivial-functions -- reason: The rule in the plugin source does not report it.
function buildSelectedAvailableSettings(configurations: string[]): AvailableSettings {
    return buildAvailableSettings(selectConfigurations(configurations, readConfigurations()), 'recommended');
}
