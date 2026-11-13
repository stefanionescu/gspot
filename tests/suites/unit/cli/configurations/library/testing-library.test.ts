import { expect, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';

import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { buildEslint, listLintFindings } from '#tests/setup/eslint/lint.ts';
import type { EslintConfiguration } from '#tests/types/setup.ts';

test('Testing Library with react reports debugging only in dependency-owned test files', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['javascript', 'react', 'testing-library'], {
            level: 'all',
            scopes: [{ path: 'child' }, { path: 'neighbor' }],
            tables: 'removed_configurations = { testing-library = "This scope does not use Testing Library." }\n',
        }),
        'package.json': JSON.stringify({ private: true, dependencies: { '@testing-library/react': '1.0.0' } }),
        'child/package.json': '{"private":true,"dependencies":{}}\n',
        'neighbor/package.json': JSON.stringify({ private: true, dependencies: { '@testing-library/react': '1.0.0' } }),
        'source.test.js': '',
        'child/source.test.js': '',
        'neighbor/source.test.js': '',
    });

    const eslint = await buildEslint(sandbox.path);
    const source = "import { screen } from '@testing-library/react';\nscreen.debug();\n";
    const paths = ['source.test.js', 'source.js', 'child/source.test.js', 'neighbor/source.test.js'];
    await createFileTree(sandbox.path, Object.fromEntries(paths.map((path) => [path, source])));
    expect(await listLintFindings(eslint, sandbox.path, paths, ['testing-library/no-debugging-utils'])).toStrictEqual([
        { file: 'source.test.js', rule: 'testing-library/no-debugging-utils', line: 2 },
    ]);
});

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

    const eslint = await buildEslint(sandbox.path);
    const configuration = (await eslint.calculateConfigForFile('sample.test.js')) as EslintConfiguration;
    expect(configuration.rules['testing-library/no-dom-import']).toStrictEqual([2, 'react']);
    const applicationConfiguration = (await eslint.calculateConfigForFile('app/sample.test.js')) as EslintConfiguration;
    expect(applicationConfiguration.rules['testing-library/no-dom-import']).toStrictEqual([2, 'vue']);
});

test('Testing Library rules read Testing Library queries and leave a Playwright page alone', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['javascript', 'testing-library'], { level: 'all' }),
        'package.json': JSON.stringify({
            private: true,
            type: 'module',
            dependencies: { '@testing-library/react': '1.0.0' },
        }),
        'rtl.test.js':
            "import { render } from '@testing-library/react';\nconst { getByRole } = render(null);\ngetByRole('button');\n",
        'page.test.js':
            "import { test } from '@playwright/test';\ntest('opens', ({ page }) => page.getByRole('button'));\n",
    });
    const eslint = await buildEslint(sandbox.path);
    expect(
        await listLintFindings(
            eslint,
            sandbox.path,
            ['rtl.test.js', 'page.test.js'],
            ['testing-library/prefer-screen-queries'],
        ),
    ).toStrictEqual([{ file: 'rtl.test.js', rule: 'testing-library/prefer-screen-queries', line: 3 }]);
});

test('a scope with only jest-dom gets the dom rules', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['javascript', 'testing-library']),
        'package.json': '{"private":true,"dependencies":{"@testing-library/jest-dom":"*"}}',
        'sample.test.js': 'export const value = 1;\n',
    });
    const eslint = await buildEslint(sandbox.path);
    const configuration = (await eslint.calculateConfigForFile('sample.test.js')) as EslintConfiguration;
    expect(configuration.rules['testing-library/await-async-queries']?.[0]).toBe(2);
    expect(configuration.rules['testing-library/no-dom-import']).toBeUndefined();
});
