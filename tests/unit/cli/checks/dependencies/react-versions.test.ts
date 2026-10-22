import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { runSandboxCheck } from '#tests/setup/cli/checks.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { BUN_PROJECT_FILES } from '#tests/data/checks/dependencies.ts';

test('react-versions reports react and react-dom that lock different versions, and nothing when they match', async () => {
    await using sandbox = await testdir({
        ...BUN_PROJECT_FILES,
        'gspot.toml': buildSandboxSettings(['react-dom']),
    });
    const findings = await runSandboxCheck(sandbox.path, 'react-dom/react-versions');
    expect(findings.map(({ rule }) => rule)).toStrictEqual(['react-versions']);
    expect(findings[0]?.message).toStartWith('react 19.1.0 and react-dom 19.0.0 differ');
});
