// ESLint reads each part of an Astro component: the frontmatter with type information, the markup, and its script.
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { containingAll } from '#tests/harness/expectations.ts';
import { COMPONENT } from '#tests/config/cli/generation/eslint/astro-parts.ts';
import { createEslint, eslintConfigurationSchema } from '#tests/harness/generated.ts';

test('the frontmatter, the markup, and a script of an Astro component each reach their rules', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': 'level = "all"\nconfigurations = ["typescript", "astro"]\n[agent_rules]\nenabled = false\n',
        'package.json': '{"name":"example","version":"1.0.0","private":true,"type":"module"}\n',
        'tsconfig.json':
            '{"compilerOptions":{"strict":true,"module":"ESNext","moduleResolution":"Bundler"},"include":["src"]}\n',
        'src/pages/index.astro': COMPONENT,
    });
    const eslint = await createEslint(sandbox.path);
    const configuration = eslintConfigurationSchema.parse(await eslint.calculateConfigForFile('src/pages/index.astro'));
    expect(configuration.rules['astro/jsx-a11y/alt-text']?.[0]).toBe(2);
    const [result] = await eslint.lintFiles(['src/pages/index.astro']);
    const found = result!.messages.map((entry) => `${String(entry.line)} ${entry.ruleId ?? entry.message}`);
    expect(found).toStrictEqual(
        containingAll([
            '4 @typescript-eslint/no-unnecessary-condition',
            '7 astro/no-set-html-directive',
            '9 @typescript-eslint/no-unused-vars',
        ]),
    );
});
