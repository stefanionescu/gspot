import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { createFileTree } from 'testdirs';
import { isOnDisk } from '#tests/setup/system/files.ts';
import { GSPOT_PATHS } from '#cli/config/gspot-folder.ts';
import { rm, chmod, readFile, writeFile } from 'node:fs/promises';
import { shareProseSandbox } from '#tests/setup/sandboxes/create.ts';
import { changeAppliedSandbox } from '#tests/setup/sandboxes/changes.ts';
import { spawnGspot, parseCheckReport } from '#tests/setup/cli/commands.ts';
import { GOOGLE_TERMS_PATH, AUTHORED_STYLE_PATH, AUTHORED_VALE_FILES } from '#tests/config/integration/install/vale.ts';

const installedSandbox = shareProseSandbox();

test('gspot install restores deleted Vale dictionaries, and prose/vale passes again', async () => {
    const { root, environment } = installedSandbox();
    await rm(join(root, GSPOT_PATHS.valePackages, 'config', 'dictionaries'), { recursive: true });
    const broken = parseCheckReport(await spawnGspot(root, ['check', '--only', 'prose/vale', '--json'], environment));
    expect(broken.code, 'a Vale that cannot run is an error, never a pass').toBe(2);
    expect(broken.report.checks).toMatchObject([{ check: 'prose/vale', status: 'missing' }]);
    // The install command that the finding names gets the missing dictionaries again.
    const installed = await spawnGspot(root, ['install'], environment);
    expect(installed.code, installed.stdout + installed.stderr).toBe(0);
    const corrected = parseCheckReport(
        await spawnGspot(root, ['check', '--only', 'prose/vale', '--json'], environment),
    );
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    expect(corrected.report.checks).toMatchObject([{ check: 'prose/vale', status: 'passed', findings: [] }]);
});

test('Vale package install deletes a package gspot no longer ships', async () => {
    const sandbox = installedSandbox();
    await using _change = await changeAppliedSandbox(sandbox, AUTHORED_VALE_FILES);
    await createFileTree(sandbox.root, { [`${GSPOT_PATHS.valePackages}/Retired/terms.yml`]: 'old rule\n' });
    const installed = await spawnGspot(sandbox.root, ['install'], sandbox.environment);
    expect(installed.code, installed.stdout + installed.stderr).toBe(0);
    expect(await isOnDisk(join(sandbox.root, `${GSPOT_PATHS.valePackages}/Retired`))).toBe(false);
    expect(await isOnDisk(join(sandbox.root, GOOGLE_TERMS_PATH))).toBe(true);
    await assertAuthoredFilesKept(sandbox.root);
});

test('Vale package install replaces an edited package and keeps your files', async () => {
    const sandbox = installedSandbox();
    await using _change = await changeAppliedSandbox(sandbox, AUTHORED_VALE_FILES);
    const original = await readFile(join(sandbox.root, GOOGLE_TERMS_PATH));
    await chmod(join(sandbox.root, GOOGLE_TERMS_PATH), 0o644);
    await writeFile(join(sandbox.root, GOOGLE_TERMS_PATH), 'edited\n');
    const installed = await spawnGspot(sandbox.root, ['install'], sandbox.environment);
    expect(installed.code, installed.stdout + installed.stderr).toBe(0);
    expect(await readFile(join(sandbox.root, GOOGLE_TERMS_PATH))).toStrictEqual(original);
    await assertAuthoredFilesKept(sandbox.root);
});

/** Assert the authored files kept by a Vale package install. */
async function assertAuthoredFilesKept(root: string): Promise<void> {
    expect(await readFile(join(root, 'authored.txt'), 'utf8')).toBe('keep\n');
    expect(await readFile(join(root, AUTHORED_STYLE_PATH), 'utf8')).toBe('authored legacy bytes\n');
}
