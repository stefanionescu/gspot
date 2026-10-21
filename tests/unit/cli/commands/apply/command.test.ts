import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { isOnDisk } from '#tests/setup/files.ts';
import { isWindows } from '#tests/setup/system.ts';
import { testdir, createFileTree } from 'testdirs';
import { runGspot } from '#tests/setup/run-gspot.ts';
import { startCommand } from '#tests/setup/processes.ts';
import { buildInitArguments } from '#tests/setup/builders.ts';
import { chmod, readFile, writeFile } from 'node:fs/promises';
import { commitAll, readGitOutput } from '#tests/setup/git.ts';
import { buildSandboxSettings } from '#tests/setup/settings.ts';
import { type CommandFailureJson } from '#cli/types/terminal.ts';

test('init deletes a replaced file and apply regenerates owned files without changing settings', async () => {
    await using folder = await testdir({ '.shellcheckrc': 'disable=SC2086\n', 'entry.sh': 'echo example\n' });

    commitAll(folder.path);
    const initialized = await runGspot(folder.path, buildInitArguments(['bash']));
    expect(initialized.code, initialized.stdout + initialized.stderr).toBe(0);
    const writtenVersion = await readFile(join(folder.path, '.gspot/version'), 'utf8');
    expect(initialized.stdout.split('\n')).toContain(`gspot ${writtenVersion.trim()}`);
    expect(await isOnDisk(join(folder.path, '.shellcheckrc'))).toBe(false);
    const settingsPath = join(folder.path, 'gspot.toml');
    const settings = await readFile(settingsPath, 'utf8');
    await writeFile(join(folder.path, 'added.py'), 'print("example")\n');
    const generated = join(folder.path, '.gspot/configurations/language/bash/shellcheckrc');
    const edited = `${await readFile(generated, 'utf8')}# Authored after installation.\n`;
    await chmod(generated, 0o644);
    await writeFile(generated, edited);
    await writeFile(join(folder.path, '.gspot/authored.txt'), 'Preserve this file.\n');
    const applied = await runGspot(folder.path, ['apply']);
    expect(applied.code, applied.stdout + applied.stderr).toBe(0);
    expect(await readFile(generated, 'utf8')).not.toContain('# Authored after installation.');
    expect(await isOnDisk(join(folder.path, '.gspot/authored.txt'))).toBe(false);
    expect(await readFile(settingsPath, 'utf8')).toBe(settings);
});
test('a broken managed block stops apply before generated files change', async () => {
    await using folder = await testdir();
    const authored = `# Preserve this file
<!-- >>> gspot managed >>> -->
Unclosed instructions.
`;
    await createFileTree(folder.path, {
        'gspot.toml': buildSandboxSettings(['bash'], { rules: true }),
        'AGENTS.md': authored,
        'entry.sh': 'echo example\n',
    });
    const refused = await runGspot(folder.path, ['apply']);
    expect(refused.code, refused.stdout + refused.stderr).toBe(2);
    expect(refused.stdout + refused.stderr).toContain('incomplete or repeated');
    expect(await readFile(join(folder.path, 'AGENTS.md'), 'utf8')).toBe(authored);
    expect(await isOnDisk(join(folder.path, '.gspot/configurations/language/bash/shellcheckrc'))).toBe(false);
});
// A lock left after a crash or held by a live process: apply stops and names the lock to delete.
test.each([
    ['empty', ''],
    ['held by a live process', undefined],
    ...(isWindows ? [] : [['held by process 1', '1:held'] as const]),
] as const)('apply refuses a writer lock %s and names it', async (_, holder) => {
    await using folder = await testdir();
    // A process that outlives the run stands for the holder; disposing it kills it.
    const command = [process.execPath, '-e', 'await Bun.sleep(60_000)'];
    await using sleeper = holder === undefined ? startCommand(command, { cwd: folder.path }) : undefined;
    const lock = holder ?? `${String(sleeper!.child.pid)}:held`;
    await createFileTree(folder.path, {
        'gspot.toml': buildSandboxSettings([]),
        '.gspot/state/writer.lock': lock,
    });
    const refused = await runGspot(folder.path, ['apply']);
    expect(refused.code, refused.stdout + refused.stderr).toBe(2);
    expect(refused.stderr).toContain('.gspot/state/writer.lock');
    expect(await readFile(join(folder.path, '.gspot/state/writer.lock'), 'utf8')).toBe(lock);
});
test('apply --json prints one error object when an unowned file blocks generation', async () => {
    await using folder = await testdir({
        'gspot.toml': buildSandboxSettings(['bash']),
        'entry.sh': 'echo example\n',
    });

    const applied = await runGspot(folder.path, ['apply']);
    expect(applied.code, applied.stdout + applied.stderr).toBe(0);
    const generated = join(folder.path, '.editorconfig');
    await chmod(generated, 0o644);
    await writeFile(generated, 'root = true\n');
    await writeFile(
        join(folder.path, 'gspot.toml'),
        buildSandboxSettings(['bash'], { tables: '[limits]\nfile_lines = 100\n' }),
    );
    const refused = await runGspot(folder.path, ['apply', '--json']);
    expect(refused.code, refused.stdout + refused.stderr).toBe(2);
    const failure = JSON.parse(refused.stdout) as CommandFailureJson;
    expect(Object.keys(failure)).toStrictEqual(['error', 'message']);
    expect(failure.message).toContain('.editorconfig');
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
    expect(JSON.parse(checked.stdout)).toStrictEqual({ error: 'settings', message: message });
    const applied = await runGspot(sandbox.path, ['apply']);
    expect(applied.code, applied.stdout + applied.stderr).toBe(2);
    expect(applied.stdout + applied.stderr).toContain(message);
    expect(await readFile(join(sandbox.path, 'gspot.toml'), 'utf8')).toBe(source);
    expect(await isOnDisk(join(sandbox.path, '.gspot'))).toBe(false);
});
test('removing rules from a fresh clone removes the managed AGENTS.md block', async () => {
    await using sandbox = await testdir();
    const source = join(sandbox.path, 'source');
    const checkout = join(sandbox.path, 'checkout');
    const authored = '# Your instructions\n';
    await createFileTree(source, { 'gspot.toml': buildSandboxSettings([], { rules: true }), 'AGENTS.md': authored });
    commitAll(source);
    expect(await runGspot(source, ['apply'])).toHaveProperty('code', 0);
    commitAll(source);
    readGitOutput(sandbox.path, ['clone', '--quiet', source, checkout]);
    expect(await runGspot(checkout, ['apply'])).toHaveProperty('code', 0);
    await writeFile(join(checkout, 'gspot.toml'), buildSandboxSettings([]));
    expect(await runGspot(checkout, ['apply'])).toHaveProperty('code', 0);
    expect(await readFile(join(checkout, 'AGENTS.md'), 'utf8')).toBe(authored);
});
