import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import type { TomlSyntax } from '#cli/types/parsers.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { PLUGIN_SOURCE_REFUSAL } from '#cli/config/settings/tables.ts';
import { createTemporaryFolder } from '#cli/system/files/temporary.ts';
import { parseSettings, safeParseSettings } from '#cli/settings/parse.ts';
import { UNKNOWN_TABLE_FIELDS, CONFIGURATION_CONFLICTS } from '#tests/config/settings/parse.ts';

function captureSettingsError(text: string, root: string): string {
    try {
        parseSettings(text, root);
    } catch (error) {
        return (error as Error).message;
    }
    throw new Error('The settings passed validation.');
}

test.each([
    { name: 'a value that is not valid', text: 'level = "x"\n', named: ['level'] },
    { name: 'a weaker value', text: 'configurations = ["bash"]\n[limits]\nmax_file_lines = 1000\n', named: ['limits'] },
    { name: 'an unknown key', text: 'nope = 1\n', named: ['nope'] },
    { name: 'an unknown tools table', text: '[tools.nope]\nrules = []\n', named: ['tools.nope'] },
    { name: 'two bad keys', text: 'level = "x"\nnope = 1\n', named: ['level', 'nope'] },
])('an unreadable gspot.toml with $name ends with the page of the settings, once', ({ text, named }) => {
    using sandbox = createTemporaryFolder();
    const lines = captureSettingsError(text, sandbox.path).split('\n');
    expect(lines.at(-1)).toEndWith('/reference/gspot-toml/ lists every setting.');
    expect(lines.filter((line) => line.includes('/reference/gspot-toml/'))).toHaveLength(1);
    for (const key of named) expect(lines.join('\n')).toContain(key);
});

test('a generator command must declare at least one output', () => {
    using sandbox = createTemporaryFolder();
    const text = buildSandboxSettings([], {
        tables: '[[command_check]]\nid = "project/generated"\ncommand = ["bun", "generate.ts"]\noutputs = []\npaths = ["**/*.ts"]\nstage = "commit"\n',
    });
    expect(safeParseSettings(text, sandbox.path)).toStrictEqual({
        syntax: expect.anything() as TomlSyntax,
        errors: [
            {
                path: ['command_check', 0, 'outputs'],
                message: expect.stringMatching(
                    /^The value \[\] is not valid for command_check\.0\.outputs\./u,
                ) as string,
            },
        ],
    });
});

test('pytest refuses a function coverage limit because it supports line coverage only', () => {
    using sandbox = createTemporaryFolder();
    const text = buildSandboxSettings(['python', 'pytest'], { tables: '[coverage]\nmin_function_percent = 100\n' });
    expect(safeParseSettings(text, sandbox.path)).toStrictEqual({
        syntax: expect.anything() as TomlSyntax,
        errors: [
            {
                path: ['coverage', 'min_function_percent'],
                message:
                    'There is no setting called coverage.min_function_percent. The settings that exist under that table are coverage.min_line_percent.',
            },
        ],
    });
});

test('a numeric scope keeps its authored position after a nonnumeric scope', async () => {
    await using sandbox = await testdir({ 'app/.keep': '', '2024/.keep': '' });
    const text = buildSandboxSettings([], {
        scopes: [
            { path: 'app', configurations: [] },
            { path: '2024', configurations: [] },
        ],
    });
    const settings = parseSettings(text, sandbox.path);
    expect(settings.scopes.keys().toArray()).toStrictEqual(['app', '2024']);
});

test('adding an external Python module needs a reason and accepts a recorded reason', () => {
    using sandbox = createTemporaryFolder();
    const text = buildSandboxSettings(['python'], { tables: '[python]\nexternals = ["private_sdk"]\n' });
    expect(safeParseSettings(text, sandbox.path)).toStrictEqual({
        syntax: expect.anything() as TomlSyntax,
        errors: [
            {
                path: ['python', 'externals', 'reason'],
                message:
                    'python.externals needs a reason. Write python.externals = { value = [...], reason = "<why>" }.',
            },
        ],
    });
    const reasoned = text.replace(
        '["private_sdk"]',
        '{ value = ["private_sdk"], reason = "The deployment provides this private package." }',
    );
    const settings = parseSettings(reasoned, sandbox.path);
    expect(settings.python?.externals).toStrictEqual(['private_sdk']);
});

test.each(UNKNOWN_TABLE_FIELDS)('an unknown field identifies its actual table: $text', ({ text, path, setting }) => {
    using sandbox = createTemporaryFolder();
    const escaped = setting.replaceAll('.', String.raw`\.`);
    const named = new RegExp(String.raw`(?:^|\s)${escaped}\b`, 'u');
    expect(safeParseSettings(text, sandbox.path)).toStrictEqual({
        syntax: expect.anything() as TomlSyntax,
        errors: [{ path, message: expect.stringMatching(named) as string }],
    });
});

test.each(CONFIGURATION_CONFLICTS)(
    'a selected and removed configuration is refused at $path',
    async ({ text, path }) => {
        await using sandbox = await testdir({ 'app/.keep': '' });
        expect(safeParseSettings(text, sandbox.path)).toStrictEqual({
            syntax: expect.anything() as TomlSyntax,
            errors: [{ path, message: 'bash is both selected and removed. Keep it in only one list.' }],
        });
    },
);

test('an empty ignore path list is refused while an omitted list means every path', () => {
    using sandbox = createTemporaryFolder();
    const text = '[[ignore]]\ncheck = "bash/shellcheck"\npaths = []\nreason = "External tooling checks Bash."\n';
    expect(safeParseSettings(text, sandbox.path)).toStrictEqual({
        syntax: expect.anything() as TomlSyntax,
        errors: [
            {
                path: ['ignore', 0, 'paths'],
                message:
                    'paths = [] matches no path. Leave out paths to ignore bash/shellcheck everywhere, or list the paths.',
            },
        ],
    });
    expect(parseSettings(text.replace('paths = []\n', ''), sandbox.path).ignore[0]?.paths).toBeUndefined();
});

test.each(['bad id', 'bad,id', 'commit'])('a command check cannot take the ID %s', (id) => {
    using sandbox = createTemporaryFolder();
    const text = `[[command_check]]\nid = "${id}"\ncommand = ["echo"]\npaths = ["**"]\nstage = "commit"\n`;
    expect(safeParseSettings(text, sandbox.path)).toStrictEqual({
        syntax: expect.anything() as TomlSyntax,
        errors: [
            {
                path: ['command_check', 0, 'id'],
                message: `The value ${JSON.stringify(id)} is not valid for command_check.0.id. Use a check ID without whitespace or commas, other than commit and push, which --only reads as stages.`,
            },
        ],
    });
});

test('removed_configurations refuses a configuration that is always selected', () => {
    using sandbox = createTemporaryFolder();
    const result = safeParseSettings('removed_configurations = { json = "Not needed here." }\n', sandbox.path);
    expect(result).toMatchObject({ errors: [{ path: ['removed_configurations', 'json'] }] });
});

test('removed_configurations refuses a configuration that a selected one requires, at the root and in a scope', async () => {
    await using sandbox = await testdir({ 'app/a.ts': '' });
    const selection = 'configurations = ["typescript"]\nremoved_configurations = { javascript = "Not needed here." }\n';
    expect(safeParseSettings(selection, sandbox.path)).toMatchObject({
        errors: [{ path: ['removed_configurations', 'javascript'] }],
    });
    expect(safeParseSettings(`[[scope]]\npath = "app"\n${selection}`, sandbox.path)).toMatchObject({
        errors: [{ path: ['scope', 0, 'removed_configurations', 'javascript'] }],
    });
});

test('settings for a configuration that a selected one requires are accepted while it is being added', () => {
    using sandbox = createTemporaryFolder();
    const result = safeParseSettings('[javascript]\nentry_files = ["src/a.ts"]\n', sandbox.path, ['typescript']);
    expect(result).not.toHaveProperty('errors');
});

test('a plugin record with a package and no version is refused at the record', () => {
    using sandbox = createTemporaryFolder();
    const text = buildSandboxSettings(['javascript'], {
        tables: '[[tools.eslint.plugins]]\nname = "acme"\npackage = "eslint-plugin-acme"\nrules = {}\n',
    });
    expect(safeParseSettings(text, sandbox.path)).toStrictEqual({
        syntax: expect.anything() as TomlSyntax,
        errors: [
            {
                path: ['tools', 'eslint', 'plugins', 0],
                message: expect.stringContaining(PLUGIN_SOURCE_REFUSAL) as string,
            },
        ],
    });
});
