// apply preserves later edits and refuses before it writes when authored input is malformed.
import { run } from '#tests/support/cli/command.ts';
import { commitAll } from '#tests/support/cli/git.ts';
import { initArgs } from '#tests/support/cli/init.ts';
import { expect, test } from 'bun:test';
import { chmodSync, existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createFileTree, testdir } from 'testdirs';

const INIT = initArgs(['bash']);

test('apply and uninstall preserve later edits and unowned content while restoring a takeover original', async () => {
    await using directory = await testdir();
    const original = 'disable=SC2086\n';
    await createFileTree(directory.path, { '.shellcheckrc': original, 'entry.sh': 'echo example\n' });
    chmodSync(join(directory.path, '.shellcheckrc'), 0o640);
    commitAll(directory.path);
    const initialized = await run(directory.path, INIT);
    expect(initialized.code, initialized.stdout + initialized.stderr).toBe(0);
    const generated = join(directory.path, '.gspot/config/shellcheckrc');
    const edited = `${readFileSync(generated, 'utf8')}# Authored after installation.\n`;
    chmodSync(generated, 0o644);
    writeFileSync(generated, edited);
    writeFileSync(join(directory.path, '.gspot/authored.txt'), 'Preserve this file.\n');
    const applied = await run(directory.path, ['apply']);
    expect(applied.code, applied.stdout + applied.stderr).toBe(2);
    expect(applied.stderr).toContain('version pin was not changed');
    expect(readFileSync(generated, 'utf8')).toBe(edited);
    const removed = await run(directory.path, ['uninstall', '--yes']);
    expect(removed.code, removed.stdout + removed.stderr).toBe(0);
    expect(removed.stdout).toContain('preserved edited or unowned .gspot/config/shellcheckrc');
    expect(readFileSync(generated, 'utf8')).toBe(edited);
    expect(readFileSync(join(directory.path, '.gspot/authored.txt'), 'utf8')).toBe('Preserve this file.\n');
    expect(readFileSync(join(directory.path, '.shellcheckrc'), 'utf8')).toBe(original);
    expect(statSync(join(directory.path, '.shellcheckrc')).mode & 0o777).toBe(0o640);
    expect(readFileSync(join(directory.path, '.gitignore'), 'utf8')).toContain('.gspot/state/');
});

test('a generated proposal cannot overwrite lifecycle recovery data', async () => {
    await using directory = await testdir();
    await createFileTree(directory.path, {
        'gspot.toml': 'version = 1\nconfigurations = ["bash"]\n[rules]\ndirectory = ".gspot/state/recovery"\n',
        '.gspot/state/recovery/authored.txt': 'preserve recovery\n',
    });
    const refused = await run(directory.path, ['apply']);
    expect(refused.code, refused.stdout + refused.stderr).toBe(2);
    expect(refused.stdout + refused.stderr).toContain('Lifecycle metadata is not a generated target');
    expect(readFileSync(join(directory.path, '.gspot/state/recovery/authored.txt'), 'utf8')).toBe(
        'preserve recovery\n',
    );
    expect(existsSync(join(directory.path, '.gspot/config/shellcheckrc'))).toBe(false);
});

test('apply previews missing outputs without writing and rejects obsolete mutation flags', async () => {
    await using directory = await testdir();
    const policy = 'version = 1\nconfigurations = ["bash"]\n[rules]\ninstall = false\n';
    await createFileTree(directory.path, { 'gspot.toml': policy, 'entry.sh': 'echo example\n' });
    const preview = await run(directory.path, ['apply', '--dry-run', '--json']);
    expect(preview.code, preview.stdout + preview.stderr).toBe(0);
    const result = JSON.parse(preview.stdout) as { isDryRun: boolean; drift: { path: string; kind: string }[] };
    expect(result.isDryRun).toBe(true);
    expect(result.drift).toContainEqual(
        expect.objectContaining({ path: '.gspot/config/shellcheckrc', kind: 'missing' }),
    );
    expect(readFileSync(join(directory.path, 'gspot.toml'), 'utf8')).toBe(policy);
    expect(existsSync(join(directory.path, '.gspot'))).toBe(false);
});

test('malformed authored blocks refuse apply before generated files change', async () => {
    await using directory = await testdir();
    const authored = '# Preserve this file\n<!-- >>> gspot managed >>> -->\nUnclosed instructions.\n';
    await createFileTree(directory.path, {
        'gspot.toml': 'version = 1\nconfigurations = ["bash"]\n',
        'AGENTS.md': authored,
        'entry.sh': 'echo example\n',
    });
    const refused = await run(directory.path, ['apply']);
    expect(refused.code, refused.stdout + refused.stderr).toBe(2);
    expect(refused.stdout + refused.stderr).toContain('incomplete or repeated');
    expect(readFileSync(join(directory.path, 'AGENTS.md'), 'utf8')).toBe(authored);
    expect(existsSync(join(directory.path, '.gspot/config/shellcheckrc'))).toBe(false);
    writeFileSync(join(directory.path, 'AGENTS.md'), `${authored}<!-- <<< gspot managed <<< -->\n`);
    const corrected = await run(directory.path, ['apply']);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    expect(existsSync(join(directory.path, '.gspot/config/shellcheckrc'))).toBe(true);
});

test('malformed shared YAML refuses apply before any generated configuration is published', async () => {
    await using directory = await testdir();
    const authored = 'pre-commit: [unfinished\n';
    await createFileTree(directory.path, {
        'gspot.toml': 'version = 1\nconfigurations = ["bash"]\n[hooks]\ntool = "lefthook"\n[rules]\ninstall = false\n',
        'lefthook.yml': authored,
        'entry.sh': 'echo example\n',
    });
    const refused = await run(directory.path, ['apply']);
    expect(refused.code, refused.stdout + refused.stderr).toBe(2);
    expect(refused.stdout + refused.stderr).toContain('valid YAML mapping');
    expect(readFileSync(join(directory.path, 'lefthook.yml'), 'utf8')).toBe(authored);
    expect(existsSync(join(directory.path, '.gspot/config/shellcheckrc'))).toBe(false);
    expect(existsSync(join(directory.path, '.gitignore'))).toBe(false);
    writeFileSync(join(directory.path, 'lefthook.yml'), '# Authored hook settings\npre-commit:\n  parallel: true\n');
    const corrected = await run(directory.path, ['apply']);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    expect(existsSync(join(directory.path, '.gspot/config/shellcheckrc'))).toBe(true);
    expect(readFileSync(join(directory.path, 'lefthook.yml'), 'utf8')).toContain('parallel: true');
});
