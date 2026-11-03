import { test, expect } from 'bun:test';
import { createFileTree } from 'testdirs';
import { LEVELS } from '#cli/config/manifests.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { buildEslint, listLintFindings } from '#tests/setup/eslint/lint.ts';

test('level all runs the typed gspot test and React rules', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['typescript', 'react'], { level: 'all' }),
        'tsconfig.json':
            '{"compilerOptions":{"strict":true,"target":"esnext","lib":["esnext","dom"],"jsx":"preserve"},"include":["*.ts","*.tsx"]}',
        'package.json': '{"private":true,"type":"module","dependencies":{"react":"^19.0.0"}}',
        'cart.test.ts': '',
        'badge.tsx': '',
    });
    const eslint = await buildEslint(sandbox.path);
    const files = ['badge.tsx', 'cart.test.ts'];
    const rules = [
        'gspot/prefer-readonly-props',
        'gspot/no-mismatched-assertion-types',
        'gspot/valid-throw-assertions',
    ];
    await createFileTree(sandbox.path, {
        'badge.tsx': 'export function Badge(props: { label: string }) {\n    return <b>{props.label}</b>;\n}\n',
        'cart.test.ts': [
            'import { expect, test } from "vitest";',
            'declare function parse(): number;',
            'test("reads", () => { expect(parse()).toBe("3"); });',
            'test("parses", () => { expect(parse()).toThrow(); });',
        ].join('\n'),
    });
    expect(await listLintFindings(eslint, sandbox.path, files, rules)).toStrictEqual([
        { file: 'badge.tsx', rule: 'gspot/prefer-readonly-props', line: 1 },
        { file: 'cart.test.ts', rule: 'gspot/no-mismatched-assertion-types', line: 3 },
        { file: 'cart.test.ts', rule: 'gspot/valid-throw-assertions', line: 4 },
    ]);
    await createFileTree(sandbox.path, {
        'badge.tsx':
            'export function Badge(props: Readonly<{ label: string }>) {\n    return <b>{props.label}</b>;\n}\n',
        'cart.test.ts': [
            'import { expect, test } from "vitest";',
            'declare function parse(): number;',
            'test("reads", () => { expect(parse()).toBe(3); });',
            'test("parses", () => { expect(() => parse()).toThrow(); });',
        ].join('\n'),
    });
    expect(await listLintFindings(eslint, sandbox.path, files, rules)).toStrictEqual([]);
});

test.each([...LEVELS])(
    'at level %s, a listener that hands its promise to then passes the promise rules',
    async (level) => {
        await using sandbox = await createGitSandbox({
            'gspot.toml': buildSandboxSettings(['typescript'], { level }),
            'tsconfig.json':
                '{"compilerOptions":{"strict":true,"target":"esnext","lib":["esnext"]},"include":["*.ts"]}',
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
    },
);

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
