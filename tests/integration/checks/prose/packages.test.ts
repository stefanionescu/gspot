import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { createFileTree } from 'testdirs';
import { isOnDisk } from '#tests/setup/files.ts';
import { spawnGspot } from '#tests/setup/run-gspot.ts';
import type { RunReport } from '#cli/types/runs/check.ts';
import { GOOGLE_TERMS_FILE } from '#tests/data/checks/prose.ts';
import { rm, chmod, readFile, writeFile } from 'node:fs/promises';
import { updateSandbox, shareProseSandbox } from '#tests/setup/sandbox.ts';

const installedSandbox = shareProseSandbox();

/**
 * Add a file of your own and an authored file inside the Google style to the installed sandbox.
 * @param sandbox the installed sandbox
 * @returns the change, undone when disposed
 */
function addAuthoredFiles(sandbox: ReturnType<typeof installedSandbox>): ReturnType<typeof updateSandbox> {
    return updateSandbox(sandbox, {
        check: '',
        files: {
            'authored.txt': 'keep\n',
            '.gspot/configurations/general/prose/styles/Google/legacy.yml': 'authored legacy bytes\n',
        },
    });
}

test('gspot install restores deleted Vale dictionaries, and prose/vale passes again', async () => {
    const { root: sandbox, environment } = installedSandbox();
    await rm(join(sandbox, '.gspot', 'vale', 'config', 'dictionaries'), {
        recursive: true,
    });
    const broken = await spawnGspot(sandbox, ['check', '--only', 'prose/vale', '--json'], environment);
    expect(broken.code, 'a Vale that cannot run is an error, never a pass').toBe(2);
    expect((JSON.parse(broken.stdout) as RunReport).checks).toMatchObject([{ check: 'prose/vale', status: 'missing' }]);
    // The install command that the finding names gets the missing dictionaries again.
    const installed = await spawnGspot(sandbox, ['install'], environment);
    expect(installed.code, installed.stdout + installed.stderr).toBe(0);
    const corrected = await spawnGspot(sandbox, ['check', '--only', 'prose/vale', '--json'], environment);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    expect((JSON.parse(corrected.stdout) as RunReport).checks).toMatchObject([
        { check: 'prose/vale', status: 'passed', findings: [] },
    ]);
});
test('Vale package install deletes a package gspot no longer ships', async () => {
    const sandbox = installedSandbox();
    await using _change = await addAuthoredFiles(sandbox);
    await createFileTree(sandbox.root, { '.gspot/vale/Retired/terms.yml': 'old rule\n' });
    const installed = await spawnGspot(sandbox.root, ['install'], sandbox.environment);
    expect(installed.code, installed.stdout + installed.stderr).toBe(0);
    expect(await isOnDisk(join(sandbox.root, '.gspot/vale/Retired'))).toBe(false);
    expect(await isOnDisk(join(sandbox.root, GOOGLE_TERMS_FILE))).toBe(true);
    expect(await readFile(join(sandbox.root, 'authored.txt'), 'utf8')).toBe('keep\n');
    expect(
        await readFile(join(sandbox.root, '.gspot/configurations/general/prose/styles/Google/legacy.yml'), 'utf8'),
    ).toBe('authored legacy bytes\n');
});

test('Vale package install replaces an edited package and keeps your files', async () => {
    const sandbox = installedSandbox();
    await using _change = await addAuthoredFiles(sandbox);
    const original = await readFile(join(sandbox.root, GOOGLE_TERMS_FILE));
    await chmod(join(sandbox.root, GOOGLE_TERMS_FILE), 0o644);
    await writeFile(join(sandbox.root, GOOGLE_TERMS_FILE), 'edited\n');
    const installed = await spawnGspot(sandbox.root, ['install'], sandbox.environment);
    expect(installed.code, installed.stdout + installed.stderr).toBe(0);
    expect(await readFile(join(sandbox.root, GOOGLE_TERMS_FILE))).toStrictEqual(original);
    expect(await readFile(join(sandbox.root, 'authored.txt'), 'utf8')).toBe('keep\n');
    expect(
        await readFile(join(sandbox.root, '.gspot/configurations/general/prose/styles/Google/legacy.yml'), 'utf8'),
    ).toBe('authored legacy bytes\n');
});
