import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { createEslint, listLintFindings } from '#tests/setup/eslint/lint.ts';
import { DUPLICATE_RULE_CASES, DUPLICATE_RULE_FILES } from '#tests/data/generation/eslint/settings-blocks.ts';

test.each([...DUPLICATE_RULE_CASES])(
    'each pair of duplicate rules reports a defect once, from the kept rule ($kept)',
    async ({ file, rules, kept }) => {
        await using sandbox = await testdir({
            ...DUPLICATE_RULE_FILES,
            'gspot.toml': buildSandboxSettings(['typescript'], { level: 'all' }),
            ...Object.fromEntries(DUPLICATE_RULE_CASES.map(({ file, source }) => [file, source])),
        });

        const eslint = await createEslint(sandbox.path);

        const reports = await listLintFindings(eslint, sandbox.path, [file], rules);
        expect(
            reports.map(({ rule }) => rule),
            file,
        ).toStrictEqual([kept]);
    },
);

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
        // The shipped limit allows seven parameters; the other row changes it.
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
