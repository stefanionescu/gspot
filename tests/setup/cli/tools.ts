import { join } from 'node:path';
import { open, readFile } from 'node:fs/promises';
import { stringify } from '@decimalturn/toml-patch';
import type { Session } from '#cli/types/session.ts';
import type { Files } from '#cli/types/system/files.ts';
import { listHostCheckTools } from '#cli/engine/tools.ts';
import { getTable, getRootScope } from '#cli/settings/scopes.ts';
import type { ToolSearch } from '#cli/types/tools/inspection.ts';
import type { ToolProjectFiles } from '#tests/types/packages.ts';
import { buildGeneratedFiles } from '#cli/generation/generate.ts';
import { rootSettingSchemas } from '#cli/schemas/settings/file.ts';
import type { Tool, Configuration } from '#cli/types/manifests.ts';
import { GSPOT_PATHS, GSPOT_FOLDER } from '#cli/config/files/gspot.ts';
import { buildPythonProjectTable } from '#cli/tools/installers/pypi.ts';
import type { NpmToolInstall } from '#cli/types/tools/installers/npm.ts';
import { selectLockfileName } from '#cli/tools/installers/npm/lockfiles.ts';
import { readRegistryEnvironment } from '#cli/tools/installers/npm/registry.ts';
import { readToolPackageManager } from '#cli/repository/javascript/package-manager.ts';
import { listMisePins, listDistinctTools, listToolProjectPins } from '#cli/tools/pins.ts';
import type { ToolInstall, ToolPackageManager } from '#cli/types/tools/installers/installers.ts';

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
    const pin = session.packageManager;
    const packageManager =
        pin === undefined
            ? undefined
            : readToolPackageManager(session.toolsRoot, pin, session.timeoutSeconds, session.cache);
    return {
        session,
        packageManager:
            packageManager === undefined
                ? undefined
                : {
                      ...packageManager,
                      command: pin?.name === packageManager.name ? pin : { name: packageManager.name },
                  },
        releaseAgeDays: getTable(getRootScope(session.scopes).settings, 'dependencies').min_release_age_days,
        writer,
        generated: buildGeneratedFiles(session),
        tools: listDistinctTools(session.toolConfigurations),
        checkTools: listHostCheckTools(session.configuredChecks),
        misePath: null,
        steps: [],
    };
}

/**
Build the npm tool install for a sandbox whose package.json names its package packageManager.

@param session the open sandbox.
@param writer holds the repository lock and saves files.
@returns the tool install with its package packageManager and registry environment.
*/
export async function buildNpmToolInstall(session: Session, writer: Files): Promise<NpmToolInstall> {
    const install = buildToolInstall(session, writer);
    const { packageManager } = install;
    if (packageManager === undefined) throw new Error('The sandbox package.json names no package packageManager.');
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
What tool search reads, for tests that inspect installed tools.
*/

// eslint-disable-next-line gspot/no-trivial-functions -- reason: The tool tests build the tool search record through it, and jscpd reports the inlined copies as clones.
export function buildToolSearch(root: string, fields: Partial<ToolSearch> = {}): ToolSearch {
    return {
        root,
        timeoutSeconds: rootSettingSchemas.tool_timeout_seconds.parse(undefined),
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
