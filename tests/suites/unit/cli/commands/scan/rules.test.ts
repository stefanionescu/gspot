import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { chmod, mkdir, writeFile } from 'node:fs/promises';
import { convertRule } from '#cli/generation/setup/lint-rules.ts';
import { compareInstalledRules } from '#cli/commands/scan/rules.ts';
import { PRINTED_RULE_TOOLS } from '#cli/config/repository/setup.ts';
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
    const rows = await compareInstalledRules(sandbox.path, [
        { definition, path: 'eslint.config.js', sample: 'a.js', user },
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
    const rows = await compareInstalledRules(sandbox.path, [
        { definition, path: 'eslint.config.js', sample: 'a.js', user },
    ]);
    expect(rows).toMatchObject([
        { plugins: ['acme/no-legacy []', 'curl/no-legacy []'], commandChecks: ['unicorn/no-array-reduce'] },
    ]);
});

test('scan says so when a tool cannot print its rules', async () => {
    await using sandbox = await createGitSandbox({ 'a.js': 'export const a = 1;\n' });
    const [definition] = PRINTED_RULE_TOOLS;
    const rows = await compareInstalledRules(sandbox.path, [
        { definition, path: 'eslint.config.js', sample: 'a.js', user: undefined },
    ]);
    expect(rows).toMatchObject([{ path: 'eslint.config.js', covered: 0, dropped: [expect.stringContaining('print')] }]);
});
