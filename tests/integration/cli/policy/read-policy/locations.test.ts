import { join } from 'node:path';
import { describe, expect, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';
import { readFileSync, symlinkSync } from 'node:fs';
import { MINIMAL_POLICY } from '#tests/constants/support/cli.ts';
import { policyProblems } from '#tests/support/cli/policy-problems.ts';

describe('parsePolicyText', () => {
    test('missing adopted executables identify the module value and accept a repository file', async () => {
        await using sandbox = await testdir();
        const text =
            'version = 1\n[[tools.eslint.adopted]]\n[tools.eslint.adopted.processor]\nmodule = "./processing.mjs"\nexport = "default"\n';
        const found = policyProblems(text, sandbox.path);
        expect(found).toHaveLength(1);
        expect(found[0]).toStartWith('gspot.toml:4:');
        expect(found[0]).toContain('executable module is missing');
        await createFileTree(sandbox.path, { 'processing.mjs': 'export default {};\n' });
        expect(policyProblems(text, sandbox.path)).toStrictEqual([]);
    });
    test.each([
        {
            name: 'a missing ignore reason',
            text: 'version = 1\nrequire_reasons = true\n[[ignore]]\ncheck = "bash/syntax"\n',
            line: 3,
            before: '',
            after: 'reason = "The native shell is checked by the project command."\n',
        },
        {
            name: 'a grouped limit reason',
            text: 'version = 1\nrequire_reasons = true\n[limits.python]\nfile_lines = {value = 300, reason = "N/A"}\n',
            line: 4,
            before: 'N/A',
            after: 'The generated route table is reviewed as one file.',
        },
        {
            name: 'a scoped disabled rule',
            text: 'version = 1\n[[scope]]\npath = "api"\n[scope.tools.eslint.rules]\n"no-console" = "off"\n',
            line: 5,
            before: '"off"',
            after: '"error"',
        },
    ])('semantic errors locate $name and accept its correction', ({ text, line, before, after }) => {
        const found = policyProblems(text);
        expect(found).toHaveLength(1);
        expect(found[0]).toStartWith(`gspot.toml:${String(line)}:`);
        const corrected = before === '' ? text + after : text.replace(before, after);
        expect(policyProblems(corrected)).toStrictEqual([]);
    });
    test.each([
        {
            name: 'a multiline array value',
            text: 'version = 1\nconfigurations = [\n"bash",\n12\n]\n',
            line: 4,
            correction: ['12', '"toml"'],
        },
        {
            name: 'a quoted key',
            text: 'version = 1\n"require_reasons" = "wrong"\n',
            line: 2,
            correction: ['"wrong"', 'true'],
        },
        {
            name: 'an inline table value',
            text: 'version = 1\ntools = { jest = { coverage_lines = "wrong" } }\n',
            line: 2,
            correction: ['"wrong"', '90'],
        },
        {
            name: 'a repeated scope table',
            text: 'version = 1\n[[scope]]\npath = "api"\n[[scope]]\npath = "web"\n[scope.tools.jest]\ncoverage_lines = "wrong"\n',
            line: 7,
            correction: ['"wrong"', '90'],
        },
        {
            name: 'an unknown nested key',
            text: 'version = 1\n[[scope]]\npath = "api"\nconfigurationz = []\n',
            line: 4,
            correction: ['configurationz', 'configurations'],
        },
        {
            name: 'a nested array of tables under a second scope',
            text: 'version = 1\n[[scope]]\npath = "api"\n[[scope.tools.eslint.overrides]]\npaths = ["src"]\nrules = {eqeqeq = "error"}\n[[scope]]\npath = "web"\n[[scope.tools.eslint.overrides]]\npaths = []\nrules = {eqeqeq = "error"}\n',
            line: 10,
            correction: ['paths = []', 'paths = ["src"]'],
        },
    ])('schema errors locate $name and accept its correction', ({ name, text, line, correction }) => {
        const found = policyProblems(text);
        expect(found).toHaveLength(1);
        expect(found[0]).toStartWith(`gspot.toml:${String(line)}:`);
        // The quoted key keeps its type message beside the position.
        expect(name !== 'a quoted key' || found[0]!.includes('expected boolean, received string')).toBe(true);
        expect(policyProblems(text.replace(correction[0], correction[1]))).toStrictEqual([]);
    });
    test.each(['\n', '\r\n'])(
        'syntax errors name their location without copying neighboring source with %j lines',
        (newline) => {
            const invalid = ['# private fixture marker', 'version = 1', 'configurations = ?', ''].join(newline);
            const found = policyProblems(invalid);
            expect(found).toHaveLength(1);
            expect(found[0]).toMatch(/^gspot\.toml:3:\d+ is not valid TOML:/u);
            expect(found[0]).not.toContain('private fixture marker');
            expect(found[0]).not.toContain('\n');
            expect(policyProblems(invalid.replace('configurations = ?', 'configurations = []'))).toStrictEqual([]);
        },
    );
    test.each(['linked', 'linked/nested'])('scope %s cannot follow an external directory symlink', async (path) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, { 'project/.keep': '', 'outside/nested/sentinel': 'unchanged' });
        const root = join(sandbox.path, 'project');
        symlinkSync('../outside', join(root, 'linked'));
        const found = policyProblems(`${MINIMAL_POLICY}[[scope]]\npath = "${path}"\n`, root);
        expect(found).toHaveLength(1);
        expect(found[0]).toContain('Unsafe lifecycle');
        expect(readFileSync(join(sandbox.path, 'outside/nested/sentinel'), 'utf8')).toBe('unchanged');
    });

    test('a version other than 1 is refused', () => {
        expect(policyProblems('version = 2\n')[0]).toContain('version = 2');
    });

    test('invalid TOML is reported as such', () => {
        expect(policyProblems('version = \n')[0]).toContain('is not valid TOML');
    });
});
