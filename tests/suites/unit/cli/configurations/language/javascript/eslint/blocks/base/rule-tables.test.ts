import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { LEVELS } from '#cli/config/manifests.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { buildEslint, listLintFindings } from '#tests/setup/eslint/lint.ts';
import { DUPLICATE_RULE_CASES } from '#tests/config/configurations/javascript/blocks.ts';

const DUPLICATE_RULE_FILES = {
    'package.json': '{"private":true,"type":"module"}\n',
    'tsconfig.json':
        '{"compilerOptions":{"target":"ESNext","module":"NodeNext","moduleResolution":"NodeNext","types":[]},"include":["*.ts"]}\n',
} as const;

test.each([...DUPLICATE_RULE_CASES])(
    'each pair of duplicate rules reports a defect once, from the kept rule ($kept)',
    async ({ file, rules, kept }) => {
        await using sandbox = await testdir({
            ...DUPLICATE_RULE_FILES,
            'gspot.toml': buildSandboxSettings(['typescript', 'jest'], { level: 'all' }),
            ...Object.fromEntries(DUPLICATE_RULE_CASES.map(({ file, source }) => [file, source])),
        });

        const eslint = await buildEslint(sandbox.path);

        const reports = await listLintFindings(eslint, sandbox.path, [file], rules);
        expect(
            reports.map(({ rule }) => rule),
            file,
        ).toStrictEqual([kept]);
    },
);

test('level all keeps an if-else helper, whose ternary form gspot/no-trivial-functions reports', async () => {
    const rules = ['gspot/no-trivial-functions', 'unicorn/prefer-ternary'];
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['javascript'], { level: 'all' }),
        'package.json': '{"private":true,"type":"module"}',
        'branch.js':
            "function countLabel(count) {\n    if (count === 1) return 'one item';\n    else return 'many items';\n}\nexport const label = countLabel(2);\n",
        'ternary.js':
            "function countLabel(count) {\n    return count === 1 ? 'one item' : 'many items';\n}\nexport const label = countLabel(2);\n",
    });
    const eslint = await buildEslint(sandbox.path);
    expect(await listLintFindings(eslint, sandbox.path, ['branch.js', 'ternary.js'], rules)).toStrictEqual([
        { file: 'ternary.js', rule: 'gspot/no-trivial-functions', line: 1 },
    ]);
});

test('a boolean name starts with is, has, or can at level all', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['javascript'], { level: 'all' }),
        'package.json': '{"private":true,"type":"module"}',
        'flags.js': [
            'export const isReady = true;',
            'export const hasRows = true;',
            'export const canRetry = true;',
            'export const areReady = true;',
            'export const doesFit = true;',
            'export const requiresLogin = true;',
        ].join('\n'),
    });
    const eslint = await buildEslint(sandbox.path);
    expect(
        await listLintFindings(eslint, sandbox.path, ['flags.js'], ['unicorn/consistent-boolean-name']),
    ).toStrictEqual([4, 5, 6].map((line) => ({ file: 'flags.js', rule: 'unicorn/consistent-boolean-name', line })));
});

test('a test file may hold template text, and a function named for its action returns a boolean', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['javascript'], { level: 'all' }),
        'package.json': '{"private":true,"type":"module"}',
        'steps.test.js': 'export const step = "run: echo ${{ github.sha }}";\n',
        'steps.js':
            'export const step = "run: echo ${{ github.sha }}";\nexport function kill() { return true; }\nexport const ready = true;\n',
    });
    const eslint = await buildEslint(sandbox.path);
    const rules = ['no-template-curly-in-string', 'unicorn/consistent-boolean-name'];
    expect(await listLintFindings(eslint, sandbox.path, ['steps.test.js', 'steps.js'], rules)).toStrictEqual([
        { file: 'steps.js', rule: 'no-template-curly-in-string', line: 1 },
        { file: 'steps.js', rule: 'unicorn/consistent-boolean-name', line: 3 },
    ]);
});

test('at level all, a listener that hands its promise to then passes the promise rules', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['typescript'], { level: 'all' }),
        'tsconfig.json': '{"compilerOptions":{"strict":true,"target":"esnext","lib":["esnext"]},"include":["*.ts"]}',
        'package.json': '{"private":true,"type":"module"}',
        'signal.ts': [
            'declare function onSignal(listener: () => void): void;',
            'declare function closeResources(): Promise<void>;',
            'declare function exit(): void;',
            'onSignal(() => {',
            '    closeResources().then(exit, exit);',
            '});',
        ].join('\n'),
    });
    const eslint = await buildEslint(sandbox.path);
    const rules = [
        'unicorn/prefer-await',
        '@typescript-eslint/no-floating-promises',
        '@typescript-eslint/no-misused-promises',
        'no-void',
    ];
    expect(await listLintFindings(eslint, sandbox.path, ['signal.ts'], rules)).toStrictEqual([]);
});

test.each([...LEVELS])('at level %s, a template takes a number and refuses a boolean', async (level) => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['typescript'], { level }),
        'tsconfig.json': '{"compilerOptions":{"strict":true,"target":"esnext","lib":["esnext"]},"include":["*.ts"]}',
        'package.json': '{"private":true,"type":"module"}',
        'count.ts': [
            'declare const count: number;',
            'declare const isReady: boolean;',
            'export const files = `${count} files`;',
            'export const state = `ready: ${isReady}`;',
        ].join('\n'),
    });
    const eslint = await buildEslint(sandbox.path);
    const rules = ['@typescript-eslint/restrict-template-expressions'];
    expect(await listLintFindings(eslint, sandbox.path, ['count.ts'], rules)).toStrictEqual([
        { file: 'count.ts', rule: '@typescript-eslint/restrict-template-expressions', line: 4 },
    ]);
});
