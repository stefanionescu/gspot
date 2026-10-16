import { join } from 'node:path';
import { writeFile } from 'node:fs/promises';
import { test, expect, describe } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { stringify } from '@decimalturn/toml-patch';
import { buildMobileFiles } from '#tests/setup/builders.ts';
import { buildSettingsText } from '#tests/setup/settings.ts';
import { REACT_NATIVE_TSCONFIG } from '#tests/data/checks/react.ts';
import testsPackage from '#tests/package.json' with { type: 'json' };
import type { EslintConfiguration } from '#tests/types/tool-output.ts';
import { ANSWER_MODULE } from '#tests/data/checks/component-samples.ts';
import { createEslint, readEslintRules, collectLintFindings } from '#tests/setup/tool-files.ts';
import { TEXT_COMPONENTS, REACT_NATIVE_FIXES } from '#tests/data/generated-files/eslint/framework.ts';

describe('expo', () => {
    test('Expo rules apply in the Expo scope and not in its React Native sibling', async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, buildMobileFiles());
        const eslint = await createEslint(sandbox.path);
        const bare = (await eslint.calculateConfigForFile('bare/source.js')) as EslintConfiguration;
        const expo = (await eslint.calculateConfigForFile('expo-app/source.js')) as EslintConfiguration;
        expect(bare.rules['expo/no-env-var-destructuring']).toBeUndefined();
        expect(expo.rules['expo/no-env-var-destructuring']![0]).toBe(2);
        expect(
            await collectLintFindings(
                eslint,
                sandbox.path,
                ['bare/source.js', 'expo-app/source.js'],
                ['expo/no-env-var-destructuring'],
            ),
        ).toStrictEqual([{ file: 'expo-app/source.js', rule: 'expo/no-env-var-destructuring', line: 1 }]);
    });
});
describe('react-native', () => {
    test('React Native turns off DOM accessibility rules only inside its scope', async () => {
        await using sandbox = await testdir();
        const files = ['native/App.tsx', 'web/App.tsx'];
        await createFileTree(sandbox.path, {
            'gspot.toml':
                'configurations = ["react-dom", "typescript"]\n[[scope]]\npath = "native"\nconfigurations = ["react-native"]\n',
            ...Object.fromEntries(files.map((file) => [file, 'export const value = 1;\n'])),
        });
        const eslint = await createEslint(sandbox.path);
        const rules = await readEslintRules(eslint, files);
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
        expect(await collectLintFindings(eslint, sandbox.path, Object.keys(TEXT_COMPONENTS), rules)).toStrictEqual([
            { file: 'src/Raw.jsx', rule: 'react-native/no-raw-text', line: 1 },
        ]);
        await writeFile(join(sandbox.path, 'src/Raw.jsx'), 'export const Raw = () => <Text>label</Text>;\n');
        expect(await collectLintFindings(eslint, sandbox.path, ['src/Raw.jsx'], rules)).toStrictEqual([]);
    });

    test('Expo reports its native rule and accepts the original correction', async () => {
        const { configurations, dependencies, file, source, rule, line } = REACT_NATIVE_FIXES[0];
        await using sandbox = await testdir();
        const settings = buildSettingsText([...configurations], { level: 'all' });
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
        expect(await collectLintFindings(eslint, sandbox.path, [file], [rule])).toStrictEqual([{ file, rule, line }]);
        await Bun.write(join(sandbox.path, file), ANSWER_MODULE);
        expect(await collectLintFindings(eslint, sandbox.path, [file], [rule])).toStrictEqual([]);
    });
});
