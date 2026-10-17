import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { writeFile } from 'node:fs/promises';
import { openSession } from '#cli/session.ts';
import { testdir, createFileTree } from 'testdirs';
import { parseSettings } from '#cli/settings/read.ts';
import { matchSubstring } from '#tests/setup/matchers.ts';
import { buildKnownSettings } from '#cli/settings/known.ts';
import { createReadCache } from '#cli/system/files/cache.ts';
import { validateKeys } from '#cli/settings/validation/keys.ts';
import { readManifests } from '#cli/configurations/manifests.ts';
import { selectConfigurations } from '#cli/configurations/select.ts';
import { findDeclaration, getSettingValue } from '#cli/settings/inherit.ts';
import { buildSettingsText, validateSettingsText } from '#tests/setup/settings.ts';

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
removed_configurations = ["site"]
`;
    await createFileTree(sandbox.path, {
        'gspot.toml': buildSettingsText(['site'], { level: 'all', tables }),
        'index.html': '<!doctype html><title>Site</title>',
        'app/index.html': '<!doctype html><title>App</title>',
        'app/deep/index.html': '<!doctype html><title>Deep</title>',
        'sibling/index.html': '<!doctype html><title>Sibling</title>',
    });
    const inherited = await openSession(sandbox.path);
    for (const path of ['', 'app', 'app/deep']) {
        const scope = inherited.scopes.find(({ scope }) => scope.path === path)!;
        expect(scope.selected.map(({ configuration }) => configuration.name)).toContain('site');
        expect(scope.view.options('tools.purgecss').safelist).toStrictEqual([]);
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
        buildSettingsText(['site'], { level: 'all', tables: overridden }),
    );
    const session = await openSession(sandbox.path);
    expect(
        session.scopes
            .filter(({ scope }) => scope.path !== 'sibling')
            .map(({ scope, view }) => [scope.path, view.options('tools.purgecss').safelist]),
    ).toStrictEqual([
        ['', []],
        ['app', ['keep']],
        ['app/deep', ['keep']],
    ]);
    expect(() => session.scopes.find(({ scope }) => scope.path === 'sibling')!.view.options('tools.purgecss')).toThrow(
        'The selected scope has no tools.purgecss settings.',
    );
});

test('two configurations with different defaults are an error until gspot.toml sets the value', () => {
    const reads = createReadCache(process.cwd());
    const known = buildConflictingSettings();

    const source = buildSettingsText(['sql'], { rules: true });
    const settings = parseSettings(source, undefined, reads);
    expect(validateKeys(known, settings, new Map(), buildKnownSettings([], 'recommended', reads))).toStrictEqual([
        {
            path: ['configurations'],
            message:
                'The configurations `sql` and `alternate-sql` set `tools.sqlfluff.dialect` to different values. Set it yourself in gspot.toml to decide.',
        },
    ]);
    const corrected = parseSettings(`${source}[tools.sqlfluff]\ndialect = "sqlite"\n`, undefined, reads);
    expect(validateKeys(known, corrected, new Map(), buildKnownSettings([], 'recommended', reads))).toStrictEqual([]);
    expect(getSettingValue(known, corrected, 'tools.sqlfluff.dialect')).toMatchObject({
        value: 'sqlite',
        source: 'gspot.toml',
    });
});

test('the conflict is reported at the scope that selects both configurations', () => {
    const reads = createReadCache(process.cwd());
    const known = buildConflictingSettings();

    const settings = parseSettings(
        buildSettingsText([], { rules: true, tables: '\n[[scope]]\npath = "db"\nconfigurations = ["sql"]\n' }),
        undefined,
        reads,
    );
    expect(
        validateKeys(
            buildKnownSettings([], 'recommended', reads),
            settings,
            new Map([['db', known]]),
            buildKnownSettings([], 'recommended', reads),
        ),
    ).toStrictEqual([{ path: ['scope', 0, 'configurations'], message: known.errors[0]!.message }]);
});

test('a scope value settles the scopes below it, and a sibling scope still reports the conflict', () => {
    const reads = createReadCache(process.cwd());
    const known = buildConflictingSettings();

    const settings = parseSettings(
        buildSettingsText([], {
            rules: true,
            tables: '\n[[scope]]\npath = "app"\nconfigurations = ["sql"]\ntools.sqlfluff.dialect = "sqlite"\n[[scope]]\npath = "app/db"\nconfigurations = ["sql"]\n[[scope]]\npath = "other"\nconfigurations = ["sql"]\n',
        }),
        undefined,
        reads,
    );
    const scopes = new Map(Object.keys(settings.scopes).map((path) => [path, known]));
    expect(
        validateKeys(
            buildKnownSettings([], 'recommended', reads),
            settings,
            scopes,
            buildKnownSettings([], 'recommended', reads),
        ),
    ).toStrictEqual([{ path: ['scope', 2, 'configurations'], message: known.errors[0]!.message }]);
    expect(getSettingValue(known, settings, 'tools.sqlfluff.dialect', 'app/db')).toMatchObject({
        value: 'sqlite',
        source: '[scope "app"]',
    });
});

test("a written false overrides a configuration's true default", () => {
    const reads = createReadCache(process.cwd());
    const known = buildKnownSettings(selectConfigurations(['supabase'], readManifests(reads)), 'recommended', reads);
    const source = buildSettingsText(['supabase'], { rules: true });
    const settings = parseSettings(source, undefined, reads);
    expect(getSettingValue(known, settings, 'tools.squawk.assume_in_transaction')).toMatchObject({
        value: true,
        source: 'configuration supabase',
    });
    const corrected = parseSettings(`${source}[tools.squawk]\nassume_in_transaction = false\n`, undefined, reads);
    expect(getSettingValue(known, corrected, 'tools.squawk.assume_in_transaction')).toMatchObject({
        value: false,
        source: 'gspot.toml',
    });
});

test('an inherited default names the configuration that declares it', () => {
    const reads = createReadCache(process.cwd());
    const known = buildKnownSettings(selectConfigurations(['supabase'], readManifests(reads)), 'recommended', reads);
    const settings = parseSettings(buildSettingsText(['supabase'], { rules: true }), undefined, reads);
    expect(validateKeys(known, settings, new Map(), buildKnownSettings([], 'recommended', reads))).toStrictEqual([]);
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
    const reads = createReadCache(process.cwd());
    const known = buildKnownSettings(
        selectConfigurations(['structure', 'sql', 'bash'], readManifests(reads)),
        'recommended',
        reads,
    );
    expect(findDeclaration(known, 'limits.sql.function_lines')).toBeUndefined();
    expect(findDeclaration(known, 'limits.bash.cyclomatic_complexity')).toBeUndefined();
    expect(findDeclaration(known, 'limits.sql.function_parameters')).toBeUndefined();
    const errors = validateSettingsText(
        buildSettingsText(['sql', 'bash'], {
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
        buildSettingsText(['bash'], {
            rules: true,
            tables: '[limits]\nfile_lines = 250\n[[scope]]\npath = "api"\nlimits.file_lines = 200\n',
        }),
        undefined,
        createReadCache(process.cwd()),
    );
    expect(getSettingValue(baseKnown, settings, 'limits.file_lines')?.value).toBe(250);
    expect(getSettingValue(baseKnown, settings, 'limits.file_lines', 'api')?.value).toBe(200);
    expect(getSettingValue(baseKnown, settings, 'limits.function_lines')?.source).toBe('configuration structure');
});

test('lists add up across tables without repeats', () => {
    const baseKnown = buildLanguageSettings();

    const settings = parseSettings(
        buildSettingsText(['bash'], {
            rules: true,
            tables: '[naming]\nbanned_words = ["dispatcher"]\n[[scope]]\npath = "api"\nnaming.banned_words = ["dispatcher", "orchestrator"]\n',
        }),
        undefined,
        createReadCache(process.cwd()),
    );
    expect(getSettingValue(baseKnown, settings, 'naming.banned_words', 'api')?.value).toStrictEqual([
        'dispatcher',
        'orchestrator',
    ]);
});

test('list defaults add up across configurations before root and scope additions', () => {
    const reads = createReadCache(process.cwd());
    const naming = readManifests(reads).get('naming')!;
    const manifests = [naming];
    for (const [index, terms] of [['dispatcher'], ['dispatcher', 'orchestrator']].entries()) {
        manifests.push({
            ...naming,
            configuration: { ...naming.configuration, name: `naming-${String(index)}` },
            defaults: { 'naming.banned_words': terms },
        });
    }
    const defaults = buildKnownSettings(manifests, 'recommended', reads);
    const settings = parseSettings(
        buildSettingsText(['naming'], {
            rules: true,
            tables: '[naming]\nbanned_words = ["dispatcher", "manager"]\n[[scope]]\npath = "api"\nnaming.banned_words = ["orchestrator", "handler"]\n',
        }),
        undefined,
        reads,
    );
    expect(getSettingValue(defaults, settings, 'naming.banned_words', 'api')?.value).toStrictEqual([
        'dispatcher',
        'orchestrator',
        'manager',
        'handler',
    ]);
    expect(
        validateKeys(defaults, settings, new Map([['api', defaults]]), buildKnownSettings([], 'recommended', reads)),
    ).toStrictEqual([]);
});

test("a scope's rules keep other rules and replace the whole options of the same rule", () => {
    const reads = createReadCache(process.cwd());
    const known = buildKnownSettings(selectConfigurations(['css'], readManifests(reads)), 'recommended', reads);
    const settings = parseSettings(
        buildSettingsText(['css'], {
            rules: true,
            tables: '[tools.stylelint.rules]\nselector-max-id = 0\ncolor-named = ["never", { severity = "error" }]\n[[scope]]\npath = "app"\nconfigurations = []\ntools.stylelint.rules.color-named = ["always-where-possible"]\n',
        }),
        undefined,
        reads,
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

function buildConflictingSettings() {
    const reads = createReadCache(process.cwd());
    const sql = readManifests(reads).get('sql')!;
    return buildKnownSettings(
        [
            sql,
            {
                ...sql,
                configuration: { ...sql.configuration, name: 'alternate-sql' },
                defaults: { 'tools.sqlfluff.dialect': 'postgres' },
            },
        ],
        'recommended',
        reads,
    );
}

function buildLanguageSettings() {
    const reads = createReadCache(process.cwd());
    const selected = selectConfigurations(['structure', 'bash', 'naming', 'format', 'prose'], readManifests(reads));
    return buildKnownSettings(selected, 'recommended', reads);
}
