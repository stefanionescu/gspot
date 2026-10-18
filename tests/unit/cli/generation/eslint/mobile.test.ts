import { test, expect, describe } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { buildMobileFiles } from '#tests/setup/builders.ts';
import type { EslintConfiguration } from '#tests/types/tool-output.ts';
import { createEslint, readEslintRules, collectLintFindings } from '#tests/setup/tool-files.ts';

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
});
