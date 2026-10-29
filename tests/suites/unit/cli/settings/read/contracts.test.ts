import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { readSettings, parseSettings } from '#cli/settings/read.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { createTemporaryFolder } from '#cli/system/files/folders.ts';

test('a numeric scope keeps its authored position after a nonnumeric scope', async () => {
    await using sandbox = await testdir({ 'app/.keep': '', '2024/.keep': '' });
    const text = buildSandboxSettings([], {
        scopes: [
            { path: 'app', configurations: [] },
            { path: '2024', configurations: [] },
        ],
    });
    const settings = readSettings(text, sandbox.path);
    expect([...settings.scopes.keys()]).toStrictEqual(['app', '2024']);
});

test('adding an external Python module needs a reason and accepts a recorded reason', () => {
    using sandbox = createTemporaryFolder();
    const text = buildSandboxSettings(['python'], { tables: '[python]\nexternals = ["private_sdk"]\n' });
    expect(parseSettings(text, sandbox.path)).toStrictEqual([
        {
            path: ['python', 'externals', 'reason'],
            message:
                'python.externals needs a reason. Write it as python.externals = { value = [...], reason = "..." }, or run gspot set python.externals ... --reason "<why>".',
        },
    ]);
    const reasoned = text.replace(
        '["private_sdk"]',
        '{ value = ["private_sdk"], reason = "The deployment provides this private package." }',
    );
    const settings = readSettings(reasoned, sandbox.path);
    expect(settings.python?.externals).toStrictEqual(['private_sdk']);
});
