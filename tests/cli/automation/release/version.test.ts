// Release validation refuses a branch or mismatched tag before publication can start.
import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { run } from '#cli/platform/spawn.ts';
import cliPackage from '#cli-package' with { type: 'json' };
import { TEST_TIMEOUT_MS } from '#tests/config/timeouts.ts';
import { workspaceRoot as root } from '#automation/workspace.ts';
import { INVALID_RELEASE_TAGS } from '#tests/config/cli/automation/release/version.ts';

const script = join(root, 'scripts/release/version.ts');

test.each(INVALID_RELEASE_TAGS)('release validation refuses %s', async (tag) => {
    const result = await run([process.execPath, script, tag], { cwd: root, timeoutMs: TEST_TIMEOUT_MS });
    expect(result.code, result.stdout + result.stderr).toBe(1);
    expect(result.stderr).toContain('Start the release on the version tag');
});

test('release validation accepts the stable package version and its matching plugin pin', async () => {
    const result = await run([process.execPath, script, `v${cliPackage.version}`], {
        cwd: root,
        timeoutMs: TEST_TIMEOUT_MS,
    });
    expect(result.code, result.stdout + result.stderr).toBe(0);
    expect(result.stdout).toContain(`Validated v${cliPackage.version}`);
    expect(result.stderr).toBe('');
});
