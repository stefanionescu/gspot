import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { symlinkSync, readFileSync } from 'node:fs';
import { buildPolicy, policyProblems } from '#tests/harness/policy.ts';

test.each([
    {
        name: 'a missing ignore reason',
        text: 'require_reasons = true\n[[ignore]]\ncheck = "bash/syntax"\n',
        where: 'ignore.0.reason',
        before: '',
        after: 'reason = "The native shell is checked by the project command."\n',
    },
    {
        name: 'a grouped limit reason',
        text: 'require_reasons = true\n[limits.python]\nfile_lines = {value = 300, reason = "N/A"}\n',
        where: 'limits.python.file_lines.reason',
        before: 'N/A',
        after: 'The generated route table is reviewed as one file.',
    },
    {
        name: 'a scoped disabled rule',
        text: '[[scope]]\npath = "api"\n[scope.tools.eslint.rules]\n"no-console" = "off"\n',
        where: 'scope.0.tools.eslint.rules.no-console',
        before: '"off"',
        after: '[]',
    },
])(
    'parseStrictPolicy > semantic errors name the key path of $name and accept its correction',
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
        text: 'configurations = [\n"bash",\n12\n]\n',
        where: 'configurations.1',
        correction: ['12', '"files"'],
    },
    {
        name: 'a quoted key',
        text: '"require_reasons" = "wrong"\n',
        where: 'require_reasons',
        correction: ['"wrong"', 'true'],
    },
    {
        name: 'an inline table value',
        text: 'tools = { jest = { coverage = { lines = "wrong" } } }\n',
        where: 'tools.jest.coverage.lines',
        correction: ['"wrong"', '90'],
    },
    {
        name: 'a repeated scope table',
        text: '[[scope]]\npath = "api"\n[[scope]]\npath = "web"\n[scope.tools.jest.coverage]\nlines = "wrong"\n',
        where: 'scope.1.tools.jest.coverage.lines',
        correction: ['"wrong"', '90'],
    },
    {
        name: 'an unknown nested key',
        text: '[[scope]]\npath = "api"\nkitz = []\n',
        where: '`kitz` is not a setting gspot knows under [scope.0]',
        correction: ['kitz', 'configurations'],
    },
    {
        name: 'a nested array of tables under a second scope',
        text: '[[scope]]\npath = "api"\n[[scope.tools.eslint.overrides]]\npaths = ["src"]\nrules = {eqeqeq = ["always"]}\n[[scope]]\npath = "web"\n[[scope.tools.eslint.overrides]]\npaths = []\nrules = {eqeqeq = ["always"]}\n',
        where: 'scope.1.tools.eslint.overrides.0.paths',
        correction: ['paths = []', 'paths = ["src"]'],
    },
])(
    'parseStrictPolicy > schema errors name the key path of $name and accept its correction',
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
    'parseStrictPolicy > syntax errors name their location without copying neighboring source with %j lines',
    (newline) => {
        const invalid = ['# private fixture marker', 'configurations = ?', ''].join(newline);
        const found = policyProblems(invalid);
        expect(found).toHaveLength(1);
        expect(found[0]).toMatch(/^gspot\.toml:2:\d+ is not valid TOML:/u);
        expect(found[0]).not.toContain('private fixture marker');
        expect(found[0]).not.toContain('\n');
        expect(policyProblems(invalid.replace('configurations = ?', 'configurations = []'))).toStrictEqual([]);
    },
);
test.each(['linked', 'linked/nested'])(
    'parseStrictPolicy > scope %s cannot follow an external directory symlink',
    async (path) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, { 'project/.keep': '', 'outside/nested/sentinel': 'unchanged' });
        const root = join(sandbox.path, 'project');
        symlinkSync('../outside', join(root, 'linked'));
        const found = policyProblems(`${buildPolicy(['bash'])}[[scope]]\npath = "${path}"\n`, root);
        expect(found).toHaveLength(1);
        expect(found[0]).toContain('Unsafe lifecycle');
        expect(readFileSync(join(sandbox.path, 'outside/nested/sentinel'), 'utf8')).toBe('unchanged');
    },
);

test('parseStrictPolicy > invalid TOML is reported as such', () => {
    expect(policyProblems('level = \n')[0]).toContain('is not valid TOML');
});
