import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { LEVELS } from '#cli/config/configurations.ts';
import { settingsText } from '#tests/setup/settings.ts';
import { VITEST_FILES } from '#tests/config/eslint/fragments.ts';
import { createEslint, lintFindings, readEslintConfiguration } from '#tests/setup/generate.ts';

test.each([...LEVELS])(
    'Vitest reports a focused test without a fix, and strict equality only at level all (%s)',
    async (level) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            ...VITEST_FILES,
            'gspot.toml': settingsText(['vitest'], { level }),
        });
        const eslint = await createEslint(sandbox.path);
        const config = await readEslintConfiguration(eslint, 'tests/unit/example.test.js');
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
        expect(await lintFindings(eslint, sandbox.path, [path], rules)).toStrictEqual([
            { file: path, rule: 'vitest/no-focused-tests', line: 2 },
            ...(level === 'all' ? [{ file: path, rule: 'vitest/prefer-strict-equal', line: 2 }] : []),
        ]);
        const [result] = await eslint.lintFiles([path]);
        expect(result!.messages.find(({ ruleId }) => ruleId === 'vitest/no-focused-tests')?.fix).toBeUndefined();
    },
);
