import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { symlink, readFile } from 'node:fs/promises';
import { buildPolicy, policyFindings } from '#tests/harness/policy.ts';

test.each([
    {
        name: 'a missing ignore reason',
        text: '[[ignore]]\ncheck = "bash/syntax"\n',
        where: 'ignore.0.reason',
        before: '',
        after: 'reason = "The native shell is checked by the project command."\n',
    },
    {
        name: 'a grouped limit reason',
        text: '[limits.python]\nfile_lines = 300\n[reasons]\n"limits.python.file_lines" = "N/A"\n',
        where: 'reasons.limits.python.file_lines',
        before: 'N/A',
        after: 'The generated route table is reviewed as one file.',
    },
    {
        name: 'a scoped disabled rule',
        text: '[scope."api"]\n[scope."api".tools.eslint.rules]\n"no-console" = "off"\n',
        where: 'scope.api.tools.eslint.rules.no-console',
        before: '"off"',
        after: '[]',
    },
])(
    'parseStrictPolicy > semantic errors name the key path of $name and pass after the fix',
    ({ text, where, before, after }) => {
        const found = policyFindings(text);
        expect(found).toHaveLength(1);
        expect(found[0]).toStartWith(`gspot.toml: ${where}:`);
        const corrected = before === '' ? text + after : text.replace(before, after);
        expect(policyFindings(corrected)).toStrictEqual([]);
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
        text: '[hooks]\n"enabled" = "wrong"\n',
        where: 'hooks.enabled',
        correction: ['"wrong"', 'true'],
    },
    {
        name: 'an inline table value',
        text: 'coverage = { lines = "wrong" }\n',
        where: 'coverage.lines',
        correction: ['"wrong"', '90'],
    },
    {
        name: 'a repeated scope table',
        text: '[scope."api"]\n[scope."web"]\n[scope."web".coverage]\nlines = "wrong"\n',
        where: 'scope.web.coverage.lines',
        correction: ['"wrong"', '90'],
    },
    {
        name: 'an unknown nested key',
        text: '[scope."api"]\nkitz = []\n',
        where: '`kitz` is not a setting gspot knows under [scope.api]',
        correction: ['kitz', 'configurations'],
    },
    {
        name: 'a nested array of tables under a second scope',
        text: '[scope."api"]\n[[scope."api".tools.eslint.overrides]]\npaths = ["src"]\nrules = {eqeqeq = ["always"]}\n[scope."web"]\n[[scope."web".tools.eslint.overrides]]\npaths = []\nrules = {eqeqeq = ["always"]}\n',
        where: 'scope.web.tools.eslint.overrides.0.paths',
        correction: ['paths = []', 'paths = ["src"]'],
    },
])(
    'parseStrictPolicy > schema errors name the key path of $name and pass after the fix',
    ({ name, text, where, correction }) => {
        const found = policyFindings(text);
        expect(found).toHaveLength(1);
        expect(found[0]).toStartWith(`gspot.toml: ${where}`);
        // The quoted key keeps its type message beside the key path.
        expect(name !== 'a quoted key' || found[0]!.includes('expected boolean, received string')).toBe(true);
        expect(policyFindings(text.replace(correction[0], correction[1]))).toStrictEqual([]);
    },
);
test.each(['\n', '\r\n'])(
    'parseStrictPolicy > syntax errors name their location without copying neighboring source with %j lines',
    (newline) => {
        const invalid = ['# private fixture marker', 'configurations = ?', ''].join(newline);
        const found = policyFindings(invalid);
        expect(found).toHaveLength(1);
        expect(found[0]).toMatch(/^gspot\.toml:2:\d+ is not valid TOML:/u);
        expect(found[0]).not.toContain('private fixture marker');
        expect(found[0]).not.toContain('\n');
        expect(policyFindings(invalid.replace('configurations = ?', 'configurations = []'))).toStrictEqual([]);
    },
);
test.each(['linked', 'linked/nested'])(
    'parseStrictPolicy > scope %s cannot follow an external directory symlink',
    async (path) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, { 'project/.keep': '', 'outside/nested/sentinel': 'unchanged' });
        const root = join(sandbox.path, 'project');
        await symlink('../outside', join(root, 'linked'));
        const found = policyFindings(`${buildPolicy(['bash'])}[scope."${path}"]\n`, root);
        expect(found).toHaveLength(1);
        expect(found[0]).toContain('Unsafe lifecycle');
        expect(await readFile(join(sandbox.path, 'outside/nested/sentinel'), 'utf8')).toBe('unchanged');
    },
);

test('parseStrictPolicy > invalid TOML is reported as such', () => {
    expect(policyFindings('level = \n')[0]).toContain('is not valid TOML');
});
