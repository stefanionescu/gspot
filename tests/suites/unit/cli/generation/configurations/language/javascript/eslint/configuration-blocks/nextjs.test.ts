import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { createEslint } from '#tests/setup/eslint/lint.ts';
import type { EslintConfiguration } from '#tests/types/tools.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';

test.each([false, true])('Next.js keeps its project root and pages rule with a pages scope: %s', async (inScope) => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['javascript', 'nextjs'], { scopes: inScope ? [{ path: 'pages' }] : [] }),
        'package.json': '{"private":true,"type":"module","dependencies":{"next":"0.0.0-test"}}',
        'pages/index.jsx': 'export default function Page() { return <a href="/about">About</a>; }\n',
    });
    const eslint = await createEslint(sandbox.path);
    const config = (await eslint.calculateConfigForFile('pages/index.jsx')) as EslintConfiguration;
    expect(config.rules['@next/next/no-html-link-for-pages']?.[0]).toBe(2);
    expect(config.settings['next']).toStrictEqual({ rootDir: sandbox.path });
});
