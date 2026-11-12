import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { expect, spyOn, test } from 'bun:test';
import { testdir } from 'testdirs';

import { parseTomlFile } from '#cli/parsers/formats/toml.ts';
import { parseSettings } from '#cli/settings/parse.ts';
import { compareText } from '#cli/system/text.ts';
import * as installers from '#cli/tools/installers/install.ts';
import { EMPTY_TOOL_INSTALL } from '#tests/config/setup/sandboxes.ts';
import { assertRefusalWithoutWrites, runGspot } from '#tests/setup/cli/commands.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { commitAll } from '#tests/setup/system/git.ts';

const TEAM_TEMPLATE = `# gspot settings for this repository. Change them with gspot set, unset, add, remove, ignore, and unignore.

configurations = ["typescript"]
level = "all"
test_files = ["**/*.spec.ts"]

# The parsers are state machines.
[limits]
max_function_lines = { value = 80, reason = "The parsers are state machines." }

[javascript]
import_extension = "js"

[tools.eslint.rules]
eqeqeq = ["smart"]

[[scope]]
path = "apps/web"
configurations = ["react"]

[[command_check]]
id = "licenses"
command = ["./scripts/licenses.sh"]
paths = ["**/*"]
stage = "manual"

[[ignore]]
check = "commits/commitlint"
rule = "subject-case"
reason = "Our commit subjects start with a ticket number."

[[ignore]]
check = "javascript/eslint"
rule = "no-console"
paths = ["scripts/**"]
reason = "The scripts print their output."

[ci]
enabled = true
provider = "github"

[nginx]
image = "nginx:stable"

[[import_rule]]
name = "app"
paths = ["app/**"]

[[ignore]]
check = "licenses"
reason = "The command runs separately."
`;

const TEAM_LEFT_OUT = [
    { key: 'ci.enabled', note: 'CI stays off; run gspot set ci.enabled true' },
    { key: 'ci.provider', note: 'CI stays off; run gspot set ci.enabled true' },
    { key: 'nginx.image', note: 'runs code' },
    { key: '[[import_rule]] app', note: 'names paths of that repository' },
    { key: '[[ignore]] licenses', note: 'ignores a command check' },
    { key: 'test_files', note: 'names paths of that repository' },
    { key: 'javascript.import_extension', note: 'describes that repository' },
    { key: '[[scope]] apps/web', note: 'names paths of that repository' },
    { key: '[[command_check]] licenses', note: 'runs code' },
    { key: '[[ignore]] javascript/eslint no-console', note: 'names paths of that repository' },
];

const TEMPLATE_SCOPE_FILES = {
    'package.json': '{"private":true,"workspaces":["apps/*"],"devDependencies":{"left-pad":"1.0.0"}}',
    'apps/web/package.json': '{"private":true,"dependencies":{"react":"1.0.0"}}',
    'apps/web/app.tsx': 'export const App = () => <main>Hello</main>;\n',
};

const COMMENTED_TEMPLATE = `# Old team preface
configurations = ['typescript']

# Keep modules short.
[limits]
max_file_lines = 100
`;

test('init --from copies the settings that fit any repository and lists each one it leaves out', async () => {
    using _install = spyOn(installers, 'installTools').mockResolvedValue(EMPTY_TOOL_INSTALL);
    await using team = await testdir({ 'gspot.toml': TEAM_TEMPLATE });
    await using sandbox = await createGitSandbox({});
    const result = await runGspot(sandbox.path, ['init', '--from', join(team.path, 'gspot.toml'), '--json']);
    expect(result.code, result.stdout + result.stderr).toBe(0);
    const json = JSON.parse(result.stdout) as {
        plan: {
            from: { file: string; leftOutSettings: Array<{ key: string; note: string }> };
            configurations: unknown[];
        };
    };
    expect(json.plan.from.file).toBe(join(team.path, 'gspot.toml'));
    expect(json.plan.from.leftOutSettings.toSorted((a, b) => compareText(a.key, b.key))).toStrictEqual(
        TEAM_LEFT_OUT.toSorted((a, b) => compareText(a.key, b.key)),
    );
    expect(json.plan.configurations).toContainEqual(
        expect.objectContaining({ configuration: 'typescript', origin: 'template' }),
    );
    const written = await readFile(join(sandbox.path, 'gspot.toml'), 'utf8');
    const table = parseTomlFile('gspot.toml', written);
    expect(table).toMatchObject({
        configurations: ['typescript'],
        limits: { max_function_lines: { value: 80, reason: 'The parsers are state machines.' } },
    });
    expect(written).not.toContain('test_files');
    expect(table).not.toHaveProperty('scope');
    expect(table).not.toHaveProperty('command_check');
    expect(written).not.toContain('[ci]');
});

test.each([
    {
        name: 'a missing file',
        files: {},
        from: 'missing.toml',
        error: 'arguments',
        message: 'There is no file at missing.toml.',
    },
    {
        name: 'a folder',
        files: { 'folder/a.txt': '' },
        from: 'folder',
        error: 'arguments',
        message: '--from needs a file, and folder is a folder.',
    },
    {
        name: 'invalid UTF-8',
        files: { 'invalid.toml': Buffer.from('ff', 'hex') },
        from: 'invalid.toml',
        error: 'settings',
        message: 'invalid.toml must contain valid UTF-8 text.',
    },
    {
        name: 'an unknown setting',
        files: { 'team.toml': 'configurations = []\nunknown_key = 1\n' },
        from: 'team.toml',
        error: 'settings',
        message: expect.stringContaining('team.toml:2: unknown_key: There is no setting called unknown_key.') as string,
    },
    {
        name: 'an unknown configuration',
        files: { 'team.toml': 'configurations = ["pythn"]\n' },
        from: 'team.toml',
        error: 'settings',
        message: expect.stringContaining(
            'team.toml:1: configurations.0: There is no configuration called pythn.',
        ) as string,
    },
] as const)(
    'init --from refuses $name, names the file, and writes nothing',
    async ({ files, from, error, message }) => {
        using _install = spyOn(installers, 'installTools').mockResolvedValue(EMPTY_TOOL_INSTALL);
        await using sandbox = await createGitSandbox(files);
        const failure = await assertRefusalWithoutWrites(sandbox.path, ['init', '--from', from], error);
        expect(failure.message).toEqual(message);
    },
);

test('init --from lists each setting that no selected configuration reads, and writes the rest', async () => {
    using _install = spyOn(installers, 'installTools').mockResolvedValue(EMPTY_TOOL_INSTALL);
    await using team = await testdir({
        'gspot.toml': `configurations = ["markdown"]

[limits]
max_file_lines = 250

[licenses]
allowed = ["MIT"]

[tools.ruff]
rules = ["ANN"]
`,
    });
    await using sandbox = await createGitSandbox({});
    const result = await runGspot(sandbox.path, ['init', '--from', join(team.path, 'gspot.toml'), '--json']);
    expect(result.code, result.stdout + result.stderr).toBe(0);
    const { plan } = JSON.parse(result.stdout) as {
        plan: { from: { leftOutSettings: Array<{ key: string; note: string }> } };
    };
    const note = 'no selected configuration reads it';
    expect(plan.from.leftOutSettings).toStrictEqual([
        { key: 'licenses.allowed', note },
        { key: 'tools.ruff.rules', note },
    ]);
    const written = parseTomlFile('gspot.toml', await readFile(join(sandbox.path, 'gspot.toml'), 'utf8'));
    expect(written).not.toHaveProperty('licenses');
    expect(written).not.toHaveProperty('tools');
    expect(written['limits']).toStrictEqual({ max_file_lines: 250 });
});

test('init --from keeps a setting of a configuration that the new repository selects by its files', async () => {
    using _install = spyOn(installers, 'installTools').mockResolvedValue(EMPTY_TOOL_INSTALL);
    await using team = await testdir({
        'gspot.toml': 'configurations = ["markdown"]\n[tools.ruff]\nrules = ["ANN"]\n',
    });
    await using sandbox = await createGitSandbox({ 'main.py': 'PORT = 8080\n' });
    const result = await runGspot(sandbox.path, ['init', '--from', join(team.path, 'gspot.toml'), '--json']);
    expect(result.code, result.stdout + result.stderr).toBe(0);
    const written = parseTomlFile('gspot.toml', await readFile(join(sandbox.path, 'gspot.toml'), 'utf8'));
    expect(written['tools']).toMatchObject({ ruff: { rules: ['ANN'] } });
});

test('init refuses --from beside --configurations before it reads anything', async () => {
    using _install = spyOn(installers, 'installTools').mockResolvedValue(EMPTY_TOOL_INSTALL);
    await using sandbox = await createGitSandbox({});
    const result = await runGspot(sandbox.path, [
        'init',
        '--from',
        'missing.toml',
        '--configurations',
        'python',
        '--json',
    ]);
    expect(result.code).toBe(2);
    expect(JSON.parse(result.stdout)).toMatchObject({
        error: 'arguments',
        message: expect.stringContaining('--configurations') as string,
    });
});

test('init --from adds the detected configurations to the ones of the file', async () => {
    using _install = spyOn(installers, 'installTools').mockResolvedValue(EMPTY_TOOL_INSTALL);
    await using team = await testdir({ 'gspot.toml': 'configurations = ["markdown"]\n' });
    await using sandbox = await createGitSandbox({ 'main.py': 'PORT = 8080\n' });
    const result = await runGspot(sandbox.path, ['init', '--from', join(team.path, 'gspot.toml'), '--json']);
    expect(result.code, result.stdout + result.stderr).toBe(0);
    const written = parseTomlFile('gspot.toml', await readFile(join(sandbox.path, 'gspot.toml'), 'utf8'));
    expect(written['configurations']).toStrictEqual(['markdown', 'python']);
});

test('in a monorepo, a framework of the file goes to the scope that detects it', async () => {
    using _install = spyOn(installers, 'installTools').mockResolvedValue(EMPTY_TOOL_INSTALL);
    await using team = await testdir({ 'gspot.toml': 'configurations = ["react"]\n' });
    await using sandbox = await createGitSandbox(TEMPLATE_SCOPE_FILES);
    const result = await runGspot(sandbox.path, ['init', '--from', join(team.path, 'gspot.toml'), '--json']);
    expect(result.code, result.stdout + result.stderr).toBe(0);
    const written = parseTomlFile('gspot.toml', await readFile(join(sandbox.path, 'gspot.toml'), 'utf8'));
    expect(written['configurations']).not.toContain('react');
    const settings = parseSettings(await readFile(join(sandbox.path, 'gspot.toml'), 'utf8'), sandbox.path);
    expect(settings.scopes.get('apps/web')?.configurations).toContain('react');
});

test('init --from copies the level of the file, and the .editorconfig of this repository wins over its format', async () => {
    using _install = spyOn(installers, 'installTools').mockResolvedValue(EMPTY_TOOL_INSTALL);
    await using team = await testdir({
        'gspot.toml': 'configurations = ["typescript"]\nlevel = "all"\n[format]\nindent_width = 8\n',
    });
    await using sandbox = await createGitSandbox({
        '.editorconfig': 'root = true\n[*]\nindent_size = 2\nindent_style = space\n',
    });
    commitAll(sandbox.path);
    const result = await runGspot(sandbox.path, ['init', '--from', join(team.path, 'gspot.toml')]);
    expect(result.code, result.stdout + result.stderr).toBe(0);
    const written = parseTomlFile('gspot.toml', await readFile(join(sandbox.path, 'gspot.toml'), 'utf8'));
    expect(written['level']).toBe('all');
    expect(written['format']).toMatchObject({ indent_width: 2 });
});

test('the comments of copied keys stay and the template preface is replaced', async () => {
    using _install = spyOn(installers, 'installTools').mockResolvedValue(EMPTY_TOOL_INSTALL);
    await using team = await testdir({ 'gspot.toml': COMMENTED_TEMPLATE });
    await using sandbox = await createGitSandbox({});
    const result = await runGspot(sandbox.path, ['init', '--from', join(team.path, 'gspot.toml')]);
    expect(result.code, result.stdout + result.stderr).toBe(0);
    const written = await readFile(join(sandbox.path, 'gspot.toml'), 'utf8');
    expect(written).toContain('# Keep modules short.');
    expect(written).not.toContain('# Old team preface');
});
