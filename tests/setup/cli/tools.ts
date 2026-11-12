import { open, readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { stringify } from '@decimalturn/toml-patch';

import { GSPOT_PATHS } from '#cli/config/manifests.ts';
import { GSPOT_FOLDER } from '#cli/config/system.ts';
import { listHostCheckTools } from '#cli/engine/tools.ts';
import { rootSettingSchemas } from '#cli/schemas/settings/file.ts';
import { buildToolInstall } from '#cli/tools/installers/install.ts';
import { selectLockfileName } from '#cli/tools/installers/npm/lockfiles.ts';
import { readRegistryEnvironment } from '#cli/tools/installers/npm/registry.ts';
import { buildPythonProjectTable, listMisePins, listPackagePins } from '#cli/tools/pins.ts';
import type { Configuration, Tool } from '#cli/types/manifests.ts';
import type { Files } from '#cli/types/system.ts';
import type { NpmToolInstall, Session, ToolInstall, ToolPackageManager, ToolSearch } from '#cli/types/tools.ts';
import type { ToolProjectFiles } from '#tests/types/setup.ts';

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

export async function buildSandboxToolInstall(session: Session, writer: Files): Promise<ToolInstall> {
    return await buildToolInstall(session, { writer, checkTools: listHostCheckTools(session), misePath: undefined });
}

export async function buildNpmToolInstall(session: Session, writer: Files): Promise<NpmToolInstall> {
    const install = await buildSandboxToolInstall(session, writer);
    const { packageManager } = install;
    if (packageManager === undefined) throw new Error('The sandbox package.json names no package packageManager.');
    return { ...install, packageManager, registryEnvironment: await readRegistryEnvironment(session.root) };
}

export function buildProgramPin(name: string, version: string, npmPackage?: string): Tool {
    return {
        name,
        kind: 'program',
        version,
        installers: npmPackage === undefined ? {} : { npm: { name: npmPackage, version } },
    };
}

export function buildToolSearch(root: string, fields: Partial<ToolSearch> = {}): ToolSearch {
    return {
        root,
        settings: { tool_timeout_seconds: rootSettingSchemas.tool_timeout_seconds.parse(undefined) },
        ...fields,
    };
}

export function buildToolLockfiles(configurations: Configuration[]): Record<string, string> {
    const dependencies = listPackagePins(configurations).npm;
    const python = buildPythonProjectTable(configurations);
    return {
        [GSPOT_PATHS.miseLockfile]: stringify({
            tools: Object.fromEntries(
                listMisePins(configurations).map((pin) => [
                    pin.name,
                    [
                        {
                            version: pin.version,
                            ...Object.fromEntries(
                                Object.entries(pin.checksums).map(([platform, checksum]) => [
                                    `platforms.${platform}`,
                                    {
                                        url: 'https://github.com/example/tool/releases/download/v1.0.0/tool.tar.gz',
                                        checksum,
                                    },
                                ]),
                            ),
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
                            const [name, version] = pin.split('==', 2);
                            return { name, specifier: `==${version!}` };
                        }),
                    },
                },
            ],
        }),
    };
}
