import { selectKits } from '#cli/kits/select.ts';
import { test, expect, describe } from 'bun:test';
import { kitManifests } from '#cli/kits/manifests.ts';
import { parsePolicyText } from '#cli/policy/read.ts';
import { policyOf } from '#tests/support/cli/policy/text.ts';
import { commandArguments } from '#cli/platform/arguments.ts';
import { validateAgainstSurface } from '#cli/policy/audit.ts';
import { specFor, settingValue } from '#cli/policy/settings.ts';
import { exposedSettings } from '#cli/policy/setting-surface.ts';

const selected = selectKits(['bash', 'naming', 'formatting', 'spelling'], kitManifests());
const surface = exposedSettings(selected);

test('SQLFluff refuses dialect text that injects a directive and accepts a dialect label', () => {
    for (const table of ['tools.sqlfluff', 'scope.tools.sqlfluff']) {
        const scope = table.startsWith('scope.') ? '[[scope]]\npath = "db"\n' : '';
        expect(() =>
            parsePolicyText(
                policyOf(['sql'], `${scope}[${table}]\ndialect = ${JSON.stringify('sqlite\nexclude_rules = ALL')}\n`),
                'gspot.toml',
            ),
        ).toThrow('Use a SQLFluff dialect label');
        expect(() =>
            parsePolicyText(policyOf(['sql'], `${scope}[${table}]\ndialect = "sqlite"\n`), 'gspot.toml'),
        ).not.toThrow();
    }
});

describe('conflicting configuration defaults', () => {
    const sql = kitManifests().get('sql')!;
    const settings = exposedSettings([
        sql,
        {
            ...sql,
            kit: { ...sql.kit, name: 'alternate-sql' },
            settings: sql.settings.map((spec) =>
                spec.name === 'tools.sqlfluff.dialect' ? { ...spec, default: 'postgres' } : spec,
            ),
        },
    ]);

    test('reports both configurations until an explicit root value settles their scalar', () => {
        const source = policyOf(['sql']);
        const policy = parsePolicyText(source, 'gspot.toml');
        expect(validateAgainstSurface(settings, policy)).toStrictEqual([
            {
                path: ['kits'],
                message:
                    'The kits `sql` and `alternate-sql` set `tools.sqlfluff.dialect` to different values. Set it yourself in gspot.toml to decide.',
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
        const policy = parsePolicyText(policyOf([], '[[scope]]\npath = "db"\nkits = ["sql"]\n'), 'gspot.toml');
        expect(validateAgainstSurface(exposedSettings([]), policy, new Map([['db', settings]]))).toStrictEqual([
            { path: ['scope', 0, 'kits'], message: settings.problems[0]!.message },
        ]);
    });

    test('an inherited scope value settles descendants but leaves a sibling conflict visible', () => {
        const policy = parsePolicyText(
            policyOf(
                [],
                '[[scope]]\npath = "app"\nkits = ["sql"]\n[scope.tools.sqlfluff]\ndialect = "sqlite"\n[[scope]]\npath = "app/db"\nkits = ["sql"]\n[[scope]]\npath = "other"\nkits = ["sql"]\n',
            ),
            'gspot.toml',
        );
        const scopes = new Map(policy.scopes.map(({ path }) => [path, settings]));
        expect(validateAgainstSurface(exposedSettings([]), policy, scopes)).toStrictEqual([
            { path: ['scope', 2, 'kits'], message: settings.problems[0]!.message },
        ]);
        expect(settingValue(settings, policy, 'tools.sqlfluff.dialect', 'app/db')).toMatchObject({
            value: 'sqlite',
            source: '[[scope]] app',
        });
    });
});

test('the settings surface > a kit transaction default is overridden by an explicit false value', () => {
    const settings = exposedSettings(selectKits(['supabase'], kitManifests()));
    const source = policyOf(['supabase']);
    const policy = parsePolicyText(source, 'gspot.toml');
    expect(settingValue(settings, policy, 'tools.squawk.assume_in_transaction')).toMatchObject({
        value: true,
        source: 'kit supabase',
    });
    const corrected = parsePolicyText(`${source}[tools.squawk]\nassume_in_transaction = false\n`, 'gspot.toml');
    expect(settingValue(settings, corrected, 'tools.squawk.assume_in_transaction')).toMatchObject({
        value: false,
        source: 'gspot.toml',
    });
});

test('the settings surface > an inherited dialect default names the kit that declares it', () => {
    const settings = exposedSettings(selectKits(['supabase'], kitManifests()));
    const policy = parsePolicyText(policyOf(['supabase']), 'gspot.toml');
    expect(validateAgainstSurface(settings, policy)).toStrictEqual([]);
    expect(settingValue(settings, policy, 'tools.sqlfluff.dialect')).toMatchObject({
        value: 'postgres',
        source: 'kit postgres',
    });
});

test('the settings surface > maps a per-language key back to its base spec', () => {
    expect(specFor(surface, 'limits.bash.function_lines')?.spec.name).toBe('limits.bash.function_lines');
    expect(specFor(surface, 'limits.python.file_lines')?.language).toBe('python');
    expect(specFor(surface, 'naming.python.parameters.max_words')?.category).toBe('parameters');
    expect(specFor(surface, 'limits.nope')).toBeUndefined();
});

test('the settings surface > resolves configuration default, root table, then scope table', () => {
    const policy = parsePolicyText(
        policyOf(['bash'], '[limits]\nfile_lines = 250\n[[scope]]\npath = "api"\n[scope.limits]\nfile_lines = 200\n'),
        'gspot.toml',
    );
    expect(settingValue(surface, policy, 'limits.file_lines')?.value).toBe(250);
    expect(settingValue(surface, policy, 'limits.file_lines', 'api')?.value).toBe(200);
    expect(settingValue(surface, policy, 'limits.function_lines')?.source).toBe('kit structure');
});

test('the settings surface > lists append and deduplicate across layers', () => {
    const policy = parsePolicyText(
        policyOf(
            ['bash'],
            '[naming]\nbanned_terms = ["dispatcher"]\n[[scope]]\npath = "api"\n[scope.naming]\nbanned_terms = ["dispatcher", "orchestrator"]\n',
        ),
        'gspot.toml',
    );
    expect(settingValue(surface, policy, 'naming.banned_terms', 'api')?.value).toStrictEqual([
        'dispatcher',
        'orchestrator',
    ]);
});

test('the settings surface > list defaults append across configurations before root and scope additions', () => {
    const naming = kitManifests().get('naming')!;
    const defaults = exposedSettings(
        [['dispatcher'], ['dispatcher', 'orchestrator']].map((terms, index) => ({
            ...naming,
            kit: { ...naming.kit, name: `naming-${String(index)}` },
            settings: naming.settings.map((spec) =>
                spec.name === 'naming.banned_terms' ? { ...spec, default: terms } : spec,
            ),
        })),
    );
    const policy = parsePolicyText(
        policyOf(
            ['naming'],
            '[naming]\nbanned_terms = ["dispatcher", "manager"]\n[[scope]]\npath = "api"\n[scope.naming]\nbanned_terms = ["orchestrator", "handler"]\n',
        ),
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

test('the settings surface > scoped rules inherit unrelated rules and replace complete options for the same rule', () => {
    const settings = exposedSettings(selectKits(['css'], kitManifests()));
    const policy = parsePolicyText(
        policyOf(
            ['css'],
            '[tools.stylelint.rules]\nselector-max-id = 0\ncolor-named = ["never", { severity = "warning" }]\n[[scope]]\npath = "app"\nkits = []\n[scope.tools.stylelint.rules]\ncolor-named = ["always-where-possible"]\n',
        ),
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

test('the settings surface > raising a ceiling needs a reason that names the command, and lowering one does not', () => {
    const policy = parsePolicyText(
        'version = 1\nrequire_reasons = true\nkits = ["bash"]\n[limits]\nfile_lines = 400\n',
        'gspot.toml',
    );
    const problems = validateAgainstSurface(surface, policy);
    expect(problems[0]?.message).toContain('gspot set limits.file_lines 400 --reason');
    const lowered = parsePolicyText(policyOf(['bash'], '[limits]\nfile_lines = 200\n'), 'gspot.toml');
    expect(validateAgainstSurface(surface, lowered)).toStrictEqual([]);
});

test('the settings surface > a setting no configuration has is refused with the keys that exist', () => {
    const policy = parsePolicyText(policyOf(['bash'], '[tools.shellcheck]\nseverity = "style"\n'), 'gspot.toml');
    expect(validateAgainstSurface(surface, policy)[0]?.message).toContain(
        'No selected kit has the setting `tools.shellcheck.severity`',
    );
});

test('the settings surface > the marketing group cannot be removed', () => {
    const policy = parsePolicyText(
        policyOf(
            ['bash'],
            '[naming]\nremove_groups = [{ group = "marketing", reason = "We like adjectives here." }]\n',
        ),
        'gspot.toml',
    );
    expect(validateAgainstSurface(surface, policy)[0]?.message).toContain('`marketing` term group cannot be removed');
});

test('raising the duplication line floor requires a reason, while lowering it tightens detection', () => {
    const settings = exposedSettings(selectKits(['duplication'], kitManifests()));
    const key = 'limits.duplication.min_lines';
    const shipped = settings.defaults.get(key)!.value as number;
    const [raised, lowered] = [shipped + 1, shipped - 1].map((value) =>
        validateAgainstSurface(
            settings,
            parsePolicyText(
                `version = 1\nrequire_reasons = true\nkits = ["duplication"]\n[limits.duplication]\nmin_lines = ${String(value)}\n`,
                'gspot.toml',
            ),
        ),
    );
    expect(raised!.some((problem) => problem.message.includes(key))).toBe(true);
    expect(lowered).toStrictEqual([]);
});

test.each(['../outside', 'C:outside'])(
    'Jest refuses escaping support directory %s and accepts an owned directory',
    (path) => {
        expect(() =>
            parsePolicyText(
                policyOf(['jest'], `[tools.jest]\nharness_directory = ${JSON.stringify(path)}\n`),
                'gspot.toml',
            ),
        ).toThrow();
        expect(() =>
            parsePolicyText(policyOf(['jest'], '[tools.jest]\nharness_directory = "tests/fixtures"\n'), 'gspot.toml'),
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
