import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { policyOf } from '#tests/support/cli/policy/text.ts';
import { generatedEslint } from '#tests/support/cli/generated/eslint.ts';

test.each(['recommended', 'all'])(
    'generated %s ESLint permits JavaScript type documentation and rejects duplicate TypeScript type tags',
    async (level) => {
        await using sandbox = await testdir();
        const description =
            '/**\n * Measure the input.\n * @param {string} value The input text.\n * @returns {number} The input length.\n */\n';
        const typescript = 'export function measure(value: string): number { return value.length; }\n';
        await createFileTree(sandbox.path, {
            'gspot.toml': policyOf(['typescript'], '[guides]\ninstall = false\n', level),
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
        ).toMatchObject(level === 'all' ? [{ line: 3 }, { line: 4 }] : []);
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
