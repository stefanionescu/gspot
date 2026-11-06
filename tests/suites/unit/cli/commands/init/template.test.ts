import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { expect, spyOn, test } from 'bun:test';
import { testdir } from 'testdirs';

import { parseTomlFile } from '#cli/parsers/formats/toml.ts';
import { readSettings } from '#cli/settings/read.ts';
import { compareText } from '#cli/system/text.ts';
import * as installers from '#cli/tools/installers/install.ts';
import type { CommandFailureJson } from '#cli/types/system.ts';
import {
    COMMENTED_TEMPLATE,
    TEAM_LEFT_OUT,
    TEAM_TEMPLATE,
    TEMPLATE_REFUSALS,
    TEMPLATE_SCOPE_FILES,
} from '#tests/config/generation/settings.ts';
import { EMPTY_TOOL_INSTALL } from '#tests/config/setup/sandboxes.ts';
import { runGspot } from '#tests/setup/cli/commands.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { readTree } from '#tests/setup/system/files.ts';
import { commitAll } from '#tests/setup/system/git.ts';

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
    expect(written).toContain('# The parsers are state machines.');
    expect(written).not.toContain('test_files');
    expect(table).not.toHaveProperty('scope');
    expect(table).not.toHaveProperty('command_check');
    expect(written).not.toContain('[ci]');
});

test.each(TEMPLATE_REFUSALS)(
    'init --from refuses $name, names the file, and writes nothing',
    async ({ files, from }) => {
        using _install = spyOn(installers, 'installTools').mockResolvedValue(EMPTY_TOOL_INSTALL);
        await using sandbox = await createGitSandbox(files);
        const before = await readTree(sandbox.path);
        const result = await runGspot(sandbox.path, ['init', '--from', from, '--json']);
        expect(result.code).toBe(2);
        expect((JSON.parse(result.stdout) as CommandFailureJson).message).toContain(from);
        expect(await readTree(sandbox.path)).toStrictEqual(before);
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
    const settings = readSettings(await readFile(join(sandbox.path, 'gspot.toml'), 'utf8'), sandbox.path);
    expect(settings.scopes.get('apps/web')?.configurations).toContain('react');
});

test('what init reads from this repository wins over the file', async () => {
    using _install = spyOn(installers, 'installTools').mockResolvedValue(EMPTY_TOOL_INSTALL);
    await using team = await testdir({
        'gspot.toml': 'configurations = ["typescript"]\nlevel = "all"\n[format]\nindent_width = 8\n',
    });
    await using sandbox = await createGitSandbox({
        '.editorconfig': 'root = true\n[*]\nindent_size = 2\nindent_style = space\n',
    });
    commitAll(sandbox.path);
    const result = await runGspot(sandbox.path, ['init', '--from', join(team.path, 'gspot.toml'), '--level', 'basic']);
    expect(result.code, result.stdout + result.stderr).toBe(0);
    const written = parseTomlFile('gspot.toml', await readFile(join(sandbox.path, 'gspot.toml'), 'utf8'));
    expect(written['level']).toBeUndefined();
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
