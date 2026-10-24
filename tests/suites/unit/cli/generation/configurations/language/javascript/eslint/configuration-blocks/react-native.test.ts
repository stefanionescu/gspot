import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { LEVELS } from '#cli/config/configurations/names.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { createEslint, listLintFindings } from '#tests/setup/eslint/lint.ts';

test.each([...LEVELS])('React Native text wrappers accept text at level %s', async (level) => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['javascript', 'react-native'], { level }),
        'App.jsx': 'export function HomeScreen() { return <ThemedText type="title">Welcome!</ThemedText>; }\n',
    });
    const eslint = await createEslint(sandbox.path);
    expect(await listLintFindings(eslint, sandbox.path, ['App.jsx'], ['react-native/no-raw-text'])).toStrictEqual([]);
});
