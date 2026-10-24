import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { readFile, writeFile } from 'node:fs/promises';
import { isOnDisk } from '#tests/setup/system/files.ts';
import { runCommand } from '#tests/setup/system/processes.ts';
import { commitAll, runGitStep } from '#tests/setup/system/git.ts';
import { findManifestTarget } from '#tests/setup/cli/generated-files.ts';
import { spawnGspot, buildInitArguments } from '#tests/setup/cli/commands.ts';
import { SYNCPACK_FILES } from '#tests/config/integration/checks/general/dependencies.ts';

// eslint-disable-next-line gspot/no-trivial-functions -- reason: The rule in the plugin source does not report it.
async function initAtLevelAll(root: string): Promise<void> {
    const initialized = await spawnGspot(root, [...buildInitArguments([]), '--no-configurations', '--level', 'all']);
    expect(initialized.code, initialized.stdout + initialized.stderr).toBe(0);
}

test.each([...SYNCPACK_FILES])(
    'init replaces your Syncpack file $file and keeps syncpack.config.cts and .mts',
    async ({ file, source }) => {
        await using sandbox = await testdir();
        runGitStep(sandbox.path, ['init', '--quiet']);
        const rootPackage = '{"name":"root","private":true,"dependencies":{"fixture":"1.0.0"}}\n';
        await createFileTree(sandbox.path, {
            [file]: source,
            'package.json': rootPackage,
            'packages/app/package.json': '{"name":"app","private":true,"dependencies":{"fixture":"2.0.0"}}\n',
            'syncpack.config.cts': 'module.exports = {};\n',
            'syncpack.config.mts': 'export default {};\n',
        });
        commitAll(sandbox.path);
        await initAtLevelAll(sandbox.path);
        expect(await isOnDisk(join(sandbox.path, file))).toBe(false);
        expect(await readFile(join(sandbox.path, 'syncpack.config.cts'), 'utf8')).toBe('module.exports = {};\n');
        expect(await readFile(join(sandbox.path, 'syncpack.config.mts'), 'utf8')).toBe('export default {};\n');
    },
);

test('the generated Syncpack config reports a version mismatch and passes once the versions match', async () => {
    await using sandbox = await testdir();
    runGitStep(sandbox.path, ['init', '--quiet']);
    const rootPackage = '{"name":"root","private":true,"dependencies":{"fixture":"1.0.0"}}\n';
    await createFileTree(sandbox.path, {
        'package.json': rootPackage,
        'packages/app/package.json': '{"name":"app","private":true,"dependencies":{"fixture":"2.0.0"}}\n',
    });
    commitAll(sandbox.path);
    await initAtLevelAll(sandbox.path);
    const command = ['syncpack', 'lint', '--config', findManifestTarget('dependencies', 'syncpack.json'), '--no-ansi'];
    const after = await runCommand(command, { cwd: sandbox.path });
    expect(after.code, after.stdout + after.stderr).toBe(1);
    expect(after.stderr).toContain('fixture');
    expect(after.stderr).toContain('SameRangeMismatch');
    await writeFile(join(sandbox.path, 'packages/app/package.json'), rootPackage.replace('"root"', '"app"'));
    const corrected = await runCommand(command, { cwd: sandbox.path });
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
});
