// apply preserves later edits and refuses before it writes when authored input is malformed.
import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { commitAll } from '#tests/harness/git.ts';
import { runGspot } from '#tests/harness/gspot.ts';
import { testdir, createFileTree } from 'testdirs';
import { buildPolicy } from '#tests/harness/policy.ts';
import { readTree } from '#tests/harness/preservation.ts';
import { buildInitArguments } from '#tests/harness/init.ts';
import { containing } from '#tests/harness/expectations.ts';
import type { CommandFailureJson } from '#cli/types/output.ts';
import { prepareTestCommand } from '#tests/harness/command.ts';
import type { ApplyPreviewJson } from '#cli/types/commands/apply.ts';
import { chmodSync, existsSync, unlinkSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';

const INIT = buildInitArguments(['bash']);

test('init deletes a replaced file, and apply preserves later edits and unowned content', async () => {
    await using directory = await testdir();
    await createFileTree(directory.path, { '.shellcheckrc': 'disable=SC2086\n', 'entry.sh': 'echo example\n' });
    commitAll(directory.path);
    const initialized = await runGspot(directory.path, INIT);
    expect(initialized.code, initialized.stdout + initialized.stderr).toBe(0);
    expect(existsSync(join(directory.path, '.shellcheckrc'))).toBe(false);
    const generated = join(directory.path, '.gspot/config/shellcheckrc');
    const edited = `${readFileSync(generated, 'utf8')}# Authored after installation.\n`;
    chmodSync(generated, 0o644);
    writeFileSync(generated, edited);
    writeFileSync(join(directory.path, '.gspot/authored.txt'), 'Preserve this file.\n');
    const applied = await runGspot(directory.path, ['apply']);
    expect(applied.code, applied.stdout + applied.stderr).toBe(2);
    expect(applied.stderr).toContain('The version pin is unchanged.');
    expect(readFileSync(generated, 'utf8')).toBe(edited);
    expect(readFileSync(join(directory.path, '.gspot/authored.txt'), 'utf8')).toBe('Preserve this file.\n');
});

test('a generated plan cannot write into the lifecycle state folder', async () => {
    await using directory = await testdir();
    await createFileTree(directory.path, {
        'gspot.toml': buildPolicy(['bash'], { tables: '[agent_rules]\nfolder = ".gspot/state/notes"\n' }),
        '.gspot/state/notes/authored.txt': 'preserve notes\n',
    });
    const refused = await runGspot(directory.path, ['apply']);
    expect(refused.code, refused.stdout + refused.stderr).toBe(2);
    expect(refused.stdout + refused.stderr).toContain('Lifecycle metadata is not a generated target');
    expect(readFileSync(join(directory.path, '.gspot/state/notes/authored.txt'), 'utf8')).toBe('preserve notes\n');
    expect(existsSync(join(directory.path, '.gspot/config/shellcheckrc'))).toBe(false);
});

test('apply previews missing outputs without writing', async () => {
    await using directory = await testdir();
    const policy = buildPolicy(['bash'], { tables: '[agent_rules]\nenabled = false\n' });
    await createFileTree(directory.path, { 'gspot.toml': policy, 'entry.sh': 'echo example\n' });
    const preview = await runGspot(directory.path, ['apply', '--dry-run', '--json']);
    expect(preview.code, preview.stdout + preview.stderr).toBe(0);
    const result = JSON.parse(preview.stdout) as ApplyPreviewJson;
    expect(result.dryRun).toBe(true);
    expect(result.drift).toContainEqual(containing({ path: '.gspot/config/shellcheckrc', kind: 'missing' }));
    expect(readFileSync(join(directory.path, 'gspot.toml'), 'utf8')).toBe(policy);
    expect(existsSync(join(directory.path, '.gspot'))).toBe(false);
});

test('malformed authored blocks refuse apply before generated files change', async () => {
    await using directory = await testdir();
    const authored = '# Preserve this file\n<!-- >>> gspot managed >>> -->\nUnclosed instructions.\n';
    await createFileTree(directory.path, {
        'gspot.toml': buildPolicy(['bash']),
        'AGENTS.md': authored,
        'entry.sh': 'echo example\n',
    });
    const refused = await runGspot(directory.path, ['apply']);
    expect(refused.code, refused.stdout + refused.stderr).toBe(2);
    expect(refused.stdout + refused.stderr).toContain('incomplete or repeated');
    expect(readFileSync(join(directory.path, 'AGENTS.md'), 'utf8')).toBe(authored);
    expect(existsSync(join(directory.path, '.gspot/config/shellcheckrc'))).toBe(false);
    writeFileSync(join(directory.path, 'AGENTS.md'), `${authored}<!-- <<< gspot managed <<< -->\n`);
    const corrected = await runGspot(directory.path, ['apply']);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    expect(existsSync(join(directory.path, '.gspot/config/shellcheckrc'))).toBe(true);
});

// A lock that a crash left behind, and one a live process holds: apply stops and names the lock to delete.
test.each([
    ['empty', () => ''],
    ['held by a live process', (pid: number) => `${String(pid)}:held`],
    ...(process.platform === 'win32' ? [] : [['held by process 1', () => '1:held'] as const]),
] as const)('apply refuses a writer lock %s and names it', async (_, holder) => {
    await using directory = await testdir();
    // A process that outlives the run stands for the holder; disposing it kills it.
    const command = [process.execPath, '-e', 'await Bun.sleep(60_000)'];
    const prepared = prepareTestCommand(command, { cwd: directory.path }, 'live writer lock holder');
    await using sleeper = Bun.spawn(command, { cwd: directory.path, timeout: prepared.options.timeoutMs });
    await createFileTree(directory.path, {
        'gspot.toml': buildPolicy([], { tables: '[agent_rules]\nenabled = false\n' }),
        '.gspot/state/writer.lock': holder(sleeper.pid),
    });
    const refused = await runGspot(directory.path, ['apply']);
    expect(refused.code, refused.stdout + refused.stderr).toBe(2);
    expect(refused.stderr).toContain('.gspot/state/writer.lock');
    expect(readFileSync(join(directory.path, '.gspot/state/writer.lock'), 'utf8')).toBe(holder(sleeper.pid));
});

test('apply --json prints one error object when it refuses an edited generated file', async () => {
    await using directory = await testdir();
    await createFileTree(directory.path, {
        'gspot.toml': buildPolicy(['bash'], { tables: '[agent_rules]\nenabled = false\n' }),
        'entry.sh': 'echo example\n',
    });
    const applied = await runGspot(directory.path, ['apply']);
    expect(applied.code, applied.stdout + applied.stderr).toBe(0);
    const generated = join(directory.path, '.gspot/config/shellcheckrc');
    chmodSync(generated, 0o644);
    writeFileSync(generated, `${readFileSync(generated, 'utf8')}# Edited.\n`);
    writeFileSync(
        join(directory.path, 'gspot.toml'),
        buildPolicy(['bash'], { tables: '[agent_rules]\nenabled = false\n[limits]\nfile_lines = 100\n' }),
    );
    const refused = await runGspot(directory.path, ['apply', '--json']);
    expect(refused.code, refused.stdout + refused.stderr).toBe(2);
    const failure = JSON.parse(refused.stdout) as CommandFailureJson;
    expect(Object.keys(failure)).toStrictEqual(['error', 'message']);
    expect(failure.message).toContain('shellcheckrc');
});

test('apply refuses to move a generated file to a spelling that differs only by letter case', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy([], { tables: '[agent_rules]\nfolder = "docs/rules"\n' }),
    });
    const first = await runGspot(sandbox.path, ['apply']);
    expect(first.code, first.stdout + first.stderr).toBe(0);
    const guide = join(sandbox.path, 'docs/rules/general/engineering/agent/WORKING.md');
    const written = readFileSync(guide, 'utf8');
    writeFileSync(
        join(sandbox.path, 'gspot.toml'),
        buildPolicy([], { tables: '[agent_rules]\nfolder = "docs/Rules"\n' }),
    );
    const renamed = await runGspot(sandbox.path, ['apply']);
    expect(renamed.code, renamed.stdout + renamed.stderr).toBe(2);
    expect(renamed.stderr).toContain('differs only by letter case');
    expect(readdirSync(join(sandbox.path, 'docs'))).toStrictEqual(['rules']);
    expect(readFileSync(guide, 'utf8')).toBe(written);
});

test('apply --dry-run reports a changed file, a stray, a conflict, and an edited block, and writes nothing', async () => {
    await using directory = await testdir();
    await createFileTree(directory.path, {
        'gspot.toml': buildPolicy(['bash', 'markdown']),
        'entry.sh': 'echo example\n',
        'README.md': '# Example\n',
    });
    const applied = await runGspot(directory.path, ['apply']);
    expect(applied.code, applied.stdout + applied.stderr).toBe(0);
    const edit = (path: string, text: (current: string) => string): void => {
        const full = join(directory.path, path);
        chmodSync(full, 0o644);
        writeFileSync(full, text(readFileSync(full, 'utf8')));
    };
    edit('.gspot/config/shellcheckrc', (current) => `${current}# Edited.\n`);
    edit('.gspot/package.json', (current) => `<<<<<<< ours\n${current}=======\n>>>>>>> theirs\n`);
    edit('AGENTS.md', (current) =>
        current.replace('<!-- <<< gspot managed <<< -->', 'Edited inside.\n<!-- <<< gspot managed <<< -->'),
    );
    unlinkSync(join(directory.path, 'README.md'));
    writeFileSync(join(directory.path, 'settings.json'), '{}\n');
    writeFileSync(join(directory.path, 'gspot.toml'), buildPolicy(['bash']));
    const before = readTree(directory.path);
    const preview = await runGspot(directory.path, ['apply', '--dry-run', '--json']);
    expect(preview.code, preview.stdout + preview.stderr).toBe(0);
    const { drift } = JSON.parse(preview.stdout) as ApplyPreviewJson;
    expect(drift).toContainEqual(
        containing({
            path: '.gspot/config/shellcheckrc',
            kind: 'changed',
            diff: expect.stringContaining('-# Edited.') as string,
        }),
    );
    expect(drift).toContainEqual(containing({ path: '.gspot/package.json', kind: 'conflict' }));
    expect(drift).toContainEqual(
        containing({ path: 'AGENTS.md', kind: 'changed', diff: expect.stringContaining('-Edited inside.') as string }),
    );
    expect(drift).toContainEqual(containing({ path: '.gspot/config/markdownlint.jsonc', kind: 'stray' }));
    expect(readTree(directory.path)).toStrictEqual(before);
});
