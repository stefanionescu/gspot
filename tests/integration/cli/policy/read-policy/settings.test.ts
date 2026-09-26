import { join } from 'node:path';
import { mkdirSync } from 'node:fs';
import { describe, expect, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';
import { MINIMAL_POLICY } from '#tests/constants/support/cli.ts';
import { parsePolicyText, readPolicy } from '#cli/policy/read.ts';
import { policyProblems } from '#tests/support/cli/policy-problems.ts';

describe('parsePolicyText', () => {
    test('normalizes reasoned limits into value and reason', () => {
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

    test('normalizes per-language naming tables and categories', () => {
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

    test('an unknown key names the keys that exist under that table', () => {
        const found = policyProblems(`${MINIMAL_POLICY}[hooks]\ntool = "gspot"\ntol = "gspot"\n`);
        expect(found).toHaveLength(1);
        expect(found[0]).toContain('`tol` is not a setting gspot knows under [hooks]');
        expect(found[0]).toContain('`tool`');
    });

    test('an unknown top-level key is refused', () => {
        expect(policyProblems(`${MINIMAL_POLICY}color = "red"\n`)[0]).toContain(
            '`color` is not a setting gspot knows under the top level',
        );
    });

    test('an ignore without a reason that says something is refused', () => {
        for (const reason of ['', 'N/A', 'TBD', '-', 'because']) {
            const found = policyProblems(
                `${MINIMAL_POLICY}require_reasons = true\n[[ignore]]\ncheck = "bash/shellcheck"\nreason = "${reason}"\n`,
            );
            expect(found[0]).toContain('needs a reason that says something');
        }
    });

    test('a directory selector is accepted', () => {
        const found = policyProblems(
            `${MINIMAL_POLICY}[[ignore]]\ncheck = "bash/shellcheck"\npaths = ["scripts"]\nreason = "One launcher script per environment."\n`,
        );
        expect(found).toStrictEqual([]);
    });

    test('a rule slot set to off names the ignore line', () => {
        const found = policyProblems(`${MINIMAL_POLICY}[tools.eslint]\nrules = { "unicorn/no-null" = "off" }\n`);
        expect(found[0]).toContain('gspot ignore');
        expect(found[0]).toContain('--rule unicorn/no-null');
    });

    test('an extra table needs a reason', () => {
        expect(
            policyProblems(
                `${MINIMAL_POLICY}require_reasons = true\n[tools.markdownlint.extra]\nMD044 = false\nreason = ""\n`,
            )[0],
        ).toContain('[tools.markdownlint.extra] needs a `reason`');
    });

    test('nested scopes are accepted and a missing scope is refused', async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, { 'api/a.txt': '', 'api/inner/b.txt': '' });
        const text = `${MINIMAL_POLICY}[[scope]]\npath = "api"\n[[scope]]\npath = "api/inner"\n[[scope]]\npath = "missing"\n`;
        const found = policyProblems(text, sandbox.path);
        expect(found.some((problem) => problem.includes('`missing` names a directory that does not exist'))).toBe(true);
        expect(found).toHaveLength(1);
        expect(found[0]).toStartWith('gspot.toml:8:');
        mkdirSync(join(sandbox.path, 'missing'));
        expect(policyProblems(text, sandbox.path)).toStrictEqual([]);
    });

    test('a vendored declaration needs a reason when required', () => {
        expect(
            policyProblems(`${MINIMAL_POLICY}require_reasons = true\n[[vendored]]\npaths = ["vendor/**"]\n`)[0],
        ).toContain('needs a reason');
    });
});

describe('readPolicy', () => {
    test('reads gspot.toml from a root', async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': MINIMAL_POLICY,
        });
        const files = readPolicy(sandbox.path);
        expect(files.policy.configurations).toStrictEqual(['bash']);
    });

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

    test('keeps advice separate from the correction command and its ordering', () => {
        const policy = parsePolicyText(
            `${check}help = "Review the tool output."
fix_command = ["tool", "correct"]
fix_order = "imports"
`,
            'gspot.toml',
        );
        expect(policy.checks[0]?.help).toBe('Review the tool output.');
        expect(policy.checks[0]?.fix_command).toStrictEqual(['tool', 'correct']);
        expect(policy.checks[0]?.fix_order).toBe('imports');
    });

    test('refuses incomplete executable corrections', () => {
        expect(policyProblems(`${check}fix_command = ["tool"]`)[0]).toContain('fix_order');
        expect(policyProblems(`${check}fix_command = []\nfix_order = "format"`)).not.toStrictEqual([]);
    });
});
