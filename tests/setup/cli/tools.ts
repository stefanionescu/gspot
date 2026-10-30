import { join } from 'node:path';
import { open, readFile } from 'node:fs/promises';
import { stringify } from '@decimalturn/toml-patch';
import type { Session } from '#cli/types/session.ts';
import type { Files } from '#cli/types/system/files.ts';
import { isOnDisk } from '#tests/setup/system/files.ts';
import * as installers from '#cli/installers/install.ts';
import { generateFiles } from '#cli/generation/generate.ts';
import type { ToolSearch } from '#cli/types/tools/inspection.ts';
import type { ToolProjectFiles } from '#tests/types/packages.ts';
import { buildPythonProjectTable } from '#cli/installers/pypi.ts';
import type { NpmToolInstall } from '#cli/types/installers/npm.ts';
import type { Tool, Configuration } from '#cli/types/manifests.ts';
import { selectLockfileName } from '#cli/installers/npm/lockfiles.ts';
import { GSPOT_PATHS, GSPOT_FOLDER } from '#cli/config/gspot-folder.ts';
import { readRegistryEnvironment } from '#cli/installers/npm/registry.ts';
import { listMisePins, listToolProjectPins } from '#cli/manifests/tools.ts';
import { SETTING_DEFINITIONS } from '#cli/config/settings/definitions/all-settings.ts';
import type { ToolInstall, ToolPackageManager } from '#cli/types/installers/install.ts';

/**
Read a tool project file, its lockfile, and the lockfile mode.
*/
export async function readToolProjectFiles(
    root: string,
    packageManager: ToolPackageManager['name'] | 'uv',
): Promise<ToolProjectFiles> {
    const isPython = packageManager === 'uv';
    const lockfilePath = join(root, GSPOT_FOLDER, isPython ? 'uv.lock' : selectLockfileName(packageManager));
    await using lockfile = await open(lockfilePath, 'r');
    const attributes = await lockfile.stat();
    return {
        projectFile: await readFile(join(root, GSPOT_FOLDER, isPython ? 'pyproject.toml' : 'package.json')),
        lockfilePath,
        lockfile: await lockfile.readFile(),
        mode: attributes.mode,
    };
}

/**
Build the tool install for a sandbox.

@param session the open sandbox.
@param writer holds the repository lock and saves files.
@returns the session, writer, generated files, and tools that the install steps read.
*/

export function buildToolInstall(session: Session, writer: Files): ToolInstall {
    const generated = generateFiles(session);
    const install = installers.buildToolInstall(session, writer, generated);
    install.misePath = null;
    return install;
}

/**
Build the npm tool install for a sandbox whose package.json names its package manager.

@param session the open sandbox.
@param writer holds the repository lock and saves files.
@returns the tool install with its package manager and registry environment.
*/
export async function buildNpmToolInstall(session: Session, writer: Files): Promise<NpmToolInstall> {
    const install = buildToolInstall(session, writer);
    const { packageManager } = install;
    if (packageManager === undefined) throw new Error('The sandbox package.json names no package manager.');
    return { ...install, packageManager, registryEnvironment: await readRegistryEnvironment(session.root) };
}

/**
A program pin, with an npm installer when npm names a package.
*/

// eslint-disable-next-line gspot/no-trivial-functions -- reason: The tool tests share the npm pin record.
export function buildProgramPin(name: string, version: string, npmPackage?: string): Tool {
    return {
        name,
        kind: 'program',
        version,
        installers: npmPackage === undefined ? {} : { npm: { name: npmPackage, version } },
    };
}

/**
List the npm install folder and lockfile of the tool project that exist, to show that a command installed nothing.
*/
export async function listNpmInstallFiles(root: string): Promise<string[]> {
    const paths = [GSPOT_PATHS.nodeModules, `${GSPOT_FOLDER}/package-lock.json`];
    const found = await Promise.all(paths.map(async (path) => ((await isOnDisk(join(root, path))) ? [path] : [])));
    return found.flat();
}

/**
What tool search reads, for tests that inspect installed tools.
*/

// eslint-disable-next-line gspot/no-trivial-functions -- reason: Inlined, the tool search record makes duplication/jscpd clones in the tools tests.
export function buildToolSearch(root: string, fields: Partial<ToolSearch> = {}): ToolSearch {
    return {
        root,
        timeoutSeconds: SETTING_DEFINITIONS['tool_timeout_seconds'].default,
        inspections: new Map(),
        ...fields,
    };
}

/**
Build tool lockfiles that match the pins of the configurations, so that apply finds every lockfile current.
*/
export function buildToolLockfiles(configurations: Configuration[]): Record<string, string> {
    const dependencies = listToolProjectPins(configurations).npm;
    const python = buildPythonProjectTable(configurations);
    return {
        [GSPOT_PATHS.miseLockfile]: stringify({
            tools: Object.fromEntries(
                listMisePins(configurations).map((pin) => [
                    pin.name,
                    [
                        {
                            version: pin.version,
                            'platforms.linux-x64': {
                                url: 'https://github.com/example/tool/releases/download/v1.0.0/tool.tar.gz',
                                checksum: pin.checksums?.['linux-x64'] ?? `sha256:${'a'.repeat(64)}`,
                            },
                        },
                    ],
                ]),
            ),
        }),
        '.gspot/bun.lock': JSON.stringify({
            workspaces: { '': { devDependencies: dependencies } },
            packages: Object.fromEntries(
                Object.entries(dependencies).map(([name, version]) => [
                    name,
                    [`${name}@${version}`, '', {}, 'sha512-YQ=='],
                ]),
            ),
        }),
        [GSPOT_PATHS.uvLockfile]: stringify({
            version: 1,
            'requires-python': python['requires-python'],
            options: { 'exclude-newer-span': 'P7D' },
            package: [
                {
                    name: python.name,
                    version: python.version,
                    source: { virtual: '.' },
                    metadata: {
                        'requires-dist': python.dependencies.map((pin) => {
                            const [name, version] = pin.split('==');
                            return { name, specifier: `==${version!}` };
                        }),
                    },
                },
            ],
        }),
    };
}
