import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { LEVELS } from '#cli/config/configurations/names.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { createEslint, listLintFindings } from '#tests/setup/eslint/lint.ts';
import { SELECTOR_FILES } from '#tests/config/generation/configurations/language/javascript/eslint/blocks/selectors.ts';

test('a template message to a logger method, including log, is reported, and console.log is not', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['javascript'], { level: 'all' }),
        'package.json': '{"private":true,"type":"module"}\n',
        'source.js':
            'export function report(logger, count) {\n    logger.log(`Saved ${count}`);\n    logger.info(`Read ${count}`);\n    console.log(`Printed ${count}`);\n}\n',
    });

    const eslint = await createEslint(sandbox.path);
    const [result] = await eslint.lintFiles(['source.js']);
    expect(
        result?.messages
            .filter(({ ruleId, message }) => ruleId === 'no-restricted-syntax' && message.startsWith('Log a stable'))
            .map(({ line }) => line),
    ).toStrictEqual([2, 3]);
});
test('a block that stands alone is reported at the top of a file and inside a function, and a case block is not', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['javascript'], { level: 'all' }),
        'package.json': '{"private":true,"type":"module"}\n',
        'source.js':
            'export const first = 1;\n{\n    console.info(first);\n}\nexport function pick(kind) {\n    {\n        console.info(kind);\n    }\n    switch (kind) {\n        case 1: {\n            return 1;\n        }\n        default: {\n            return 0;\n        }\n    }\n}\n',
    });

    const eslint = await createEslint(sandbox.path);
    const [result] = await eslint.lintFiles(['source.js']);
    expect(
        result?.messages
            .filter(
                ({ ruleId, message }) => ruleId === 'no-restricted-syntax' && message.startsWith('A block that stands'),
            )
            .map(({ line }) => line),
    ).toStrictEqual([2, 6]);
});
test.each([...LEVELS])('form validation and list security run at both levels (%s)', async (level) => {
    await using sandbox = await testdir({
        ...SELECTOR_FILES,
        'gspot.toml': buildSandboxSettings(['javascript'], {
            level,
            rules: true,
            scopes: [
                { path: 'native', configurations: ['react-native'] },
                { path: 'forms', configurations: ['react', 'react-hook-form'] },
            ],
        }),
    });

    const eslint = await createEslint(sandbox.path);
    expect(
        await listLintFindings(eslint, sandbox.path, ['native/App.jsx', 'forms/Fields.jsx'], ['no-restricted-syntax']),
    ).toStrictEqual([
        { file: 'forms/Fields.jsx', rule: 'no-restricted-syntax', line: 3 },
        { file: 'native/App.jsx', rule: 'no-restricted-syntax', line: 2 },
    ]);
});

test('store, form and procedure selectors distinguish validated calls and unrelated queries', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['javascript', 'zustand', 'react-hook-form', 'trpc'], {
            tables: '[trpc]\nrouter_files = ["source.js"]\n',
        }),
        'source.js':
            'useStore(cartStore);\nuseForm(options);\nuseForm({ ...options });\nuseForm({ defaultValues: { nested: { resolver: 1 } } });\npublicProcedure.query(resolve);\nprotectedProcedure.use(logger).query(resolve);\nt.procedure.query(resolve);\npool.query(sql);\nbyId.query(resolve);\ngetClient().query(sql);\npublicProcedure.input(schema).use(logger).mutation(resolve);\n',
    });
    const eslint = await createEslint(sandbox.path);
    expect(await listLintFindings(eslint, sandbox.path, ['source.js'], ['no-restricted-syntax'])).toStrictEqual(
        [1, 4, 5, 6, 7].map((line) => ({ file: 'source.js', rule: 'no-restricted-syntax', line })),
    );
});
