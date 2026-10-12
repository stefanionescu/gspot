import { join } from 'node:path';
import { test, spyOn, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { settingsText } from '#tests/setup/settings.ts';
import { SERVER_FILES } from '#tests/config/eslint/framework.ts';
import { createEslint, lintFindings, readEslintConfiguration } from '#tests/setup/generate.ts';

test.each(['none', 'index-only'])(
    'Next.js page files skip no-trivial-files and follow reexports = %s in nested scopes',
    async (reexports) => {
        await using sandbox = await testdir();
        const files = ['app/page.tsx', 'app/format.ts', 'library/page.tsx'];
        await createFileTree(sandbox.path, {
            'gspot.toml': `level = "all"\nconfigurations = ["typescript"]\n[structure]\nreexports = ${reexports === 'index-only' ? '{ value = "index-only", reason = "The package exports its public index files." }' : '"none"'}\n[[scope]]\npath = "app"\nconfigurations = ["nextjs"]\n`,
            ...Object.fromEntries(files.map((file) => [file, 'export const value = 1;\n'])),
        });
        const eslint = await createEslint(sandbox.path);
        const rules = Object.fromEntries(
            await Promise.all(
                files.map(async (file) => {
                    const awaitedConfiguration = await readEslintConfiguration(eslint, file);
                    return [file, awaitedConfiguration.rules] as const;
                }),
            ),
        );
        expect(rules['app/page.tsx']!['gspot/no-trivial-files']![0]).toBe(0);
        expect(
            rules['app/page.tsx']!['no-restricted-syntax']!.some(
                (entry: unknown) =>
                    typeof entry === 'object' &&
                    entry !== null &&
                    'selector' in entry &&
                    entry.selector === 'ExportAllDeclaration',
            ),
        ).toBe(reexports !== 'index-only');
        // The rule skips a small component and checks a plain module in the same scope.
        expect(rules['app/format.ts']!['gspot/no-trivial-files']![0]).toBe(2);
        expect(rules['library/page.tsx']!['gspot/no-trivial-files']![0]).toBe(2);
    },
);

test('Next.js reports require-server-only in .server files and server folders', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        ...SERVER_FILES,
        'gspot.toml':
            'level = "all"\nconfigurations = [ "javascript" ]\n\n[[scope]]\npath = "app"\nconfigurations = [ "nextjs" ]\n',
    });
    const eslint = await createEslint(sandbox.path);
    expect(
        await lintFindings(
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
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': settingsText(['javascript'], {
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
        const config = await readEslintConfiguration(eslint, join(sandbox.path, scope, path));
        expect(config.settings.next!.rootDir.replaceAll('\\', '/')).toBe(
            join(sandbox.path, scope).replaceAll('\\', '/'),
        );
        expect(config.rules['@next/next/no-html-link-for-pages'], scope).toStrictEqual([2]);
        const file = `${scope}/${path}`;
        expect(await lintFindings(eslint, sandbox.path, [file], ['@next/next/no-html-link-for-pages'])).toStrictEqual([
            { file, rule: '@next/next/no-html-link-for-pages', line: 1 },
        ]);
    }
    const empty = await readEslintConfiguration(eslint, join(sandbox.path, 'apps/empty/component.jsx'));
    expect(empty.rules['@next/next/no-html-link-for-pages']).toStrictEqual([0]);
    await eslint.lintFiles(['apps/empty/component.jsx']);
    expect(warnings.mock.calls).toStrictEqual([]);
});

test('an App Router link leaves the Pages Router rule off', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': settingsText(['nextjs'], { level: 'all' }),
        'package.json': '{"private":true,"type":"module"}\n',
        'app/about/page.jsx': 'export default function About() { return <a href="/about">About</a>; }\n',
    });
    const eslint = await createEslint(sandbox.path);
    const config = await readEslintConfiguration(eslint, join(sandbox.path, 'app/about/page.jsx'));
    expect(config.rules['@next/next/no-html-link-for-pages']).toStrictEqual([0]);
    expect(
        await lintFindings(eslint, sandbox.path, ['app/about/page.jsx'], ['@next/next/no-html-link-for-pages']),
    ).toStrictEqual([]);
});
