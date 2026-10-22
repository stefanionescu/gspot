import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { LEVELS } from '#cli/config/configurations.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import type { EslintConfiguration } from '#tests/types/tool-output.ts';
import { createEslint, listLintFindings } from '#tests/setup/eslint/lint.ts';
import { VITEST_FILES, JEST_IN_APP_TABLES, TESTING_LIBRARY_CASES } from '#tests/data/generation/eslint/testing.ts';

test.each(['js', 'jsx'])('Jest rules apply only to their scope for .%s files', async (extension) => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['javascript'], { level: 'all', tables: JEST_IN_APP_TABLES }),
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
    expect(await listLintFindings(eslint, sandbox.path, [root], ['jest/no-focused-tests'])).toStrictEqual([]);
    expect(await listLintFindings(eslint, sandbox.path, [nested], ['jest/no-focused-tests'])).toStrictEqual([
        { file: nested, rule: 'jest/no-focused-tests', line: 2 },
    ]);
});
test.each([...TESTING_LIBRARY_CASES])(
    'Testing Library with %s reports debugging only in dependency-owned test files',
    async (framework, library) => {
        await using sandbox = await testdir({
            'gspot.toml': buildSandboxSettings(['javascript', framework, 'testing-library'], {
                level: 'all',
                scopes: [{ path: 'child' }, { path: 'neighbor' }],
                tables: 'removed_configurations = { value = [ "testing-library" ], reason = "This scope does not use Testing Library." }\n',
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
            await listLintFindings(eslint, sandbox.path, paths, ['testing-library/no-debugging-utils']),
        ).toStrictEqual([{ file: 'source.test.js', rule: 'testing-library/no-debugging-utils', line: 2 }]);
        await createFileTree(sandbox.path, {
            'source.test.js': `import { screen } from '${library}';\nscreen.getByRole('button');\n`,
        });
        expect(
            await listLintFindings(eslint, sandbox.path, ['source.test.js'], ['testing-library/no-debugging-utils']),
        ).toStrictEqual([]);
    },
);
test.each([...LEVELS])(
    'Vitest reports a focused test without a fix, and strict equality only at level all (%s)',
    async (level) => {
        await using sandbox = await testdir({
            ...VITEST_FILES,
            'gspot.toml': buildSandboxSettings(['vitest'], { level }),
        });

        const eslint = await createEslint(sandbox.path);
        const path = 'tests/unit/example.test.js';
        await createFileTree(sandbox.path, {
            [path]: `import { test, expect } from 'vitest';
test.only('checks the value', () => { expect({value: 1}).toEqual({value: 1}); });
`,
        });
        const rules = ['vitest/no-focused-tests', 'vitest/prefer-strict-equal'];
        expect(await listLintFindings(eslint, sandbox.path, [path], rules)).toStrictEqual([
            { file: path, rule: 'vitest/no-focused-tests', line: 2 },
            ...(level === 'all' ? [{ file: path, rule: 'vitest/prefer-strict-equal', line: 2 }] : []),
        ]);
        const [result] = await eslint.lintFiles([path]);
        expect(result!.messages.find(({ ruleId }) => ruleId === 'vitest/no-focused-tests')?.fix).toBeUndefined();
    },
);
test('Testing Library rules take the framework package of each scope', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['javascript', 'testing-library'], {
            level: 'all',
            scopes: [{ path: 'app', configurations: ['javascript', 'testing-library'] }],
        }),
        'package.json': '{"private":true,"dependencies":{"@testing-library/react":"*"}}',
        'app/package.json': '{"private":true,"dependencies":{"@testing-library/vue":"*"}}',
        'sample.test.js': 'export const value = 1;\n',
        'app/sample.test.js': 'export const value = 1;\n',
    });

    const eslint = await createEslint(sandbox.path);
    const configuration = (await eslint.calculateConfigForFile('sample.test.js')) as EslintConfiguration;
    expect(configuration.rules['testing-library/no-dom-import']).toStrictEqual([2, 'react']);
    const applicationConfiguration = (await eslint.calculateConfigForFile('app/sample.test.js')) as EslintConfiguration;
    expect(applicationConfiguration.rules['testing-library/no-dom-import']).toStrictEqual([2, 'vue']);
});
