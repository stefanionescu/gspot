import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { createEslint } from '#tests/setup/eslint/lint.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';

test('Astro and TypeScript parse together and report component defects', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['astro', 'typescript']),
        'tsconfig.json': '{"compilerOptions":{"strict":true},"include":["**/*"]}',
        'src/pages/index.astro': '---\nconst unused = 1;\n---\n<img src="/logo.png" />\n',
    });
    const eslint = await createEslint(sandbox.path);
    const results = await eslint.lintFiles(['src/pages/index.astro']);
    expect(results.flatMap(({ messages }) => messages.filter(({ fatal }) => fatal))).toStrictEqual([]);
    expect(results.flatMap(({ messages }) => messages.map(({ ruleId }) => ruleId))).toContain(
        'astro/jsx-a11y/alt-text',
    );
});
