import { configurationManifests } from '#cli/configurations/manifests.ts';
import { selectConfigurations } from '#cli/configurations/select.ts';
import { commandArguments } from '#cli/platform/arguments.ts';
import { validateAgainstSurface } from '#cli/policy/audit.ts';
import { parsePolicyText } from '#cli/policy/read.ts';
import { exposedSettings, settingValue, specFor } from '#cli/policy/settings.ts';
import { describe, expect, test } from 'bun:test';

const selected = selectConfigurations(['bash', 'naming', 'formatting', 'spelling'], configurationManifests());
const surface = exposedSettings(selected);

test.each(['sqlite\nexclude_rules = ALL', 'postgres\rtemplater = jinja', '', '[sqlfluff]', 'postgres # comment'])(
    'SQLFluff refuses dialect text %j before emission and accepts a dialect label',
    (dialect) => {
        for (const table of ['tools.sqlfluff', 'scope.tools.sqlfluff']) {
            const scope = table.startsWith('scope.') ? '[[scope]]\npath = "db"\n' : '';
            expect(() =>
                parsePolicyText(
                    `version = 1\nconfigurations = ["sql"]\n${scope}[${table}]\ndialect = ${JSON.stringify(dialect)}\n`,
                    'gspot.toml',
                ),
            ).toThrow('Use a SQLFluff dialect label');
            expect(() =>
                parsePolicyText(
                    `version = 1\nconfigurations = ["sql"]\n${scope}[${table}]\ndialect = "sqlite"\n`,
                    'gspot.toml',
                ),
            ).not.toThrow();
        }
    },
);

describe('conflicting configuration defaults', () => {
    const sql = configurationManifests().get('sql')!;
    const settings = exposedSettings([
        sql,
        {
            ...sql,
            configuration: { ...sql.configuration, name: 'alternate-sql' },
            settings: sql.settings.map((spec) =>
                spec.name === 'tools.sqlfluff.dialect' ? { ...spec, default: 'postgres' } : spec,
            ),
        },
    ]);

    test('reports both configurations until an explicit root value settles their scalar', () => {
        const source = 'version = 1\nconfigurations = ["sql"]\n';
        const policy = parsePolicyText(source, 'gspot.toml');
        expect(validateAgainstSurface(settings, policy)).toStrictEqual([
            {
                path: ['configurations'],
                message:
                    'The configurations `sql` and `alternate-sql` set `tools.sqlfluff.dialect` to different values. Set it yourself in gspot.toml to decide.',
            },
        ]);
        const corrected = parsePolicyText(`${source}[tools.sqlfluff]\ndialect = "sqlite"\n`, 'gspot.toml');
        expect(validateAgainstSurface(settings, corrected)).toStrictEqual([]);
        expect(settingValue(settings, corrected, 'tools.sqlfluff.dialect')).toMatchObject({
            value: 'sqlite',
            source: 'gspot.toml',
        });
    });

    test('reports an unresolved conflict at the scope that selects the configurations', () => {
        const policy = parsePolicyText(
            'version = 1\nconfigurations = []\n[[scope]]\npath = "db"\nconfigurations = ["sql"]\n',
            'gspot.toml',
        );
        expect(validateAgainstSurface(exposedSettings([]), policy, new Map([['db', settings]]))).toStrictEqual([
            { path: ['scope', 0, 'configurations'], message: settings.problems[0]!.message },
        ]);
    });

    test('an inherited scope value settles descendants but leaves a sibling conflict visible', () => {
        const policy = parsePolicyText(
            'version = 1\nconfigurations = []\n[[scope]]\npath = "app"\nconfigurations = ["sql"]\n[scope.tools.sqlfluff]\ndialect = "sqlite"\n[[scope]]\npath = "app/db"\nconfigurations = ["sql"]\n[[scope]]\npath = "other"\nconfigurations = ["sql"]\n',
            'gspot.toml',
        );
        const scopes = new Map(policy.scopes.map(({ path }) => [path, settings]));
        expect(validateAgainstSurface(exposedSettings([]), policy, scopes)).toStrictEqual([
            { path: ['scope', 2, 'configurations'], message: settings.problems[0]!.message },
        ]);
        expect(settingValue(settings, policy, 'tools.sqlfluff.dialect', 'app/db')).toMatchObject({
            value: 'sqlite',
            source: '[[scope]] app',
        });
    });
});

describe('the settings surface', () => {
    test.each([
        ['postgres', false],
        ['supabase', true],
    ] as const)('the %s transaction default is overridden by an explicit false value', (configuration, expected) => {
        const settings = exposedSettings(selectConfigurations([configuration], configurationManifests()));
        const source = `version = 1\nconfigurations = ["${configuration}"]\n`;
        const policy = parsePolicyText(source, 'gspot.toml');
        expect(settingValue(settings, policy, 'tools.squawk.assume_in_transaction')).toMatchObject({
            value: expected,
            source: `configuration ${configuration}`,
        });
        const corrected = parsePolicyText(`${source}[tools.squawk]\nassume_in_transaction = false\n`, 'gspot.toml');
        expect(settingValue(settings, corrected, 'tools.squawk.assume_in_transaction')).toMatchObject({
            value: false,
            source: 'gspot.toml',
        });
    });

    test.each([
        ['sql', 'ansi', 'sql'],
        ['postgres', 'postgres', 'postgres'],
        ['supabase', 'postgres', 'postgres'],
    ])('the %s dialect default identifies its owning configuration', (configuration, dialect, owner) => {
        const settings = exposedSettings(selectConfigurations([configuration], configurationManifests()));
        const policy = parsePolicyText(`version = 1\nconfigurations = ["${configuration}"]\n`, 'gspot.toml');
        expect(validateAgainstSurface(settings, policy)).toStrictEqual([]);
        expect(settingValue(settings, policy, 'tools.sqlfluff.dialect')).toMatchObject({
            value: dialect,
            source: `configuration ${owner}`,
        });
    });

    test('maps a per-language key back to its base spec', () => {
        expect(specFor(surface, 'limits.bash.function_lines')?.spec.name).toBe('limits.bash.function_lines');
        expect(specFor(surface, 'limits.python.file_lines')?.language).toBe('python');
        expect(specFor(surface, 'naming.python.parameters.max_words')?.category).toBe('parameters');
        expect(specFor(surface, 'limits.nope')).toBeUndefined();
    });

    test('resolves configuration default, root table, then scope table', () => {
        const policy = parsePolicyText(
            'version = 1\nconfigurations = ["bash"]\n[limits]\nfile_lines = 250\n[[scope]]\npath = "api"\n[scope.limits]\nfile_lines = 200\n',
            'gspot.toml',
        );
        expect(settingValue(surface, policy, 'limits.file_lines')?.value).toBe(250);
        expect(settingValue(surface, policy, 'limits.file_lines', 'api')?.value).toBe(200);
        expect(settingValue(surface, policy, 'limits.function_lines')?.source).toBe('configuration structure');
    });

    test('lists append and deduplicate across layers', () => {
        const policy = parsePolicyText(
            'version = 1\nconfigurations = ["bash"]\n[naming]\nbanned_terms = ["dispatcher"]\n[[scope]]\npath = "api"\n[scope.naming]\nbanned_terms = ["dispatcher", "orchestrator"]\n',
            'gspot.toml',
        );
        expect(settingValue(surface, policy, 'naming.banned_terms', 'api')?.value).toStrictEqual([
            'dispatcher',
            'orchestrator',
        ]);
    });

    test('list defaults append across configurations before root and scope additions', () => {
        const naming = configurationManifests().get('naming')!;
        const defaults = exposedSettings(
            [['dispatcher'], ['dispatcher', 'orchestrator']].map((terms, index) => ({
                ...naming,
                configuration: { ...naming.configuration, name: `naming-${String(index)}` },
                settings: naming.settings.map((spec) =>
                    spec.name === 'naming.banned_terms' ? { ...spec, default: terms } : spec,
                ),
            })),
        );
        const policy = parsePolicyText(
            'version = 1\nconfigurations = ["naming"]\n[naming]\nbanned_terms = ["dispatcher", "manager"]\n[[scope]]\npath = "api"\n[scope.naming]\nbanned_terms = ["orchestrator", "handler"]\n',
            'gspot.toml',
        );
        expect(settingValue(defaults, policy, 'naming.banned_terms', 'api')?.value).toStrictEqual([
            'dispatcher',
            'orchestrator',
            'manager',
            'handler',
        ]);
        expect(validateAgainstSurface(defaults, policy)).toStrictEqual([]);
    });

    test('scoped rules inherit unrelated rules and replace complete options for the same rule', () => {
        const settings = exposedSettings(selectConfigurations(['css'], configurationManifests()));
        const policy = parsePolicyText(
            'version = 1\nconfigurations = ["css"]\n[tools.stylelint.rules]\nselector-max-id = 0\ncolor-named = ["never", { severity = "warning" }]\n[[scope]]\npath = "app"\nconfigurations = []\n[scope.tools.stylelint.rules]\ncolor-named = ["always-where-possible"]\n',
            'gspot.toml',
        );
        expect(settingValue(settings, policy, 'tools.stylelint.rules', 'app')?.value).toStrictEqual({
            'selector-max-id': 0,
            'color-named': ['always-where-possible'],
        });
        expect(settingValue(settings, policy, 'tools.stylelint.rules')?.value).toStrictEqual({
            'selector-max-id': 0,
            'color-named': ['never', { severity: 'warning' }],
        });
    });

    test('raising a ceiling without a reason is a problem that names the command', () => {
        const policy = parsePolicyText(
            'version = 1\nrequire_reasons = true\nconfigurations = ["bash"]\n[limits]\nfile_lines = 400\n',
            'gspot.toml',
        );
        const problems = validateAgainstSurface(surface, policy);
        expect(problems[0]?.message).toContain('gspot set limits.file_lines 400 --reason');
    });

    test('lowering a ceiling needs no reason', () => {
        const policy = parsePolicyText(
            'version = 1\nconfigurations = ["bash"]\n[limits]\nfile_lines = 200\n',
            'gspot.toml',
        );
        expect(validateAgainstSurface(surface, policy)).toStrictEqual([]);
    });

    test('a setting no configuration has is refused with the keys that exist', () => {
        const policy = parsePolicyText(
            'version = 1\nconfigurations = ["bash"]\n[tools.shellcheck]\nseverity = "style"\n',
            'gspot.toml',
        );
        expect(validateAgainstSurface(surface, policy)[0]?.message).toContain(
            'No selected configuration has the setting `tools.shellcheck.severity`',
        );
    });

    test('the marketing group cannot be removed', () => {
        const policy = parsePolicyText(
            'version = 1\nconfigurations = ["bash"]\n[naming]\nremove_groups = [{ group = "marketing", reason = "We like adjectives here." }]\n',
            'gspot.toml',
        );
        expect(validateAgainstSurface(surface, policy)[0]?.message).toContain(
            '`marketing` term group cannot be removed',
        );
    });
});

test.each(['min_lines', 'min_tokens'])(
    'raising duplication %s requires a reason, while lowering it tightens detection',
    (name) => {
        const selected = selectConfigurations(['duplication'], configurationManifests());
        const settings = exposedSettings(selected);
        const key = `limits.duplication.${name}`;
        const shipped = settings.defaults.get(key)!.value as number;
        const policy = (value: number) =>
            parsePolicyText(
                `version = 1\nrequire_reasons = true\nconfigurations = ["duplication"]\n[limits.duplication]\n${name} = ${String(value)}\n`,
                'gspot.toml',
            );
        expect(
            validateAgainstSurface(settings, policy(shipped + 1)).some((problem) => problem.message.includes(key)),
        ).toBe(true);
        expect(validateAgainstSurface(settings, policy(shipped - 1))).toStrictEqual([]);
    },
);

test.each([-1, 101])('Jest rejects coverage percentage %s and accepts bounded floors with reasons', (percentage) => {
    expect(() =>
        parsePolicyText(
            `version = 1\nconfigurations = ["jest"]\n[tools.jest]\ncoverage_lines = ${String(percentage)}\n`,
            'gspot.toml',
        ),
    ).toThrow();
    expect(() =>
        parsePolicyText(
            'version = 1\nconfigurations = ["jest"]\n[tools.jest]\ncoverage_lines = {value = 75, reason = "Legacy branches are covered as their owners change."}\ncoverage_functions = 100\n',
            'gspot.toml',
        ),
    ).not.toThrow();
});

test.each(['../outside', '/outside', 'C:outside', String.raw`..\outside`])(
    'Jest refuses escaping support directory %s and accepts an owned directory',
    (path) => {
        expect(() =>
            parsePolicyText(
                `version = 1\nconfigurations = ["jest"]\n[tools.jest]\nharness_directory = ${JSON.stringify(path)}\n`,
                'gspot.toml',
            ),
        ).toThrow();
        expect(() =>
            parsePolicyText(
                'version = 1\nconfigurations = ["jest"]\n[tools.jest]\nharness_directory = "tests/fixtures"\n',
                'gspot.toml',
            ),
        ).not.toThrow();
    },
);

test('configured commands preserve quoted paths, empty arguments, and escaped spaces', () => {
    expect(commandArguments(`bun "scripts/build site.js" "" 'two words'`)).toStrictEqual([
        'bun',
        'scripts/build site.js',
        '',
        'two words',
    ]);
    expect(() => commandArguments('bun script.js && echo done')).toThrow();
});
