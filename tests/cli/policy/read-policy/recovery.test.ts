import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { textContaining } from '#tests/harness/expectations.ts';
import { buildPolicy, policyProblems } from '#tests/harness/policy.ts';
import { GOOD_IGNORE } from '#tests/config/cli/policy/read/recovery.ts';
import { readPolicyText, parseStrictPolicy } from '#cli/policy/read.ts';

test('forbidden ShellCheck settings in a scope are reported and removed at the scoped key', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'api/source.sh': 'echo value' });
    const text =
        'configurations = ["bash"]\n[scope."api"]\n[scope."api".tools.shellcheck.verbatim]\ndisable = "SC2086"\n[scope."api".reasons]\n"tools.shellcheck.verbatim" = "Exercise the native rule-selection refusal."\n';
    const result = readPolicyText(text, sandbox.path);
    expect(result.problems).toMatchObject([{ path: ['scope', 'api', 'tools', 'shellcheck', 'verbatim'] }]);
    expect(result.policy.scopeTables['api']?.tools?.['shellcheck']?.verbatim).toBeUndefined();
    expect(result.policy.configurations).toStrictEqual(['bash']);
});
test('an ignore without a reason is a finding at its key path, and the other ignore stands', () => {
    const text = `${buildPolicy(['bash'])}${GOOD_IGNORE}[[ignore]]\ncheck = "bash/syntax"\n`;
    const { policy, problems } = readPolicyText(text);
    expect(problems).toMatchObject([{ path: ['ignore', 1, 'reason'], message: textContaining('needs a reason') }]);
    expect(policy.ignore.map((entry) => entry.check)).toStrictEqual(['bash/shellcheck']);
    expect(() => parseStrictPolicy(text)).toThrow('gspot.toml: ignore.1.reason:');
    const corrected = readPolicyText(`${text}reason = "The syntax check reads the shebang alone."\n`);
    expect(corrected.problems).toStrictEqual([]);
    expect(corrected.policy.ignore).toHaveLength(2);
});

test('a limit with a placeholder reason is dropped with its value, and the tightened limit stays', () => {
    const text = `${buildPolicy(['bash'])}[limits]\nfile_lines = 900\ncyclomatic_complexity = 6\n[reasons]\n"limits.file_lines" = "TBD"\n`;
    const { policy, problems } = readPolicyText(text);
    expect(problems).toMatchObject([
        { path: ['reasons', 'limits.file_lines'], message: textContaining('"TBD" is refused') },
    ]);
    expect(policy.limits.root['file_lines']).toBeUndefined();
    expect(policy.limits.root['cyclomatic_complexity']).toBe(6);
});

test('a loosening without a reason and an unknown nested setting are findings, and the defaults stand', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'api/main.sh': '' });
    const text = `${buildPolicy(['bash'])}[limits]\nfile_lines = 1000\n[scope."api"]\n[scope."api".limits]\nfile_linse = 200\n`;
    const { policy, problems } = readPolicyText(text, sandbox.path);
    expect(problems).toMatchObject([
        { path: ['limits', 'file_lines'], message: textContaining('`limits.file_lines = 1000` is looser') },
        {
            path: ['scope', 'api', 'limits', 'file_linse'],
            message: textContaining('`limits.file_linse` is not a limit'),
        },
    ]);
    expect(policy.limits.root['file_lines']).toBeUndefined();
    expect(policy.scopeTables['api']?.limits?.root).toStrictEqual({});
});

test('an unknown configuration stops reading and names a matching configuration', () => {
    expect(() => readPolicyText(buildPolicy(['bash']).replace('bash', 'bas'))).toThrow('bash');
});

test('an unknown native tool option is refused at its table', () => {
    const source = `${buildPolicy(['bash'])}[tools.shellcheck]\nrules = { SC2086 = "error" }\n`;
    expect(() => readPolicyText(source)).toThrow('`rules` is not a setting gspot knows under [tools.shellcheck]');
});

test('a syntax error stops reading with a TOML diagnostic', () => {
    expect(() => readPolicyText(`${buildPolicy(['bash'])}level = \n`)).toThrow('is not valid TOML');
});

test('an unknown top-level key stops reading and names that key', () => {
    expect(() => readPolicyText(`${buildPolicy(['bash'])}hue = "red"\n`)).toThrow('`hue`');
});

test('unknown configurations retain duplicate root entries and scoped declaration order', () => {
    const problems = policyProblems(
        buildPolicy(['bas', 'bash', 'bas'], {
            tables: '[scope."api"]\nconfigurations = ["pythonn", "bas"]\n',
        }),
    );
    expect(problems).toStrictEqual([
        textContaining('gspot.toml: configurations.0: There is no configuration called `bas`.'),
        textContaining('gspot.toml: configurations.2: There is no configuration called `bas`.'),
        textContaining('gspot.toml: scope.api.configurations.0: There is no configuration called `pythonn`.'),
        textContaining('gspot.toml: scope.api.configurations.1: There is no configuration called `bas`.'),
    ]);
});
