import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { MOBILE_SETTINGS } from '#tests/config/eslint/framework.ts';
import testsPackage from '#tests/package.json' with { type: 'json' };
import { EXPO_DEPENDENCIES, REACT_NATIVE_DEPENDENCIES } from '#tests/config/react.ts';
import { createEslint, lintFindings, readEslintConfiguration } from '#tests/setup/generate.ts';

test('Expo rules apply in the Expo scope and not in its React Native sibling', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': MOBILE_SETTINGS,
        'bare/package.json': JSON.stringify({
            private: true,
            dependencies: { react: testsPackage.devDependencies.react, ...REACT_NATIVE_DEPENDENCIES },
        }),
        'expo-app/package.json': JSON.stringify({
            private: true,
            dependencies: { react: testsPackage.devDependencies.react, ...EXPO_DEPENDENCIES },
        }),
        'bare/source.js': 'const { EXPO_PUBLIC_URL } = process.env;\n',
        'expo-app/source.js': 'const { EXPO_PUBLIC_URL } = process.env;\n',
    });
    const eslint = await createEslint(sandbox.path);
    const bare = await readEslintConfiguration(eslint, 'bare/source.js');
    const expo = await readEslintConfiguration(eslint, 'expo-app/source.js');
    expect(bare.rules['expo/no-env-var-destructuring']).toBeUndefined();
    expect(expo.rules['expo/no-env-var-destructuring']![0]).toBe(2);
    expect(
        await lintFindings(
            eslint,
            sandbox.path,
            ['bare/source.js', 'expo-app/source.js'],
            ['expo/no-env-var-destructuring'],
        ),
    ).toStrictEqual([{ file: 'expo-app/source.js', rule: 'expo/no-env-var-destructuring', line: 1 }]);
});
