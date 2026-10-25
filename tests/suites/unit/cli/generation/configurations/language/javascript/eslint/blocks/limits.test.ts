import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { createEslint, listLintFindings } from '#tests/setup/eslint/lint.ts';

test.each(['javascript', 'typescript'].flatMap((language) => [7, 8].map((maximum) => ({ language, maximum }))))(
    'ESLint for $language counts declared parameters against an authored maximum of $maximum',
    async ({ language, maximum }) => {
        await using sandbox = await testdir();
        const extension = { javascript: 'js', typescript: 'ts' }[language]!;
        const source = [7, 8]
            .map((count) => {
                const names = Array.from({ length: count }, (_, index) => `value${String(index)}`);
                const name = count === 7 ? 'seven' : 'eight';
                const parameters =
                    language === 'typescript' ? ['this: void', ...names.map((name) => `${name}: number`)] : names;
                return `export function ${name}(${parameters.join(', ')}) { return ${names.join(' + ')}; }`;
            })
            .join('\n');
        const limits =
            maximum === 7
                ? ''
                : `[limits.${language}]\nfunction_parameters = { value = ${String(maximum)}, reason = "This sandbox tests the authored parameter ceiling." }\n`;
        await createFileTree(sandbox.path, {
            'gspot.toml': buildSandboxSettings([language], { tables: limits, level: 'all' }),
            'package.json': '{"private":true,"type":"module"}',
            'tsconfig.json': '{"compilerOptions":{"strict":true},"include":["*.ts"]}',
            [`example.${extension}`]: source,
        });
        const eslint = await createEslint(sandbox.path);
        const file = `example.${extension}`;
        expect(await listLintFindings(eslint, sandbox.path, [file], ['max-params'])).toStrictEqual(
            maximum === 7 ? [{ file, rule: 'max-params', line: 2 }] : [],
        );
    },
);

test('a JavaScript file takes the JavaScript limits, and a TypeScript file the TypeScript ones', async () => {
    await using sandbox = await testdir();
    const body = '(value) { if (value > 1) return 1; if (value > 0) return 2; return 3; }';
    await createFileTree(sandbox.path, {
        'gspot.toml': buildSandboxSettings(['javascript', 'typescript'], {
            tables: '[limits.javascript]\ncyclomatic_complexity = 2\n',
            level: 'all',
        }),
        'package.json': '{"private":true,"type":"module"}',
        'tsconfig.json': '{"compilerOptions":{"strict":true},"include":["*.ts"]}',
        'example.js': `export function choose${body}\n`,
        'example.ts': `export function choose${body.replace('(value)', '(value: number)')}\n`,
    });
    const eslint = await createEslint(sandbox.path);
    expect(await listLintFindings(eslint, sandbox.path, ['example.js', 'example.ts'], ['complexity'])).toStrictEqual([
        { file: 'example.js', rule: 'complexity', line: 1 },
    ]);
});

test('a scope that lowers a limit gets it in its own files, and the root keeps its own limit', async () => {
    await using sandbox = await testdir();
    const source = 'export function add(first, second, third) { return first + second + third; }\n';
    const typedSource = source.replace('(first, second, third)', '(first: number, second: number, third: number)');
    await createFileTree(sandbox.path, {
        'gspot.toml': buildSandboxSettings(['javascript', 'typescript'], {
            tables: '[[scope]]\npath = "child"\nlimits.function_parameters = 2\n',
            level: 'all',
        }),
        'package.json': '{"private":true,"type":"module"}',
        'tsconfig.json': '{"compilerOptions":{"strict":true},"include":["**/*.ts"]}',
        'example.js': source,
        'example.ts': typedSource,
        'child/example.js': source,
        'child/example.ts': typedSource,
    });
    const eslint = await createEslint(sandbox.path);
    const files = ['example.js', 'example.ts', 'child/example.js', 'child/example.ts'];
    expect(await listLintFindings(eslint, sandbox.path, files, ['max-params'])).toStrictEqual([
        { file: 'child/example.js', rule: 'max-params', line: 1 },
        { file: 'child/example.ts', rule: 'max-params', line: 1 },
    ]);
});
