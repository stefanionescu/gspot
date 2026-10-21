import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { writeFile } from 'node:fs/promises';
import { openSession } from '#cli/session.ts';
import { testdir, createFileTree } from 'testdirs';
import { parseSettings } from '#cli/settings/read.ts';
import { getTable } from '#cli/settings/scope-view.ts';
import { matchSubstring } from '#tests/setup/matchers.ts';
import { buildKnownSettings } from '#cli/settings/known.ts';
import { validateKeys } from '#cli/settings/validation/keys.ts';
import { readManifests } from '#cli/configurations/manifests.ts';
import { buildScopeNamingSettings } from '#tests/setup/builders.ts';
import { selectConfigurations } from '#cli/configurations/select.ts';
import { CSS_HTML_NAMING_SETTINGS } from '#tests/data/settings/scopes.ts';
import { listSettings, findDeclaration, getSettingValue } from '#cli/settings/inherit.ts';

import {
    buildSandboxSettings,
    validateSettingsText,
    buildLanguageSettings,
    buildConflictingSettings,
} from '#tests/setup/settings.ts';

test('[naming.css] and [naming.html.folders] accept max_words, max_characters, and cases', () => {
    const settings = parseSettings(CSS_HTML_NAMING_SETTINGS, undefined);
    const known = buildKnownSettings(selectConfigurations(['css', 'html', 'naming'], readManifests()), 'recommended');
    for (const table of ['naming.css', 'naming.css.files', 'naming.html.folders']) {
        for (const [name, value] of Object.entries({ max_words: 3, max_characters: 20, cases: ['kebab'] })) {
            expect(getSettingValue(known, settings, `${table}.${name}`)?.value).toStrictEqual(value);
        }
    }
    expect(findDeclaration(known, 'naming.css.functions.max_words')).toBeUndefined();
    expect(findDeclaration(known, 'naming.html.types.max_characters')).toBeUndefined();
});

test('an empty PurgeCSS safelist is inherited, and a scope value applies to its children', async () => {
    await using sandbox = await testdir();
    const tables = `[tools.purgecss]
safelist = []
[[scope]]
path = "app"
configurations = []
[[scope]]
path = "app/deep"
configurations = []
[[scope]]
path = "sibling"
removed_configurations = { value = ["site"], reason = "This scope does not use the inherited site checks." }
`;
    await createFileTree(sandbox.path, {
        'gspot.toml': buildSandboxSettings(['site'], { level: 'all', tables }),
        'index.html': '<!doctype html><title>Site</title>',
        'app/index.html': '<!doctype html><title>App</title>',
        'app/deep/index.html': '<!doctype html><title>Deep</title>',
        'sibling/index.html': '<!doctype html><title>Sibling</title>',
    });
    const inherited = await openSession(sandbox.path);
    for (const path of ['', 'app', 'app/deep']) {
        const scope = inherited.scopes.find(({ scope }) => scope.path === path)!;
        expect(scope.selected.map(({ configuration }) => configuration.name)).toContain('site');
        expect(getTable(scope.view, 'tools.purgecss').safelist).toStrictEqual([]);
    }
    expect(
        inherited.scopes
            .find(({ scope }) => scope.path === 'sibling')!
            .selected.map(({ configuration }) => configuration.name),
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
            .filter(({ scope }) => scope.path !== 'sibling')
            .map(({ scope, view }) => [scope.path, getTable(view, 'tools.purgecss').safelist]),
    ).toStrictEqual([
        ['', []],
        ['app', ['keep']],
        ['app/deep', ['keep']],
    ]);
    expect(() =>
        getTable(session.scopes.find(({ scope }) => scope.path === 'sibling')!.view, 'tools.purgecss'),
    ).toThrow('The selected scope has no tools.purgecss settings.');
});

test('two configurations with different defaults are an error until gspot.toml sets the value', () => {
    const known = buildConflictingSettings();

    const source = buildSandboxSettings(['sql'], { rules: true });
    const settings = parseSettings(source, undefined);
    expect(validateKeys(known, settings, new Map(), buildKnownSettings([], 'recommended'))).toStrictEqual([
        {
            path: ['configurations'],
            message:
                'The configurations `sql` and `alternate-sql` set `tools.sqlfluff.dialect` to different values. Set it yourself in gspot.toml to decide.',
        },
    ]);
    const corrected = parseSettings(`${source}[tools.sqlfluff]\ndialect = "sqlite"\n`, undefined);
    expect(validateKeys(known, corrected, new Map(), buildKnownSettings([], 'recommended'))).toStrictEqual([]);
    expect(getSettingValue(known, corrected, 'tools.sqlfluff.dialect')).toMatchObject({
        value: 'sqlite',
        source: 'gspot.toml',
    });
});

test('the conflict is reported at the scope that selects both configurations', () => {
    const known = buildConflictingSettings();

    const settings = parseSettings(
        buildSandboxSettings([], { rules: true, scopes: [{ path: 'db', configurations: ['sql'] }] }),
        undefined,
    );
    expect(
        validateKeys(
            buildKnownSettings([], 'recommended'),
            settings,
            new Map([['db', known]]),
            buildKnownSettings([], 'recommended'),
        ),
    ).toStrictEqual([{ path: ['scope', 0, 'configurations'], message: known.errors[0]!.message }]);
});

test('a scope value settles the scopes below it, and a sibling scope still reports the conflict', () => {
    const known = buildConflictingSettings();

    const settings = parseSettings(
        buildSandboxSettings([], {
            rules: true,
            tables: '\n[[scope]]\npath = "app"\nconfigurations = ["sql"]\ntools.sqlfluff.dialect = "sqlite"\n[[scope]]\npath = "app/db"\nconfigurations = ["sql"]\n[[scope]]\npath = "other"\nconfigurations = ["sql"]\n',
        }),
        undefined,
    );
    const scopes = new Map(Object.keys(settings.scopes).map((path) => [path, known]));
    expect(
        validateKeys(buildKnownSettings([], 'recommended'), settings, scopes, buildKnownSettings([], 'recommended')),
    ).toStrictEqual([{ path: ['scope', 2, 'configurations'], message: known.errors[0]!.message }]);
    expect(getSettingValue(known, settings, 'tools.sqlfluff.dialect', 'app/db')).toMatchObject({
        value: 'sqlite',
        source: '[scope "app"]',
    });
});

test("a written false overrides a configuration's true default", () => {
    const known = buildKnownSettings(selectConfigurations(['supabase'], readManifests()), 'recommended');
    const source = buildSandboxSettings(['supabase'], { rules: true });
    const settings = parseSettings(source, undefined);
    expect(getSettingValue(known, settings, 'tools.squawk.assume_in_transaction')).toMatchObject({
        value: true,
        source: 'configuration supabase',
    });
    const corrected = parseSettings(`${source}[tools.squawk]\nassume_in_transaction = false\n`, undefined);
    expect(getSettingValue(known, corrected, 'tools.squawk.assume_in_transaction')).toMatchObject({
        value: false,
        source: 'gspot.toml',
    });
});

test('an inherited default names the configuration that declares it', () => {
    const known = buildKnownSettings(selectConfigurations(['supabase'], readManifests()), 'recommended');
    const settings = parseSettings(buildSandboxSettings(['supabase'], { rules: true }), undefined);
    expect(validateKeys(known, settings, new Map(), buildKnownSettings([], 'recommended'))).toStrictEqual([]);
    expect(getSettingValue(known, settings, 'tools.sqlfluff.dialect')).toMatchObject({
        value: 'postgres',
        source: 'configuration postgres',
    });
});

test('a per-language key maps to its base setting', () => {
    const baseKnown = buildLanguageSettings();

    expect(findDeclaration(baseKnown, 'limits.bash.function_lines')?.declaration.name).toBe('limits.function_lines');
    expect(findDeclaration(baseKnown, 'limits.python.file_lines')?.language).toBe('python');
    expect(findDeclaration(baseKnown, 'naming.python.parameters.max_words')?.category).toBe('parameters');
    expect(findDeclaration(baseKnown, 'limits.nope')).toBeUndefined();
});

test('limits that no check reads are refused', () => {
    const known = buildKnownSettings(
        selectConfigurations(['structure', 'sql', 'bash'], readManifests()),
        'recommended',
    );
    expect(findDeclaration(known, 'limits.sql.function_lines')).toBeUndefined();
    expect(findDeclaration(known, 'limits.bash.cyclomatic_complexity')).toBeUndefined();
    expect(findDeclaration(known, 'limits.sql.function_parameters')).toBeUndefined();
    const errors = validateSettingsText(
        buildSandboxSettings(['sql', 'bash'], {
            rules: true,
            tables: '[limits.sql]\nfunction_lines = 60\n[limits.bash]\ncyclomatic_complexity = 8\n',
        }),
    );
    expect(errors).toContainEqual(matchSubstring('`limits.sql.function_lines` is not a limit any check reads.'));
    expect(errors).toContainEqual(
        matchSubstring('`limits.bash.cyclomatic_complexity` is not a limit any check reads.'),
    );
});

test('a value comes from the configuration default, then the root table, then the scope table', () => {
    const baseKnown = buildLanguageSettings();

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

test('lists add up across tables without repeats', () => {
    const baseKnown = buildLanguageSettings();

    const settings = parseSettings(
        buildSandboxSettings(['bash'], {
            rules: true,
            tables: '[naming]\nbanned_words = ["dispatcher"]\n[[scope]]\npath = "api"\nnaming.banned_words = ["dispatcher", "orchestrator"]\n',
        }),
        undefined,
    );
    expect(getSettingValue(baseKnown, settings, 'naming.banned_words', 'api')?.value).toStrictEqual([
        'dispatcher',
        'orchestrator',
    ]);
});

test('list defaults add up across configurations before root and scope additions', () => {
    const naming = readManifests().get('naming')!;
    const manifests = [naming];
    for (const [index, terms] of [['dispatcher'], ['dispatcher', 'orchestrator']].entries()) {
        manifests.push({
            ...naming,
            configuration: { ...naming.configuration, name: `naming-${String(index)}` },
            defaults: { 'naming.banned_words': terms },
        });
    }
    const defaults = buildKnownSettings(manifests, 'recommended');
    const settings = parseSettings(
        buildSandboxSettings(['naming'], {
            rules: true,
            tables: '[naming]\nbanned_words = ["dispatcher", "manager"]\n[[scope]]\npath = "api"\nnaming.banned_words = ["orchestrator", "handler"]\n',
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
        validateKeys(defaults, settings, new Map([['api', defaults]]), buildKnownSettings([], 'recommended')),
    ).toStrictEqual([]);
});

test("a scope's rules keep other rules and replace the whole options of the same rule", () => {
    const known = buildKnownSettings(selectConfigurations(['css'], readManifests()), 'recommended');
    const settings = parseSettings(
        buildSandboxSettings(['css'], {
            rules: true,
            tables: '[tools.stylelint.rules]\nselector-max-id = 0\ncolor-named = ["never", { severity = "error" }]\n[[scope]]\npath = "app"\nconfigurations = []\ntools.stylelint.rules.color-named = ["always-where-possible"]\n',
        }),
        undefined,
    );
    expect(getSettingValue(known, settings, 'tools.stylelint.rules', 'app')?.value).toStrictEqual({
        'selector-max-id': 0,
        'color-named': ['always-where-possible'],
    });
    expect(getSettingValue(known, settings, 'tools.stylelint.rules')?.value).toStrictEqual({
        'selector-max-id': 0,
        'color-named': ['never', { severity: 'error' }],
    });
});

test('a naming category takes its shipped cases as its default, so gspot.toml may write them without a reason', () => {
    const text = buildSandboxSettings(['typescript'], {
        tables: '[naming.typescript.files]\ncases = ["kebab"]\n',
    });
    const settings = parseSettings(text, undefined);
    const selected = selectConfigurations(['typescript', 'naming'], readManifests());
    const known = buildKnownSettings(selected, 'recommended');
    const key = 'naming.typescript.files.cases';
    const defaults = parseSettings(buildSandboxSettings(['typescript']), undefined);
    expect(getSettingValue(known, defaults, key)?.value).toStrictEqual(['kebab']);
    expect(getSettingValue(known, settings, key)?.value).toStrictEqual(['kebab']);
    expect(listSettings(known, settings).find((entry) => entry.key === key)?.value).toStrictEqual(['kebab']);
    expect(buildScopeNamingSettings(text).limitsFor('typescript', 'files').caseNames).toStrictEqual(['kebab']);
});
