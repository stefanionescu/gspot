import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { symlinkSync, readFileSync } from 'node:fs';
import { MINIMAL_POLICY } from '#tests/inputs/cli.ts';
import { policyProblems } from '#tests/support/cli/policy/problems.ts';

test.each([
    {
        name: 'a missing ignore reason',
        text: 'version = 1\nrequire_reasons = true\n[[ignore]]\ncheck = "bash/syntax"\n',
        where: 'ignore.0.reason',
        before: '',
        after: 'reason = "The native shell is checked by the project command."\n',
    },
    {
        name: 'a grouped limit reason',
        text: 'version = 1\nrequire_reasons = true\n[limits.python]\nfile_lines = {value = 300, reason = "N/A"}\n',
        where: 'limits.python.file_lines.reason',
        before: 'N/A',
        after: 'The generated route table is reviewed as one file.',
    },
    {
        name: 'a scoped disabled rule',
        text: 'version = 1\n[[scope]]\npath = "api"\n[scope.tools.eslint.rules]\n"no-console" = "off"\n',
        where: 'scope.0.tools.eslint.rules.no-console',
        before: '"off"',
        after: '"error"',
    },
])(
    'parsePolicyText > semantic errors name the key path of $name and accept its correction',
    ({ text, where, before, after }) => {
        const found = policyProblems(text);
        expect(found).toHaveLength(1);
        expect(found[0]).toStartWith(`gspot.toml: ${where}:`);
        const corrected = before === '' ? text + after : text.replace(before, after);
        expect(policyProblems(corrected)).toStrictEqual([]);
    },
);
test.each([
    {
        name: 'a multiline array value',
        text: 'version = 1\nkits = [\n"bash",\n12\n]\n',
        where: 'kits.1',
        correction: ['12', '"toml"'],
    },
    {
        name: 'a quoted key',
        text: 'version = 1\n"require_reasons" = "wrong"\n',
        where: 'require_reasons',
        correction: ['"wrong"', 'true'],
    },
    {
        name: 'an inline table value',
        text: 'version = 1\ntools = { jest = { coverage_lines = "wrong" } }\n',
        where: 'tools.jest.coverage_lines',
        correction: ['"wrong"', '90'],
    },
    {
        name: 'a repeated scope table',
        text: 'version = 1\n[[scope]]\npath = "api"\n[[scope]]\npath = "web"\n[scope.tools.jest]\ncoverage_lines = "wrong"\n',
        where: 'scope.1.tools.jest.coverage_lines',
        correction: ['"wrong"', '90'],
    },
    {
        name: 'an unknown nested key',
        text: 'version = 1\n[[scope]]\npath = "api"\nkitz = []\n',
        where: '`kitz` is not a setting gspot knows under [scope.0]',
        correction: ['kitz', 'kits'],
    },
    {
        name: 'a nested array of tables under a second scope',
        text: 'version = 1\n[[scope]]\npath = "api"\n[[scope.tools.eslint.overrides]]\npaths = ["src"]\nrules = {eqeqeq = "error"}\n[[scope]]\npath = "web"\n[[scope.tools.eslint.overrides]]\npaths = []\nrules = {eqeqeq = "error"}\n',
        where: 'scope.1.tools.eslint.overrides.0.paths',
        correction: ['paths = []', 'paths = ["src"]'],
    },
])(
    'parsePolicyText > schema errors name the key path of $name and accept its correction',
    ({ name, text, where, correction }) => {
        const found = policyProblems(text);
        expect(found).toHaveLength(1);
        expect(found[0]).toStartWith(`gspot.toml: ${where}`);
        // The quoted key keeps its type message beside the key path.
        expect(name !== 'a quoted key' || found[0]!.includes('expected boolean, received string')).toBe(true);
        expect(policyProblems(text.replace(correction[0], correction[1]))).toStrictEqual([]);
    },
);
test.each(['\n', '\r\n'])(
    'parsePolicyText > syntax errors name their location without copying neighboring source with %j lines',
    (newline) => {
        const invalid = ['# private fixture marker', 'version = 1', 'configurations = ?', ''].join(newline);
        const found = policyProblems(invalid);
        expect(found).toHaveLength(1);
        expect(found[0]).toMatch(/^gspot\.toml:3:\d+ is not valid TOML:/u);
        expect(found[0]).not.toContain('private fixture marker');
        expect(found[0]).not.toContain('\n');
        expect(policyProblems(invalid.replace('configurations = ?', 'kits = []'))).toStrictEqual([]);
    },
);
test.each(['linked', 'linked/nested'])(
    'parsePolicyText > scope %s cannot follow an external directory symlink',
    async (path) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, { 'project/.keep': '', 'outside/nested/sentinel': 'unchanged' });
        const root = join(sandbox.path, 'project');
        symlinkSync('../outside', join(root, 'linked'));
        const found = policyProblems(`${MINIMAL_POLICY}[[scope]]\npath = "${path}"\n`, root);
        expect(found).toHaveLength(1);
        expect(found[0]).toContain('Unsafe lifecycle');
        expect(readFileSync(join(sandbox.path, 'outside/nested/sentinel'), 'utf8')).toBe('unchanged');
    },
);

test('parsePolicyText > a version other than 1 is refused', () => {
    expect(policyProblems('version = 2\n')[0]).toContain('version = 2');
});

test('parsePolicyText > invalid TOML is reported as such', () => {
    expect(policyProblems('version = \n')[0]).toContain('is not valid TOML');
});
