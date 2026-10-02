import { join } from 'node:path';
import { mkdirSync } from 'node:fs';
import { test, expect, describe } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { MINIMAL_POLICY } from '#tests/inputs/cli.ts';
import { policyProblems } from '#tests/harness/cli/policy.ts';
import { readPolicy, parsePolicyText } from '#cli/policy/read.ts';

test('parsePolicyText > normalizes reasoned limits into value and reason', () => {
    const policy = parsePolicyText(
        `${MINIMAL_POLICY}[limits]\nfile_lines = 300\nfunction_lines = { value = 80, reason = "Route tables are one ordered list each." }\n[limits.python]\nfile_lines = 400\n`,
        'gspot.toml',
    );
    expect(policy.limits.root['file_lines']).toStrictEqual({ value: 300 });
    expect(policy.limits.root['function_lines']).toStrictEqual({
        value: 80,
        reason: 'Route tables are one ordered list each.',
    });
    expect(policy.limits.groups['python']?.['file_lines']).toStrictEqual({ value: 400 });
});

test('parsePolicyText > normalizes per-language naming tables and categories', () => {
    const policy = parsePolicyText(
        `${MINIMAL_POLICY}[naming]\nbanned_terms = ["dispatcher"]\n[naming.python]\nmax_words = 4\n[naming.python.parameters]\nmax_words = { value = 3, reason = "Handler signatures read as one line." }\n`,
        'gspot.toml',
    );
    expect(policy.naming.banned_terms).toStrictEqual(['dispatcher']);
    expect(policy.naming.languages['python']?.max_words).toStrictEqual({ value: 4 });
    expect(policy.naming.languages['python']?.categories['parameters']?.max_words?.reason).toBe(
        'Handler signatures read as one line.',
    );
});

test('parsePolicyText > an unknown key names its table', () => {
    const found = policyProblems(`${MINIMAL_POLICY}[hooks]\npush = "all"\npsh = "all"\n`);
    expect(found).toHaveLength(1);
    expect(found[0]).toContain('`psh` is not a setting gspot knows under [hooks]');
});

test('parsePolicyText > an ignore without a reason that says something is refused', () => {
    for (const reason of ['', 'N/A', 'TBD', '-', 'because']) {
        const found = policyProblems(
            `${MINIMAL_POLICY}require_reasons = true\n[[ignore]]\ncheck = "bash/shellcheck"\nreason = "${reason}"\n`,
        );
        expect(found[0]).toContain('needs a reason that says something');
    }
});

test('parsePolicyText > a rule slot set to off names the ignore line', () => {
    const found = policyProblems(`${MINIMAL_POLICY}[tools.eslint]\nrules = { "unicorn/no-null" = "off" }\n`);
    expect(found[0]).toContain('gspot ignore');
    expect(found[0]).toContain('--rule unicorn/no-null');
});

test('parsePolicyText > an extra table needs a reason', () => {
    expect(
        policyProblems(
            `${MINIMAL_POLICY}require_reasons = true\n[tools.markdownlint.extra]\nMD044 = false\nreason = ""\n`,
        )[0],
    ).toContain('[tools.markdownlint.extra] needs a `reason`');
});

test('parsePolicyText > nested scopes are accepted and a missing scope is refused', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'api/a.txt': '', 'api/inner/b.txt': '' });
    const text = `${MINIMAL_POLICY}[[scope]]\npath = "api"\n[[scope]]\npath = "api/inner"\n[[scope]]\npath = "missing"\n`;
    const found = policyProblems(text, sandbox.path);
    expect(found.some((problem) => problem.includes('`missing` names a directory that does not exist'))).toBe(true);
    expect(found).toHaveLength(1);
    expect(found[0]).toStartWith('gspot.toml: scope.2');
    mkdirSync(join(sandbox.path, 'missing'));
    expect(policyProblems(text, sandbox.path)).toStrictEqual([]);
});

test('parsePolicyText > a vendored declaration needs a reason when required', () => {
    expect(
        policyProblems(`${MINIMAL_POLICY}require_reasons = true\n[[vendored]]\npaths = ["vendor/**"]\n`)[0],
    ).toContain('needs a reason');
});

describe('readPolicy', () => {
    test('a missing gspot.toml points at init', async () => {
        await using sandbox = await testdir();
        expect(() => readPolicy(sandbox.path)).toThrow('Run `gspot init`');
    });
});

describe('repository correction contracts', () => {
    const check = `${MINIMAL_POLICY}[[check]]
name = "sandbox/correction"
command = ["tool", "check"]
paths = ["source.txt"]
stage = "commit"
`;

    test('refuses an empty correction command', () => {
        expect(policyProblems(`${check}fix_command = []`)).not.toStrictEqual([]);
        expect(policyProblems(`${check}fix_command = ["tool"]`)).toStrictEqual([]);
    });
});
