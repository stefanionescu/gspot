import { join } from 'node:path';
import { test, spyOn, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { LEVELS } from '#cli/config/configurations/names.ts';
import { type EslintConfiguration } from '#tests/types/tools.ts';
import { STRICT_TSCONFIG_TEXT } from '#tests/config/typescript.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { createEslint, readEslintRules, listLintFindings } from '#tests/setup/eslint/lint.ts';
import { INDEX_ONLY_REEXPORTS } from '#tests/config/generation/configurations/language/javascript/eslint/settings.ts';

import {
    MOBILE_FILES,
    EXPRESS_SOURCE,
    COMPONENT_FILES,
    EXPRESS_FINDINGS,
    NEXTJS_ROUTE_FILES,
    HTML_INJECTION_CASES,
} from '#tests/config/generation/configurations/language/javascript/eslint/configuration-blocks/frameworks.ts';

test('Vue, Svelte and Astro files parse in their scopes, and a scope without them gets none of their rules', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['javascript', 'typescript', 'vue', 'svelte', 'astro'], {
            level: 'all',
            scopes: [{ path: 'app' }, { path: 'plain' }],
            tables: 'removed_configurations = { value = [ "vue", "svelte", "astro" ], reason = "This scope contains plain JavaScript rather than framework components." }\n',
        }),
        'package.json': '{"private":true,"type":"module"}',
        'tsconfig.json': '{"compilerOptions":{"strict":true},"include":["**/*"]}',
        ...COMPONENT_FILES,
        ...Object.fromEntries(Object.entries(COMPONENT_FILES).map(([path, text]) => [`app/${path}`, text])),
        'plain/Card.vue': COMPONENT_FILES['Card.vue'],
        'plain/source.js': COMPONENT_FILES['source.js'],
    });

    const eslint = await createEslint(sandbox.path);
    for (const prefix of ['', 'app/']) {
        expect(
            await listLintFindings(
                eslint,
                sandbox.path,
                Object.keys(COMPONENT_FILES).map((path) => `${prefix}${path}`),
                [],
            ),
        ).toStrictEqual([]);
        const vue = (await eslint.calculateConfigForFile(`${prefix}Card.vue`)) as EslintConfiguration;
        expect(vue.rules['vue/no-v-html']?.[0]).toBeGreaterThan(0);
    }
    const outside = (await eslint.calculateConfigForFile('plain/Card.vue')) as EslintConfiguration;
    expect(
        Object.entries(outside.rules).filter(([name, rule]) => name.startsWith('vue/') && rule[0] !== 0),
    ).toStrictEqual([]);
    const script = (await eslint.calculateConfigForFile('plain/source.js')) as EslintConfiguration;
    expect(
        Object.entries(script.rules).filter(([name, rule]) => /^(?:vue|svelte|astro)\//u.test(name) && rule[0] !== 0),
    ).toStrictEqual([]);
});

test.each([...HTML_INJECTION_CASES])(
    '$configuration reports raw HTML and accepts text, and a JavaScript file gets no such rule',
    async (component) => {
        await using sandbox = await testdir({
            'gspot.toml': buildSandboxSettings(['javascript'], {
                level: 'all',
                tables: `[[scope]]\npath = "app"\nconfigurations = ["${component.configuration}"]\n`,
            }),
            'package.json': '{"name":"markup-security","private":true,"type":"module"}',
            [`app/${component.path}`]: component.sample,
            'plain.js': 'export const markup = "<b>Hello</b>";\n',
        });

        const eslint = await createEslint(sandbox.path);
        const path = `app/${component.path}`;
        expect(await listLintFindings(eslint, sandbox.path, [path], [component.rule])).toStrictEqual([
            { file: path, rule: component.rule, line: 1 },
        ]);
        expect(await listLintFindings(eslint, sandbox.path, ['plain.js'], [component.rule])).toStrictEqual([]);
        await createFileTree(sandbox.path, { [path]: component.corrected });
        expect(await listLintFindings(eslint, sandbox.path, [path], [component.rule])).toStrictEqual([]);
    },
);

test.each([...LEVELS])(
    'Express selectors and security rules apply in the Express scope at their level (%s)',
    async (level) => {
        await using sandbox = await testdir({
            'gspot.toml': buildSandboxSettings(['javascript'], {
                level,
                rules: true,
                tables: '[tools.eslint]\nimport_extension = "js"\n',
                scopes: [{ path: 'api', configurations: ['express'] }],
            }),
            'package.json': '{"private":true,"type":"module","imports":{"#lib/*":"./*.js"}}',
            'owner.js': 'export const value = 1;',
            'source.js': EXPRESS_SOURCE,
            'api/source.js': EXPRESS_SOURCE,
            'api/child/source.js': EXPRESS_SOURCE,
        });

        const eslint = await createEslint(sandbox.path);
        const root = (await eslint.calculateConfigForFile('source.js')) as EslintConfiguration;
        const express = (await eslint.calculateConfigForFile('api/source.js')) as EslintConfiguration;
        expect(root.rules['security/detect-buffer-noassert']).toBeUndefined();
        expect(root.rules['security/detect-no-csrf-before-method-override']).toBeUndefined();
        expect(express.rules['security/detect-no-csrf-before-method-override']![0]).toBe(2);
        expect(root.rules['no-param-reassign']![0]).toBe(level === 'all' ? 2 : 0);
        expect(root.rules['security/detect-child-process']![0]).toBe(level === 'all' ? 2 : 0);
        expect(root.rules['security/detect-possible-timing-attacks']![0]).toBe(level === 'all' ? 2 : 0);
        const files = ['source.js', 'api/source.js', 'api/child/source.js'];
        expect(await listLintFindings(eslint, sandbox.path, files, ['no-restricted-syntax'])).toStrictEqual([
            ...EXPRESS_FINDINGS[level],
        ]);
    },
);

test.each(['none', 'index-only'])(
    'Next.js page files skip no-trivial-files and follow reexports = %s in nested scopes',
    async (reexports) => {
        await using sandbox = await testdir();
        const files = ['app/page.tsx', 'app/index.ts', 'app/format.ts', 'library/page.tsx'];
        await createFileTree(sandbox.path, {
            'tsconfig.json': STRICT_TSCONFIG_TEXT,
            'gspot.toml': buildSandboxSettings(['typescript'], {
                level: 'all',
                rules: true,
                tables: `[structure]
reexports = ${reexports === 'index-only' ? INDEX_ONLY_REEXPORTS : '"none"'}
[[scope]]
path = "app"
configurations = ["nextjs"]
`,
            }),
            ...Object.fromEntries(files.map((file) => [file, 'export const value = 1;\n'])),
        });
        const eslint = await createEslint(sandbox.path);
        const rules = await readEslintRules(eslint, files);
        expect(rules['app/page.tsx']!['gspot/no-trivial-files']![0]).toBe(0);
        for (const file of ['app/page.tsx', 'app/index.ts']) {
            await createFileTree(sandbox.path, { [file]: 'export * from "./format.js";\n' });
            expect(await listLintFindings(eslint, sandbox.path, [file], ['no-restricted-syntax'])).toStrictEqual(
                file === 'app/index.ts' && reexports === 'index-only'
                    ? []
                    : [{ file, rule: 'no-restricted-syntax', line: 1 }],
            );
        }
        expect(rules['app/format.ts']!['gspot/no-trivial-files']![0]).toBe(2);
        expect(rules['library/page.tsx']!['gspot/no-trivial-files']![0]).toBe(2);
    },
);

test('Next.js reports require-server-only in .server files and server folders', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['javascript'], {
            level: 'all',
            rules: true,
            scopes: [{ path: 'app', configurations: ['nextjs'] }],
        }),
        'app/lib/widget/server.js': 'export const value = 1;\n',
        'app/lib/widget/data.server.js': 'export const value = 1;\n',
        'app/server/data.js': 'export const value = 1;\n',
    });

    const eslint = await createEslint(sandbox.path);
    expect(
        await listLintFindings(
            eslint,
            sandbox.path,
            ['app/lib/widget/server.js', 'app/lib/widget/data.server.js', 'app/server/data.js'],
            ['gspot/require-server-only'],
        ),
    ).toStrictEqual([
        { file: 'app/lib/widget/data.server.js', rule: 'gspot/require-server-only', line: 1 },
        { file: 'app/server/data.js', rule: 'gspot/require-server-only', line: 1 },
    ]);
});

test('Next.js route rules use each project root and stay off in a scope without pages', async () => {
    await using sandbox = await testdir({
        ...NEXTJS_ROUTE_FILES,
        'gspot.toml': buildSandboxSettings(['javascript'], {
            level: 'all',
            scopes: [
                { path: 'apps/first', configurations: ['nextjs'] },
                { path: 'apps/second', configurations: ['nextjs'] },
                { path: 'apps/empty', configurations: ['nextjs'] },
            ],
        }),
    });

    const eslint = await createEslint(sandbox.path);
    using warnings = spyOn(console, 'warn');

    for (const [scope, path] of [
        ['apps/first', 'pages/index.jsx'],
        ['apps/second', 'src/pages/index.jsx'],
    ] as const) {
        const config = (await eslint.calculateConfigForFile(join(sandbox.path, scope, path))) as EslintConfiguration;
        expect(config.settings.next!.rootDir.replaceAll('\\', '/')).toBe(
            join(sandbox.path, scope).replaceAll('\\', '/'),
        );
        expect(config.rules['@next/next/no-html-link-for-pages'], scope).toStrictEqual([2]);
        const file = `${scope}/${path}`;
        expect(
            await listLintFindings(eslint, sandbox.path, [file], ['@next/next/no-html-link-for-pages']),
        ).toStrictEqual([{ file, rule: '@next/next/no-html-link-for-pages', line: 1 }]);
    }
    const empty = (await eslint.calculateConfigForFile(
        join(sandbox.path, 'apps/empty/component.jsx'),
    )) as EslintConfiguration;
    expect(empty.rules['@next/next/no-html-link-for-pages']).toStrictEqual([0]);
    await eslint.lintFiles(['apps/empty/component.jsx']);
    expect(warnings.mock.calls).toStrictEqual([]);
});

test('react-refresh knows the catchError wrapper of next/error in a Next.js scope', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['javascript'], {
            level: 'all',
            scopes: [{ path: 'web', configurations: ['nextjs'] }],
        }),
        'package.json': '{"private":true,"type":"module"}\n',
        'web/app/layout.jsx': 'export const fontClass = "sans";\nexport default function Layout() { return null; }\n',
        'web/components/panel.jsx':
            "import { catchError } from 'next/error';\nfunction Panel() { return null; }\nexport default catchError(Panel, { fallback: () => null });\n",
        'web/components/mixed.jsx': 'export const count = 2;\nexport function Mixed() { return null; }\n',
    });

    const eslint = await createEslint(sandbox.path);
    const config = (await eslint.calculateConfigForFile(
        join(sandbox.path, 'web/components/panel.jsx'),
    )) as EslintConfiguration;
    expect(config.rules['react-refresh/only-export-components']?.[1]).toMatchObject({ extraHOCs: ['catchError'] });
    expect(
        await listLintFindings(
            eslint,
            sandbox.path,
            ['web/app/layout.jsx', 'web/components/panel.jsx', 'web/components/mixed.jsx'],
            ['react-refresh/only-export-components'],
        ),
    ).toStrictEqual([
        { file: 'web/app/layout.jsx', rule: 'react-refresh/only-export-components', line: 1 },
        { file: 'web/components/mixed.jsx', rule: 'react-refresh/only-export-components', line: 1 },
    ]);
});

test('in a React DOM file, a scrollable region may take tabIndex, and an article may not', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['javascript', 'react', 'react-dom']),
        'package.json': '{"private":true,"type":"module"}\n',
        'log.jsx':
            'export function Log() {\n    return <div role="region" aria-label="Build log" tabIndex={0}>Done</div>;\n}\n',
        'story.jsx': 'export function Story() {\n    return <article tabIndex={0}>Text</article>;\n}\n',
    });

    const eslint = await createEslint(sandbox.path);
    expect(
        await listLintFindings(
            eslint,
            sandbox.path,
            ['log.jsx', 'story.jsx'],
            ['jsx-a11y-x/no-noninteractive-tabindex'],
        ),
    ).toStrictEqual([{ file: 'story.jsx', rule: 'jsx-a11y-x/no-noninteractive-tabindex', line: 2 }]);
});

test('Expo rules apply in the Expo scope and not in its React Native sibling', async () => {
    await using sandbox = await testdir(MOBILE_FILES);

    const eslint = await createEslint(sandbox.path);
    expect(
        await listLintFindings(
            eslint,
            sandbox.path,
            ['bare/source.js', 'expo-app/source.js'],
            ['expo/no-env-var-destructuring'],
        ),
    ).toStrictEqual([{ file: 'expo-app/source.js', rule: 'expo/no-env-var-destructuring', line: 1 }]);
});

test('React Native turns off DOM accessibility rules only inside its scope', async () => {
    await using sandbox = await testdir();
    const files = ['native/App.tsx', 'web/App.tsx'];
    await createFileTree(sandbox.path, {
        'gspot.toml': buildSandboxSettings(['react-dom', 'typescript'], {
            rules: true,
            scopes: [{ path: 'native', configurations: ['react-native'] }],
        }),
        ...Object.fromEntries(files.map((file) => [file, 'export const value = 1;\n'])),
    });
    const eslint = await createEslint(sandbox.path);
    const rules = await readEslintRules(eslint, files);
    expect(rules['native/App.tsx']!['jsx-a11y-x/alt-text']).toBeUndefined();
    expect(rules['web/App.tsx']!['jsx-a11y-x/alt-text']![0]).toBe(2);
});
