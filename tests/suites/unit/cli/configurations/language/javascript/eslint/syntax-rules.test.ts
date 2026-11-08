import { expect, test } from 'bun:test';
import { createFileTree } from 'testdirs';

import { ESLINT_LEVEL_CASES } from '#tests/config/configurations/javascript/configuration-blocks.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { buildEslint, listLintFindings } from '#tests/setup/eslint/lint.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';

test.each(ESLINT_LEVEL_CASES)(
    '%s reports assignment, deletion, switch and static-property checks in %s',
    async (level, extension) => {
        await using sandbox = await createGitSandbox({
            'gspot.toml': buildSandboxSettings([extension === 'js' ? 'javascript' : 'typescript'], { level }),
            'tsconfig.json': '{"compilerOptions":{"strict":true},"include":["*.ts"]}',
            'package.json': '{"private":true,"type":"module"}',
            [`assignment.${extension}`]: 'send(value = read());',
            [`delete.${extension}`]: 'delete 42;',
            [`switch.${extension}`]: 'switch (value) { case 1: retry: while (ready) run(); }',
            [`static.${extension}`]: 'class Clock { static interval = 1000; }',
        });
        const eslint = await buildEslint(sandbox.path);
        const rules = ['gspot/restricted-syntax', 'gspot/no-switch-case-labels', 'gspot/prefer-readonly-static'];
        const files = ['assignment', 'delete', 'switch', 'static'].map((name) => `${name}.${extension}`);
        expect(await listLintFindings(eslint, sandbox.path, files, rules)).toStrictEqual([
            ...(level === 'all' ? [{ file: `assignment.${extension}`, rule: 'gspot/restricted-syntax', line: 1 }] : []),
            { file: `delete.${extension}`, rule: 'gspot/restricted-syntax', line: 1 },
            ...(level === 'all' && extension === 'ts'
                ? [{ file: 'static.ts', rule: 'gspot/prefer-readonly-static', line: 1 }]
                : []),
            { file: `switch.${extension}`, rule: 'gspot/no-switch-case-labels', line: 1 },
        ]);
        await createFileTree(sandbox.path, {
            [`assignment.${extension}`]: 'value = read(); send(value);',
            [`delete.${extension}`]: 'delete value.key;',
            [`switch.${extension}`]: 'switch (value) { case 1: while (ready) run(); }',
            [`static.${extension}`]:
                extension === 'ts'
                    ? 'class Clock { static readonly interval = 1000; }'
                    : 'class Clock { interval = 1000; }',
        });
        expect(await listLintFindings(eslint, sandbox.path, files, rules)).toStrictEqual([]);
    },
);

test.each(['js', 'ts'])('assignment selectors allow their parent contexts in %s', async (extension) => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings([extension === 'js' ? 'javascript' : 'typescript'], { level: 'all' }),
        'tsconfig.json': '{"compilerOptions":{"strict":true},"include":["*.ts"]}',
        'package.json': '{"private":true,"type":"module"}',
        [`contexts.${extension}`]: [
            'value = read();',
            'first = second = read();',
            'const result = value = read();',
            'if ((value = read()) !== null) run();',
            'for (; ready; count++, value = read()) run();',
            'const fetch = () => value = read();',
            'ready && (value = read());',
            'while (value = read()) run();',
            'do run(); while (value = read());',
            'for (value = read(); ready; value = read()) run();',
            'delete value?.key;',
        ].join('\n'),
    });
    const eslint = await buildEslint(sandbox.path);
    expect(
        await listLintFindings(eslint, sandbox.path, [`contexts.${extension}`], ['gspot/restricted-syntax']),
    ).toStrictEqual([]);
    await createFileTree(sandbox.path, {
        [`contexts.${extension}`]: [
            'call(value = read());',
            '1 + (value = read());',
            '(value = read()) || other;',
            'if (value = read()) run();',
            'for (; value = read(); count++) run();',
            'function read() { return value = fetch(); }',
            'delete read();',
        ].join('\n'),
    });
    expect(
        await listLintFindings(eslint, sandbox.path, [`contexts.${extension}`], ['gspot/restricted-syntax']),
    ).toStrictEqual(
        [1, 2, 3, 4, 5, 6, 7].map((line) => ({ file: `contexts.${extension}`, rule: 'gspot/restricted-syntax', line })),
    );
});

test('at level all, a module that exports values runs no top-level loop or branch, and a script or config file may', async () => {
    const loop = 'const registry = new Map();\nfor (const name of ["a", "b"]) registry.set(name, name.length);\n';
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['javascript'], { level: 'all' }),
        'package.json': '{"private":true,"type":"module"}',
        'registry.js': `${loop}if (registry.size > 0) registry.clear();\nexport { registry };\n`,
        'build.js': loop,
        'tool.config.js': `${loop}export default registry;\n`,
    });
    const eslint = await buildEslint(sandbox.path);
    const files = ['registry.js', 'build.js', 'tool.config.js'];
    expect(await listLintFindings(eslint, sandbox.path, files, ['gspot/restricted-syntax'])).toStrictEqual([
        { file: 'registry.js', rule: 'gspot/restricted-syntax', line: 2 },
        { file: 'registry.js', rule: 'gspot/restricted-syntax', line: 3 },
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
