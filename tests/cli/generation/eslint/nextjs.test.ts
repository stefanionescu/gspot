// Framework route rules use the project scope and require actual route inputs.
import { join } from 'node:path';
import type { Linter } from 'eslint';
import { test, spyOn, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { buildPolicy } from '#tests/harness/policy.ts';
import { createEslint } from '#tests/harness/generated.ts';
import type { NextEslintConfiguration } from '#tests/types/cli/generation/eslint/nextjs.ts';

test('Next.js route rules resolve two project roots and disable route lookup in an empty scope', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['javascript'], {
            level: 'all',
            tables: '[scope."apps/first"]\nconfigurations = ["nextjs"]\n[scope."apps/second"]\nconfigurations = ["nextjs"]\n[scope."apps/empty"]\nconfigurations = ["nextjs"]\n',
        }),
        'package.json': '{"private":true,"type":"module"}\n',
        'apps/first/pages/about.jsx': 'export default function About() { return <p>About</p>; }\n',
        'apps/first/pages/index.jsx': 'export default function Home() { return <a href="/about">About</a>; }\n',
        'apps/second/src/pages/about.jsx': 'export default function About() { return <p>About</p>; }\n',
        'apps/second/src/pages/index.jsx': 'export default function Home() { return <a href="/about">About</a>; }\n',
        'apps/empty/component.jsx': 'export function Empty() { return <p>Empty</p>; }\n',
    });
    const eslint = await createEslint(sandbox.path);
    const warnings = spyOn(console, 'warn');
    try {
        for (const [scope, path] of [
            ['apps/first', 'pages/index.jsx'],
            ['apps/second', 'src/pages/index.jsx'],
        ] as const) {
            const config = (await eslint.calculateConfigForFile(
                join(sandbox.path, scope, path),
            )) as NextEslintConfiguration;
            expect(config.settings.next.rootDir.replaceAll('\\', '/')).toBe(
                join(sandbox.path, scope).replaceAll('\\', '/'),
            );
            expect(config.rules!['@next/next/no-html-link-for-pages'], scope).toStrictEqual([2]);
            const result = await eslint.lintFiles([`${scope}/${path}`]);
            expect(result.flatMap(({ messages }) => messages.filter(({ fatal }) => fatal === true))).toStrictEqual([]);
            expect(
                result.flatMap(({ messages }) =>
                    messages
                        .filter(({ ruleId }) => ruleId === '@next/next/no-html-link-for-pages')
                        .map(({ line }) => line),
                ),
                JSON.stringify(result),
            ).toStrictEqual([1]);
        }
        const empty = (await eslint.calculateConfigForFile(
            join(sandbox.path, 'apps/empty/component.jsx'),
        )) as Linter.Config;
        expect(empty.rules!['@next/next/no-html-link-for-pages']).toStrictEqual([0]);
        await eslint.lintFiles(['apps/empty/component.jsx']);
        expect(warnings.mock.calls).toStrictEqual([]);
    } finally {
        warnings.mockRestore();
    }
});
