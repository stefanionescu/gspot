import { join } from 'node:path';
import { stringify } from 'smol-toml';
import { test, expect } from 'bun:test';
import { writeFileSync } from 'node:fs';
import { testdir, createFileTree } from 'testdirs';
import { emitAll } from '#cli/generation/outputs.ts';
import { openSession } from '#cli/commands/session.ts';
import { configuredChecks } from '#cli/planning/plan.ts';
import { collectPins } from '#cli/configurations/pins.ts';
import { createEslint } from '#tests/harness/generated.ts';
import { applicableManifests } from '#cli/planning/requirements.ts';
import { EXPO_DEPENDENCIES, NATIVE_DEPENDENCIES } from '#tests/config/samples/react.ts';
import type { RuntimeConfiguration } from '#tests/types/generation/configuration-files.ts';
import { MOBILE_POLICY, TEXT_COMPONENTS } from '#tests/config/cli/generation/eslint/mobile-applicability.ts';

test('a bare React Native project requires neither Expo nor DOM accessibility tooling', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': 'configurations = ["react-native"]\n[agent_rules]\nenabled = false\n',
        'package.json': JSON.stringify({ private: true, dependencies: NATIVE_DEPENDENCIES }),
        'src/App.jsx': 'export const App = () => <View />;\n',
    });
    const session = await openSession(sandbox.path);
    const pins = collectPins(applicableManifests(session)).map((tool) => tool.name);
    expect(pins).not.toContain('eslint-plugin-expo');
    expect(pins).not.toContain('expo-doctor');
    expect(pins).not.toContain('eslint-plugin-jsx-a11y');
    expect(pins).toContain('eslint-plugin-react-native');
    expect(pins).toContain('eslint-plugin-react-hooks');
    const config = emitAll(session).files.find((file) => file.path === '.gspot/config/eslint.config.mjs')!.content;
    expect(config).not.toContain("from 'eslint-plugin-expo'");
    expect(config).not.toContain("from 'eslint-plugin-jsx-a11y'");
});

test('Expo rules and Doctor apply to the Expo scope and leave its bare native sibling alone', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': MOBILE_POLICY,
        'bare/package.json': JSON.stringify({ private: true, dependencies: NATIVE_DEPENDENCIES }),
        'expo-app/package.json': JSON.stringify({ private: true, dependencies: EXPO_DEPENDENCIES }),
        'bare/source.js': 'const { EXPO_PUBLIC_URL } = process.env;\n',
        'expo-app/source.js': 'const { EXPO_PUBLIC_URL } = process.env;\n',
    });
    const session = await openSession(sandbox.path);
    expect(
        configuredChecks(session)
            .filter((check) => check.check.name === 'expo/doctor')
            .map((check) => check.scope.scope.path),
    ).toStrictEqual(['expo-app']);
    const eslint = await createEslint(sandbox.path);
    const bare = (await eslint.calculateConfigForFile('bare/source.js')) as RuntimeConfiguration;
    const expo = (await eslint.calculateConfigForFile('expo-app/source.js')) as RuntimeConfiguration;
    expect(bare.rules['expo/no-env-var-destructuring']).toBeUndefined();
    expect(expo.rules['expo/no-env-var-destructuring']![0]).toBe(2);
    const results = await eslint.lintFiles(['bare/source.js', 'expo-app/source.js']);
    expect(
        results.flatMap((result) =>
            result.messages
                .filter((diagnostic) => diagnostic.ruleId === 'expo/no-env-var-destructuring')
                .map(() => result.filePath),
        ),
    ).toStrictEqual([join(sandbox.path, 'expo-app/source.js')]);
});

test('native text component options preserve raw-text findings and ordinary Text components', async () => {
    await using sandbox = await testdir();
    const policy = {
        configurations: ['react-native'],
        agent_rules: { enabled: false },
        tools: { eslint: { rules: { 'react-native/no-raw-text': [{ skip: ['ThemedText'] }] } } },
    };
    await createFileTree(sandbox.path, { 'gspot.toml': stringify(policy), ...TEXT_COMPONENTS });
    const eslint = await createEslint(sandbox.path);
    const results = await eslint.lintFiles(Object.keys(TEXT_COMPONENTS));
    expect(
        results.flatMap((result) =>
            result.messages
                .filter((diagnostic) => diagnostic.ruleId === 'react-native/no-raw-text')
                .map(({ line }) => ({
                    file: result.filePath.slice(sandbox.path.length + 1).replaceAll('\\', '/'),
                    line,
                })),
        ),
    ).toStrictEqual([{ file: 'src/Raw.jsx', line: 1 }]);
    writeFileSync(join(sandbox.path, 'src/Raw.jsx'), 'export const Raw = () => <Text>label</Text>;\n');
    const corrected = await eslint.lintFiles(['src/Raw.jsx']);
    expect(
        corrected.flatMap((result) =>
            result.messages.filter((diagnostic) => diagnostic.ruleId === 'react-native/no-raw-text'),
        ),
    ).toStrictEqual([]);
});
