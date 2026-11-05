import { expect, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';

import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { buildEslint, listLintFindings } from '#tests/setup/eslint/lint.ts';

test('a JavaScript file takes the JavaScript limits, and a TypeScript file the TypeScript ones', async () => {
    await using sandbox = await testdir();
    const body = '(value) { if (value > 1) return 1; if (value > 0) return 2; return 3; }';
    await createFileTree(sandbox.path, {
        'gspot.toml': buildSandboxSettings(['javascript', 'typescript'], {
            tables: '[limits.javascript]\nmax_cyclomatic_complexity = 2\n',
            level: 'all',
        }),
        'package.json': '{"private":true,"type":"module"}',
        'tsconfig.json': '{"compilerOptions":{"strict":true},"include":["*.ts"]}',
        'example.js': `export function choose${body}\n`,
        'example.ts': `export function choose${body.replace('(value)', '(value: number)')}\n`,
    });
    const eslint = await buildEslint(sandbox.path);
    expect(await listLintFindings(eslint, sandbox.path, ['example.js', 'example.ts'], ['complexity'])).toStrictEqual([
        { file: 'example.js', rule: 'complexity', line: 1 },
    ]);
});

test('a switch counts once against the cyclomatic limit, however many cases it has', async () => {
    await using sandbox = await testdir();
    const cases = ['red', 'green', 'blue', 'cyan', 'gray', 'pink', 'gold', 'navy']
        .map((color, index) => `case '${color}': return ${String(index)};`)
        .join(' ');
    await createFileTree(sandbox.path, {
        'gspot.toml': buildSandboxSettings(['javascript'], {
            tables: '[limits.javascript]\nmax_cyclomatic_complexity = 3\n',
            level: 'all',
        }),
        'package.json': '{"private":true,"type":"module"}',
        'example.js': [
            `export function name(color) { switch (color) { ${cases} default: return -1; } }`,
            'export function choose(value) { if (value > 2) return 2; if (value > 1) return 1; if (value > 0) return 0; return -1; }',
        ].join('\n'),
    });
    const eslint = await buildEslint(sandbox.path);
    expect(await listLintFindings(eslint, sandbox.path, ['example.js'], ['complexity'])).toStrictEqual([
        { file: 'example.js', rule: 'complexity', line: 2 },
    ]);
});

test('a scope that lowers only its TypeScript limit keeps the JavaScript limit in its JavaScript files', async () => {
    await using sandbox = await testdir();
    const source = 'export function add(first, second, third) { return first + second + third; }\n';
    const typedSource = source.replace('(first, second, third)', '(first: number, second: number, third: number)');
    await createFileTree(sandbox.path, {
        'gspot.toml': buildSandboxSettings(['javascript', 'typescript'], {
            tables: '[[scope]]\npath = "child"\n[scope.limits.typescript]\nmax_function_parameters = 2\n',
            level: 'all',
        }),
        'package.json': '{"private":true,"type":"module"}',
        'tsconfig.json': '{"compilerOptions":{"strict":true},"include":["**/*.ts"]}',
        'child/example.js': source,
        'child/example.ts': typedSource,
    });
    const eslint = await buildEslint(sandbox.path);
    const files = ['child/example.js', 'child/example.ts'];
    expect(await listLintFindings(eslint, sandbox.path, files, ['max-params'])).toStrictEqual([
        { file: 'child/example.ts', rule: 'max-params', line: 1 },
    ]);
});

test('a scope that lowers a limit gets it in its own files, and the root keeps its own limit', async () => {
    await using sandbox = await testdir();
    const source = 'export function add(first, second, third) { return first + second + third; }\n';
    const typedSource = source.replace('(first, second, third)', '(first: number, second: number, third: number)');
    await createFileTree(sandbox.path, {
        'gspot.toml': buildSandboxSettings(['javascript', 'typescript'], {
            tables: '[[scope]]\npath = "child"\nlimits.max_function_parameters = 2\n',
            level: 'all',
        }),
        'package.json': '{"private":true,"type":"module"}',
        'tsconfig.json': '{"compilerOptions":{"strict":true},"include":["**/*.ts"]}',
        'example.js': source,
        'example.ts': typedSource,
        'child/example.js': source,
        'child/example.ts': typedSource,
    });
    const eslint = await buildEslint(sandbox.path);
    const files = ['example.js', 'example.ts', 'child/example.js', 'child/example.ts'];
    expect(await listLintFindings(eslint, sandbox.path, files, ['max-params'])).toStrictEqual([
        { file: 'child/example.js', rule: 'max-params', line: 1 },
        { file: 'child/example.ts', rule: 'max-params', line: 1 },
    ]);
});
