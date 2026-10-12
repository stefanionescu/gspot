import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { readTree } from '#tests/setup/files.ts';
import { testdir, createFileTree } from 'testdirs';
import { rejection } from '#tests/setup/matchers.ts';
import { runGspot } from '#tests/setup/run-gspot.ts';
import { applyCommand } from '#cli/commands/apply.ts';
import { exportCommand } from '#cli/commands/export.ts';
import { settingsText } from '#tests/setup/settings.ts';
import { stat, chmod, symlink, readFile } from 'node:fs/promises';
import { exportTemplate, downloadTemplate } from '#cli/settings/templates.ts';

test('export is repeatable, writes the template again after an edit, and apply leaves it alone', async () => {
    await using directory = await testdir();
    await createFileTree(directory.path, {
        'gspot.toml': settingsText([]),
    });
    const exported = await exportCommand({ cwd: directory.path, file: 'shared.template.toml' });
    expect(exported.exitCode).toBe(0);
    const path = join(directory.path, 'shared.template.toml');
    const first = await readFile(path);
    const repeated = await exportCommand({ cwd: directory.path, file: 'shared.template.toml' });
    expect(repeated.exitCode).toBe(0);
    expect(await readFile(path)).toStrictEqual(first);
    const applied = await applyCommand({ cwd: directory.path, isDryRun: false });
    expect(applied.exitCode).toBe(0);
    expect(await readFile(path)).toStrictEqual(first);
    const refreshed = exportTemplate(await readFile(join(directory.path, 'gspot.toml'), 'utf8'));
    await Bun.write(path, `${first.toString('utf8')}\n# Authored note.\n`);
    const reexported = await exportCommand({ cwd: directory.path, file: 'shared.template.toml' });
    expect(reexported.exitCode).toBe(0);
    expect(await readFile(path, 'utf8')).toBe(refreshed.text);
});

test('export from a nested folder writes a parent path inside the repository', async () => {
    await using directory = await testdir();
    const settings = settingsText(['bash']);
    await createFileTree(directory.path, { 'gspot.toml': settings, 'app/entry.sh': 'echo example\n' });
    const exported = await exportCommand({
        cwd: join(directory.path, 'app'),
        file: '../team.template.toml',
    });
    expect(exported.exitCode).toBe(0);
    expect(exported.json).toStrictEqual({ file: 'team.template.toml', leftOut: [], warnings: [] });
    const restored = await downloadTemplate('team.template.toml', directory.path);
    expect(restored.tables.configurations).toStrictEqual(['bash']);
    expect(await readFile(join(directory.path, 'gspot.toml'), 'utf8')).toBe(settings);
    expect(await readFile(join(directory.path, 'app/entry.sh'), 'utf8')).toBe('echo example\n');
});

test('export refuses a destination that links to a file outside', async () => {
    const file = 'linked.toml';
    const message = 'linked.toml is not a regular file with one link. Use a regular file without extra hard links.';
    await using directory = await testdir();
    await createFileTree(directory.path, {
        'project/gspot.toml': settingsText([]),
        'outside/template.toml': 'original',
    });
    const root = join(directory.path, 'project');
    const outside = join(directory.path, 'outside/template.toml');
    await symlink('../outside', join(root, 'linked'), 'dir');
    await symlink(outside, join(root, 'linked.toml'));
    expect(await rejection(exportCommand({ cwd: root, file }))).toBe(message);
    expect(await readFile(outside, 'utf8')).toBe('original');
});

test('export replaces a destination gspot did not write and keeps its read-only mode', async () => {
    await using directory = await testdir();
    await createFileTree(directory.path, {
        'gspot.toml': settingsText([]),
        'occupied.toml': 'original bytes',
    });
    const occupied = join(directory.path, 'occupied.toml');
    await chmod(occupied, 0o444);
    const exported = await exportCommand({ cwd: directory.path, file: 'occupied.toml' });
    expect(exported.exitCode).toBe(0);
    expect(await readFile(occupied, 'utf8')).toContain('enabled = false');
    const attributes = await stat(occupied);
    expect(attributes.mode & 0o200).toBe(0);
});

test('export refuses the managed settings with the same settings diagnostic in human and JSON output', async () => {
    await using directory = await testdir();
    await createFileTree(directory.path, {
        'gspot.toml': settingsText([]),
        'control.txt': 'preserve this source\n',
    });
    const edited = await runGspot(directory.path, ['set', 'level', 'all']);
    expect(edited.code, edited.stdout + edited.stderr).toBe(0);
    const before = await readTree(directory.path);
    const human = await runGspot(directory.path, ['export', 'gspot.toml']);
    expect(human.code, human.stdout + human.stderr).toBe(2);
    expect(human.stdout).toBe('');
    expect(human.stderr).toBe('gspot writes gspot.toml itself. Choose another file name.\n');
    expect(await readTree(directory.path)).toStrictEqual(before);
    const structured = await runGspot(directory.path, ['export', 'gspot.toml', '--json']);
    expect(structured.code, structured.stdout + structured.stderr).toBe(2);
    expect(structured.stderr).toBe('');
    expect(JSON.parse(structured.stdout)).toStrictEqual({
        error: 'template',
        message: 'gspot writes gspot.toml itself. Choose another file name.',
    });
    expect(await readTree(directory.path)).toStrictEqual(before);
});

test('export to a folder outside the repository writes the template and nothing inside the repository', async () => {
    await using directory = await testdir();
    await using outside = await testdir();
    await createFileTree(directory.path, { 'gspot.toml': settingsText([]), 'control.txt': 'preserve' });
    await createFileTree(outside.path, { 'shared.template.toml': 'existing template' });
    const before = await readTree(directory.path);
    const destination = join(outside.path, 'shared.template.toml');
    const exported = await exportCommand({ cwd: directory.path, file: destination });
    expect(exported.exitCode).toBe(0);
    const restored = await downloadTemplate(destination, directory.path);
    expect(restored.tables.rules).toStrictEqual({ enabled: false });
    expect(await readTree(directory.path)).toStrictEqual(before);
});

test('export warns once for each command that needs a repository file', async () => {
    await using directory = await testdir();
    await createFileTree(directory.path, {
        'gspot.toml': settingsText([], {
            tables: `[[command_check]]
name = "local"
command = ["./verify.sh"]
paths = ["**/*"]
stage = "manual"
[[command_check]]
name = "system"
command = ["git", "status"]
paths = ["**/*"]
stage = "manual"
`,
        }),
    });
    const result = await exportCommand({ cwd: directory.path, file: 'team.template.toml' });
    expect(result.json).toMatchObject({
        warnings: ['command_check local uses ./verify.sh; add that file in the destination repository.'],
    });
    const text = await readFile(join(directory.path, 'team.template.toml'), 'utf8');
    expect(text).toContain('command = ["./verify.sh"]');
    expect(text).toContain('command = ["git", "status"]');
});
