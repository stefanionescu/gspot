// Runs the compiled binary of this platform in a planted repository: the embedded presets, rules and grammars, not the source tree.

import { join } from 'node:path';
import { existsSync } from 'node:fs';
// Runs when GSPOT_RELEASE_TEST=1 (the release workflow sets it); it needs a built binary under dist/.
import { fileURLToPath } from 'node:url';
import { createSandbox } from '@gspot/testing';
import { describe, expect, test } from 'bun:test';
import { GSPOT_VERSION } from '#cli/run/version-pin.ts';
import { environmentVariables, isReleaseTestWanted } from '#cli/platform/environment.ts';
import { commitAll, PLANTED_TIMEOUT_MS, script, toolsPath } from '#tests/harness/planted.ts';

const PLATFORM = process.platform === 'win32' ? 'windows' : process.platform;
const ARCHITECTURE = process.arch === 'arm64' ? 'arm64' : 'x64';
const BINARY = join(
    fileURLToPath(new URL('../..', import.meta.url)),
    'dist',
    `gspot-${PLATFORM}-${ARCHITECTURE}${PLATFORM === 'windows' ? '.exe' : ''}`,
);

function binary(cwd: string, argv: string[]): { code: number; stdout: string } {
    const environment = Object.fromEntries(
        Object.entries(environmentVariables()).filter(([name]) => name !== 'GSPOT_BIN'),
    );
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
            await using sandbox = await createSandbox({ 'scripts/build.sh': script, 'README.md': '# planted\n' });
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
            expect(binary(sandbox.path, ['apply', '--check']).code).toBe(0);
        },
        PLANTED_TIMEOUT_MS,
    );
});
