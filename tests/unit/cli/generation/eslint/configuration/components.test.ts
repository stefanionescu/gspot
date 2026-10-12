import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { settingsText } from '#tests/setup/settings.ts';
import { RAW_HTML_CASES, COMPONENT_FILES } from '#tests/config/eslint/framework.ts';
import { createEslint, lintFindings, readEslintConfiguration } from '#tests/setup/generate.ts';

test('Vue, Svelte and Astro files parse in their scopes, and a plain scope gets none of their rules', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': settingsText(['javascript', 'typescript', 'vue', 'svelte', 'astro'], {
            level: 'all',
            tables: '[[scope]]\npath = "app"\n\n[[scope]]\npath = "plain"\nremoved_configurations = [ "vue", "svelte", "astro" ]\n',
        }),
        'package.json': '{"private":true,"type":"module"}',
        'tsconfig.json': '{"compilerOptions":{"strict":true},"include":["**/*"]}',
        ...COMPONENT_FILES,
        ...Object.fromEntries(Object.entries(COMPONENT_FILES).map(([path, text]) => [`app/${path}`, text])),
        'plain/Card.vue': COMPONENT_FILES['Card.vue'],
        'plain/source.js': COMPONENT_FILES['source.js'],
    });
    const eslint = await createEslint(sandbox.path);
    for (const prefix of ['', 'app/']) {
        expect(
            await lintFindings(
                eslint,
                sandbox.path,
                Object.keys(COMPONENT_FILES).map((path) => `${prefix}${path}`),
                [],
            ),
        ).toStrictEqual([]);
        const vue = await readEslintConfiguration(eslint, `${prefix}Card.vue`);
        expect(vue.rules['vue/no-v-html']).toBeDefined();
    }
    const plain = await readEslintConfiguration(eslint, 'plain/Card.vue');
    expect(
        Object.entries(plain.rules).filter(([name, rule]) => name.startsWith('vue/') && rule[0] !== 0),
    ).toStrictEqual([]);
    const script = await readEslintConfiguration(eslint, 'plain/source.js');
    expect(
        Object.entries(script.rules).filter(([name, rule]) => /^(?:vue|svelte|astro)\//u.test(name) && rule[0] !== 0),
    ).toStrictEqual([]);
});

test.each([...RAW_HTML_CASES])(
    '$configuration reports raw HTML and accepts text, and a plain JavaScript file gets no such rule',
    async (component) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': settingsText(['javascript'], {
                level: 'all',
                tables: `[[scope]]\npath = "app"\nconfigurations = ["${component.configuration}"]\n`,
            }),
            'package.json': '{"name":"markup-security","private":true,"type":"module"}',
            [`app/${component.path}`]: component.sample,
            'plain.js': 'export const markup = "<b>Hello</b>";\n',
        });
        const eslint = await createEslint(sandbox.path);
        const path = `app/${component.path}`;
        expect(await lintFindings(eslint, sandbox.path, [path], [component.rule])).toStrictEqual([
            { file: path, rule: component.rule, line: 1 },
        ]);
        expect(await lintFindings(eslint, sandbox.path, ['plain.js'], [component.rule])).toStrictEqual([]);
        await createFileTree(sandbox.path, { [path]: component.corrected });
        expect(await lintFindings(eslint, sandbox.path, [path], [component.rule])).toStrictEqual([]);
    },
);
