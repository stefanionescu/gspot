import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { runGspot } from '#tests/setup/cli/commands.ts';
import { isOnDisk } from '#tests/setup/system/files.ts';
import { isWindows } from '#tests/setup/system/platform.ts';
import { startCommand } from '#tests/setup/system/processes.ts';
import { type CommandFailureJson } from '#cli/types/terminal.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { chmod, symlink, readFile, writeFile } from 'node:fs/promises';
import { LINKED_FILE_CASES } from '#tests/data/commands/apply/refusals.ts';

test('a broken managed block stops apply before generated files change', async () => {
    await using sandbox = await testdir();
    const authored = `# Preserve this file
<!-- >>> gspot managed >>> -->
Unclosed instructions.
`;
    await createFileTree(sandbox.path, {
        'gspot.toml': buildSandboxSettings(['bash'], { rules: true }),
        'AGENTS.md': authored,
        'entry.sh': 'echo example\n',
    });
    const refused = await runGspot(sandbox.path, ['apply']);
    expect(refused.code, refused.stdout + refused.stderr).toBe(2);
    expect(refused.stdout + refused.stderr).toBe(
        'AGENTS.md has incomplete or repeated gspot block markers. Fix the markers, then run gspot apply.\n',
    );
    expect(await readFile(join(sandbox.path, 'AGENTS.md'), 'utf8')).toBe(authored);
    expect(await isOnDisk(join(sandbox.path, '.gspot/configurations/language/bash/shellcheckrc'))).toBe(false);
});
test('apply refuses an empty writer lock left after a crash and names the lock to delete', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings([]),
        '.gspot/state/writer.lock': '',
    });
    const refused = await runGspot(sandbox.path, ['apply']);
    expect(refused.code, refused.stdout + refused.stderr).toBe(2);
    expect(refused.stderr).toBe(
        '.gspot/state/writer.lock names no gspot process. Delete .gspot/state/writer.lock when no gspot command is running.\n',
    );
    expect(await readFile(join(sandbox.path, '.gspot/state/writer.lock'), 'utf8')).toBe('');
});

test.each([['a live process', undefined], ...(isWindows ? [] : [['process 1', '1:held'] as const])] as const)(
    'apply refuses a writer lock held by %s and names the process and the lock',
    async (_, holder) => {
        await using sandbox = await testdir();
        // A process that outlives the run stands for the holder; disposing it kills it.
        const command = [process.execPath, '-e', 'await Bun.sleep(60_000)'];
        await using sleeper = holder === undefined ? startCommand(command, { cwd: sandbox.path }) : undefined;
        const lock = holder ?? `${String(sleeper!.child.pid)}:held`;
        await createFileTree(sandbox.path, {
            'gspot.toml': buildSandboxSettings([]),
            '.gspot/state/writer.lock': lock,
        });
        const refused = await runGspot(sandbox.path, ['apply']);
        expect(refused.code, refused.stdout + refused.stderr).toBe(2);
        expect(refused.stderr).toBe(
            `Another gspot command, process ${lock.split(':', 1)[0]!}, holds .gspot/state/writer.lock. Retry after it finishes, or delete .gspot/state/writer.lock when no gspot command is running.\n`,
        );
        expect(await readFile(join(sandbox.path, '.gspot/state/writer.lock'), 'utf8')).toBe(lock);
    },
);
test('apply --json prints one error object when an unowned file blocks generation', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['bash']),
        'entry.sh': 'echo example\n',
    });

    const applied = await runGspot(sandbox.path, ['apply']);
    expect(applied.code, applied.stdout + applied.stderr).toBe(0);
    const generated = join(sandbox.path, '.editorconfig');
    await chmod(generated, 0o644);
    await writeFile(generated, 'root = true\n');
    await writeFile(
        join(sandbox.path, 'gspot.toml'),
        buildSandboxSettings(['bash'], { tables: '[limits]\nfile_lines = 100\n' }),
    );
    const refused = await runGspot(sandbox.path, ['apply', '--json']);
    expect(refused.code, refused.stdout + refused.stderr).toBe(2);
    const failure = JSON.parse(refused.stdout) as CommandFailureJson;
    expect(Object.keys(failure)).toStrictEqual(['error', 'message']);
    expect(failure.message).toBe(
        'These files were not overwritten by gspot: .editorconfig. Move them aside, then run the command again.',
    );
});
test('a malformed reason reports a settings error and apply preserves the authored settings', async () => {
    await using sandbox = await testdir();
    const source = buildSandboxSettings(['site'], {
        tables: '[limits]\nfile_lines = { value = 1000, reason = 42 }\n',
    });
    await createFileTree(sandbox.path, { 'gspot.toml': source });
    const message = 'gspot.toml: limits.file_lines.reason: Invalid input: expected string, received number';
    const checked = await runGspot(sandbox.path, ['check', '--json']);
    expect(checked.code, checked.stdout + checked.stderr).toBe(2);
    expect(JSON.parse(checked.stdout)).toStrictEqual({ error: 'settings', message });
    const applied = await runGspot(sandbox.path, ['apply']);
    expect(applied.code, applied.stdout + applied.stderr).toBe(2);
    expect(applied.stdout + applied.stderr).toBe(
        'gspot.toml: limits.file_lines.reason: Invalid input: expected string, received number\n',
    );
    expect(await readFile(join(sandbox.path, 'gspot.toml'), 'utf8')).toBe(source);
    expect(await isOnDisk(join(sandbox.path, '.gspot'))).toBe(false);
});
test.each([...LINKED_FILE_CASES])(
    'apply --dry-run refuses a $path that links outside the repository and writes nothing',
    async ({ path, outside, files, message }) => {
        await using sandbox = await testdir({
            ...files,
            'project/.gspot/configurations/.keep': '',
            outside,
        });

        const project = join(sandbox.path, 'project');
        await symlink(join(sandbox.path, 'outside'), join(project, path));
        const refused = await runGspot(project, ['apply', '--dry-run']);
        expect(refused.code).toBe(2);
        expect(refused.stderr).toBe(`${message}\n`);
        expect(await readFile(join(sandbox.path, 'outside'), 'utf8')).toBe(outside);
    },
);
