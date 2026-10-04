import { test, expect, describe } from 'bun:test';
import { parseStrictPolicy } from '#cli/policy/read.ts';
import { knownSettings } from '#cli/policy/settings/known.ts';
import { selectConfigurations } from '#cli/configurations/select.ts';
import { validateAgainstSurface } from '#cli/policy/problems/keys.ts';
import { buildPolicy, policyProblems } from '#tests/harness/policy.ts';
import { specFor, settingValue } from '#cli/policy/settings/entries.ts';
import { configurationManifests } from '#cli/configurations/manifests.ts';

const selected = selectConfigurations(['bash', 'naming', 'format', 'spelling'], configurationManifests());
const surface = knownSettings(selected);

test.each(['recommended', 'all'] as const)('new license policy requires an explicit choice at %s', (level) => {
    const licenses = knownSettings(selectConfigurations(['licenses'], configurationManifests()));
    const policy = parseStrictPolicy(buildPolicy(['licenses'], { level }));
    expect(settingValue(licenses, policy, 'licenses.allowed')).toMatchObject({ value: [] });
    const authored = parseStrictPolicy(buildPolicy(['licenses'], { level, tables: '[licenses]\nallowed = ["MIT"]\n' }));
    expect(settingValue(licenses, authored, 'licenses.allowed')).toMatchObject({
        value: ['MIT'],
        source: 'gspot.toml',
    });
});

describe('conflicting configuration defaults', () => {
    const sql = configurationManifests().get('sql')!;
    const settings = knownSettings([
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
        const source = buildPolicy(['sql']);
        const policy = parseStrictPolicy(source);
        expect(validateAgainstSurface(settings, policy, new Map())).toStrictEqual([
            {
                path: ['configurations'],
                message:
                    'The configurations `sql` and `alternate-sql` set `tools.sqlfluff.dialect` to different values. Set it yourself in gspot.toml to decide.',
            },
        ]);
        const corrected = parseStrictPolicy(`${source}[tools.sqlfluff]\ndialect = "sqlite"\n`);
        expect(validateAgainstSurface(settings, corrected, new Map())).toStrictEqual([]);
        expect(settingValue(settings, corrected, 'tools.sqlfluff.dialect')).toMatchObject({
            value: 'sqlite',
            source: 'gspot.toml',
        });
    });

    test('reports an unresolved conflict at the scope that selects the configurations', () => {
        const policy = parseStrictPolicy(
            buildPolicy([], { tables: '[[scope]]\npath = "db"\nconfigurations = ["sql"]\n' }),
        );
        expect(validateAgainstSurface(knownSettings([]), policy, new Map([['db', settings]]))).toStrictEqual([
            { path: ['scope', 0, 'configurations'], message: settings.problems[0]!.message },
        ]);
    });

    test('an inherited scope value settles descendants but leaves a sibling conflict visible', () => {
        const policy = parseStrictPolicy(
            buildPolicy([], {
                tables: '[[scope]]\npath = "app"\nconfigurations = ["sql"]\n[scope.tools.sqlfluff]\ndialect = "sqlite"\n[[scope]]\npath = "app/db"\nconfigurations = ["sql"]\n[[scope]]\npath = "other"\nconfigurations = ["sql"]\n',
            }),
        );
        const scopes = new Map(policy.scopes.map(({ path }) => [path, settings]));
        expect(validateAgainstSurface(knownSettings([]), policy, scopes)).toStrictEqual([
            { path: ['scope', 2, 'configurations'], message: settings.problems[0]!.message },
        ]);
        expect(settingValue(settings, policy, 'tools.sqlfluff.dialect', 'app/db')).toMatchObject({
            value: 'sqlite',
            source: '[[scope]] app',
        });
    });
});

describe('setting defaults and declarations', () => {
    test('a configuration transaction default is overridden by an explicit false value', () => {
        const settings = knownSettings(selectConfigurations(['supabase'], configurationManifests()));
        const source = buildPolicy(['supabase']);
        const policy = parseStrictPolicy(source);
        expect(settingValue(settings, policy, 'tools.squawk.assume_in_transaction')).toMatchObject({
            value: true,
            source: 'configuration supabase',
        });
        const corrected = parseStrictPolicy(`${source}[tools.squawk]\nassume_in_transaction = false\n`);
        expect(settingValue(settings, corrected, 'tools.squawk.assume_in_transaction')).toMatchObject({
            value: false,
            source: 'gspot.toml',
        });
    });

    test('an inherited dialect default names the configuration that declares it', () => {
        const settings = knownSettings(selectConfigurations(['supabase'], configurationManifests()));
        const policy = parseStrictPolicy(buildPolicy(['supabase']));
        expect(validateAgainstSurface(settings, policy, new Map())).toStrictEqual([]);
        expect(settingValue(settings, policy, 'tools.sqlfluff.dialect')).toMatchObject({
            value: 'postgres',
            source: 'configuration postgres',
        });
    });

    test('maps a per-language key back to its base spec', () => {
        expect(specFor(surface, 'limits.bash.function_lines')?.spec.name).toBe('limits.bash.function_lines');
        expect(specFor(surface, 'limits.python.file_lines')?.language).toBe('python');
        expect(specFor(surface, 'naming.python.parameters.max_words')?.category).toBe('parameters');
        expect(specFor(surface, 'limits.nope')).toBeUndefined();
    });
});

describe('root and scoped settings', () => {
    test('resolves configuration default, root table, then scope table', () => {
        const policy = parseStrictPolicy(
            buildPolicy(['bash'], {
                tables: '[limits]\nfile_lines = 250\n[[scope]]\npath = "api"\n[scope.limits]\nfile_lines = 200\n',
            }),
        );
        expect(settingValue(surface, policy, 'limits.file_lines')?.value).toBe(250);
        expect(settingValue(surface, policy, 'limits.file_lines', 'api')?.value).toBe(200);
        expect(settingValue(surface, policy, 'limits.function_lines')?.source).toBe('configuration structure');
    });

    test('lists append and deduplicate across layers', () => {
        const policy = parseStrictPolicy(
            buildPolicy(['bash'], {
                tables: '[naming]\nbanned = ["dispatcher"]\n[[scope]]\npath = "api"\n[scope.naming]\nbanned = ["dispatcher", "orchestrator"]\n',
            }),
        );
        expect(settingValue(surface, policy, 'naming.banned', 'api')?.value).toStrictEqual([
            'dispatcher',
            'orchestrator',
        ]);
    });
});

describe('merged settings', () => {
    test('list defaults append across configurations before root and scope additions', () => {
        const naming = configurationManifests().get('naming')!;
        const manifests = [];
        for (const [index, terms] of [['dispatcher'], ['dispatcher', 'orchestrator']].entries()) {
            manifests.push({
                ...naming,
                configuration: { ...naming.configuration, name: `naming-${String(index)}` },
                settings: naming.settings.map((spec) =>
                    spec.name === 'naming.banned' ? { ...spec, default: terms } : spec,
                ),
            });
        }
        const defaults = knownSettings(manifests);
        const policy = parseStrictPolicy(
            buildPolicy(['naming'], {
                tables: '[naming]\nbanned = ["dispatcher", "manager"]\n[[scope]]\npath = "api"\n[scope.naming]\nbanned = ["orchestrator", "handler"]\n',
            }),
        );
        expect(settingValue(defaults, policy, 'naming.banned', 'api')?.value).toStrictEqual([
            'dispatcher',
            'orchestrator',
            'manager',
            'handler',
        ]);
        expect(validateAgainstSurface(defaults, policy, new Map())).toStrictEqual([]);
    });

    test('scoped rules inherit unrelated rules and replace complete options for the same rule', () => {
        const settings = knownSettings(selectConfigurations(['css'], configurationManifests()));
        const policy = parseStrictPolicy(
            buildPolicy(['css'], {
                tables: '[tools.stylelint.rules]\nselector-max-id = 0\ncolor-named = ["never", { severity = "warning" }]\n[[scope]]\npath = "app"\nconfigurations = []\n[scope.tools.stylelint.rules]\ncolor-named = ["always-where-possible"]\n',
            }),
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
});

describe('setting validation', () => {
    test('raising a ceiling needs a reason that names the command, and lowering one does not', () => {
        const problems = policyProblems(
            'require_reasons = true\nconfigurations = ["bash"]\n[limits]\nfile_lines = 400\n',
        );
        expect(problems[0]).toContain('gspot set limits.file_lines 400 --reason');
        const lowered = parseStrictPolicy(buildPolicy(['bash'], { tables: '[limits]\nfile_lines = 200\n' }));
        expect(validateAgainstSurface(surface, lowered, new Map())).toStrictEqual([]);
    });

    test('a setting no configuration has is refused with the keys that exist', () => {
        const problems = policyProblems(buildPolicy(['bash'], { tables: '[tools.shellcheck]\nseverity = "style"\n' }));
        expect(problems[0]).toContain('No selected configuration has the setting `tools.shellcheck.severity`');
    });

    test('the marketing group cannot be removed', () => {
        const problems = policyProblems(
            buildPolicy(['bash'], {
                tables: '[naming]\ngroups_off = [{ group = "marketing", reason = "We like adjectives here." }]\n',
            }),
        );
        expect(problems[0]).toContain('`marketing` term group cannot be removed');
    });
});

test('raising the duplication line floor requires a reason, while lowering it tightens detection', () => {
    const settings = knownSettings(selectConfigurations(['duplication'], configurationManifests()));
    const key = 'limits.duplication.min_lines';
    const shipped = settings.defaults.get(key)!.value as number;
    const [raised, lowered] = [shipped + 1, shipped - 1].map((value) =>
        policyProblems(
            `require_reasons = true\nconfigurations = ["duplication"]\n[limits.duplication]\nmin_lines = ${String(value)}\n`,
        ),
    );
    expect(raised).toHaveLength(1);
    expect(raised![0]).toContain(`gspot set ${key} ${String(shipped + 1)} --reason`);
    expect(lowered).toStrictEqual([]);
});

test.each(['../outside', 'C:outside'])('the harness role refuses the escaping folder %s', (path) => {
    expect(() =>
        parseStrictPolicy(
            buildPolicy(['jest'], { tables: `[architecture.roles]\ntest_support = ${JSON.stringify(path)}\n` }),
        ),
    ).toThrow('Use a relative path with forward slashes, without parent traversal or a drive prefix.');
});

test('the harness role accepts an owned folder', () => {
    const policy = parseStrictPolicy(
        buildPolicy(['jest'], { tables: '[architecture.roles]\ntest_support = "tests/fixtures"\n' }),
    );
    expect(policy.architecture.roles['test_support']).toBe('tests/fixtures');
});
