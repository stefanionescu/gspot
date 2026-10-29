import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { LEVELS } from '#cli/config/configurations/names.ts';
import { type EslintConfiguration } from '#tests/types/tools.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { createEslint, listLintFindings } from '#tests/setup/eslint/lint.ts';

import {
    TESTING_LIBRARY_CASES,
    ASSERTION_RULE_OWNERS,
    JEST_RECOMMENDED_RULES,
} from '#tests/config/generation/configurations/language/javascript/eslint/configuration-blocks/testing.ts';

test.each(['js', 'jsx'])('Jest rules apply only to their scope for .%s files', async (extension) => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['javascript'], {
            level: 'all',
            tables: `[[scope]]
path = "app"
configurations = [ "jest" ]
`,
        }),
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
            'package.json': '{"private":true,"type":"module"}\n',
            'tests/unit/example.test.js': '',
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

test.each(ASSERTION_RULE_OWNERS)(
    'basic assertion ownership with $configuration',
    async ({ configuration, assertions }) => {
        await using sandbox = await testdir({
            'gspot.toml': buildSandboxSettings(
                ['javascript', ...(configuration === undefined ? [] : [configuration])],
                { level: 'basic' },
            ),
            'package.json': '{"private":true,"type":"module"}',
            'source.test.js': '',
            'source.js': '',
        });
        const eslint = await createEslint(sandbox.path);
        const tests = (await eslint.calculateConfigForFile('source.test.js')) as EslintConfiguration;
        const source = (await eslint.calculateConfigForFile('source.js')) as EslintConfiguration;
        expect(tests.rules['sonarjs/assertions-in-tests']?.[0]).toBe(assertions);
        expect(tests.rules['sonarjs/no-empty-test-file']?.[0]).toBe(2);
        expect(source.rules['sonarjs/assertions-in-tests']?.[0]).toBe(0);
        expect(source.rules['sonarjs/no-empty-test-file']?.[0]).toBe(0);
        if (configuration === 'jest')
            expect(
                Object.fromEntries(JEST_RECOMMENDED_RULES.map((name) => [name, tests.rules[name]?.[0]])),
            ).toStrictEqual(Object.fromEntries(JEST_RECOMMENDED_RULES.map((name) => [name, 2])));
    },
);
