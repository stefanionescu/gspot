// Bun template sandboxes verify publication, recovery, and preservation through the real lifecycle.
import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { runGspot } from '#tests/harness/gspot.ts';
import { testdir, createFileTree } from 'testdirs';
import { applyCommand } from '#cli/commands/public.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { readTree } from '#tests/harness/preservation.ts';
import { exportCommand } from '#cli/commands/contracts.ts';
import { rejection } from '#tests/harness/expectations.ts';
import { stat, chmod, symlink, readFile } from 'node:fs/promises';
import { getTemplate, exportTemplate } from '#cli/policy/document/contracts.ts';

test('template publication is idempotent, supports re-export, and survives apply', async () => {
    await using directory = await testdir();
    await createFileTree(directory.path, {
        'gspot.toml': buildPolicy([], { tables: '[agent_rules]\nenabled = false\n' }),
    });
    const exported = await exportCommand({ cwd: directory.path, file: 'shared.template.toml', isDryRun: false });
    expect(exported.exitCode).toBe(0);
    const path = join(directory.path, 'shared.template.toml');
    const first = await readFile(path);
    const repeated = await exportCommand({ cwd: directory.path, file: 'shared.template.toml', isDryRun: false });
    expect(repeated.exitCode).toBe(0);
    expect(await readFile(path)).toStrictEqual(first);
    const applied = await applyCommand({ cwd: directory.path, isDryRun: false });
    expect(applied.exitCode).toBe(0);
    expect(await readFile(path)).toStrictEqual(first);
    const refreshed = exportTemplate(
        await readFile(join(directory.path, 'gspot.toml'), 'utf8'),
        'shared.template.toml',
    );
    await Bun.write(path, `${first.toString('utf8')}\n# Authored note.\n`);
    const reexported = await exportCommand({ cwd: directory.path, file: 'shared.template.toml', isDryRun: false });
    expect(reexported.exitCode).toBe(0);
    expect(await readFile(path, 'utf8')).toBe(refreshed.text);
});

test('template export resolves a parent destination inside the repository from a nested working directory', async () => {
    await using directory = await testdir();
    const policy = buildPolicy(['bash'], { tables: '[agent_rules]\nenabled = false\n' });
    await createFileTree(directory.path, { 'gspot.toml': policy, 'app/entry.sh': 'echo example\n' });
    const exported = await exportCommand({
        cwd: join(directory.path, 'app'),
        file: '../team.template.toml',
        isDryRun: false,
    });
    expect(exported.exitCode).toBe(0);
    expect(exported.json).toStrictEqual({ file: '../team.template.toml', leftOut: [], warnings: [] });
    const restored = await getTemplate('team.template.toml', directory.path);
    expect(restored.tables.configurations).toStrictEqual(['bash']);
    expect(await readFile(join(directory.path, 'gspot.toml'), 'utf8')).toBe(policy);
    expect(await readFile(join(directory.path, 'app/entry.sh'), 'utf8')).toBe('echo example\n');
});

test.each([
    [
        'C:outside.toml',
        'Template export cannot use a drive-relative destination. Choose an absolute or repository-relative path.',
    ],
    ['linked/template.toml', 'Template export cannot write through a linked parent directory. Choose its real path.'],
    ['linked.toml', 'Lifecycle destination is not a private regular file: linked.toml'],
])('template export refuses unsafe destination %s without changing external bytes', async (file, message) => {
    await using directory = await testdir();
    await createFileTree(directory.path, {
        'project/gspot.toml': buildPolicy([]),
        'outside/template.toml': 'original',
    });
    const root = join(directory.path, 'project');
    const outside = join(directory.path, 'outside/template.toml');
    await symlink('../outside', join(root, 'linked'), 'dir');
    await symlink(outside, join(root, 'linked.toml'));
    expect(await rejection(exportCommand({ cwd: root, file, isDryRun: false }))).toBe(message);
    expect(await readFile(outside, 'utf8')).toBe('original');
});

test('template export replaces an unowned destination and preserves its read-only mode', async () => {
    await using directory = await testdir();
    await createFileTree(directory.path, {
        'gspot.toml': buildPolicy([], { tables: '[agent_rules]\nenabled = false\n' }),
        'occupied.toml': 'original bytes',
    });
    const occupied = join(directory.path, 'occupied.toml');
    await chmod(occupied, 0o444);
    const exported = await exportCommand({ cwd: directory.path, file: 'occupied.toml', isDryRun: false });
    expect(exported.exitCode).toBe(0);
    expect(await readFile(occupied, 'utf8')).toContain('template = "occupied"');
    const attributes = await stat(occupied);
    expect(attributes.mode & 0o200).toBe(0);
});

test('export refuses the managed policy with the same policy diagnostic in human and JSON output', async () => {
    await using directory = await testdir();
    await createFileTree(directory.path, {
        'gspot.toml': buildPolicy([], { tables: '[agent_rules]\nenabled = false\n' }),
        'control.txt': 'preserve this source\n',
    });
    const edited = await runGspot(directory.path, ['set', 'level', 'all']);
    expect(edited.code, edited.stdout + edited.stderr).toBe(0);
    const before = await readTree(directory.path);
    const human = await runGspot(directory.path, ['export', 'gspot.toml']);
    expect(human.code, human.stdout + human.stderr).toBe(2);
    expect(human.stdout).toBe('');
    expect(human.stderr).toBe('Template export cannot replace managed gspot.toml. Choose another destination.\n');
    expect(await readTree(directory.path)).toStrictEqual(before);
    const structured = await runGspot(directory.path, ['export', 'gspot.toml', '--json']);
    expect(structured.code, structured.stdout + structured.stderr).toBe(2);
    expect(structured.stderr).toBe('');
    expect(JSON.parse(structured.stdout)).toStrictEqual({
        error: 'policy',
        message: 'Template export cannot replace managed gspot.toml. Choose another destination.',
    });
    expect(await readTree(directory.path)).toStrictEqual(before);
});

test('template export previews an external atomic destination without writing either repository', async () => {
    await using directory = await testdir();
    await using outside = await testdir();
    await createFileTree(directory.path, { 'gspot.toml': buildPolicy([]), 'control.txt': 'preserve' });
    await createFileTree(outside.path, { 'shared.template.toml': 'existing template' });
    const before = await readTree(directory.path);
    const destination = join(outside.path, 'shared.template.toml');
    const preview = await exportCommand({ cwd: directory.path, file: destination, isDryRun: true });
    expect(preview.exitCode).toBe(0);
    expect(preview.text).toContain('template = "shared"');
    expect(await readFile(destination, 'utf8')).toBe('existing template');
    expect(await readTree(directory.path)).toStrictEqual(before);
    const exported = await exportCommand({ cwd: directory.path, file: destination, isDryRun: false });
    expect(exported.exitCode).toBe(0);
    const restored = await getTemplate(destination, directory.path);
    expect(restored.tables.configurations).toStrictEqual([]);
    expect(await readTree(directory.path)).toStrictEqual(before);
});

test('template export warns once for each command that needs a repository file', async () => {
    await using directory = await testdir();
    await createFileTree(directory.path, {
        'gspot.toml': buildPolicy([], {
            tables: '[check.local]\ncommand = ["./verify.sh"]\npaths = ["**/*"]\nstage = "manual"\n[check.system]\ncommand = ["git", "status"]\npaths = ["**/*"]\nstage = "manual"\n',
        }),
    });
    const result = await exportCommand({ cwd: directory.path, file: 'team.template.toml', isDryRun: true });
    expect(result.json).toMatchObject({
        warnings: ['check."local" uses ./verify.sh; add that file in the destination repository.'],
    });
    expect(result.text).toContain('command = ["./verify.sh"]');
    expect(result.text).toContain('command = ["git", "status"]');
});
