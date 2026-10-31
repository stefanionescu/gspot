import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { writeFile } from 'node:fs/promises';
import { commitAll } from '#tests/setup/system/git.ts';
import { spawnGspot } from '#tests/setup/cli/commands.ts';
import { runCommand } from '#tests/setup/system/processes.ts';
import { getManifestTarget } from '#tests/setup/cli/generated-files.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { SYNCPACK_PACKAGE_FILES } from '#tests/config/commands/init/conflicts.ts';

async function initAtLevelAll(root: string): Promise<void> {
    commitAll(root);
    const initialized = await spawnGspot(root, ['init', '--yes', '--no-configurations', '--level', 'all']);
    expect(initialized.code, initialized.stdout + initialized.stderr).toBe(0);
}

test('dependencies/syncpack reports each mismatched package.json and passes once the versions match', async () => {
    await using sandbox = await createGitSandbox(SYNCPACK_PACKAGE_FILES);
    await initAtLevelAll(sandbox.path);
    const command = ['syncpack', 'lint', '--config', getManifestTarget('dependencies', 'syncpack.json'), '--no-ansi'];
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
