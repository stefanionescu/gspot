import { stringify } from 'smol-toml';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { textContaining } from '#tests/harness/expectations.ts';
import { selectForScope } from '#cli/repository/selection/public.ts';
import { configurationManifests } from '#cli/configurations/public.ts';
import { buildPolicy, policyFindings } from '#tests/harness/policy.ts';
import { scopeView, knownSettings } from '#cli/policy/settings/public.ts';
import { readPolicyTable, parseStrictPolicy } from '#cli/policy/public.ts';
import { policyValues, parseTomlText } from '#cli/policy/document/public.ts';
import { MISSING_REASON_CASES } from '#tests/config/cli/policy/read/recovery.ts';

test('forbidden ShellCheck settings in a scope are reported and removed at the scoped key', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'api/source.sh': 'echo value' });
    const text =
        'configurations = ["bash"]\n[scope."api"]\n[scope."api".tools.shellcheck.verbatim]\ndisable = "SC2086"\n[scope."api".reasons]\n"tools.shellcheck.verbatim" = "Exercise the native rule-selection refusal."\n';
    const result = readPolicyTable(parseTomlText(text, 'gspot.toml', 'policy'), sandbox.path);
    expect(result.errors).toMatchObject([{ path: ['scope', 'api', 'tools', 'shellcheck', 'verbatim'] }]);
    expect(result.policy.scopeTables['api']?.tools?.['shellcheck']?.verbatim).toBeUndefined();
    expect(result.policy.configurations).toStrictEqual(['bash']);
});
test.each(MISSING_REASON_CASES)('$name', ({ validIgnore, index, checks, reason }) => {
    const text = `${buildPolicy(['bash'])}${validIgnore}[[ignore]]\ncheck = "bash/bash-syntax"\n`;
    const authored = parseTomlText(text, 'gspot.toml', 'policy');
    const original = policyValues(authored);
    const { policy, errors } = readPolicyTable(authored);
    expect(policyValues(authored)).toBe(original);
    expect(errors).toMatchObject([{ path: ['ignore', index, 'reason'], message: textContaining('needs a reason') }]);
    expect(policy.ignore.map((entry) => entry.check)).toStrictEqual(checks);
    expect(() => parseStrictPolicy(text)).toThrow(`gspot.toml: ignore.${String(index)}.reason:`);
    const corrected = readPolicyTable(parseTomlText(`${text}reason = "${reason}"\n`, 'gspot.toml', 'policy'));
    expect(corrected.errors).toStrictEqual([]);
    expect(corrected.policy.ignore).toHaveLength(index + 1);
});

test('a limit with a placeholder reason is dropped with its value, and the tightened limit stays', () => {
    const text = `${buildPolicy(['bash'])}[limits]\nfile_lines = 900\ncyclomatic_complexity = 6\n[reasons]\n"limits.file_lines" = "TBD"\n`;
    const { policy, errors } = readPolicyTable(parseTomlText(text, 'gspot.toml', 'policy'));
    expect(errors).toMatchObject([
        { path: ['reasons', 'limits.file_lines'], message: textContaining('"TBD" is refused') },
    ]);
    expect(policy.limits.root['file_lines']).toBeUndefined();
    expect(policy.limits.root['cyclomatic_complexity']).toBe(6);
});

test('a loosening without a reason and an unknown nested setting are findings, and the defaults stand', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'api/main.sh': '' });
    const text = `${buildPolicy(['bash'])}[limits]\nfile_lines = 1000\n[scope."api"]\n[scope."api".limits]\nfile_linse = 200\n`;
    const { policy, errors } = readPolicyTable(parseTomlText(text, 'gspot.toml', 'policy'), sandbox.path);
    expect(errors).toMatchObject([
        { path: ['limits', 'file_lines'], message: textContaining('`limits.file_lines = 1000` is looser') },
        {
            path: ['scope', 'api', 'limits', 'file_linse'],
            message: textContaining('`limits.file_linse` is not a limit'),
        },
    ]);
    expect(policy.limits.root['file_lines']).toBeUndefined();
    expect(policy.scopeTables['api']?.limits?.root).toStrictEqual({});
    const defaults = parseStrictPolicy(buildPolicy(['duplication']));
    const selected = selectForScope(defaults, '', configurationManifests());
    const key = 'limits.duplication.min_lines';
    const shipped = scopeView(
        knownSettings(selected),
        parseStrictPolicy(buildPolicy(['duplication'])),
        selected,
        '',
    ).limit('min_lines', 'duplication')!;
    const [raised, lowered] = [shipped + 1, shipped - 1].map((value) =>
        policyFindings(`configurations = ["duplication"]\n[limits.duplication]\nmin_lines = ${String(value)}\n`),
    );
    expect(raised).toHaveLength(1);
    expect(raised![0]).toContain(`gspot set ${key} ${String(shipped + 1)} --reason`);
    expect(lowered).toStrictEqual([]);
});

test('an unknown configuration stops reading and names a matching configuration', () => {
    expect(() =>
        readPolicyTable(parseTomlText(buildPolicy(['bash']).replace('bash', 'bas'), 'gspot.toml', 'policy')),
    ).toThrow('bash');
});

test('an unknown native tool option is refused at its table', () => {
    const source = `${buildPolicy(['bash'])}[tools.shellcheck]\nrules = { SC2086 = "error" }\n`;
    expect(() => readPolicyTable(parseTomlText(source, 'gspot.toml', 'policy'))).toThrow(
        '`rules` is not a setting gspot knows under [tools.shellcheck]',
    );
});

test('a syntax error stops reading with a TOML diagnostic', () => {
    expect(() => readPolicyTable(parseTomlText(`${buildPolicy(['bash'])}level = \n`, 'gspot.toml', 'policy'))).toThrow(
        'is not valid TOML',
    );
});

test('an unknown top-level key stops reading and names that key', () => {
    expect(() =>
        readPolicyTable(parseTomlText(`${buildPolicy(['bash'])}hue = "red"\n`, 'gspot.toml', 'policy')),
    ).toThrow('`hue`');
});

test('unknown configurations retain duplicate root entries and scoped declaration order', () => {
    const errors = policyFindings(
        buildPolicy(['bas', 'bash', 'bas'], {
            tables: '[scope."api"]\nconfigurations = ["pythonn", "bas"]\n',
        }),
    );
    expect(errors).toStrictEqual([
        textContaining('gspot.toml: configurations.0: There is no configuration called `bas`.'),
        textContaining('gspot.toml: configurations.2: There is no configuration called `bas`.'),
        textContaining('gspot.toml: scope.api.configurations.0: There is no configuration called `pythonn`.'),
        textContaining('gspot.toml: scope.api.configurations.1: There is no configuration called `bas`.'),
    ]);
});

test.each(["author's name", '$(printf injected); *'])(
    'an existing naming entry %j asks for a reason on that entry',
    (name) => {
        const found = policyFindings(stringify({ configurations: ['naming'], naming: { allowed: { [name]: '' } } }));
        expect(found).toHaveLength(1);
        expect(found[0]).toContain(name);
        expect(found[0]).toContain('reason');
        expect(found[0]).not.toContain('run:');
        const reason = 'The external interface fixes this exact name.';
        const corrected = parseStrictPolicy(
            stringify({ configurations: ['naming'], naming: { allowed: { [name]: reason } } }),
        );
        expect(corrected.naming.allowed).toStrictEqual({ [name]: reason });
    },
);
