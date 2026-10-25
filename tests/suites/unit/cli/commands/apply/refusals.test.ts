import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { symlink, readFile } from 'node:fs/promises';
import { DOT_GSPOT } from '#cli/config/gspot-folder.ts';
import { runGspot } from '#tests/setup/cli/commands.ts';
import { isOnDisk } from '#tests/setup/system/files.ts';
import { isWindows } from '#tests/setup/system/platform.ts';
import { startCommand } from '#tests/setup/system/processes.ts';
import { type CommandFailureJson } from '#cli/types/terminal.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { WRITER_LOCK_FILE } from '#cli/config/apply/write/writer.ts';
import { buildProgramCommand } from '#tests/setup/system/programs.ts';
import { findManifestTarget } from '#tests/setup/cli/generated-files.ts';
import { runGitStep, createGitSandbox } from '#tests/setup/system/git.ts';
import { LINKED_FILE_CASES } from '#tests/config/commands/apply/refusals.ts';

test('a broken managed block stops apply before generated files change', async () => {
    await using sandbox = await testdir();
    runGitStep(sandbox.path, ['init', '--quiet']);
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
    const isObserved = await isOnDisk(join(sandbox.path, findManifestTarget('bash', 'shellcheckrc')));
    expect(isObserved).toBe(false);
});
test('apply refuses an empty writer lock left after a crash and names the lock to delete', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings([]),
        [WRITER_LOCK_FILE]: '',
    });
    const refused = await runGspot(sandbox.path, ['apply']);
    expect(refused.code, refused.stdout + refused.stderr).toBe(2);
    expect(refused.stderr).toBe(
        `${WRITER_LOCK_FILE} names no gspot process. Delete ${WRITER_LOCK_FILE} when no gspot command is running.\n`,
    );
    expect(await readFile(join(sandbox.path, WRITER_LOCK_FILE), 'utf8')).toBe('');
});

test.each([['a live process', undefined], ...(isWindows ? [] : [['process 1', '1:held'] as const])] as const)(
    'apply refuses a writer lock held by %s and names the process and the lock',
    async (_, holder) => {
        await using sandbox = await testdir();
        runGitStep(sandbox.path, ['init', '--quiet']);
        const command = buildProgramCommand('fakes/tool', '--wait');
        await using sleeper = holder === undefined ? startCommand(command, { cwd: sandbox.path }) : undefined;
        const lock = holder ?? `${String(sleeper!.child.pid)}:held`;
        await createFileTree(sandbox.path, {
            'gspot.toml': buildSandboxSettings([]),
            [WRITER_LOCK_FILE]: lock,
        });
        const refused = await runGspot(sandbox.path, ['apply']);
        expect(refused.code, refused.stdout + refused.stderr).toBe(2);
        expect(refused.stderr).toBe(
            `Another gspot command, process ${lock.split(':', 1)[0]!}, holds ${WRITER_LOCK_FILE}. Retry after it finishes, or delete ${WRITER_LOCK_FILE} when no gspot command is running.\n`,
        );
        expect(await readFile(join(sandbox.path, WRITER_LOCK_FILE), 'utf8')).toBe(lock);
    },
);
test('apply --json prints one error object when an unowned file blocks generation', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['bash']),
        'entry.sh': 'echo example\n',
        '.editorconfig': 'root = true\n',
    });
    const refused = await runGspot(sandbox.path, ['apply', '--json']);
    expect(refused.code, refused.stdout + refused.stderr).toBe(2);
    const failure = JSON.parse(refused.stdout) as CommandFailureJson;
    expect(failure).toStrictEqual({
        error: 'writing',
        message: 'gspot did not overwrite these files: .editorconfig. Move them aside, then run the command again.',
    });
    expect(await readFile(join(sandbox.path, '.editorconfig'), 'utf8')).toBe('root = true\n');
});
test('a malformed reason reports a settings error and apply preserves the authored settings', async () => {
    await using sandbox = await testdir();
    runGitStep(sandbox.path, ['init', '--quiet']);
    const source = buildSandboxSettings(['site'], {
        tables: '[limits]\nfile_lines = { value = 1000, reason = 42 }\n',
    });
    await createFileTree(sandbox.path, { 'gspot.toml': source });
    const message =
        'gspot.toml:4: limits.file_lines.reason: The value 42 is not valid for limits.file_lines.reason. Use a valid string value: Why this code needs more than the default; required when you raise the value.';
    const checked = await runGspot(sandbox.path, ['check', '--json']);
    expect(checked.code, checked.stdout + checked.stderr).toBe(2);
    expect(JSON.parse(checked.stdout)).toStrictEqual({ error: 'settings', message });
    const applied = await runGspot(sandbox.path, ['apply']);
    expect(applied.code, applied.stdout + applied.stderr).toBe(2);
    expect(applied.stdout + applied.stderr).toBe(
        'gspot.toml:4: limits.file_lines.reason: The value 42 is not valid for limits.file_lines.reason. Use a valid string value: Why this code needs more than the default; required when you raise the value.\n',
    );
    expect(await readFile(join(sandbox.path, 'gspot.toml'), 'utf8')).toBe(source);
    expect(await isOnDisk(join(sandbox.path, DOT_GSPOT))).toBe(false);
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
        runGitStep(project, ['init', '--quiet']);
        await symlink(join(sandbox.path, 'outside'), join(project, path));
        const refused = await runGspot(project, ['apply', '--dry-run']);
        expect(refused.code).toBe(2);
        expect(refused.stderr).toBe(`${message}\n`);
        expect(await readFile(join(sandbox.path, 'outside'), 'utf8')).toBe(outside);
    },
);
