import { join } from 'node:path';
import { stringify } from 'smol-toml';
import { test, expect } from 'bun:test';
import { writeFile } from 'node:fs/promises';
import { testdir, createFileTree } from 'testdirs';
import { settingsText } from '#tests/setup/settings.ts';
import { ANSWER_MODULE } from '#tests/config/components.ts';
import { REACT_NATIVE_TSCONFIG } from '#tests/config/react.ts';
import testsPackage from '#tests/package.json' with { type: 'json' };
import { TEXT_COMPONENTS, REACT_NATIVE_FIXES } from '#tests/config/eslint/framework.ts';
import { createEslint, lintFindings, readEslintConfiguration } from '#tests/setup/generate.ts';

test('React Native turns off DOM accessibility rules only inside its scope', async () => {
    await using sandbox = await testdir();
    const files = ['native/App.tsx', 'web/App.tsx'];
    await createFileTree(sandbox.path, {
        'gspot.toml':
            'configurations = ["react-dom", "typescript"]\n[[scope]]\npath = "native"\nconfigurations = ["react-native"]\n',
        ...Object.fromEntries(files.map((file) => [file, 'export const value = 1;\n'])),
    });
    const eslint = await createEslint(sandbox.path);
    const rules = Object.fromEntries(
        await Promise.all(
            files.map(async (file) => {
                const awaitedConfiguration = await readEslintConfiguration(eslint, file);
                return [file, awaitedConfiguration.rules] as const;
            }),
        ),
    );
    expect(rules['native/App.tsx']!['jsx-a11y/alt-text']).toBeUndefined();
    expect(rules['web/App.tsx']!['jsx-a11y/alt-text']![0]).toBe(2);
});

test('react-native/no-raw-text keeps your skip option and reports raw text in a View', async () => {
    await using sandbox = await testdir();
    const settings = {
        configurations: ['react-native'],
        rules: { enabled: false },
        tools: { eslint: { rules: { 'react-native/no-raw-text': [{ skip: ['ThemedText'] }] } } },
    };
    await createFileTree(sandbox.path, { 'gspot.toml': stringify(settings), ...TEXT_COMPONENTS });
    const eslint = await createEslint(sandbox.path);
    const rules = ['react-native/no-raw-text'];
    expect(await lintFindings(eslint, sandbox.path, Object.keys(TEXT_COMPONENTS), rules)).toStrictEqual([
        { file: 'src/Raw.jsx', rule: 'react-native/no-raw-text', line: 1 },
    ]);
    await writeFile(join(sandbox.path, 'src/Raw.jsx'), 'export const Raw = () => <Text>label</Text>;\n');
    expect(await lintFindings(eslint, sandbox.path, ['src/Raw.jsx'], rules)).toStrictEqual([]);
});

test('Expo reports its native rule and accepts the original correction', async () => {
    const { configurations, dependencies, file, source, rule, line } = REACT_NATIVE_FIXES[0];
    await using sandbox = await testdir();
    const settings = settingsText([...configurations], { level: 'all' });
    await createFileTree(sandbox.path, {
        'gspot.toml': settings,
        'package.json': JSON.stringify({
            name: 'example',
            private: true,
            type: 'module',
            dependencies: { react: testsPackage.devDependencies.react, ...dependencies },
        }),
        'tsconfig.json': JSON.stringify(REACT_NATIVE_TSCONFIG),
        [file]: source,
    });
    const eslint = await createEslint(sandbox.path);
    expect(await lintFindings(eslint, sandbox.path, [file], [rule])).toStrictEqual([{ file, rule, line }]);
    await Bun.write(join(sandbox.path, file), ANSWER_MODULE);
    expect(await lintFindings(eslint, sandbox.path, [file], [rule])).toStrictEqual([]);
});
