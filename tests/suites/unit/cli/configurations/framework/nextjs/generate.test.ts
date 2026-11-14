import { testdir } from 'testdirs';
import { test, spyOn, expect } from 'bun:test';
import type { EslintConfiguration } from '#tests/types/setup.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { buildEslint, listLintFindings } from '#tests/setup/eslint/lint.ts';

test('Next.js keeps its project root and pages rule with a pages scope', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['javascript', 'nextjs'], { scopes: [{ path: 'pages' }] }),
        'package.json': '{"private":true,"type":"module","dependencies":{"next":"0.0.0-test"}}',
        'pages/index.jsx': 'export default function Page() { return <a href="/about">About</a>; }\n',
    });
    const eslint = await buildEslint(sandbox.path);
    const config = (await eslint.calculateConfigForFile('pages/index.jsx')) as EslintConfiguration;
    expect(config.rules['@next/next/no-html-link-for-pages']?.[0]).toBe(2);
    expect(config.settings.next).toStrictEqual({ rootDir: sandbox.path });
});

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

    const eslint = await buildEslint(sandbox.path);
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

const NEXTJS_ROUTE_FILES = {
    'package.json': '{"private":true,"type":"module"}\n',
    'apps/first/pages/about.jsx': 'export default function About() { return <p>About</p>; }\n',
    'apps/first/pages/index.jsx': 'export default function Home() { return <a href="/about">About</a>; }\n',
    'apps/second/src/pages/about.jsx': 'export default function About() { return <p>About</p>; }\n',
    'apps/second/src/pages/index.jsx': 'export default function Home() { return <a href="/about">About</a>; }\n',
    'apps/empty/component.jsx': 'export function Empty() { return <p>Empty</p>; }\n',
};

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

    const eslint = await buildEslint(sandbox.path);
    using warnings = spyOn(console, 'warn');

    for (const [scope, path] of [
        ['apps/first', 'pages/index.jsx'],
        ['apps/second', 'src/pages/index.jsx'],
    ] as const) {
        const file = `${scope}/${path}`;
        expect(
            await listLintFindings(eslint, sandbox.path, [file], ['@next/next/no-html-link-for-pages']),
        ).toStrictEqual([{ file, rule: '@next/next/no-html-link-for-pages', line: 1 }]);
    }
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

    const eslint = await buildEslint(sandbox.path);
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
