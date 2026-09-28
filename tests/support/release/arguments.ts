import { fileURLToPath } from 'node:url';
import { createFileTree } from 'testdirs';
import { join, delimiter } from 'node:path';
import { chmodSync, symlinkSync, readFileSync } from 'node:fs';
import { environmentVariables } from '#cli/platform/environment.ts';

const ROOT = fileURLToPath(new URL('../../..', import.meta.url));

/**
 * Prepare source publishing with sentinel binaries and a recording npm command.
 * @param cwd the caller-owned temporary directory
 * @param version the manifest version to publish
 * @param registry the only registry accepted by the recording command
 */
export async function preparePublication(cwd: string, version: string, registry: string): Promise<void> {
    const sourceManifest = JSON.parse(readFileSync(join(ROOT, 'packages/cli/package.json'), 'utf8')) as Record<
        string,
        unknown
    >;
    const manifest = JSON.stringify({ ...sourceManifest, version });
    await createFileTree(cwd, {
        'packages/cli/scripts/publish.ts': readFileSync(join(ROOT, 'packages/cli/scripts/publish.ts'), 'utf8'),
        'packages/cli/package.json': manifest,
        ...Object.fromEntries(
            [
                'packages/npm/README.md',
                'packages/npm/package.json',
                'packages/npm/gspot.js',
                'packages/npm/targets.json',
                'packages/cli/scripts/publish.ts',
                'packages/cli/scripts/targets.ts',
            ].map((path) => [path, readFileSync(join(ROOT, path), 'utf8')]),
        ),
        ...Object.fromEntries(
            [
                'gspot-darwin-arm64',
                'gspot-darwin-x64',
                'gspot-linux-x64',
                'gspot-linux-arm64',
                'gspot-linux-x64-musl',
                'gspot-linux-arm64-musl',
                'gspot-windows-x64.exe',
            ].map((binary) => [`dist/${binary}`, 'binary sentinel']),
        ),
        'dist/checksums.txt': 'existing checksums\n',
        'dist/LICENSE.md': 'Release license\n',
        'dist/NOTICE.md': 'Dependency notices\n',
        'bin/npm':
            `#!${process.execPath}\n` +
            String.raw`import { appendFileSync } from 'node:fs';
import { join } from 'node:path';
const argv = process.argv.slice(2);
if (!argv.includes('${registry}')) throw new Error('Only the sandbox registry is allowed.');
appendFileSync(join(import.meta.dir, '..', 'publisher.jsonl'), JSON.stringify(argv) + '\n');
`,
    });
    for (const path of ['node_modules', 'packages/cli/node_modules'])
        symlinkSync(join(ROOT, path), join(cwd, path), 'dir');
    chmodSync(join(cwd, 'bin/npm'), 0o755);
}

/**
 * Run the publishing script with the fixture recording command ahead of inherited executables.
 * @param cwd the prepared publication fixture
 * @param args the publishing arguments
 * @returns the process status and captured output
 */
// eslint-disable-next-line gspot/no-trivial-functions -- reason: Run the publishing script with the fixture recording command ahead of inherited executables. 1 files make 2 calls; one owner keeps that behavior in one place.
export function runPublication(cwd: string, args: string[]): Bun.SyncSubprocess<'pipe', 'pipe'> {
    return Bun.spawnSync([process.execPath, join(cwd, 'packages/cli/scripts/publish.ts'), ...args], {
        cwd,
        stdout: 'pipe',
        stderr: 'pipe',
        timeout: 10_000,
        env: {
            ...environmentVariables(),
            PATH: `${join(cwd, 'bin')}${delimiter}${environmentVariables()['PATH'] ?? ''}`,
        },
    });
}
