import { test, expect } from 'bun:test';
import { LEVELS } from '#cli/config/manifests.ts';
import { testdir, createFileTree } from 'testdirs';
import type { EslintConfiguration } from '#tests/types/setup.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { buildEslint, listLintFindings } from '#tests/setup/eslint/lint.ts';

import {
    MATCHING_SCOPE_SETTINGS,
    COMPONENT_LINT_TIMEOUT_MILLISECONDS,
} from '#tests/config/configurations/javascript/blocks.ts';

const COMPONENT_FILES = {
    'Card.vue': '<template><p>{{ count }}</p></template>\n<script setup lang="ts">const count: number = 1;</script>\n',
    'Card.svelte': '<script lang="ts">const count: number = 1;</script>\n<p>{count}</p>\n',
    'Card.astro': '---\nconst count: number = 1;\n---\n<p>{count}</p>\n',
    'source.ts': 'export const count: number = 1;\n',
    'source.js': 'export const count = 1;\n',
} as const;

// Typed ESLint with the Vue, Svelte, and Astro parsers takes 30 to 75 seconds on the shared macOS runner of CI.
test(
    'Vue, Svelte and Astro files parse in their scopes, and a scope without them gets none of their rules',
    async () => {
        await using sandbox = await testdir({
            'gspot.toml': buildSandboxSettings(['javascript', 'typescript', 'vue', 'svelte', 'astro'], {
                level: 'all',
                scopes: [{ path: 'app' }, { path: 'plain' }],
                tables: 'removed_configurations = { vue = "This scope contains plain JavaScript rather than framework components.", svelte = "This scope contains plain JavaScript rather than framework components.", astro = "This scope contains plain JavaScript rather than framework components." }\n',
            }),
            'package.json': '{"private":true,"type":"module"}',
            'tsconfig.json': '{"compilerOptions":{"strict":true},"include":["**/*"]}',
            ...COMPONENT_FILES,
            ...Object.fromEntries(Object.entries(COMPONENT_FILES).map(([path, text]) => [`app/${path}`, text])),
            'plain/Card.vue': COMPONENT_FILES['Card.vue'],
            'plain/source.js': COMPONENT_FILES['source.js'],
        });

        const eslint = await buildEslint(sandbox.path);
        const prefixes = ['', 'app/'];
        const files = prefixes.flatMap((prefix) => Object.keys(COMPONENT_FILES).map((path) => `${prefix}${path}`));
        expect(await listLintFindings(eslint, sandbox.path, files, [])).toStrictEqual([]);
        for (const prefix of prefixes) {
            const vue = (await eslint.calculateConfigForFile(`${prefix}Card.vue`)) as EslintConfiguration;
            expect(vue.rules['vue/no-v-html']?.[0]).toBeGreaterThan(0);
        }
        const outside = (await eslint.calculateConfigForFile('plain/Card.vue')) as EslintConfiguration;
        expect(
            Object.entries(outside.rules).filter(([name, rule]) => name.startsWith('vue/') && rule[0] !== 0),
        ).toStrictEqual([]);
        const script = (await eslint.calculateConfigForFile('plain/source.js')) as EslintConfiguration;
        expect(
            Object.entries(script.rules).filter(
                ([name, rule]) => /^(?:vue|svelte|astro)\//u.test(name) && rule[0] !== 0,
            ),
        ).toStrictEqual([]);
    },
    COMPONENT_LINT_TIMEOUT_MILLISECONDS,
);

test("a parent's configuration block covers a matching nested scope, and a different scope keeps its test paths", async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['typescript'], { level: 'all', tables: MATCHING_SCOPE_SETTINGS }),
        'package.json': '{"private":true,"type":"module"}',
        'tsconfig.json': '{"compilerOptions":{"strict":true},"include":["src","same","different"]}',
        'src/root.ts': 'export const root = 1;\n',
        'same/src/sample.ts': 'export const same = 1;\n',
        'same/deep/src/sample.ts': 'export const deep = 1;\n',
        'same/sample.test.ts': 'export const testValue = 1;\n',
        'different/src/sample.ts': 'export const different = 1;\n',
        'different/custom/sample.ts': 'export const custom = 1;\n',
    });

    const eslint = await buildEslint(sandbox.path);
    const same = (await eslint.calculateConfigForFile('same/sample.test.ts')) as EslintConfiguration;
    const different = (await eslint.calculateConfigForFile('different/custom/sample.ts')) as EslintConfiguration;
    const code = (await eslint.calculateConfigForFile('different/src/sample.ts')) as EslintConfiguration;
    expect(same.rules['@typescript-eslint/no-non-null-assertion']?.[0]).toBe(0);
    expect(different.rules['@typescript-eslint/no-non-null-assertion']?.[0]).toBe(0);
    expect(code.rules['@typescript-eslint/no-non-null-assertion']?.[0]).toBe(2);
});

test('ESLint loads the config when a selected configuration has no block for its scope', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['javascript', 'testing-library']),
        'package.json': '{"private":true,"type":"module"}',
        'sample.test.js': 'export const value = 1;\n',
    });

    const eslint = await buildEslint(sandbox.path);
    expect(await listLintFindings(eslint, sandbox.path, ['sample.test.js'], [])).toStrictEqual([]);
});

test('Jest rules apply only to their scope for .jsx files', async () => {
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

    const eslint = await buildEslint(sandbox.path);
    const focused =
        "import { test, expect } from '@jest/globals';\ntest.only('counts', () => { expect(1).toBe(1); });\n";
    const root = 'root.test.jsx';
    const nested = 'app/sample.test.jsx';
    await createFileTree(sandbox.path, { [root]: focused, [nested]: focused });
    expect(await listLintFindings(eslint, sandbox.path, [root], ['jest/no-focused-tests'])).toStrictEqual([]);
    expect(await listLintFindings(eslint, sandbox.path, [nested], ['jest/no-focused-tests'])).toStrictEqual([
        { file: nested, rule: 'jest/no-focused-tests', line: 2 },
    ]);
});

test('the translations configuration reports literal UI text outside the test files of each scope at all', async () => {
    await using sandbox = await testdir();
    const tested = ['qa/entry.jsx', 'app/qa/entry.jsx', 'app/verification/entry.jsx', 'app/deep/qa/entry.jsx'];
    const ordinary = new Set(['source.jsx', 'app/source.jsx', 'app/deep/source.jsx']);
    await createFileTree(sandbox.path, {
        'gspot.toml': buildSandboxSettings(['translations', 'react'], {
            level: 'all',
            tables: 'test_files = [ "**/qa/**" ]\n\n[[scope]]\npath = "app"\ntest_files = [ "verification/**" ]\n\n[[scope]]\npath = "app/deep"\n\n[[scope]]\npath = "sibling"\nremoved_configurations = { translations = "This scope does not translate its UI text." }\n',
        }),
        'package.json': '{"private":true,"type":"module"}\n',
        ...Object.fromEntries(
            [...tested, ...ordinary, 'sibling/source.jsx'].map((path) => [
                path,
                'export const element = <p>Hello there</p>;\n',
            ]),
        ),
    });
    const eslint = await buildEslint(sandbox.path);
    for (const file of [...tested, ...ordinary, 'sibling/source.jsx']) {
        expect(await listLintFindings(eslint, sandbox.path, [file], ['i18next/no-literal-string']), file).toStrictEqual(
            ordinary.has(file) ? [{ file, rule: 'i18next/no-literal-string', line: 1 }] : [],
        );
    }
});

test.each((['vitest', 'jest'] as const).flatMap((configuration) => LEVELS.map((level) => ({ configuration, level }))))(
    '$configuration at level $level refuses a title that says nothing or names a removal only at level all',
    async ({ configuration, level }) => {
        await using sandbox = await testdir({
            'gspot.toml': buildSandboxSettings([configuration], { level }),
            'package.json': '{"private":true,"type":"module"}',
            'tests/sum.test.js':
                "test('works', () => {});\ntest('no longer takes a callback', () => {});\ntest('adds two numbers', () => {});\n",
        });
        const eslint = await buildEslint(sandbox.path);
        const findings = await listLintFindings(
            eslint,
            sandbox.path,
            ['tests/sum.test.js'],
            [`${configuration}/valid-title`],
        );
        expect(findings.map(({ line }) => line)).toStrictEqual(level === 'all' ? [1, 2] : []);
    },
);
