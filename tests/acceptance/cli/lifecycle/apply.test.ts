// apply preserves later edits and refuses before it writes when authored input is malformed.
import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { commitAll } from '#tests/harness/cli/git.ts';
import { policyOf } from '#tests/harness/cli/policy.ts';
import { initArgs } from '#tests/harness/planted/init.ts';
import { spawnGspot } from '#tests/harness/cli/command.ts';
import { containing } from '#tests/harness/expectations.ts';
import { chmodSync, existsSync, readFileSync, writeFileSync } from 'node:fs';

const INIT = initArgs(['bash']);

test('init deletes a replaced file, and apply preserves later edits and unowned content', async () => {
    await using directory = await testdir();
    await createFileTree(directory.path, { '.shellcheckrc': 'disable=SC2086\n', 'entry.sh': 'echo example\n' });
    commitAll(directory.path);
    const initialized = await spawnGspot(directory.path, INIT);
    expect(initialized.code, initialized.stdout + initialized.stderr).toBe(0);
    expect(existsSync(join(directory.path, '.shellcheckrc'))).toBe(false);
    const generated = join(directory.path, '.gspot/config/shellcheckrc');
    const edited = `${readFileSync(generated, 'utf8')}# Authored after installation.\n`;
    chmodSync(generated, 0o644);
    writeFileSync(generated, edited);
    writeFileSync(join(directory.path, '.gspot/authored.txt'), 'Preserve this file.\n');
    const applied = await spawnGspot(directory.path, ['apply']);
    expect(applied.code, applied.stdout + applied.stderr).toBe(2);
    expect(applied.stderr).toContain('version pin was not changed');
    expect(readFileSync(generated, 'utf8')).toBe(edited);
    expect(readFileSync(join(directory.path, '.gspot/authored.txt'), 'utf8')).toBe('Preserve this file.\n');
});

test('a generated plan cannot write into the lifecycle state folder', async () => {
    await using directory = await testdir();
    await createFileTree(directory.path, {
        'gspot.toml': policyOf(['bash'], '[guides]\ndirectory = ".gspot/state/notes"\n'),
        '.gspot/state/notes/authored.txt': 'preserve notes\n',
    });
    const refused = await spawnGspot(directory.path, ['apply']);
    expect(refused.code, refused.stdout + refused.stderr).toBe(2);
    expect(refused.stdout + refused.stderr).toContain('Lifecycle metadata is not a generated target');
    expect(readFileSync(join(directory.path, '.gspot/state/notes/authored.txt'), 'utf8')).toBe('preserve notes\n');
    expect(existsSync(join(directory.path, '.gspot/config/shellcheckrc'))).toBe(false);
});

test('apply previews missing outputs without writing and rejects obsolete mutation flags', async () => {
    await using directory = await testdir();
    const policy = policyOf(['bash'], '[guides]\ninstall = false\n');
    await createFileTree(directory.path, { 'gspot.toml': policy, 'entry.sh': 'echo example\n' });
    const preview = await spawnGspot(directory.path, ['apply', '--dry-run', '--json']);
    expect(preview.code, preview.stdout + preview.stderr).toBe(0);
    const result = JSON.parse(preview.stdout) as { isDryRun: boolean; drift: { path: string; kind: string }[] };
    expect(result.isDryRun).toBe(true);
    expect(result.drift).toContainEqual(containing({ path: '.gspot/config/shellcheckrc', kind: 'missing' }));
    expect(readFileSync(join(directory.path, 'gspot.toml'), 'utf8')).toBe(policy);
    expect(existsSync(join(directory.path, '.gspot'))).toBe(false);
});

test('malformed authored blocks refuse apply before generated files change', async () => {
    await using directory = await testdir();
    const authored = '# Preserve this file\n<!-- >>> gspot managed >>> -->\nUnclosed instructions.\n';
    await createFileTree(directory.path, {
        'gspot.toml': policyOf(['bash']),
        'AGENTS.md': authored,
        'entry.sh': 'echo example\n',
    });
    const refused = await spawnGspot(directory.path, ['apply']);
    expect(refused.code, refused.stdout + refused.stderr).toBe(2);
    expect(refused.stdout + refused.stderr).toContain('incomplete or repeated');
    expect(readFileSync(join(directory.path, 'AGENTS.md'), 'utf8')).toBe(authored);
    expect(existsSync(join(directory.path, '.gspot/config/shellcheckrc'))).toBe(false);
    writeFileSync(join(directory.path, 'AGENTS.md'), `${authored}<!-- <<< gspot managed <<< -->\n`);
    const corrected = await spawnGspot(directory.path, ['apply']);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    expect(existsSync(join(directory.path, '.gspot/config/shellcheckrc'))).toBe(true);
});
