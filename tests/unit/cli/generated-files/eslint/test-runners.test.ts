import { test, expect, describe } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { LEVELS } from '#cli/config/configurations.ts';
import { buildSettingsText } from '#tests/setup/settings.ts';
import type { EslintConfiguration } from '#tests/types/tool-output.ts';
import { createEslint, collectLintFindings } from '#tests/setup/tool-files.ts';
import { APP_JEST, VITEST_FILES } from '#tests/data/generated-files/eslint/fragments.ts';

describe('jest', () => {
    test.each(['js', 'jsx'])('Jest rules apply only to their scope for .%s files', async (extension) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': APP_JEST,
            'package.json': '{"private":true,"type":"module"}\n',
            'root.test.js': '',
            'app/sample.test.js': '',
        });
        const eslint = await createEslint(sandbox.path);
        const focused =
            "import { test, expect } from '@jest/globals';\ntest.only('counts', () => { expect(1).toBe(1); });\n";
        const root = `root.test.${extension}`;
        const nested = `app/sample.test.${extension}`;
        await createFileTree(sandbox.path, { [root]: focused, [nested]: focused });
        expect(await collectLintFindings(eslint, sandbox.path, [root], ['jest/no-focused-tests'])).toStrictEqual([]);
        expect(await collectLintFindings(eslint, sandbox.path, [nested], ['jest/no-focused-tests'])).toStrictEqual([
            { file: nested, rule: 'jest/no-focused-tests', line: 2 },
        ]);
    });
});
describe('testing-library', () => {
    test.each([
        ['react', '@testing-library/react'],
        ['vue', '@testing-library/vue'],
        ['svelte', '@testing-library/svelte'],
    ])('Testing Library with %s reports debugging only in dependency-owned test files', async (framework, library) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': buildSettingsText(['javascript', framework, 'testing-library'], {
                level: 'all',
                tables: '[[scope]]\npath = "child"\n\n[[scope]]\npath = "neighbor"\nremoved_configurations = [ "testing-library" ]\n',
            }),
            'package.json': JSON.stringify({ private: true, dependencies: { [library]: '1.0.0' } }),
            'child/package.json': '{"private":true,"dependencies":{}}\n',
            'neighbor/package.json': JSON.stringify({ private: true, dependencies: { [library]: '1.0.0' } }),
            'source.test.js': '',
            'child/source.test.js': '',
            'neighbor/source.test.js': '',
        });
        const eslint = await createEslint(sandbox.path);
        const source = `import { screen } from '${library}';\nscreen.debug();\n`;
        const paths = ['source.test.js', 'source.js', 'child/source.test.js', 'neighbor/source.test.js'];
        await createFileTree(sandbox.path, Object.fromEntries(paths.map((path) => [path, source])));
        expect(
            await collectLintFindings(eslint, sandbox.path, paths, ['testing-library/no-debugging-utils']),
        ).toStrictEqual([{ file: 'source.test.js', rule: 'testing-library/no-debugging-utils', line: 2 }]);
        await createFileTree(sandbox.path, {
            'source.test.js': `import { screen } from '${library}';\nscreen.getByRole('button');\n`,
        });
        expect(
            await collectLintFindings(eslint, sandbox.path, ['source.test.js'], ['testing-library/no-debugging-utils']),
        ).toStrictEqual([]);
    });
});
describe('vitest', () => {
    test.each([...LEVELS])(
        'Vitest reports a focused test without a fix, and strict equality only at level all (%s)',
        async (level) => {
            await using sandbox = await testdir();
            await createFileTree(sandbox.path, {
                ...VITEST_FILES,
                'gspot.toml': buildSettingsText(['vitest'], { level }),
            });
            const eslint = await createEslint(sandbox.path);
            const config = (await eslint.calculateConfigForFile('tests/unit/example.test.js')) as EslintConfiguration;
            expect(config.rules['vitest/no-focused-tests']).toStrictEqual([2, { fixable: false }]);
            expect(config.rules['vitest/valid-expect']![0]).toBe(2);
            expect(config.rules['vitest/prefer-strict-equal']?.[0] ?? 0).toBe(level === 'all' ? 2 : 0);
            const path = 'tests/unit/example.test.js';
            await createFileTree(sandbox.path, {
                [path]: `import { test, expect } from 'vitest';
test.only('checks the value', () => { expect({value: 1}).toEqual({value: 1}); });
`,
            });
            const rules = ['vitest/no-focused-tests', 'vitest/prefer-strict-equal'];
            expect(await collectLintFindings(eslint, sandbox.path, [path], rules)).toStrictEqual([
                { file: path, rule: 'vitest/no-focused-tests', line: 2 },
                ...(level === 'all' ? [{ file: path, rule: 'vitest/prefer-strict-equal', line: 2 }] : []),
            ]);
            const [result] = await eslint.lintFiles([path]);
            expect(result!.messages.find(({ ruleId }) => ruleId === 'vitest/no-focused-tests')?.fix).toBeUndefined();
        },
    );
});
