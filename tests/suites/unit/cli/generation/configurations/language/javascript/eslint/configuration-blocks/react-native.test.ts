import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { buildEslint, readEslintRules } from '#tests/setup/eslint/lint.ts';

test.each(['all'] as const)('React Native text wrappers accept text at level %s', async (level) => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['javascript', 'react-native'], { level }),
        'App.jsx': 'export function HomeScreen() { return <ThemedText type="title">Welcome!</ThemedText>; }\n',
    });
    const eslint = await buildEslint(sandbox.path);
    const rules = await readEslintRules(eslint, ['App.jsx']);
    expect(rules['App.jsx']!['react-native/no-raw-text']).toBeUndefined();
});
