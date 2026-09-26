import { parsePolicyText, readPolicyText } from '#cli/policy/read.ts';
import { MINIMAL_POLICY } from '#tests/support/cli/policy-problems.ts';
import { describe, expect, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';

const GOOD_IGNORE = '[[ignore]]\ncheck = "bash/shellcheck"\nreason = "The launcher script checks its own arguments."\n';

describe('readPolicyText', () => {
    test('an ignore without a reason is a finding on its line, and the other ignore stands', () => {
        const text = `${MINIMAL_POLICY}require_reasons = true\n${GOOD_IGNORE}[[ignore]]\ncheck = "bash/syntax"\n`;
        const { policy, problems } = readPolicyText(text, 'gspot.toml');
        expect(problems).toMatchObject([{ line: 7, column: 1, message: expect.stringContaining('needs a reason') }]);
        expect(policy.ignores.map((entry) => entry.check)).toStrictEqual(['bash/shellcheck']);
        expect(() => parsePolicyText(text, 'gspot.toml')).toThrow('gspot.toml:7:1');
        const corrected = readPolicyText(`${text}reason = "The syntax check reads the shebang alone."\n`, 'gspot.toml');
        expect(corrected.problems).toStrictEqual([]);
        expect(corrected.policy.ignores).toHaveLength(2);
    });

    test('a scope naming a missing folder is dropped, and the scope that exists stays', async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, { 'api/main.sh': '' });
        const text = `${MINIMAL_POLICY}[[scope]]\npath = "missing"\n[[scope]]\npath = "api"\n`;
        const { policy, problems } = readPolicyText(text, 'gspot.toml', sandbox.path);
        expect(problems).toMatchObject([{ line: 4, message: expect.stringContaining('`missing` names a directory') }]);
        expect(policy.scopes.map((scope) => scope.path)).toStrictEqual(['api']);
    });

    test('a limit with a placeholder reason is dropped with its value, and the tightened limit stays', () => {
        const text = `${MINIMAL_POLICY}require_reasons = true\n[limits]\nfile_lines = { value = 900, reason = "TBD" }\ncyclomatic_complexity = 6\n`;
        const { policy, problems } = readPolicyText(text, 'gspot.toml');
        expect(problems).toMatchObject([{ line: 5, message: expect.stringContaining('"TBD" is refused') }]);
        expect(policy.limits.root['file_lines']).toBeUndefined();
        expect(policy.limits.root['cyclomatic_complexity']).toMatchObject({ value: 6 });
    });

    test('a loosening without a reason and an unknown nested setting are findings, and the defaults stand', async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, { 'api/main.sh': '' });
        const text = `${MINIMAL_POLICY}require_reasons = true\n[limits]\nfile_lines = 1000\n[[scope]]\npath = "api"\n[scope.limits]\nfile_linse = 200\n`;
        const { policy, problems } = readPolicyText(text, 'gspot.toml', sandbox.path);
        expect(problems).toMatchObject([
            { line: 5, message: expect.stringContaining('`limits.file_lines = 1000` is looser') },
            { line: 9, message: expect.stringContaining('`limits.file_linse` is not a limit') },
        ]);
        expect(policy.limits.root['file_lines']).toBeUndefined();
        expect(policy.scopeTables['api']?.limits?.root).toStrictEqual({});
    });

    test('an unknown configuration and a default two configurations disagree on still stop reading', () => {
        expect(() => readPolicyText(`${MINIMAL_POLICY.replace('bash', 'bas')}`, 'gspot.toml')).toThrow('bash');
    });

    test('a table no selected configuration exposes says so without listing settings that do not exist', () => {
        const { problems } = readPolicyText(
            `${MINIMAL_POLICY}[tools.shellcheck]\nrules = { SC2086 = "error" }\n`,
            'gspot.toml',
        );
        expect(problems).toMatchObject([
            { line: 4, message: expect.stringContaining('No setting exists under that table.') },
        ]);
    });

    test('a syntax error still stops reading, because no rest exists', () => {
        expect(() => readPolicyText(`${MINIMAL_POLICY}level = \n`, 'gspot.toml')).toThrow('is not valid TOML');
        expect(() => readPolicyText(`${MINIMAL_POLICY}colour = "red"\n`, 'gspot.toml')).toThrow('`colour`');
    });
});
