// Stamps the platform packages from the template, copies the binaries in, writes checksums, publishes everything at one version.
// Usage: bun packages/cli/publish.ts --tag v0.1.0 [--registry <url>] [--dry-run]
import { copyFileSync, mkdirSync, readFileSync, readdirSync, writeFileSync, chmodSync } from 'node:fs';
import { dirname, join } from 'node:path';

const here = dirname(new URL(import.meta.url).pathname);
const root = join(here, '..', '..');

const PLATFORMS: { os: string; cpu: string; binary: string }[] = [
    { os: 'darwin', cpu: 'arm64', binary: 'gspot-darwin-arm64' },
    { os: 'darwin', cpu: 'x64', binary: 'gspot-darwin-x64' },
    { os: 'linux', cpu: 'x64', binary: 'gspot-linux-x64' },
    { os: 'linux', cpu: 'arm64', binary: 'gspot-linux-arm64' },
    { os: 'win32', cpu: 'x64', binary: 'gspot-windows-x64.exe' },
];

function checksum(path: string): string {
    return new Bun.CryptoHasher('sha256').update(readFileSync(path)).digest('hex');
}

/** The manifest of one platform package. */
export function platformManifest(platform: { os: string; cpu: string }, version: string): Record<string, unknown> {
    return {
        name: `@gspot/cli-${platform.os}-${platform.cpu}`,
        version,
        description: `The gspot binary for ${platform.os} ${platform.cpu}. Install the gspot package instead; it picks this one for you.`,
        license: 'MIT',
        repository: 'github:stefanionescu/gspot',
        os: [platform.os],
        cpu: [platform.cpu],
        files: [platform.os === 'win32' ? 'gspot.exe' : 'gspot', 'README.md'],
    };
}

/** Writes the platform packages under dist/npm and returns their directories. */
export function stampPackages(version: string, dist: string): string[] {
    const readme = readFileSync(join(root, 'packages', 'npm', 'platform', 'README.md'), 'utf8');
    const dirs: string[] = [];
    for (const platform of PLATFORMS) {
        const source = join(dist, platform.binary);
        const dir = join(dist, 'npm', `cli-${platform.os}-${platform.cpu}`);
        mkdirSync(dir, { recursive: true });
        writeFileSync(join(dir, 'package.json'), `${JSON.stringify(platformManifest(platform, version), null, 4)}\n`);
        writeFileSync(join(dir, 'README.md'), readme);
        const target = join(dir, platform.os === 'win32' ? 'gspot.exe' : 'gspot');
        try {
            copyFileSync(source, target);
            chmodSync(target, 0o755);
            dirs.push(dir);
        } catch {
            console.error(`no binary for ${platform.os} ${platform.cpu} at ${source}; skipping its package`);
        }
    }
    const launcher = join(dist, 'npm', 'gspot');
    mkdirSync(launcher, { recursive: true });
    for (const file of ['gspot.js', 'README.md'])
        copyFileSync(join(root, 'packages', 'npm', 'gspot', file), join(launcher, file));
    const launcherManifest = JSON.parse(
        readFileSync(join(root, 'packages', 'npm', 'gspot', 'package.json'), 'utf8'),
    ) as Record<string, unknown>;
    launcherManifest['version'] = version;
    launcherManifest['optionalDependencies'] = Object.fromEntries(
        PLATFORMS.map((platform) => [`@gspot/cli-${platform.os}-${platform.cpu}`, version]),
    );
    writeFileSync(join(launcher, 'package.json'), `${JSON.stringify(launcherManifest, null, 4)}\n`);
    dirs.push(launcher);
    return dirs;
}

/** Writes dist/checksums.txt for the release page. */
export function writeChecksums(dist: string): void {
    const lines = readdirSync(dist)
        .filter((name) => name.startsWith('gspot-'))
        .sort()
        .map((name) => `${checksum(join(dist, name))}  ${name}`);
    writeFileSync(join(dist, 'checksums.txt'), `${lines.join('\n')}\n`);
}

if (import.meta.main) {
    const args = process.argv.slice(2);
    const flag = (name: string) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);
    const tag = flag('--tag') ?? '';
    const version = tag.replace(/^v/, '');
    if (!/^\d+\.\d+\.\d+/.test(version)) throw new Error('--tag v<version> is required');
    const registry = flag('--registry');
    const dryRun = args.includes('--dry-run');
    const dist = join(root, 'dist');
    writeChecksums(dist);
    const dirs = stampPackages(version, dist);
    for (const dir of dirs) {
        const command = [
            'npm',
            'publish',
            '--access',
            'public',
            ...(registry ? ['--registry', registry] : ['--provenance']),
            ...(dryRun ? ['--dry-run'] : []),
        ];
        const result = Bun.spawnSync(command, { cwd: dir, stdout: 'inherit', stderr: 'inherit' });
        if (result.exitCode !== 0) throw new Error(`publish failed in ${dir}`);
    }
}
