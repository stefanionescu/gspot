import { join } from 'node:path';
import type { ESLint } from 'eslint';
import { test, spyOn, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { testModules } from '#tests/setup/modules.ts';
import { LEVELS } from '#cli/config/configurations.ts';
import { matchFields } from '#tests/setup/matchers.ts';
import { runCommand } from '#tests/setup/processes.ts';
import { createSandbox } from '#tests/setup/sandbox.ts';
import { buildSettingsText } from '#tests/setup/settings.ts';
import { NESTJS_SANDBOX } from '#tests/data/checks/nestjs.ts';
import type { EslintConfiguration } from '#tests/types/tool-output.ts';
import type { PackageJson } from '#cli/types/parsers/dependency-files.ts';
import { createEslint, readEslintRules, collectLintFindings } from '#tests/setup/tool-files.ts';
import { ALIAS_IMPORT, RESPONSE_MESSAGES } from '#tests/data/generated-files/eslint/selectors.ts';
import { SERVER_FILES, RAW_HTML_CASES, COMPONENT_FILES } from '#tests/data/generated-files/eslint/framework.ts';

test('components > Vue, Svelte and Astro files parse in their scopes, and a plain scope gets none of their rules', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildSettingsText(['javascript', 'typescript', 'vue', 'svelte', 'astro'], {
            level: 'all',
            tables: '[[scope]]\npath = "app"\n\n[[scope]]\npath = "plain"\nremoved_configurations = [ "vue", "svelte", "astro" ]\n',
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
            await collectLintFindings(
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
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': buildSettingsText(['javascript'], {
                level: 'all',
                tables: `[[scope]]\npath = "app"\nconfigurations = ["${component.configuration}"]\n`,
            }),
            'package.json': '{"name":"markup-security","private":true,"type":"module"}',
            [`app/${component.path}`]: component.sample,
            'plain.js': 'export const markup = "<b>Hello</b>";\n',
        });
        const eslint = await createEslint(sandbox.path);
        const path = `app/${component.path}`;
        expect(await collectLintFindings(eslint, sandbox.path, [path], [component.rule])).toStrictEqual([
            { file: path, rule: component.rule, line: 1 },
        ]);
        expect(await collectLintFindings(eslint, sandbox.path, ['plain.js'], [component.rule])).toStrictEqual([]);
        await createFileTree(sandbox.path, { [path]: component.corrected });
        expect(await collectLintFindings(eslint, sandbox.path, [path], [component.rule])).toStrictEqual([]);
    },
);

test.each([...LEVELS])(
    'express > Express selectors and security rules apply in the Express scope at their level (%s)',
    async (level) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': `level = "${level}"\nconfigurations = ["javascript"]\n[tools.eslint]\nimport_extension = "js"\n[[scope]]\npath = "api"\nconfigurations = ["express"]\n`,
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
        expect(await collectLintFindings(eslint, sandbox.path, files, ['no-restricted-syntax'])).toStrictEqual(
            expected,
        );
    },
);

test.each(['none', 'index-only'])(
    'nextjs > Next.js page files skip no-trivial-files and follow reexports = %s in nested scopes',
    async (reexports) => {
        await using sandbox = await testdir();
        const files = ['app/page.tsx', 'app/index.ts', 'app/format.ts', 'library/page.tsx'];
        await createFileTree(sandbox.path, {
            'gspot.toml': `level = "all"\nconfigurations = ["typescript"]\n[structure]\nreexports = ${reexports === 'index-only' ? '{ value = "index-only", reason = "The package exports its public index files." }' : '"none"'}\n[[scope]]\npath = "app"\nconfigurations = ["nextjs"]\n`,
            ...Object.fromEntries(files.map((file) => [file, 'export const value = 1;\n'])),
        });
        const eslint = await createEslint(sandbox.path);
        const rules = await readEslintRules(eslint, files);
        expect(rules['app/page.tsx']!['gspot/no-trivial-files']![0]).toBe(0);
        for (const file of ['app/page.tsx', 'app/index.ts']) {
            expect(
                rules[file]!['no-restricted-syntax']!.some(
                    (entry: unknown) =>
                        typeof entry === 'object' &&
                        entry !== null &&
                        'selector' in entry &&
                        entry.selector === 'ExportAllDeclaration',
                ),
            ).toBe(file !== 'app/index.ts' || reexports !== 'index-only');
        }
        // The rule skips a small component and checks a plain module in the same scope.
        expect(rules['app/format.ts']!['gspot/no-trivial-files']![0]).toBe(2);
        expect(rules['library/page.tsx']!['gspot/no-trivial-files']![0]).toBe(2);
    },
);

test('nextjs > Next.js reports require-server-only in .server files and server folders', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        ...SERVER_FILES,
        'gspot.toml':
            'level = "all"\nconfigurations = [ "javascript" ]\n\n[[scope]]\npath = "app"\nconfigurations = [ "nextjs" ]\n',
    });
    const eslint = await createEslint(sandbox.path);
    expect(
        await collectLintFindings(
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
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildSettingsText(['javascript'], {
            level: 'all',
            tables: '[[scope]]\npath = "apps/first"\nconfigurations = [ "nextjs" ]\n\n[[scope]]\npath = "apps/second"\nconfigurations = [ "nextjs" ]\n\n[[scope]]\npath = "apps/empty"\nconfigurations = [ "nextjs" ]\n',
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
            await collectLintFindings(eslint, sandbox.path, [file], ['@next/next/no-html-link-for-pages']),
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
    const manifest = JSON.parse(await Bun.file(packagePath).text()) as PackageJson;
    await Bun.write(
        packagePath,
        JSON.stringify({ ...manifest, dependencies: { ...manifest.dependencies, '@nestjs/swagger': '11.2.3' } }),
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
