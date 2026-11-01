import { test, expect } from 'bun:test';
import { createFileTree } from 'testdirs';
import { LEVELS } from '#cli/config/manifests.ts';
import { compareText } from '#cli/system/text.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { buildEslint, listLintFindings } from '#tests/setup/eslint/lint.ts';
import { TYPE_SAMPLES } from '#tests/config/configurations/javascript/rule-samples.ts';

test.each(['basic', 'all'] as const)('%s reports each type sample in TypeScript', async (level) => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['typescript'], { level }),
        'tsconfig.json':
            '{"compilerOptions":{"strict":true,"target":"esnext","lib":["esnext","dom"]},"include":["*.ts"]}',
        'package.json': '{"private":true,"type":"module"}',
        ...Object.fromEntries(TYPE_SAMPLES.map((sample) => [`${sample.name}.ts`, sample.bad])),
    });
    const eslint = await buildEslint(sandbox.path);
    const files = TYPE_SAMPLES.map((sample) => `${sample.name}.ts`);
    const rules = TYPE_SAMPLES.map((sample) => sample.rule);
    const findings = await listLintFindings(eslint, sandbox.path, files, rules);
    const reported = findings.map(({ file, rule }) => `${file} ${String(rule)}`);
    const expected = TYPE_SAMPLES.filter((sample) => level === 'all' || sample.level === 'basic').map(
        (sample) => `${sample.name}.ts ${sample.rule}`,
    );
    expect([...new Set(reported)].toSorted(compareText)).toStrictEqual(expected.toSorted(compareText));
    await createFileTree(
        sandbox.path,
        Object.fromEntries(TYPE_SAMPLES.map((sample) => [`${sample.name}.ts`, sample.good])),
    );
    expect(await listLintFindings(eslint, sandbox.path, files, rules)).toStrictEqual([]);
});

test.each([...LEVELS])('%s runs the typed gspot test and React rules', async (level) => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['typescript', 'react'], { level }),
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
        ...(level === 'all' ? [{ file: 'badge.tsx', rule: 'gspot/prefer-readonly-props', line: 1 }] : []),
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
