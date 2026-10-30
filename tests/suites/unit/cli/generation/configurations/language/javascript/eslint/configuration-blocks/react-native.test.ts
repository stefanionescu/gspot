import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { LEVELS } from '#cli/config/manifests/names.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { buildEslint, readEslintRules, listLintFindings } from '#tests/setup/eslint/lint.ts';

test.each([...LEVELS])('React Native text wrappers accept text at level %s', async (level) => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['javascript', 'react-native'], { level }),
        'App.jsx': 'export function HomeScreen() { return <ThemedText type="title">Welcome!</ThemedText>; }\n',
    });
    const eslint = await buildEslint(sandbox.path);
    const rules = await readEslintRules(eslint, ['App.jsx']);
    expect(rules['App.jsx']!['react-native/no-raw-text']).toBeUndefined();
    expect(rules['App.jsx']!['@react-native/platform-colors']![0]).toBe(2);
    expect(await listLintFindings(eslint, sandbox.path, ['App.jsx'], ['@react-native/platform-colors'])).toStrictEqual(
        [],
    );
});
