// ESLint reads each part of an Astro component: the frontmatter with type information, the markup, and each script.
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { containingAll } from '#tests/support/expectations.ts';
import { generatedEslint } from '#tests/support/cli/generated/eslint.ts';

const COMPONENT = [
    '---',
    'const html: string = "<b>bold</b>";',
    'const flag = true as const;',
    'if (flag) console.info(html);',
    '---',
    '<img src="a.png">',
    '<div set:html={html} />',
    '<script>',
    '  const left = 2;',
    '</script>',
    '',
].join('\n');

test('the frontmatter, the markup, and a script of an Astro component each reach their rules', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': 'version = 1\nlevel = "all"\nkits = ["typescript", "astro"]\n[guides]\ninstall = false\n',
        'package.json': '{"name":"planted","version":"1.0.0","private":true,"type":"module"}\n',
        'tsconfig.json':
            '{"compilerOptions":{"strict":true,"module":"ESNext","moduleResolution":"Bundler"},"include":["src"]}\n',
        'src/pages/index.astro': COMPONENT,
    });
    const eslint = await generatedEslint(sandbox.path);
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
