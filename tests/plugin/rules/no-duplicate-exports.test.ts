import { join } from 'node:path';
import { testdir } from 'testdirs';
import plugin from '#plugin/plugin.ts';
import { writeFileSync } from 'node:fs';
import { test, expect, afterAll } from 'bun:test';
import * as parser from '@typescript-eslint/parser';
import { TSESLint } from '@typescript-eslint/utils';
import { createRuleTester } from '#tests/harness/rule-tester.ts';
import { noDuplicateExports } from '#plugin/rules/no-duplicate-exports.ts';
import { EXPORT_FILES } from '#tests/config/plugin/rules/no-duplicate-exports.ts';

const directory = await testdir(EXPORT_FILES);

const root = directory.path;
afterAll(() => directory[Symbol.asyncDispose]());

createRuleTester().run('no-duplicate-exports', noDuplicateExports, {
    valid: [
        {
            code: "export * from './defaults'; export { default } from './defaults';",
            filename: `${root}/index.ts`,
        },
        {
            code: "export * from './comments'; export * from './a';",
            filename: `${root}/index.ts`,
        },
        {
            code: "export * as group from './a'; export * from './a';",
            filename: `${root}/index.ts`,
        },
        {
            code: "export * from './a';\nexport { three } from './b';",
            filename: `${root}/index.ts`,
        },
        {
            code: "export * from './a';\nexport * from './b';",
            filename: `${root}/not-index.ts`,
        },
        { code: 'export const x = 1;\nexport const y = 2;', filename: `${root}/index.ts` },
    ],
    invalid: [
        ...['second', 'renamed', 'deep', 'rest', 'head', 'tail'].map((name) => ({
            code: `export * from './bindings'; export { ${name} } from './bindings';`,
            filename: `${root}/index.ts`,
            errors: [{ messageId: 'duplicate' as const, data: { name } }],
        })),
        {
            code: "export * from './cycle'; export { one } from './a'; export * as group from './b';",
            filename: `${root}/index.ts`,
            errors: [
                { messageId: 'duplicate', data: { name: 'one' } },
                { messageId: 'duplicate', data: { name: 'group' } },
            ],
        },
        {
            code: "export const {one} = value; export {one} from './a';",
            filename: `${root}/index.ts`,
            errors: [{ messageId: 'duplicate', data: { name: 'one' } }],
        },
        {
            code: "export * from './a';\nexport * from './b';",
            filename: `${root}/index.ts`,
            errors: [{ messageId: 'duplicate', data: { name: 'two' } }],
        },
        {
            code: "export { one } from './a';\nexport const one = 3;",
            filename: `${root}/index.ts`,
            errors: [{ messageId: 'duplicate', data: { name: 'one' } }],
        },
        {
            code: "export * from './c';\nexport { one } from './a';",
            filename: `${root}/index.ts`,
            errors: [{ messageId: 'duplicate', data: { name: 'one' } }],
        },
    ],
});

createRuleTester(root, { parserOptions: { project: './tsconfig.json' } }).run(
    'no-duplicate-exports with project aliases',
    noDuplicateExports,
    {
        valid: [
            { code: "export * from '@app/a'; export { three } from '@app/b';", filename: 'index.ts' },
            {
                code: "export * from '@app/defaults'; export { default } from '@app/defaults';",
                filename: 'index.ts',
            },
        ],
        invalid: [
            {
                code: "export * from '@app/a'; export * from '@app/b';",
                filename: 'index.ts',
                errors: [{ messageId: 'duplicate', data: { name: 'two' } }],
            },
            {
                code: "export * from '@app/cycle'; export { one } from '@app/a';",
                filename: 'index.ts',
                errors: [{ messageId: 'duplicate', data: { name: 'one' } }],
            },
        ],
    },
);

test('duplicate exports read a changed dependency on the next lint run', async () => {
    await using sandbox = await testdir(EXPORT_FILES);
    const linter = new TSESLint.Linter({ configType: 'flat', cwd: sandbox.path });
    const configuration = {
        files: ['**/*.ts'],
        languageOptions: { parser, parserOptions: { tsconfigRootDir: sandbox.path } },
        plugins: { gspot: plugin },
        rules: { 'gspot/no-duplicate-exports': 'error' as const },
    };
    const code = "export * from './a'; export * from './b';";
    const before = linter.verify(code, configuration, { filename: join(sandbox.path, 'index.ts') });
    expect(
        before.map(({ messageId: diagnosticId, line, message: diagnostic }) => ({
            messageId: diagnosticId,
            line,
            message: diagnostic,
        })),
    ).toStrictEqual([
        {
            messageId: 'duplicate',
            line: 1,
            message: 'The index exports "two" twice. Export it once, or alias one of them.',
        },
    ]);
    writeFileSync(join(sandbox.path, 'b.ts'), 'export const distinct = 22;\n');
    expect(linter.verify(code, configuration, { filename: join(sandbox.path, 'index.ts') })).toStrictEqual([]);
});
