import { chmod, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { expect, test } from 'bun:test';

import { compareInstalledRules, readUserRules } from '#cli/commands/scan/rules.ts';
import { NOT_COMPARED_MESSAGE, PRINTED_RULE_TOOLS } from '#cli/config/generation/setup.ts';
import { convertRule } from '#cli/generation/setup/carryover/lint-rules.ts';
import { planInit } from '#cli/generation/setup/planner.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';

async function writePrinter(root: string, rules: unknown): Promise<void> {
    await mkdir(join(root, '.gspot/node_modules/.bin'), { recursive: true });
    const program = join(root, '.gspot/node_modules/.bin/eslint');
    await writeFile(program, `#!/bin/sh\necho '${JSON.stringify({ rules })}'\n`);
    await chmod(program, 0o755);
}

test('scan sorts the ESLint rules of the repository by what gspot runs', async () => {
    await using sandbox = await createGitSandbox({ 'a.js': 'export const a = 1;\n' });
    await writePrinter(sandbox.path, {
        eqeqeq: [2, 'always'],
        semi: [2, 'always'],
        curly: [2],
        'max-depth': [2, { max: 3 }],
        'no-alert': [0],
    });
    const user = new Map(
        Object.entries({
            eqeqeq: [2, 'always'],
            semi: [2, 'never'],
            curly: [0],
            'max-depth': [2, { max: 9 }],
            'no-alert': [0],
            'acme/no-legacy': [2],
        }).map(([rule, value]) => [rule, convertRule(value, true)]),
    );
    const [definition] = PRINTED_RULE_TOOLS;
    const text = `export default [{ rules: ${JSON.stringify(Object.fromEntries(user))} }];\n`;
    const rows = await compareInstalledRules(sandbox.path, [
        { definition, path: 'eslint.config.js', others: [], text, sample: 'a.js', user },
    ]);
    expect(rows).toStrictEqual([
        {
            path: 'eslint.config.js',
            tool: 'eslint',
            covered: 2,
            carried: [],
            differing: ['semi ["never"]'],
            reasons: [
                'gspot ignore javascript/eslint --rule curly --reason "<why>"',
                'gspot ignore javascript/eslint --rule max-depth --reason "<why>"',
            ],
            plugins: ['acme/no-legacy []'],
            commandChecks: [],
            dropped: [],
        },
    ]);
});

test('scan offers no plugin record for a rule of a plugin that gspot loads', async () => {
    await using sandbox = await createGitSandbox({ 'a.js': 'export const a = 1;\n' });
    await writePrinter(sandbox.path, { curly: [2], 'unicorn/no-null': [2] });
    const user = new Map(
        ['unicorn/no-array-reduce', 'acme/no-legacy', 'curl/no-legacy'].map((rule) => [rule, convertRule([2], true)]),
    );
    const [definition] = PRINTED_RULE_TOOLS;
    const text = `export default [{ rules: ${JSON.stringify(Object.fromEntries(user))} }];\n`;
    const rows = await compareInstalledRules(sandbox.path, [
        { definition, path: 'eslint.config.js', others: [], text, sample: 'a.js', user },
    ]);
    expect(rows).toMatchObject([
        { plugins: ['acme/no-legacy []', 'curl/no-legacy []'], commandChecks: ['unicorn/no-array-reduce'] },
    ]);
});

test.each([
    { name: 'the config of the repository', printed: { semi: [2] }, user: undefined },
    { name: 'the tool of gspot', printed: undefined, user: new Map([['semi', convertRule([2], true)]]) },
])('scan says so when $name cannot print its rules', async ({ printed, user }) => {
    await using sandbox = await createGitSandbox({ 'a.js': 'export const a = 1;\n' });
    if (printed !== undefined) await writePrinter(sandbox.path, printed);
    const [definition] = PRINTED_RULE_TOOLS;
    const rows = await compareInstalledRules(sandbox.path, [
        { definition, path: 'eslint.config.js', others: [], text: '', sample: 'a.js', user },
    ]);
    expect(rows).toMatchObject([{ path: 'eslint.config.js', covered: 0, dropped: [NOT_COMPARED_MESSAGE] }]);
});

test('scan compares only the rules that the config file names, not the rules of its shared configs', async () => {
    await using sandbox = await createGitSandbox({ 'a.js': 'export const a = 1;\n' });
    await writePrinter(sandbox.path, { 'no-const-assign': [2], 'no-constant-binary-expression': [2, {}], semi: [2] });
    const user = new Map(
        Object.entries({
            'no-const-assign': [0],
            'no-constant-binary-expression': [2],
            semi: [0],
        }).map(([rule, value]) => [rule, convertRule(value, true)]),
    );
    const [definition] = PRINTED_RULE_TOOLS;
    const text = "import shared from 'shared-config';\nexport default [...shared, { rules: { semi: 'off' } }];\n";
    const rows = await compareInstalledRules(sandbox.path, [
        { definition, path: 'eslint.config.js', others: [], text, sample: 'a.js', user },
    ]);
    expect(rows).toMatchObject([
        {
            covered: 0,
            differing: [],
            reasons: ['gspot ignore javascript/eslint --rule semi --reason "<why>"'],
        },
    ]);
});

test('scan names each other config of a tool, which the tool does not read beside the first one', async () => {
    await using sandbox = await createGitSandbox({
        '.eslintignore': 'dist/\n',
        '.eslintrc.yml': 'rules:\n  semi: off\n',
        '.eslintrc.json': '{"rules":{"semi":"off"}}\n',
        'eslint.config.mjs': 'export default [];\n',
        'package.json': '{"private":true,"type":"module"}\n',
        'src/a.js': 'export const a = 1;\n',
    });
    const reads = await readUserRules(await planInit(sandbox.path, {}));
    expect(reads).toMatchObject([
        { path: 'eslint.config.mjs', others: ['.eslintrc.yml', '.eslintrc.json'], user: undefined },
    ]);
    const rows = await compareInstalledRules(sandbox.path, reads);
    expect(rows.map(({ path, dropped }) => [path, dropped])).toStrictEqual([
        ['eslint.config.mjs', [expect.stringContaining('print')]],
        ['.eslintrc.yml', [expect.stringContaining('eslint reads eslint.config.mjs instead')]],
        ['.eslintrc.json', [expect.stringContaining('eslint reads eslint.config.mjs instead')]],
    ]);
});
