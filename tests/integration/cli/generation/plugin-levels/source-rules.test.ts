import { expect, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';
import { generatedEslint } from '#tests/support/cli/generated-eslint.ts';

test.each([
    ['recommended', 'client.js'],
    ['recommended', 'app/client.js'],
    ['all', 'client.js'],
    ['all', 'app/client.js'],
] as const)('generated %s ESLint retains client defects and makes aliases opt-in for %s', async (level, filePath) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': `version = 1\nlevel = "${level}"\nconfigurations = ["javascript"]\n[rules]\ninstall = false\n[[scope]]\npath = "app"\nconfigurations = []\n`,
        'package.json': '{"private":true,"type":"module"}\n',
        'client.js': '',
        'other.js': '',
        'app/client.js': '',
    });
    const eslint = await generatedEslint(sandbox.path);
    const finding = await eslint.lintText("'use client';\nexport const value = process.env.SECRET;\n", {
        filePath,
    });
    expect(
        finding.flatMap((file) => file.messages).filter(({ ruleId }) => ruleId === 'gspot/no-client-environment'),
    ).toMatchObject([{ line: 2, messageId: 'private' }]);
    const alias = await eslint.lintText('const source = 1;\nexport const publicName = source;\n', {
        filePath,
    });
    expect(
        alias
            .flatMap((file) => file.messages)
            .filter(({ ruleId }) => ruleId === 'gspot/no-exported-alias-constants')
            .map(({ line, column, messageId }) => ({ line, column, messageId })),
    ).toStrictEqual(level === 'recommended' ? [] : [{ line: 2, column: 14, messageId: 'alias' }]);
    const corrected = await eslint.lintText("'use client';\nexport const value = 'public';\n", {
        filePath,
    });
    expect(
        corrected
            .flatMap((file) => file.messages)
            .filter(
                ({ ruleId }) =>
                    ruleId === 'gspot/no-client-environment' || ruleId === 'gspot/no-exported-alias-constants',
            ),
    ).toStrictEqual([]);
});

test.each(['recommended', 'all'])(
    'generated %s ESLint permits JavaScript type documentation and rejects duplicate TypeScript type tags',
    async (level) => {
        await using sandbox = await testdir();
        const description =
            '/**\n * Measure the input.\n * @param {string} value The input text.\n * @returns {number} The input length.\n */\n';
        const typescript = 'export function measure(value: string): number { return value.length; }\n';
        await createFileTree(sandbox.path, {
            'gspot.toml': `version = 1\nlevel = "${level}"\nconfigurations = ["typescript"]\n[rules]\ninstall = false\n`,
            'package.json': '{"private":true,"type":"module"}\n',
            'tsconfig.json': '{"compilerOptions":{"strict":true,"noEmit":true},"include":["client.ts"]}\n',
            'client.ts': description + typescript,
            'client.js': description + 'export function measure(value) { return value.length; }\n',
        });
        const eslint = await generatedEslint(sandbox.path);
        const javascript = await eslint.lintFiles(['client.js']);
        expect(
            javascript
                .flatMap((file) => file.messages)
                .filter(({ ruleId, fatal }) => ruleId === 'jsdoc/no-types' || fatal),
        ).toStrictEqual([]);
        const planted = await eslint.lintFiles(['client.ts']);
        expect(
            planted.flatMap((file) => file.messages).filter(({ ruleId }) => ruleId === 'jsdoc/no-types'),
        ).toMatchObject([{ line: 3 }, { line: 4 }]);
        const corrected = await eslint.lintText(
            description.replace('{string} ', '').replace('{number} ', '') + typescript,
            { filePath: 'client.ts' },
        );
        expect(
            corrected
                .flatMap((file) => file.messages)
                .filter(({ ruleId, fatal }) => ruleId === 'jsdoc/no-types' || fatal),
        ).toStrictEqual([]);
    },
);
