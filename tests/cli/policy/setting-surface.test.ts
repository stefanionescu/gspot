import { test, expect, describe } from 'bun:test';
import { parseStrictPolicy } from '#cli/policy/read.ts';
import { knownSettings } from '#cli/policy/settings/known.ts';
import { textContaining } from '#tests/harness/expectations.ts';
import { validateAgainstSurface } from '#cli/policy/errors/keys.ts';
import { selectConfigurations } from '#cli/configurations/select.ts';
import { buildPolicy, policyFindings } from '#tests/harness/policy.ts';
import { configurationManifests } from '#cli/configurations/manifests.ts';
import { settingValue, declarationFor } from '#cli/policy/settings/lookup.ts';

const selected = selectConfigurations(['bash', 'naming', 'format', 'spelling'], configurationManifests());
const surface = knownSettings(selected);

test('new license policy requires an explicit choice', () => {
    const licenses = knownSettings(selectConfigurations(['licenses'], configurationManifests()));
    const policy = parseStrictPolicy(buildPolicy(['licenses']));
    expect(settingValue(licenses, policy, 'licenses.allowed')).toMatchObject({ value: [] });
    const authored = parseStrictPolicy(buildPolicy(['licenses'], { tables: '[licenses]\nallowed = ["MIT"]\n' }));
    expect(settingValue(licenses, authored, 'licenses.allowed')).toMatchObject({
        value: ['MIT'],
        source: 'gspot.toml',
    });
});

test.each(['Codex', 'The public product name.'])('spelling accepts the reason %s', (reason) => {
    expect(() =>
        parseStrictPolicy(buildPolicy(['spelling'], { tables: `[words]\nCodex = ${JSON.stringify(reason)}\n` })),
    ).not.toThrow();
});

test.each(['', 'because'])('spelling refuses the invalid reason %s', (reason) => {
    expect(() =>
        parseStrictPolicy(buildPolicy(['spelling'], { tables: `[words]\nCodex = ${JSON.stringify(reason)}\n` })),
    ).toThrow('reason');
});

test('spelling refuses a word without a string reason', () => {
    expect(() => parseStrictPolicy(buildPolicy(['spelling'], { tables: '[words]\nCodex = {}\n' }))).toThrow(
        'expected string',
    );
});

describe('conflicting configuration defaults', () => {
    const sql = configurationManifests().get('sql')!;
    const settings = knownSettings([
        sql,
        {
            ...sql,
            configuration: { ...sql.configuration, name: 'alternate-sql' },
            settings: sql.settings.map((declaration) =>
                declaration.name === 'tools.sqlfluff.dialect' ? { ...declaration, default: 'postgres' } : declaration,
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
        const policy = parseStrictPolicy(buildPolicy([], { tables: '[scope."db"]\nconfigurations = ["sql"]\n' }));
        expect(validateAgainstSurface(knownSettings([]), policy, new Map([['db', settings]]))).toStrictEqual([
            { path: ['scope', 'db', 'configurations'], message: settings.errors[0]!.message },
        ]);
    });

    test('an inherited scope value settles descendants but leaves a sibling conflict visible', () => {
        const policy = parseStrictPolicy(
            buildPolicy([], {
                tables: '[scope."app"]\nconfigurations = ["sql"]\n[scope."app".tools.sqlfluff]\ndialect = "sqlite"\n[scope."app/db"]\nconfigurations = ["sql"]\n[scope."other"]\nconfigurations = ["sql"]\n',
            }),
        );
        const scopes = new Map(Object.keys(policy.scope).map((path) => [path, settings]));
        expect(validateAgainstSurface(knownSettings([]), policy, scopes)).toStrictEqual([
            { path: ['scope', 'other', 'configurations'], message: settings.errors[0]!.message },
        ]);
        expect(settingValue(settings, policy, 'tools.sqlfluff.dialect', 'app/db')).toMatchObject({
            value: 'sqlite',
            source: '[scope."app"]',
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

    test('maps a per-language key back to its base declaration', () => {
        expect(declarationFor(surface, 'limits.bash.function_lines')?.declaration.name).toBe(
            'limits.bash.function_lines',
        );
        expect(declarationFor(surface, 'limits.python.file_lines')?.language).toBe('python');
        expect(declarationFor(surface, 'naming.python.parameters.max_words')?.category).toBe('parameters');
        expect(declarationFor(surface, 'limits.nope')).toBeUndefined();
    });

    test('refuses SQL function line and Bash cyclomatic limits without native consumers', () => {
        const settings = knownSettings(selectConfigurations(['sql', 'bash'], configurationManifests()));
        expect(declarationFor(settings, 'limits.sql.function_lines')).toBeUndefined();
        expect(declarationFor(settings, 'limits.bash.cyclomatic_complexity')).toBeUndefined();
        expect(declarationFor(settings, 'limits.sql.function_parameters')?.declaration.name).toBe(
            'limits.function_parameters',
        );
        const errors = policyFindings(
            buildPolicy(['sql', 'bash'], {
                tables: '[limits.sql]\nfunction_lines = 60\n[limits.bash]\ncyclomatic_complexity = 8\n',
            }),
        );
        expect(errors).toContainEqual(textContaining('`limits.sql.function_lines` is not a limit any check reads.'));
        expect(errors).toContainEqual(
            textContaining('`limits.bash.cyclomatic_complexity` is not a limit any check reads.'),
        );
    });
});

describe('root and scoped settings', () => {
    test('resolves configuration default, root table, then scope table', () => {
        const policy = parseStrictPolicy(
            buildPolicy(['bash'], {
                tables: '[limits]\nfile_lines = 250\n[scope."api"]\n[scope."api".limits]\nfile_lines = 200\n',
            }),
        );
        expect(settingValue(surface, policy, 'limits.file_lines')?.value).toBe(250);
        expect(settingValue(surface, policy, 'limits.file_lines', 'api')?.value).toBe(200);
        expect(settingValue(surface, policy, 'limits.function_lines')?.source).toBe('configuration structure');
    });

    test('lists append and deduplicate across layers', () => {
        const policy = parseStrictPolicy(
            buildPolicy(['bash'], {
                tables: '[naming]\nbanned = ["dispatcher"]\n[scope."api"]\n[scope."api".naming]\nbanned = ["dispatcher", "orchestrator"]\n',
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
                settings: naming.settings.map((declaration) =>
                    declaration.name === 'naming.banned' ? { ...declaration, default: terms } : declaration,
                ),
            });
        }
        const defaults = knownSettings(manifests);
        const policy = parseStrictPolicy(
            buildPolicy(['naming'], {
                tables: '[naming]\nbanned = ["dispatcher", "manager"]\n[scope."api"]\n[scope."api".naming]\nbanned = ["orchestrator", "handler"]\n',
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
                tables: '[tools.stylelint.rules]\nselector-max-id = 0\ncolor-named = ["never", { severity = "error" }]\n[scope."app"]\nconfigurations = []\n[scope."app".tools.stylelint.rules]\ncolor-named = ["always-where-possible"]\n',
            }),
        );
        expect(settingValue(settings, policy, 'tools.stylelint.rules', 'app')?.value).toStrictEqual({
            'selector-max-id': 0,
            'color-named': ['always-where-possible'],
        });
        expect(settingValue(settings, policy, 'tools.stylelint.rules')?.value).toStrictEqual({
            'selector-max-id': 0,
            'color-named': ['never', { severity: 'error' }],
        });
    });
});

describe('setting validation', () => {
    test('raising a ceiling needs a reason that names the command, and lowering one does not', () => {
        const errors = policyFindings('configurations = ["bash"]\n[limits]\nfile_lines = 400\n');
        expect(errors[0]).toContain('gspot set limits.file_lines 400 --reason');
        const lowered = parseStrictPolicy(buildPolicy(['bash'], { tables: '[limits]\nfile_lines = 200\n' }));
        expect(validateAgainstSurface(surface, lowered, new Map())).toStrictEqual([]);
    });

    test('an undeclared native setting is refused with its owning table', () => {
        const errors = policyFindings(buildPolicy(['bash'], { tables: '[tools.shellcheck]\nseverity = "style"\n' }));
        expect(errors[0]).toContain('`severity` is not a setting gspot knows under [tools.shellcheck]');
    });

    test('term-group controls are refused because no group can be removed', () => {
        const errors = policyFindings(
            buildPolicy(['bash'], {
                tables: '[naming]\ngroups_off = [{ group = "marketing", reason = "We like adjectives here." }]\n',
            }),
        );
        expect(errors).toStrictEqual(['gspot.toml: naming.groups_off: Invalid input: expected object, received array']);
    });
});

test('raising the duplication line floor requires a reason, while lowering it tightens detection', () => {
    const settings = knownSettings(selectConfigurations(['duplication'], configurationManifests()));
    const key = 'limits.duplication.min_lines';
    const shipped = settings.defaults.get(key)!.value as number;
    const [raised, lowered] = [shipped + 1, shipped - 1].map((value) =>
        policyFindings(`configurations = ["duplication"]\n[limits.duplication]\nmin_lines = ${String(value)}\n`),
    );
    expect(raised).toHaveLength(1);
    expect(raised![0]).toContain(`gspot set ${key} ${String(shipped + 1)} --reason`);
    expect(lowered).toStrictEqual([]);
});

test.each(['../outside', 'C:outside'])('the harness role refuses the escaping folder %s', (path) => {
    expect(() =>
        parseStrictPolicy(
            buildPolicy(['jest'], { tables: `[architecture.roles]\ntest_harness = ${JSON.stringify(path)}\n` }),
        ),
    ).toThrow('Use a relative path with forward slashes, without parent traversal or a drive prefix.');
});

test('the harness role accepts an owned folder', () => {
    const policy = parseStrictPolicy(
        buildPolicy(['jest'], { tables: '[architecture.roles]\ntest_harness = "tests/fixtures"\n' }),
    );
    expect(policy.architecture.roles['test_harness']).toBe('tests/fixtures');
});
