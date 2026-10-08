// apply preserves later edits and refuses before it writes when authored input is malformed.
import * as fs from 'node:fs';
import { join } from 'node:path';
import { writeFileSync } from 'node:fs';
import { test, spyOn, expect } from 'bun:test';
import { commitAll } from '#tests/harness/git.ts';
import { runGspot } from '#tests/harness/gspot.ts';
import { testdir, createFileTree } from 'testdirs';
import { applyCommand } from '#cli/commands/public.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { buildInitArguments } from '#tests/harness/init.ts';
import { prepareTestCommand } from '#tests/harness/command.ts';
import type { CommandFailureJson } from '#cli/types/terminal.ts';
import type { ApplyPlanJson } from '#cli/types/commands/apply.ts';
import { readTree, pathExists } from '#tests/harness/preservation.ts';
import { containing, textContaining } from '#tests/harness/expectations.ts';
import { stat, chmod, unlink, readdir, readFile, writeFile } from 'node:fs/promises';

const INIT = buildInitArguments(['bash']);

test('apply preserves a policy replaced after session opening and publishes no generated outputs', async () => {
    await using directory = await testdir();
    const original = buildPolicy(['bash'], { tables: '[agent_rules]\nenabled = false\n' });
    const replacement = `${original}[scope.worker]\nconfigurations = ["python"]\n`;
    await createFileTree(directory.path, { 'gspot.toml': original, 'entry.sh': 'echo example\n' });
    const policyPath = join(directory.path, 'gspot.toml');
    const originalPolicyAttributes = await stat(policyPath);
    const read = fs.readFileSync;
    let replaced = false;
    const observer = spyOn(fs, 'readFileSync').mockImplementation(((path, options) => {
        const bytes = read(path, options);
        if (path === policyPath && !replaced) {
            replaced = true;
            // eslint-disable-next-line n/no-sync -- reason: The native synchronous read spy replaces the policy before that read returns.
            writeFileSync(policyPath, replacement);
        }
        return bytes;
    }) as typeof read);

    try {
        const result = await applyCommand({ cwd: directory.path, isDryRun: false }).catch((error: unknown) => error);
        expect(result).toMatchObject({
            code: 'policy',
            message: 'The gspot.toml file changed while gspot was running. Run the command again.',
        });
    } finally {
        observer.mockRestore();
    }
    expect(replaced).toBe(true);
    expect(await readFile(policyPath, 'utf8')).toBe(replacement);
    const policyAttributes = await stat(policyPath);
    expect(policyAttributes.mode).toBe(originalPolicyAttributes.mode);
    expect(await pathExists(join(directory.path, '.gspot/version'))).toBe(false);
    expect(await pathExists(join(directory.path, '.gspot/config/shellcheckrc'))).toBe(false);
    expect(await readFile(join(directory.path, 'entry.sh'), 'utf8')).toBe('echo example\n');
});

test('init deletes a replaced file, and apply exits 2 while preserving later edits and unowned content', async () => {
    await using directory = await testdir();
    await createFileTree(directory.path, { '.shellcheckrc': 'disable=SC2086\n', 'entry.sh': 'echo example\n' });
    commitAll(directory.path);
    const initialized = await runGspot(directory.path, INIT);
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
    expect(applied.stderr).toContain('The version pin is unchanged.');
    expect(await readFile(generated, 'utf8')).toBe(edited);
    expect(await readFile(join(directory.path, '.gspot/authored.txt'), 'utf8')).toBe('Preserve this file.\n');
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
    expect(await readFile(join(directory.path, '.gspot/state/notes/authored.txt'), 'utf8')).toBe('preserve notes\n');
    expect(await pathExists(join(directory.path, '.gspot/config/shellcheckrc'))).toBe(false);
});

test('apply previews missing outputs without writing', async () => {
    await using directory = await testdir();
    const policy = buildPolicy(['bash'], { tables: '[agent_rules]\nenabled = false\n' });
    await createFileTree(directory.path, { 'gspot.toml': policy, 'entry.sh': 'echo example\n' });
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
    const result = JSON.parse(preview.stdout) as ApplyPlanJson;
    expect(result.dryRun).toBe(true);
    expect(result.drift).toContainEqual(containing({ path: '.gspot/config/shellcheckrc', kind: 'missing' }));
    expect(await readFile(join(directory.path, 'gspot.toml'), 'utf8')).toBe(policy);
    expect(await pathExists(join(directory.path, '.gspot'))).toBe(false);
    expect(await readTree(directory.path)).toStrictEqual(before);
});

test.each([false, true])(
    'apply previews only a changed version pin (changed: %s) without writing',
    async (isChanged) => {
        await using directory = await testdir();
        await createFileTree(directory.path, {
            'gspot.toml': buildPolicy([], { tables: 'runner = "mise"\n[agent_rules]\nenabled = false\n' }),
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
        expect(preview.stdout).toBe(`${banner}every generated file is up to date\n`);
        expect(await readTree(directory.path)).toStrictEqual(before);
        const structured = await runGspot(directory.path, ['apply', '--dry-run', '--json']);
        expect(structured.code, structured.stdout + structured.stderr).toBe(0);
        expect(structured.stderr).toBe('');
        const result = JSON.parse(structured.stdout) as ApplyPlanJson;
        expect(result.pin).toStrictEqual({ from: isChanged ? '0.0.0' : version, to: version });
        expect(result.drift).toStrictEqual([]);
        expect(await readTree(directory.path)).toStrictEqual(before);
    },
);

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
    expect(await readFile(join(directory.path, 'AGENTS.md'), 'utf8')).toBe(authored);
    expect(await pathExists(join(directory.path, '.gspot/config/shellcheckrc'))).toBe(false);
});

// A claim that a crash left behind, and one a live process holds: apply stops and names the claim to delete.
test.each([
    ['empty', ''],
    ['held by a live process', undefined],
    ...(process.platform === 'win32' ? [] : [['held by process 1', '1:held'] as const]),
] as const)('apply refuses a writer claim %s and names it', async (_, holder) => {
    await using directory = await testdir();
    // A process that outlives the run stands for the holder; disposing it kills it.
    const command = [process.execPath, '-e', 'await Bun.sleep(60_000)'];
    await using sleeper =
        holder === undefined
            ? Bun.spawn(command, {
                  cwd: directory.path,
                  timeout: prepareTestCommand(command, { cwd: directory.path }, 'live writer claim holder').options
                      .timeoutMs,
              })
            : undefined;
    const claim = holder ?? `${String(sleeper!.pid)}:held`;
    await createFileTree(directory.path, {
        'gspot.toml': buildPolicy([], { tables: '[agent_rules]\nenabled = false\n' }),
        '.gspot/state/writer.lock': claim,
    });
    const refused = await runGspot(directory.path, ['apply']);
    expect(refused.code, refused.stdout + refused.stderr).toBe(2);
    expect(refused.stderr).toContain('.gspot/state/writer.lock');
    expect(await readFile(join(directory.path, '.gspot/state/writer.lock'), 'utf8')).toBe(claim);
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
    await chmod(generated, 0o644);
    await writeFile(generated, `${await readFile(generated, 'utf8')}# Edited.\n`);
    await writeFile(
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
    const written = await readFile(guide, 'utf8');
    await writeFile(
        join(sandbox.path, 'gspot.toml'),
        buildPolicy([], { tables: '[agent_rules]\nfolder = "docs/Rules"\n' }),
    );
    const renamed = await runGspot(sandbox.path, ['apply']);
    expect(renamed.code, renamed.stdout + renamed.stderr).toBe(2);
    expect(renamed.stderr).toContain('differs only by letter case');
    expect(await readdir(join(sandbox.path, 'docs'))).toStrictEqual(['rules']);
    expect(await readFile(guide, 'utf8')).toBe(written);
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
    const edit = async (path: string, text: (current: string) => string): Promise<void> => {
        const full = join(directory.path, path);
        await chmod(full, 0o644);
        await writeFile(full, text(await readFile(full, 'utf8')));
    };
    await edit('.gspot/config/shellcheckrc', (current) => `${current}# Edited.\n`);
    await edit('.gspot/package.json', (current) => `<<<<<<< ours\n${current}=======\n>>>>>>> theirs\n`);
    await edit('AGENTS.md', (current) =>
        current.replace('<!-- <<< gspot managed <<< -->', 'Edited inside.\n<!-- <<< gspot managed <<< -->'),
    );
    await unlink(join(directory.path, 'README.md'));
    await writeFile(join(directory.path, 'settings.json'), '{}\n');
    await writeFile(join(directory.path, 'gspot.toml'), buildPolicy(['bash']));
    const before = await readTree(directory.path);
    const preview = await runGspot(directory.path, ['apply', '--dry-run', '--json']);
    expect(preview.code, preview.stdout + preview.stderr).toBe(0);
    const { drift } = JSON.parse(preview.stdout) as ApplyPlanJson;
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
