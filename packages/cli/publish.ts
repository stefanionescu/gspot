// Stamps the platform packages from the template, copies the binaries in, writes checksums, publishes everything at one version.

import { valid } from 'semver';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import packageManifest from '#package' with { type: 'json' };
import { Command, CommanderError, InvalidArgumentError } from 'commander';
// Usage: bun packages/cli/publish.ts --tag v0.1.0 [--registry <url>] [--dry-run]
import { copyFileSync, mkdirSync, readFileSync, readdirSync, writeFileSync, chmodSync } from 'node:fs';

const JSON_INDENT = 4;
const EXECUTABLE_MODE = 0o755;
const here = dirname(fileURLToPath(new URL(import.meta.url)));
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

/**
 * The manifest of one platform package.
 * @param platform the platform
 * @param platform.os the node os name
 * @param platform.cpu the node cpu name
 * @param version the version to stamp
 * @returns the package.json object
 */
function platformManifest(platform: { os: string; cpu: string }, version: string): Record<string, unknown> {
    return {
        name: `@gspot/cli-${platform.os}-${platform.cpu}`,
        version,
        description: `The gspot binary for ${platform.os} ${platform.cpu}. Install the gspot package instead; it picks this one for you.`,
        license: 'Apache-2.0',
        repository: 'github:stefanionescu/gspot',
        os: [platform.os],
        cpu: [platform.cpu],
        files: [platform.os === 'win32' ? 'gspot.exe' : 'gspot', 'README.md'],
    };
}

/**
 * Writes the platform packages under dist/npm.
 * @param version the version to stamp
 * @param distribution the dist directory
 * @returns the package directories to publish
 */
function stampPackages(version: string, distribution: string): string[] {
    const readme = readFileSync(join(root, 'packages', 'npm', 'platform', 'README.md'), 'utf8');
    const directories: string[] = [];
    for (const platform of PLATFORMS) {
        const source = join(distribution, platform.binary);
        const dir = join(distribution, 'npm', `cli-${platform.os}-${platform.cpu}`);
        mkdirSync(dir, { recursive: true });
        writeFileSync(
            join(dir, 'package.json'),
            `${JSON.stringify(platformManifest(platform, version), null, JSON_INDENT)}\n`,
        );
        writeFileSync(join(dir, 'README.md'), readme);
        const target = join(dir, platform.os === 'win32' ? 'gspot.exe' : 'gspot');
        try {
            copyFileSync(source, target);
            chmodSync(target, EXECUTABLE_MODE);
            directories.push(dir);
        } catch {
            console.error('No binary for this platform; skipping its package:', platform.os, platform.cpu, source);
        }
    }
    const launcher = join(distribution, 'npm', 'gspot');
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
    writeFileSync(join(launcher, 'package.json'), `${JSON.stringify(launcherManifest, null, JSON_INDENT)}\n`);
    directories.push(launcher);
    return directories;
}

/**
 * Writes dist/checksums.txt for the release page.
 * @param distribution the dist directory
 */
function writeChecksums(distribution: string): void {
    const lines = readdirSync(distribution)
        .filter((name) => name.startsWith('gspot-'))
        .toSorted((a, b) => a.localeCompare(b))
        .map((name) => `${checksum(join(distribution, name))}  ${name}`);
    writeFileSync(join(distribution, 'checksums.txt'), `${lines.join('\n')}\n`);
}

function releaseVersion(tag: string): string {
    const version = tag.slice(1);
    if (!tag.startsWith('v') || version.startsWith('v') || version.trim() !== version || valid(version) === null)
        throw new InvalidArgumentError('Use v followed by a complete semantic version, such as v0.1.0.');
    if (version !== packageManifest.version)
        throw new InvalidArgumentError(
            `The tag must match packages/cli/package.json version ${packageManifest.version}.`,
        );
    return version;
}

function registryUrl(value: string): string {
    let url: URL;
    try {
        url = new URL(value);
    } catch {
        throw new InvalidArgumentError('The registry must be an HTTP or HTTPS URL.');
    }
    if (!['http:', 'https:'].includes(url.protocol))
        throw new InvalidArgumentError('The registry must be an HTTP or HTTPS URL.');
    return value;
}

try {
    const script = new Command('bun packages/cli/publish.ts')
        .description('Prepare and publish the gspot release packages')
        .version(packageManifest.version)
        .requiredOption('--tag <tag>', 'Release tag matching the package version', releaseVersion)
        .option('--registry <url>', 'npm registry URL', registryUrl)
        .option('--dry-run', 'Ask npm to report publication without uploading packages')
        .allowExcessArguments(false)
        .showHelpAfterError()
        .addHelpText('after', `\nExample: bun packages/cli/publish.ts --tag v${packageManifest.version} --dry-run`)
        .exitOverride()
        .parse();
    const { tag: version, registry, dryRun } = script.opts<{ tag: string; registry?: string; dryRun?: boolean }>();
    const isDryRun = dryRun === true;
    const distribution = join(root, 'dist');
    writeChecksums(distribution);
    const directories = stampPackages(version, distribution);
    for (const dir of directories) {
        const command = [
            'npm',
            'publish',
            '--access',
            'public',
            ...(registry === undefined ? ['--provenance'] : ['--registry', registry]),
            ...(isDryRun ? ['--dry-run'] : []),
        ];
        const result = Bun.spawnSync(command, { cwd: dir, stdout: 'inherit', stderr: 'inherit' });
        if (result.exitCode !== 0) throw new Error(`Publish failed in ${dir}`);
    }
} catch (error) {
    if (!(error instanceof CommanderError)) throw error;
    process.exitCode = error.exitCode === 0 ? 0 : 2;
}
