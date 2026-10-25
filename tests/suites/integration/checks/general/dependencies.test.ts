import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { readFile, writeFile } from 'node:fs/promises';
import { isOnDisk } from '#tests/setup/system/files.ts';
import { runCommand } from '#tests/setup/system/processes.ts';
import { findManifestTarget } from '#tests/setup/cli/generated-files.ts';
import { commitAll, createGitSandbox } from '#tests/setup/system/git.ts';
import { spawnGspot, buildInitArguments } from '#tests/setup/cli/commands.ts';
import { SYNCPACK_FILES, SYNCPACK_PACKAGE_FILES } from '#tests/config/integration/checks/general/dependencies.ts';

test.each([...SYNCPACK_FILES])(
    'init replaces the authored Syncpack file $file and keeps syncpack.config.cts and .mts',
    async ({ file, source }) => {
        await using sandbox = await createGitSandbox({
            ...SYNCPACK_PACKAGE_FILES,
            [file]: source,
            'syncpack.config.cts': 'module.exports = {};\n',
            'syncpack.config.mts': 'export default {};\n',
        });
        commitAll(sandbox.path);
        const initialized = await spawnGspot(sandbox.path, [
            ...buildInitArguments([]),
            '--no-configurations',
            '--level',
            'all',
        ]);
        expect(initialized.code, initialized.stdout + initialized.stderr).toBe(0);
        expect(await isOnDisk(join(sandbox.path, file))).toBe(false);
        expect(await readFile(join(sandbox.path, 'syncpack.config.cts'), 'utf8')).toBe('module.exports = {};\n');
        expect(await readFile(join(sandbox.path, 'syncpack.config.mts'), 'utf8')).toBe('export default {};\n');
    },
);

test('the generated Syncpack config reports a version mismatch and passes once the versions match', async () => {
    await using sandbox = await createGitSandbox(SYNCPACK_PACKAGE_FILES);
    commitAll(sandbox.path);
    const initialized = await spawnGspot(sandbox.path, [
        ...buildInitArguments([]),
        '--no-configurations',
        '--level',
        'all',
    ]);
    expect(initialized.code, initialized.stdout + initialized.stderr).toBe(0);
    const command = ['syncpack', 'lint', '--config', findManifestTarget('dependencies', 'syncpack.json'), '--no-ansi'];
    const mismatched = await runCommand(command, { cwd: sandbox.path });
    expect(mismatched.code, mismatched.stdout + mismatched.stderr).toBe(1);
    expect(mismatched.stderr).toContain('shared-library');
    expect(mismatched.stderr).toContain('SameRangeMismatch');
    await writeFile(
        join(sandbox.path, 'packages/app/package.json'),
        SYNCPACK_PACKAGE_FILES['package.json'].replace('"root"', '"app"'),
    );
    const corrected = await runCommand(command, { cwd: sandbox.path });
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
});
