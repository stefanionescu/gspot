import { join } from 'node:path';
import type { ESLint } from 'eslint';
import { test, spyOn, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { testModules } from '#tests/setup/modules.ts';
import { LEVELS } from '#cli/config/configurations.ts';
import { matchFields } from '#tests/setup/matchers.ts';
import { runCommand } from '#tests/setup/processes.ts';
import { readFile, writeFile } from 'node:fs/promises';
import { createSandbox } from '#tests/setup/sandbox.ts';
import { NESTJS_SANDBOX } from '#tests/data/checks/nestjs.ts';
import { buildSandboxSettings } from '#tests/setup/settings.ts';
import type { PackageJson } from '#cli/types/parsers/dependencies.ts';
import type { EslintConfiguration } from '#tests/types/tool-output.ts';
import { STRICT_TSCONFIG_TEXT } from '#tests/data/checks/typescript/projects.ts';
import { ALIAS_IMPORT, RESPONSE_MESSAGES } from '#tests/data/generation/eslint/selectors.ts';
import { createEslint, readEslintRules, listLintFindings } from '#tests/setup/tool-files.ts';
import { SERVER_FILES, RAW_HTML_CASES, COMPONENT_FILES } from '#tests/data/generation/eslint/framework.ts';

test('components > Vue, Svelte and Astro files parse in their scopes, and a plain scope gets none of their rules', async () => {
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
        expect(vue.rules['vue/no-v-html']).toBeDefined();
    }
    const plain = (await eslint.calculateConfigForFile('plain/Card.vue')) as EslintConfiguration;
    expect(
        Object.entries(plain.rules).filter(([name, rule]) => name.startsWith('vue/') && rule[0] !== 0),
    ).toStrictEqual([]);
    const script = (await eslint.calculateConfigForFile('plain/source.js')) as EslintConfiguration;
    expect(
        Object.entries(script.rules).filter(([name, rule]) => /^(?:vue|svelte|astro)\//u.test(name) && rule[0] !== 0),
    ).toStrictEqual([]);
});

test.each([...RAW_HTML_CASES])(
    'components > $configuration reports raw HTML and accepts text, and a plain JavaScript file gets no such rule',
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
    'express > Express selectors and security rules apply in the Express scope at their level (%s)',
    async (level) => {
        await using sandbox = await testdir({
            'gspot.toml': buildSandboxSettings(['javascript'], {
                level,
                rules: true,
                tables: '[tools.eslint]\nimport_extension = "js"\n',
                scopes: [{ path: 'api', configurations: ['express'] }],
            }),
            'package.json': '{"private":true,"type":"module","imports":{"#owner":"./owner.js"}}',
            'owner.js': 'export const value = 1;',
            'source.js': ALIAS_IMPORT + RESPONSE_MESSAGES,
            'api/source.js': ALIAS_IMPORT + RESPONSE_MESSAGES,
            'api/child/source.js': ALIAS_IMPORT + RESPONSE_MESSAGES,
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
        const expected = files
            .flatMap((file) => {
                const elevated = file === 'source.js' ? [1, 3] : [1, 2, 3];
                const lines = level === 'all' ? elevated : [1];
                return lines.map((line) => ({ file, rule: 'no-restricted-syntax', line }));
            })
            .toSorted((left, right) => left.file.localeCompare(right.file) || left.line - right.line);
        expect(await listLintFindings(eslint, sandbox.path, files, ['no-restricted-syntax'])).toStrictEqual(expected);
    },
);

test.each(['none', 'index-only'])(
    'nextjs > Next.js page files skip no-trivial-files and follow reexports = %s in nested scopes',
    async (reexports) => {
        await using sandbox = await testdir();
        const files = ['app/page.tsx', 'app/index.ts', 'app/format.ts', 'library/page.tsx'];
        await createFileTree(sandbox.path, {
            'tsconfig.json': STRICT_TSCONFIG_TEXT,
            'gspot.toml': buildSandboxSettings(['typescript'], {
                level: 'all',
                rules: true,
                tables: `[structure]
reexports = ${reexports === 'index-only' ? '{ value = "index-only", reason = "The package exports its public index files." }' : '"none"'}
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
                file !== 'app/index.ts' || reexports !== 'index-only'
                    ? [{ file, rule: 'no-restricted-syntax', line: 1 }]
                    : [],
            );
        }
        // The rule skips a small component and checks a plain module in the same scope.
        expect(rules['app/format.ts']!['gspot/no-trivial-files']![0]).toBe(2);
        expect(rules['library/page.tsx']!['gspot/no-trivial-files']![0]).toBe(2);
    },
);

test('nextjs > Next.js reports require-server-only in .server files and server folders', async () => {
    await using sandbox = await testdir(SERVER_FILES);

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

test('nextjs > Next.js route rules use each project root and stay off in a scope without pages', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['javascript'], {
            level: 'all',
            scopes: [
                { path: 'apps/first', configurations: ['nextjs'] },
                { path: 'apps/second', configurations: ['nextjs'] },
                { path: 'apps/empty', configurations: ['nextjs'] },
            ],
        }),
        'package.json': '{"private":true,"type":"module"}\n',
        'apps/first/pages/about.jsx': 'export default function About() { return <p>About</p>; }\n',
        'apps/first/pages/index.jsx': 'export default function Home() { return <a href="/about">About</a>; }\n',
        'apps/second/src/pages/about.jsx': 'export default function About() { return <p>About</p>; }\n',
        'apps/second/src/pages/index.jsx': 'export default function Home() { return <a href="/about">About</a>; }\n',
        'apps/empty/component.jsx': 'export function Empty() { return <p>Empty</p>; }\n',
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

test('the Swagger lint rules apply only when package.json declares @nestjs/swagger', async () => {
    await using repository = await createSandbox({ ...NESTJS_SANDBOX, level: 'all', dependencies: {} });
    const path = join(repository.root, 'src/greeting.controller.ts');
    await createEslint(repository.root);
    const plain = await runCommand([join(testModules, '.bin/eslint'), '--format', 'json', path], {
        cwd: repository.root,
    });
    expect([0, 1], plain.stdout + plain.stderr).toContain(plain.code);
    const plainResults = JSON.parse(plain.stdout) as ESLint.LintResult[];
    expect(
        plainResults
            .flatMap(({ messages }) => messages)
            .some(({ ruleId }) => ruleId === '@darraghor/nestjs-typed/controllers-should-supply-api-tags'),
    ).toBe(false);
    const packagePath = join(repository.root, 'package.json');
    const packageJson = JSON.parse(await readFile(packagePath, 'utf8')) as PackageJson;
    await writeFile(
        packagePath,
        JSON.stringify({ ...packageJson, dependencies: { ...packageJson.dependencies, '@nestjs/swagger': '11.2.3' } }),
    );
    await createEslint(repository.root);
    const swagger = await runCommand([join(testModules, '.bin/eslint'), '--format', 'json', path], {
        cwd: repository.root,
    });
    expect([0, 1], swagger.stdout + swagger.stderr).toContain(swagger.code);
    const swaggerResults = JSON.parse(swagger.stdout) as ESLint.LintResult[];
    expect(swaggerResults.flatMap(({ messages }) => messages)).toContainEqual(
        matchFields({ ruleId: '@darraghor/nestjs-typed/controllers-should-supply-api-tags', line: 7 }),
    );
});

test('nextjs > react-refresh knows the catchError wrapper of next/error', async () => {
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

test('react-dom > a scrollable region may take tabIndex, and an article may not', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['javascript', 'react', 'react-dom']),
        'package.json': '{"private":true,"type":"module"}\n',
        'log.jsx':
            'export function Log() {\n    return <div role="region" aria-label="Build log" tabIndex={0}>Done</div>;\n}\n',
        'story.jsx': 'export function Story() {\n    return <article tabIndex={0}>Text</article>;\n}\n',
    });

    const eslint = await createEslint(sandbox.path);
    expect(
        await listLintFindings(eslint, sandbox.path, ['log.jsx', 'story.jsx'], ['jsx-a11y/no-noninteractive-tabindex']),
    ).toStrictEqual([{ file: 'story.jsx', rule: 'jsx-a11y/no-noninteractive-tabindex', line: 2 }]);
});
