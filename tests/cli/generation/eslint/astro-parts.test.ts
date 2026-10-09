// The generated Astro fragment enables its native accessibility rule.
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { COMPONENT } from '#tests/config/cli/generation/eslint/astro-parts.ts';
import { createEslint, eslintConfigurationSchema } from '#tests/harness/generated.ts';

test('the generated Astro fragment enables its accessibility rule', async () => {
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
});
