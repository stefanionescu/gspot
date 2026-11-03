import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
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
    expect(config.settings['next']).toStrictEqual({ rootDir: sandbox.path });
});

test('at level all, a route handler that Next.js calls by name is not a trivial function, and a helper with one caller is', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['javascript', 'nextjs'], { level: 'all' }),
        'package.json': '{"private":true,"type":"module","dependencies":{"next":"0.0.0-test"}}',
        'app/items/route.js': 'export async function GET() {\n    return Response.json([]);\n}\n',
        'lib/items.js': 'function listItems() {\n    return [];\n}\nexport const items = listItems();\n',
    });
    const eslint = await buildEslint(sandbox.path);
    const findings = await listLintFindings(
        eslint,
        sandbox.path,
        ['app/items/route.js', 'lib/items.js'],
        ['gspot/no-trivial-functions'],
    );
    expect(findings).toStrictEqual([{ file: 'lib/items.js', rule: 'gspot/no-trivial-functions', line: 1 }]);
});
