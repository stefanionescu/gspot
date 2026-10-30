import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { readSettings, parseSettings } from '#cli/settings/read.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { createTemporaryFolder } from '#cli/system/files/folders.ts';
import { UNKNOWN_TABLE_FIELDS, CONFIGURATION_CONFLICTS } from '#tests/config/settings/read.ts';

test('a generator command must declare at least one output', () => {
    using sandbox = createTemporaryFolder();
    const text = buildSandboxSettings([], {
        tables: '[[command_check]]\nid = "project/generated"\ncommand = ["bun", "generate.ts"]\noutputs = []\npaths = ["**/*.ts"]\nstage = "commit"\n',
    });
    expect(parseSettings(text, sandbox.path)).toStrictEqual([
        {
            path: ['command_check', 0, 'outputs'],
            message: expect.stringMatching(
                /^The value \[\] is not valid for command_check\.0\.outputs\. Use a valid list value: /u,
            ) as string,
        },
    ]);
});

test('pytest refuses a function coverage limit because it supports line coverage only', () => {
    using sandbox = createTemporaryFolder();
    const text = buildSandboxSettings(['python', 'pytest'], { tables: '[coverage]\nfunctions = 100\n' });
    expect(parseSettings(text, sandbox.path)).toStrictEqual([
        {
            path: ['coverage', 'functions'],
            message:
                'There is no setting called coverage.functions in the selected configurations. The settings that exist under that table are lines. Run gspot list settings to see every one.',
        },
    ]);
});

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

test.each(UNKNOWN_TABLE_FIELDS)('an unknown field identifies its actual table: $text', ({ text, path, message }) => {
    using sandbox = createTemporaryFolder();
    expect(parseSettings(text, sandbox.path)).toStrictEqual([{ path, message }]);
});

test.each(CONFIGURATION_CONFLICTS)(
    'a selected and removed configuration is refused at $path',
    async ({ text, path }) => {
        await using sandbox = await testdir({ 'app/.keep': '' });
        expect(parseSettings(text, sandbox.path)).toStrictEqual([
            { path, message: 'bash is both selected and removed. Keep it in only one list.' },
        ]);
    },
);

test('an empty ignore path list is refused while an omitted list means every path', () => {
    using sandbox = createTemporaryFolder();
    const text = '[[ignore]]\ncheck = "bash/shellcheck"\npaths = []\nreason = "External tooling checks Bash."\n';
    expect(parseSettings(text, sandbox.path)).toStrictEqual([
        {
            path: ['ignore', 0, 'paths'],
            message:
                'paths = [] matches no path. Leave out paths to ignore bash/shellcheck everywhere, or list the paths.',
        },
    ]);
    expect(readSettings(text.replace('paths = []\n', ''), sandbox.path).ignore[0]?.paths).toBeUndefined();
});

test.each(['bad id', 'bad,id'])('a command check ID cannot contain whitespace or commas: %s', (id) => {
    using sandbox = createTemporaryFolder();
    const text = `[[command_check]]\nid = "${id}"\ncommand = ["echo"]\npaths = ["**"]\nstage = "commit"\n`;
    expect(parseSettings(text, sandbox.path)).toStrictEqual([
        {
            path: ['command_check', 0, 'id'],
            message: `The value "${id}" is not valid for command_check.0.id. Use a check ID without whitespace or commas.`,
        },
    ]);
});
