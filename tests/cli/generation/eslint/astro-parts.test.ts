// ESLint reads each part of an Astro component: the frontmatter with type information, the markup, and each script.
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { createEslint } from '#tests/harness/generated.ts';
import { containingAll } from '#tests/harness/expectations.ts';
import { COMPONENT } from '#tests/config/cli/generation/eslint/astro-parts.ts';

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
    const [result] = await eslint.lintFiles(['src/pages/index.astro']);
    const found = result!.messages.map((entry) => `${String(entry.line)} ${entry.ruleId ?? entry.message}`);
    expect(found).toStrictEqual(
        containingAll([
            '4 @typescript-eslint/no-unnecessary-condition',
            '6 astro/jsx-a11y/alt-text',
            '9 @typescript-eslint/no-unused-vars',
        ]),
    );
});
