import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { buildEslint, readEslintRules, listLintFindings } from '#tests/setup/eslint/lint.ts';

test('in a React DOM file, a scrollable region may take tabIndex, and an article may not', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['javascript', 'react', 'react-dom']),
        'package.json': '{"private":true,"type":"module"}\n',
        'log.jsx':
            'export function Log() {\n    return <div role="region" aria-label="Build log" tabIndex={0}>Done</div>;\n}\n',
        'story.jsx': 'export function Story() {\n    return <article tabIndex={0}>Text</article>;\n}\n',
    });

    const eslint = await buildEslint(sandbox.path);
    expect(
        await listLintFindings(
            eslint,
            sandbox.path,
            ['log.jsx', 'story.jsx'],
            ['jsx-a11y-x/no-noninteractive-tabindex'],
        ),
    ).toStrictEqual([{ file: 'story.jsx', rule: 'jsx-a11y-x/no-noninteractive-tabindex', line: 2 }]);
});

test('React Native turns off DOM accessibility rules only inside its scope', async () => {
    await using sandbox = await testdir();
    const files = ['native/App.tsx', 'web/App.tsx'];
    await createFileTree(sandbox.path, {
        'gspot.toml': buildSandboxSettings(['react-dom', 'typescript'], {
            rules: true,
            scopes: [{ path: 'native', configurations: ['react-native'] }],
        }),
        ...Object.fromEntries(files.map((file) => [file, 'export const value = 1;\n'])),
    });
    const eslint = await buildEslint(sandbox.path);
    const rules = await readEslintRules(eslint, files);
    expect(rules['native/App.tsx']!['jsx-a11y-x/alt-text']).toBeUndefined();
    expect(rules['web/App.tsx']!['jsx-a11y-x/alt-text']![0]).toBe(2);
});
