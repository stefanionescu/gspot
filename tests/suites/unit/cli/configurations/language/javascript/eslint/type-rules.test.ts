import { test, expect } from 'bun:test';
import { createFileTree } from 'testdirs';
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
