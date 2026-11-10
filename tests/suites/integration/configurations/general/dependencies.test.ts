import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { expect, test } from 'bun:test';

import { SYNCPACK_PACKAGE_FILES } from '#tests/config/setup/sandboxes.ts';
import { getManifestTarget } from '#tests/setup/cli/generated-files.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { applyGeneratedFiles } from '#tests/setup/sandboxes/changes.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { runCommand } from '#tests/setup/system/processes.ts';

test('syncpack accepts the generated config, reports each mismatched package.json, and passes once the versions match', async () => {
    await using sandbox = await createGitSandbox({
        ...SYNCPACK_PACKAGE_FILES,
        'gspot.toml': buildSandboxSettings(['dependencies', 'javascript'], { level: 'all' }),
    });
    await applyGeneratedFiles(sandbox.path);
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
