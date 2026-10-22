import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { writeFile } from 'node:fs/promises';
import { openSession } from '#cli/session.ts';
import { getTable } from '#cli/settings/scopes.ts';
import { testdir, createFileTree } from 'testdirs';
import { parseSettings } from '#cli/settings/read.ts';
import type { Level } from '#cli/types/configurations.ts';
import { buildKnownSettings } from '#cli/settings/known.ts';
import { validateKeys } from '#cli/settings/validation/keys.ts';
import { selectConfigurations } from '#cli/configurations/select.ts';
import { readConfigurations } from '#cli/configurations/manifests.ts';
import { buildScopeNamingSettings } from '#tests/setup/cli/naming.ts';
import type { KnownSettings } from '#cli/types/settings/inheritance.ts';
import { buildSandboxSettings, validateSettingsText } from '#tests/setup/cli/settings.ts';
import { findSetting, getSettingValue, listEffectiveSettings } from '#cli/settings/inherit.ts';

import {
    CONFLICTING_SETTINGS,
    CSS_HTML_NAMING_SETTINGS,
    PURGECSS_SAFELIST_TABLES,
    CONFLICTING_DEFAULT_ERRORS,
} from '#tests/config/settings/inherit.ts';

test('[naming.css] and [naming.html.folders] accept max_words, max_characters, and cases', () => {
    const settings = parseSettings(CSS_HTML_NAMING_SETTINGS, undefined);
    const knownSettings = buildSelectedKnownSettings(['css', 'html', 'naming']);
    for (const table of ['naming.css', 'naming.css.files', 'naming.html.folders']) {
        for (const [name, value] of Object.entries({ max_words: 3, max_characters: 20, cases: ['kebab'] })) {
            expect(getSettingValue(knownSettings, settings, `${table}.${name}`)?.value).toStrictEqual(value);
        }
    }
    expect(findSetting(knownSettings, 'naming.css.functions.max_words')).toBeUndefined();
    expect(findSetting(knownSettings, 'naming.html.types.max_characters')).toBeUndefined();
});

test('an empty PurgeCSS safelist is inherited, and a scope value applies to its children', async () => {
    await using sandbox = await testdir();
    const tables = PURGECSS_SAFELIST_TABLES;
    await createFileTree(sandbox.path, {
        'gspot.toml': buildSandboxSettings(['site'], { level: 'all', tables }),
        'index.html': '<!doctype html><title>Site</title>',
        'app/index.html': '<!doctype html><title>App</title>',
        'app/deep/index.html': '<!doctype html><title>Deep</title>',
        'sibling/index.html': '<!doctype html><title>Sibling</title>',
    });
    const inherited = await openSession(sandbox.path);
    for (const path of ['', 'app', 'app/deep']) {
        const scope = inherited.scopes.find(({ folder }) => folder.path === path)!;
        expect(scope.configurations.map((configuration) => configuration.name)).toContain('site');
        expect(getTable(scope.settings, 'tools.purgecss').safelist).toStrictEqual([]);
    }
    expect(
        inherited.scopes
            .find(({ folder }) => folder.path === 'sibling')!
            .configurations.map((configuration) => configuration.name),
    ).not.toContain('site');
    const overridden = tables.replace(
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
    const knownSettings = CONFLICTING_SETTINGS;

    const source = buildSandboxSettings(['sql'], { rules: true });
    const settings = parseSettings(source, undefined);
    expect(validateKeys(knownSettings, settings, new Map(), buildSelectedKnownSettings([]))).toStrictEqual([
        ...CONFLICTING_DEFAULT_ERRORS,
    ]);
    const corrected = parseSettings(`${source}[tools.sqlfluff]\ndialect = "sqlite"\n`, undefined);
    expect(validateKeys(knownSettings, corrected, new Map(), buildSelectedKnownSettings([]))).toStrictEqual([]);
    expect(getSettingValue(knownSettings, corrected, 'tools.sqlfluff.dialect')).toMatchObject({
        value: 'sqlite',
        source: 'gspot.toml',
    });
});

test('the conflict is reported at the scope that selects both configurations', () => {
    const knownSettings = CONFLICTING_SETTINGS;

    const settings = parseSettings(
        buildSandboxSettings([], { rules: true, scopes: [{ path: 'db', configurations: ['sql'] }] }),
        undefined,
    );
    expect(
        validateKeys(
            buildSelectedKnownSettings([]),
            settings,
            new Map([['db', knownSettings]]),
            buildSelectedKnownSettings([]),
        ),
    ).toStrictEqual([{ path: ['scope', 0, 'configurations'], message: knownSettings.errors[0]!.message }]);
});

test('a scope value settles the scopes below it, and a sibling scope still reports the conflict', () => {
    const knownSettings = CONFLICTING_SETTINGS;

    const settings = parseSettings(
        buildSandboxSettings([], {
            rules: true,
            tables: '\n[[scope]]\npath = "app"\nconfigurations = ["sql"]\ntools.sqlfluff.dialect = "sqlite"\n[[scope]]\npath = "app/db"\nconfigurations = ["sql"]\n[[scope]]\npath = "other"\nconfigurations = ["sql"]\n',
        }),
        undefined,
    );
    const scopes = new Map(Object.keys(settings.scopes).map((path) => [path, knownSettings]));
    expect(
        validateKeys(buildSelectedKnownSettings([]), settings, scopes, buildSelectedKnownSettings([])),
    ).toStrictEqual([{ path: ['scope', 2, 'configurations'], message: knownSettings.errors[0]!.message }]);
    expect(getSettingValue(knownSettings, settings, 'tools.sqlfluff.dialect', 'app/db')).toMatchObject({
        value: 'sqlite',
        source: '[scope "app"]',
    });
});

test("a written false overrides a configuration's true default", () => {
    const knownSettings = buildSelectedKnownSettings(['postgres']);
    const source = buildSandboxSettings(['postgres'], { rules: true });
    const settings = parseSettings(source, undefined);
    expect(getSettingValue(knownSettings, settings, 'tools.squawk.assume_in_transaction')).toMatchObject({
        value: true,
        source: 'configuration postgres',
    });
    const corrected = parseSettings(`${source}[tools.squawk]\nassume_in_transaction = false\n`, undefined);
    expect(getSettingValue(knownSettings, corrected, 'tools.squawk.assume_in_transaction')).toMatchObject({
        value: false,
        source: 'gspot.toml',
    });
});

test('an inherited default names the configuration that declares it', () => {
    const knownSettings = buildSelectedKnownSettings(['supabase']);
    const settings = parseSettings(buildSandboxSettings(['supabase'], { rules: true }), undefined);
    expect(validateKeys(knownSettings, settings, new Map(), buildSelectedKnownSettings([]))).toStrictEqual([]);
    expect(getSettingValue(knownSettings, settings, 'tools.sqlfluff.dialect')).toMatchObject({
        value: 'postgres',
        source: 'configuration postgres',
    });
});

test('a per-language key maps to its base setting', () => {
    const baseKnown = buildSelectedKnownSettings(['structure', 'bash', 'naming', 'format', 'prose']);

    expect(findSetting(baseKnown, 'limits.bash.function_lines')?.setting.name).toBe('limits.function_lines');
    expect(findSetting(baseKnown, 'limits.python.file_lines')?.language).toBe('python');
    expect(findSetting(baseKnown, 'naming.python.parameters.max_words')?.category).toBe('parameters');
    expect(findSetting(baseKnown, 'limits.nope')).toBeUndefined();
});

test('limits that no check reads are refused', () => {
    const knownSettings = buildSelectedKnownSettings(['structure', 'sql', 'bash']);
    expect(findSetting(knownSettings, 'limits.sql.function_lines')).toBeUndefined();
    expect(findSetting(knownSettings, 'limits.bash.cyclomatic_complexity')).toBeUndefined();
    expect(findSetting(knownSettings, 'limits.sql.function_parameters')).toBeUndefined();
    const errors = validateSettingsText(
        buildSandboxSettings(['sql', 'bash'], {
            rules: true,
            tables: '[limits.sql]\nfunction_lines = 60\n[limits.bash]\ncyclomatic_complexity = 8\n',
        }),
    );
    expect(errors).toContainEqual(
        expect.stringContaining('`limits.sql.function_lines` is not a limit any check reads.') as string,
    );
    expect(errors).toContainEqual(
        expect.stringContaining('`limits.bash.cyclomatic_complexity` is not a limit any check reads.') as string,
    );
});

test('a value comes from the configuration default, then the root table, then the scope table', () => {
    const baseKnown = buildSelectedKnownSettings(['structure', 'bash', 'naming', 'format', 'prose']);

    const settings = parseSettings(
        buildSandboxSettings(['bash'], {
            rules: true,
            tables: '[limits]\nfile_lines = 250\n[[scope]]\npath = "api"\nlimits.file_lines = 200\n',
        }),
        undefined,
    );
    expect(getSettingValue(baseKnown, settings, 'limits.file_lines')?.value).toBe(250);
    expect(getSettingValue(baseKnown, settings, 'limits.file_lines', 'api')?.value).toBe(200);
    expect(getSettingValue(baseKnown, settings, 'limits.function_lines')?.source).toBe('configuration structure');
});

test('list defaults add up across configurations before root and scope additions', () => {
    const naming = readConfigurations().get('naming')!;
    const configurations = [naming];
    for (const [index, terms] of [['dispatcher'], ['dispatcher', 'orchestrator']].entries()) {
        configurations.push({
            ...naming,
            name: `naming-${String(index)}`,
            defaults: { 'naming.banned_words': terms },
        });
    }
    const defaults = buildKnownSettings(configurations, 'recommended');
    const settings = parseSettings(
        buildSandboxSettings(['naming'], {
            rules: true,
            tables: '[naming]\nbanned_words = ["dispatcher", "manager"]\n[[scope]]\npath = "api"\nnaming.banned_words = ["manager", "orchestrator", "handler"]\n',
        }),
        undefined,
    );
    expect(getSettingValue(defaults, settings, 'naming.banned_words', 'api')?.value).toStrictEqual([
        'dispatcher',
        'orchestrator',
        'manager',
        'handler',
    ]);
    expect(
        validateKeys(defaults, settings, new Map([['api', defaults]]), buildSelectedKnownSettings([])),
    ).toStrictEqual([]);
});

test("a scope's rules keep other rules and replace the whole options of the same rule", () => {
    const knownSettings = buildSelectedKnownSettings(['css']);
    const settings = parseSettings(
        buildSandboxSettings(['css'], {
            rules: true,
            tables: '[tools.stylelint.rules]\nselector-max-id = 0\ncolor-named = ["never", { severity = "error" }]\n[[scope]]\npath = "app"\nconfigurations = []\ntools.stylelint.rules.color-named = ["always-where-possible"]\n',
        }),
        undefined,
    );
    expect(getSettingValue(knownSettings, settings, 'tools.stylelint.rules', 'app')?.value).toStrictEqual({
        'selector-max-id': 0,
        'color-named': ['always-where-possible'],
    });
    expect(getSettingValue(knownSettings, settings, 'tools.stylelint.rules')?.value).toStrictEqual({
        'selector-max-id': 0,
        'color-named': ['never', { severity: 'error' }],
    });
});

test('a naming category takes its shipped cases as its default, so gspot.toml may write them without a reason', () => {
    const text = buildSandboxSettings(['typescript'], {
        tables: '[naming.typescript.files]\ncases = ["kebab"]\n',
    });
    const settings = parseSettings(text, undefined);
    const configurations = selectConfigurations(['typescript', 'naming'], readConfigurations());
    const knownSettings = buildKnownSettings(configurations, 'recommended');
    const key = 'naming.typescript.files.cases';
    const defaults = parseSettings(buildSandboxSettings(['typescript']), undefined);
    expect(getSettingValue(knownSettings, defaults, key)?.value).toStrictEqual(['kebab']);
    expect(getSettingValue(knownSettings, settings, key)?.value).toStrictEqual(['kebab']);
    expect(listEffectiveSettings(knownSettings, settings).find((entry) => entry.key === key)?.value).toStrictEqual([
        'kebab',
    ]);
    expect(buildScopeNamingSettings(text).limitsFor('typescript', 'files').caseNames).toStrictEqual(['kebab']);
});

/** Read the defaults and declarations of the selected configurations at one level. */
function buildSelectedKnownSettings(configurations: string[], level: Level = 'recommended'): KnownSettings {
    return buildKnownSettings(selectConfigurations(configurations, readConfigurations()), level);
}
