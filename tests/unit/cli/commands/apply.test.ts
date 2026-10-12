import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { commitAll } from '#tests/setup/git.ts';
import { testdir, createFileTree } from 'testdirs';
import { runGspot } from '#tests/setup/run-gspot.ts';
import { settingsText } from '#tests/setup/settings.ts';
import { buildInitArguments } from '#tests/setup/init.ts';
import { prepareCommand } from '#tests/setup/processes.ts';
import { readTree, pathExists } from '#tests/setup/files.ts';
import { isWindows } from '#tests/setup/operating-systems.ts';
import type { CommandFailureJson } from '#cli/types/terminal.ts';
import { NPM_CHECK_IGNORES } from '#tests/config/samples/settings.ts';
import { containing, textContaining } from '#tests/setup/matchers.ts';
import { chmod, unlink, readFile, writeFile } from 'node:fs/promises';
import type { DryRunJson } from '#cli/types/commands/save-settings.ts';

test('init deletes a replaced file, and apply exits 2 and keeps later edits and files gspot did not write', async () => {
    await using directory = await testdir();
    await createFileTree(directory.path, { '.shellcheckrc': 'disable=SC2086\n', 'entry.sh': 'echo example\n' });
    commitAll(directory.path);
    const initialized = await runGspot(directory.path, buildInitArguments(['bash']));
    expect(initialized.code, initialized.stdout + initialized.stderr).toBe(0);
    const writtenVersion = await readFile(join(directory.path, '.gspot/version'), 'utf8');
    expect(initialized.stdout.split('\n')).toContain(`gspot ${writtenVersion.trim()}`);
    expect(await pathExists(join(directory.path, '.shellcheckrc'))).toBe(false);
    const generated = join(directory.path, '.gspot/config/shellcheckrc');
    const edited = `${await readFile(generated, 'utf8')}# Authored after installation.\n`;
    await chmod(generated, 0o644);
    await writeFile(generated, edited);
    await writeFile(join(directory.path, '.gspot/authored.txt'), 'Preserve this file.\n');
    const applied = await runGspot(directory.path, ['apply']);
    expect(applied.code, applied.stdout + applied.stderr).toBe(2);
    expect(applied.stderr).toContain('.gspot/config/shellcheckrc');
    expect(await readFile(generated, 'utf8')).toBe(edited);
    expect(await readFile(join(directory.path, '.gspot/authored.txt'), 'utf8')).toBe('Preserve this file.\n');
});

test('a generated file cannot go into .gspot/state', async () => {
    await using directory = await testdir();
    await createFileTree(directory.path, {
        'gspot.toml': settingsText(['bash'], {
            rules: true,
            tables: '[rules]\ninstruction_files = [".gspot/state/notes/AGENTS.md"]\n',
        }),
        '.gspot/state/notes/authored.txt': 'preserve notes\n',
    });
    const refused = await runGspot(directory.path, ['apply']);
    expect(refused.code, refused.stdout + refused.stderr).toBe(2);
    expect(refused.stdout + refused.stderr).toContain(
        '.gspot/state/notes/AGENTS.md is inside .gspot/state. Choose a path outside it.',
    );
    expect(await readFile(join(directory.path, '.gspot/state/notes/authored.txt'), 'utf8')).toBe('preserve notes\n');
    expect(await pathExists(join(directory.path, '.gspot/config/shellcheckrc'))).toBe(false);
});

test('apply --dry-run lists missing generated files and writes nothing', async () => {
    await using directory = await testdir();
    const settings = settingsText(['bash']);
    await createFileTree(directory.path, { 'gspot.toml': settings, 'entry.sh': 'echo example\n' });
    const before = await readTree(directory.path);
    const human = await runGspot(directory.path, ['apply', '--dry-run']);
    expect(human.code, human.stdout + human.stderr).toBe(0);
    expect(human.stderr).toBe('');
    expect(human.stdout).toContain(
        'Run gspot apply to write these files. apply keeps a generated file you edited; move it aside to get the new version.\n',
    );
    expect(await readTree(directory.path)).toStrictEqual(before);
    const preview = await runGspot(directory.path, ['apply', '--dry-run', '--json']);
    expect(preview.code, preview.stdout + preview.stderr).toBe(0);
    const result = JSON.parse(preview.stdout) as DryRunJson;
    expect(result.dryRun).toBe(true);
    expect(result.drift).toContainEqual(containing({ path: '.gspot/config/shellcheckrc', kind: 'missing' }));
    expect(await readFile(join(directory.path, 'gspot.toml'), 'utf8')).toBe(settings);
    expect(await pathExists(join(directory.path, '.gspot'))).toBe(false);
    expect(await readTree(directory.path)).toStrictEqual(before);
});

test.each([false, true])(
    'apply --dry-run shows only a changed version pin (changed: %s) and writes nothing',
    async (isChanged) => {
        await using directory = await testdir();
        await createFileTree(directory.path, {
            'gspot.toml': settingsText([], { tables: NPM_CHECK_IGNORES }),
            'control.txt': 'preserve this source\n',
        });
        const applied = await runGspot(directory.path, ['apply']);
        expect(applied.code, applied.stdout + applied.stderr).toBe(0);
        const versionContents = await readFile(join(directory.path, '.gspot/version'), 'utf8');
        const version = versionContents.trim();
        if (isChanged) await writeFile(join(directory.path, '.gspot/version'), '0.0.0\n');
        const before = await readTree(directory.path);
        const preview = await runGspot(directory.path, ['apply', '--dry-run']);
        expect(preview.code, preview.stdout + preview.stderr).toBe(0);
        expect(preview.stderr).toBe('');
        const banner = isChanged ? `version 0.0.0 -> ${version}\n` : '';
        expect(preview.stdout).toBe(`${banner}every generated file is up to date\nDry run: nothing was written.\n`);
        expect(await readTree(directory.path)).toStrictEqual(before);
        const structured = await runGspot(directory.path, ['apply', '--dry-run', '--json']);
        expect(structured.code, structured.stdout + structured.stderr).toBe(0);
        expect(structured.stderr).toBe('');
        const result = JSON.parse(structured.stdout) as DryRunJson;
        expect(result.pin).toStrictEqual({ from: isChanged ? '0.0.0' : version, to: version });
        expect(result.drift).toStrictEqual([]);
        expect(await readTree(directory.path)).toStrictEqual(before);
    },
);

test('a broken managed block stops apply before generated files change', async () => {
    await using directory = await testdir();
    const authored = `# Preserve this file
<!-- >>> gspot managed >>> -->
Unclosed instructions.
`;
    await createFileTree(directory.path, {
        'gspot.toml': settingsText(['bash'], { rules: true }),
        'AGENTS.md': authored,
        'entry.sh': 'echo example\n',
    });
    const refused = await runGspot(directory.path, ['apply']);
    expect(refused.code, refused.stdout + refused.stderr).toBe(2);
    expect(refused.stdout + refused.stderr).toContain('incomplete or repeated');
    expect(await readFile(join(directory.path, 'AGENTS.md'), 'utf8')).toBe(authored);
    expect(await pathExists(join(directory.path, '.gspot/config/shellcheckrc'))).toBe(false);
});

// A lock left after a crash or held by a live process: apply stops and names the lock to delete.
test.each([
    ['empty', ''],
    ['held by a live process', undefined],
    ...(isWindows ? [] : [['held by process 1', '1:held'] as const]),
] as const)('apply refuses a writer lock %s and names it', async (_, holder) => {
    await using directory = await testdir();
    // A process that outlives the run stands for the holder; disposing it kills it.
    const command = [process.execPath, '-e', 'await Bun.sleep(60_000)'];
    await using sleeper =
        holder === undefined
            ? Bun.spawn(command, {
                  cwd: directory.path,
                  timeout: prepareCommand(command, { cwd: directory.path }).options.timeoutMs,
              })
            : undefined;
    const lock = holder ?? `${String(sleeper!.pid)}:held`;
    await createFileTree(directory.path, {
        'gspot.toml': settingsText([]),
        '.gspot/state/writer.lock': lock,
    });
    const refused = await runGspot(directory.path, ['apply']);
    expect(refused.code, refused.stdout + refused.stderr).toBe(2);
    expect(refused.stderr).toContain('.gspot/state/writer.lock');
    expect(await readFile(join(directory.path, '.gspot/state/writer.lock'), 'utf8')).toBe(lock);
});

test('apply --json prints one error object when it refuses an edited generated file', async () => {
    await using directory = await testdir();
    await createFileTree(directory.path, {
        'gspot.toml': settingsText(['bash']),
        'entry.sh': 'echo example\n',
    });
    const applied = await runGspot(directory.path, ['apply']);
    expect(applied.code, applied.stdout + applied.stderr).toBe(0);
    const generated = join(directory.path, '.gspot/config/shellcheckrc');
    await chmod(generated, 0o644);
    await writeFile(generated, `${await readFile(generated, 'utf8')}# Edited.\n`);
    await writeFile(
        join(directory.path, 'gspot.toml'),
        settingsText(['bash'], { tables: '[limits]\nfile_lines = 100\n' }),
    );
    const refused = await runGspot(directory.path, ['apply', '--json']);
    expect(refused.code, refused.stdout + refused.stderr).toBe(2);
    const failure = JSON.parse(refused.stdout) as CommandFailureJson;
    expect(Object.keys(failure)).toStrictEqual(['error', 'message']);
    expect(failure.message).toContain('shellcheckrc');
});

test('apply --dry-run reports a changed file, a stray, a conflict, and an edited block, and writes nothing', async () => {
    await using directory = await testdir();
    await createFileTree(directory.path, {
        'gspot.toml': settingsText(['bash', 'markdown'], { rules: true }),
        'entry.sh': 'echo example\n',
        'README.md': '# Example\n',
    });
    const applied = await runGspot(directory.path, ['apply']);
    expect(applied.code, applied.stdout + applied.stderr).toBe(0);
    const edit = async (path: string, text: (current: string) => string): Promise<void> => {
        const full = join(directory.path, path);
        await chmod(full, 0o644);
        await writeFile(full, text(await readFile(full, 'utf8')));
    };
    await edit('.gspot/config/shellcheckrc', (current) => `${current}# Edited.\n`);
    await edit(
        '.gspot/package.json',
        (current) => `<<<<<<< ours
${current}=======
>>>>>>> theirs
`,
    );
    await edit('AGENTS.md', (current) =>
        current.replace('<!-- <<< gspot managed <<< -->', 'Edited inside.\n<!-- <<< gspot managed <<< -->'),
    );
    await unlink(join(directory.path, 'README.md'));
    await writeFile(join(directory.path, 'settings.json'), '{}\n');
    await writeFile(join(directory.path, 'gspot.toml'), settingsText(['bash'], { rules: true }));
    const before = await readTree(directory.path);
    const preview = await runGspot(directory.path, ['apply', '--dry-run', '--json']);
    expect(preview.code, preview.stdout + preview.stderr).toBe(0);
    const { drift } = JSON.parse(preview.stdout) as DryRunJson;
    expect(drift).toContainEqual(
        containing({
            path: '.gspot/config/shellcheckrc',
            kind: 'changed',
            diff: textContaining('-# Edited.'),
        }),
    );
    expect(drift).toContainEqual(containing({ path: '.gspot/package.json', kind: 'conflict' }));
    expect(drift).toContainEqual(
        containing({ path: 'AGENTS.md', kind: 'changed', diff: textContaining('-Edited inside.') }),
    );
    expect(drift).toContainEqual(containing({ path: '.gspot/config/markdownlint.jsonc', kind: 'stray' }));
    expect(drift.some(({ path }) => path === 'README.md' || path === 'settings.json')).toBe(false);
    expect(await readTree(directory.path)).toStrictEqual(before);
});

test('a malformed reason reports a settings error and apply preserves the authored settings', async () => {
    await using sandbox = await testdir();
    const source = settingsText(['site'], {
        tables: '[limits]\nfile_lines = { value = 1000, reason = 42 }\n',
    });
    await createFileTree(sandbox.path, { 'gspot.toml': source });
    const diagnostic = 'gspot.toml: limits.file_lines.reason: Invalid input: expected string, received number';
    const checked = await runGspot(sandbox.path, ['check', '--only', 'gspot/settings', '--json']);
    expect(checked.code, checked.stdout + checked.stderr).toBe(2);
    expect(JSON.parse(checked.stdout)).toStrictEqual({ error: 'settings', message: diagnostic });
    const applied = await runGspot(sandbox.path, ['apply']);
    expect(applied.code, applied.stdout + applied.stderr).toBe(2);
    expect(applied.stdout + applied.stderr).toContain(diagnostic);
    expect(await readFile(join(sandbox.path, 'gspot.toml'), 'utf8')).toBe(source);
    expect(await pathExists(join(sandbox.path, '.gspot'))).toBe(false);
});
