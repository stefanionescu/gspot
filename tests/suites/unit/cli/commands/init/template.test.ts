import { join } from 'node:path';
import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { readSettings } from '#cli/settings/read.ts';
import { commitAll } from '#tests/setup/system/git.ts';
import { runGspot } from '#tests/setup/cli/commands.ts';
import { readTree } from '#tests/setup/system/files.ts';
import { parseTomlFile } from '#cli/parsers/formats/toml.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';

import {
    TEAM_LEFT_OUT,
    TEAM_TEMPLATE,
    COPIED_TEMPLATE,
    TEMPLATE_REFUSALS,
    COMMENTED_TEMPLATE,
    TEMPLATE_SCOPE_FILES,
} from '#tests/config/commands/init/template.ts';

test('init --from copies the settings that fit any repository and lists each one it leaves out', async () => {
    await using team = await testdir({ 'gspot.toml': TEAM_TEMPLATE });
    await using sandbox = await createGitSandbox({});
    const preview = await runGspot(sandbox.path, ['init', '--from', join(team.path, 'gspot.toml'), '--dry-run']);
    expect(preview.code, preview.stdout + preview.stderr).toBe(0);
    expect(preview.stdout).toContain(`left out of ${join(team.path, 'gspot.toml')}`);
    for (const { key, note } of TEAM_LEFT_OUT) {
        expect(preview.stdout).toContain(key);
        expect(preview.stdout).toContain(note);
    }
    const result = await runGspot(sandbox.path, ['init', '--from', join(team.path, 'gspot.toml'), '--yes', '--json']);
    expect(result.code, result.stdout + result.stderr).toBe(0);
    const json = JSON.parse(result.stdout) as {
        plan: { template: { file: string; leftOut: { key: string; note: string }[] }; configurations: unknown[] };
    };
    expect(json.plan.template.file).toBe(join(team.path, 'gspot.toml'));
    expect(json.plan.template.leftOut.toSorted((a, b) => a.key.localeCompare(b.key))).toStrictEqual(
        TEAM_LEFT_OUT.toSorted((a, b) => a.key.localeCompare(b.key)),
    );
    expect(json.plan.configurations).toContainEqual({
        configuration: 'typescript',
        origin: 'template',
        checks: 2,
        checksOff: 0,
    });
    const written = await readFile(join(sandbox.path, 'gspot.toml'), 'utf8');
    expect(parseTomlFile('gspot.toml', written)).toMatchObject({
        configurations: ['typescript'],
        limits: { function_lines: { value: 80, reason: 'The parsers are state machines.' } },
    });
    expect(written).toContain('# The parsers are state machines.');
    expect(written).not.toContain('test_files');
    expect(written).not.toContain('[[scope]]');
    expect(written).not.toContain('[[command_check]]');
    expect(written).not.toContain('[ci]');
    expect(json.plan.template).toMatchObject({ leftOut: { length: TEAM_LEFT_OUT.length } });
});

test.each(TEMPLATE_REFUSALS)(
    'init --from refuses $name, names the file, and writes nothing',
    async ({ files, from, message }) => {
        await using sandbox = await createGitSandbox(files);
        const before = await readTree(sandbox.path);
        const result = await runGspot(sandbox.path, ['init', '--from', from, '--dry-run']);
        expect(result.code).toBe(2);
        expect(result.stderr).toBe(`${message}\n`);
        expect(await readTree(sandbox.path)).toStrictEqual(before);
    },
);

test.each(['--configurations', '--no-configurations'])(
    'init refuses --from beside %s before it reads anything',
    async (flag) => {
        await using sandbox = await createGitSandbox({});
        const result = await runGspot(sandbox.path, [
            'init',
            '--from',
            'missing.toml',
            flag,
            ...(flag === '--configurations' ? ['python'] : []),
            '--dry-run',
        ]);
        expect(result.code).toBe(2);
        expect(result.stderr).toBe(
            `--from takes the configurations of its file. Leave out ${flag}, or edit a copy of the file.\n`,
        );
    },
);

test('init --from adds the detected configurations to the ones of the file', async () => {
    await using team = await testdir({ 'gspot.toml': 'configurations = ["markdown"]\n' });
    await using sandbox = await createGitSandbox({ 'main.py': 'PORT = 8080\n' });
    const result = await runGspot(sandbox.path, ['init', '--from', join(team.path, 'gspot.toml'), '--yes', '--json']);
    expect(result.code, result.stdout + result.stderr).toBe(0);
    const written = parseTomlFile('gspot.toml', await readFile(join(sandbox.path, 'gspot.toml'), 'utf8'));
    expect(written['configurations']).toStrictEqual(['markdown', 'python']);
});

test('in a monorepo, a framework of the file goes to the scope that detects it', async () => {
    await using team = await testdir({ 'gspot.toml': 'configurations = ["react"]\n' });
    await using sandbox = await createGitSandbox(TEMPLATE_SCOPE_FILES);
    const result = await runGspot(sandbox.path, ['init', '--from', join(team.path, 'gspot.toml'), '--yes', '--json']);
    expect(result.code, result.stdout + result.stderr).toBe(0);
    const written = parseTomlFile('gspot.toml', await readFile(join(sandbox.path, 'gspot.toml'), 'utf8'));
    expect(written['configurations']).not.toContain('react');
    const settings = readSettings(await readFile(join(sandbox.path, 'gspot.toml'), 'utf8'), sandbox.path);
    expect(settings.scopes.get('apps/web')?.configurations).toContain('react');
});

test('what init reads from this repository wins over the file', async () => {
    await using team = await testdir({
        'gspot.toml': 'configurations = ["typescript"]\nlevel = "all"\n[format]\nindent_width = 8\n',
    });
    await using sandbox = await createGitSandbox({
        '.editorconfig': 'root = true\n[*]\nindent_size = 2\nindent_style = space\n',
    });
    commitAll(sandbox.path);
    const result = await runGspot(sandbox.path, [
        'init',
        '--from',
        join(team.path, 'gspot.toml'),
        '--level',
        'basic',
        '--yes',
    ]);
    expect(result.code, result.stdout + result.stderr).toBe(0);
    const written = parseTomlFile('gspot.toml', await readFile(join(sandbox.path, 'gspot.toml'), 'utf8'));
    expect(written['level']).toBeUndefined();
    expect(written['format']).toMatchObject({ indent_width: 2 });
});

test('init --from stops when a copied setting does not fit this repository, and names the setting', async () => {
    await using team = await testdir({ 'gspot.toml': 'configurations = ["typescript"]\n[format]\nindent_width = 8\n' });
    await using sandbox = await createGitSandbox({
        '.editorconfig': 'root = true\n[*]\nindent_size = 0\nindent_style = space\n',
    });
    commitAll(sandbox.path);
    const before = await readTree(sandbox.path);
    const result = await runGspot(sandbox.path, ['init', '--from', join(team.path, 'gspot.toml'), '--yes']);
    expect(result.code).toBe(2);
    expect(result.stderr).toStartWith(
        `The settings copied from ${join(team.path, 'gspot.toml')} do not fit this repository. Edit a copy of the file, then run gspot init again:\n`,
    );
    expect(result.stderr).toContain('format.indent_width');
    expect(await readTree(sandbox.path)).toStrictEqual(before);
});

test('the comments of copied keys stay and the template preface is replaced', async () => {
    await using team = await testdir({ 'gspot.toml': COMMENTED_TEMPLATE });
    await using sandbox = await createGitSandbox({});
    const result = await runGspot(sandbox.path, ['init', '--from', join(team.path, 'gspot.toml'), '--yes']);
    expect(result.code, result.stdout + result.stderr).toBe(0);
    expect(await readFile(join(sandbox.path, 'gspot.toml'), 'utf8')).toBe(COPIED_TEMPLATE);
});
