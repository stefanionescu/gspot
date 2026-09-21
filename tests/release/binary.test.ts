// Runs the compiled binary of this platform in a planted repository: the embedded presets, rules and grammars, not the source tree.

import { createRequire } from 'node:module';
import { releaseTargets } from '../../packages/cli/config/targets.ts';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
// Runs when GSPOT_RELEASE_TEST=1 (the release workflow sets it); it needs a built binary under dist/.
import { fileURLToPath } from 'node:url';
import { createFileTree, testdir } from 'testdirs';
import { describe, expect, test } from 'bun:test';
import { GSPOT_VERSION } from '#cli/run/version-pin.ts';
import { environmentVariables, isReleaseTestWanted } from '#cli/platform/environment.ts';
import { commitAll, PLANTED_TIMEOUT_MS, script, toolsPath } from '#tests/harness/planted.ts';

const root = fileURLToPath(new URL('../..', import.meta.url));
const requireCli = createRequire(join(root, 'packages/cli/package.json'));
const { familySync } = requireCli('detect-libc') as { familySync: () => string | null };
const libc = process.platform === 'linux' ? familySync() : null;
const host = releaseTargets.find(
    (target) => target.os === process.platform && target.cpu === process.arch && target.libc === libc,
);
if (host === undefined)
    throw new Error(`Unsupported release test host: ${process.platform} ${process.arch} ${String(libc)}.`);
const BINARY = join(root, 'dist', host.binary);

function binary(cwd: string, argv: string[]): { code: number; stdout: string } {
    const environment = Object.fromEntries(Object.entries(environmentVariables()));
    const result = Bun.spawnSync([BINARY, ...argv], {
        cwd,
        env: { ...environment, NO_COLOR: '1', CI: '1', PATH: toolsPath(['ast-grep', 'shellcheck', 'shfmt']) },
        stdout: 'pipe',
        stderr: 'pipe',
    });
    return { code: result.exitCode, stdout: result.stdout.toString() };
}

describe.skipIf(!isReleaseTestWanted())('the compiled binary', () => {
    test(
        'prints the package version, installs from its embedded assets and checks a planted script',
        async () => {
            expect(existsSync(BINARY)).toBe(true);
            await using sandbox = await testdir();
            await createFileTree(sandbox.path, { 'scripts/build.sh': script, 'README.md': '# planted\n' });
            commitAll(sandbox.path);
            expect(binary(sandbox.path, ['--version']).stdout.trim()).toBe(GSPOT_VERSION);
            const init = binary(sandbox.path, [
                'init',
                '--yes',
                '--presets',
                'bash',
                '--no-runner',
                '--no-ci',
                '--no-install',
            ]);
            expect(init.code).toBe(0);
            expect(existsSync(join(sandbox.path, '.gspot', 'rules', 'general', 'agent', 'WORKING.md'))).toBe(true);
            expect(binary(sandbox.path, ['check', '--only', 'bash/shellcheck']).code).toBe(0);
            const preview = binary(sandbox.path, ['apply', '--dry-run', '--json']);
            expect(preview.code, preview.stdout).toBe(0);
            expect((JSON.parse(preview.stdout) as { drift: unknown[] }).drift).toEqual([]);
        },
        PLANTED_TIMEOUT_MS,
    );
});
