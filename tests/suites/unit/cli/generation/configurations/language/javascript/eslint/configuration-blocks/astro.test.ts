import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { buildEslint } from '#tests/setup/eslint/lint.ts';
import { captureRejection } from '#tests/setup/matchers.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';

test('Astro and TypeScript parse together and report component defects', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['astro', 'typescript']),
        'tsconfig.json': '{"compilerOptions":{"strict":true},"include":["**/*"]}',
        'src/pages/index.astro': '---\nconst unused = 1;\n---\n<img src="/logo.png" />\n',
    });
    const eslint = await buildEslint(sandbox.path);
    const results = await eslint.lintFiles(['src/pages/index.astro']);
    expect(results.flatMap(({ messages }) => messages.filter(({ fatal }) => fatal))).toStrictEqual([]);
    expect(results.flatMap(({ messages }) => messages.map(({ ruleId }) => ruleId))).toContain(
        'astro/jsx-a11y/alt-text',
    );
});

test('a failed Astro import restores the working folder', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['astro']),
        'Card.astro': '<p>Hello</p>',
        'node_modules/eslint-plugin-astro/package.json': JSON.stringify({
            name: 'eslint-plugin-astro',
            exports: { './package.json': './package.json' },
        }),
    });
    const previousFolder = process.cwd();
    const eslint = await buildEslint(sandbox.path);
    const error = await captureRejection(eslint.lintFiles(['Card.astro']));
    expect(error.message).toContain('lib/index.mjs');
    expect(process.cwd()).toBe(previousFolder);
});
