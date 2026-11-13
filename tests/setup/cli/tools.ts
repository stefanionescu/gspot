import { mkdir, open, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';

import { stringify } from '@decimalturn/toml-patch';
import { spyOn } from 'bun:test';

import { GSPOT_PATHS } from '#cli/config/manifests.ts';
import { GSPOT_FOLDER } from '#cli/config/system.ts';
import { listHostCheckTools } from '#cli/engine/plan/tools.ts';
import { readConfigurations } from '#cli/manifests/read.ts';
import { getTool } from '#cli/manifests/tools.ts';
import { rootSettingSchemas } from '#cli/schemas/settings/file.ts';
import { readHost } from '#cli/system/environment.ts';
import { executableLayout, listExecutableNames } from '#cli/system/processes/programs.ts';
import { buildToolInstall } from '#cli/tools/installers/install.ts';
import { selectLockfileName } from '#cli/tools/installers/npm/lockfiles.ts';
import { readRegistryEnvironment } from '#cli/tools/installers/npm/registry.ts';
import { findMissingBuild, listMisePins, listPackagePins } from '#cli/tools/pins.ts';
import * as mise from '#cli/tools/programs/mise.ts';
import { buildPythonProjectTable } from '#cli/tools/projects.ts';
import type { Configuration, Tool } from '#cli/types/manifests.ts';
import type { NpmToolInstall, Session, ToolInstall, ToolPackageManager, ToolSearch } from '#cli/types/tools.ts';
import { UNPINNED_NPM_MESSAGE } from '#tests/config/setup/programs.ts';
import { fakeCommands, fakeExecutableLookup } from '#tests/setup/system/fakes.ts';
import { buildProcessResult } from '#tests/setup/system/processes.ts';
import { writeProgramCommand } from '#tests/setup/system/programs.ts';
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

export async function buildSandboxToolInstall(session: Session): Promise<ToolInstall> {
    return await buildToolInstall(session, { checkTools: listHostCheckTools(session), misePath: undefined });
}

export async function buildNpmToolInstall(session: Session): Promise<NpmToolInstall> {
    const install = await buildSandboxToolInstall(session);
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

export function fakeToolExecutables(tools: Tool[]): DisposableStack {
    const resources = new DisposableStack();
    const folder = join(tmpdir(), 'test-tools');
    resources.use(
        fakeExecutableLookup((name) => {
            if (name === 'mise') return null;
            return tools.some((tool) => tool.name === name) ? join(folder, name) : undefined;
        }),
    );
    resources.use(spyOn(mise, 'readToolBinPaths').mockResolvedValue({ folders: [folder] }));
    const findVersionPin = (command: readonly string[]): Tool | undefined => {
        const pin = tools.find((tool) => listExecutableNames(tool.name).includes(basename(command[0] ?? '')));
        const versionCommand = pin?.version_command ?? ['--version'];
        return command.slice(1).join(' ') === versionCommand.join(' ') ? pin : undefined;
    };
    resources.use(
        fakeCommands(
            (command) => findVersionPin(command) !== undefined,
            (command) => {
                const pin = findVersionPin(command);
                const version = pin?.version ?? pin?.min_version;
                return version === undefined
                    ? Promise.reject(new Error(`The test has no declared version for ${String(command[0])}.`))
                    : Promise.resolve(buildProcessResult({ stdout: version }));
            },
        ),
    );
    return resources;
}

export async function fakeNpmTool(root: string, tool: string): Promise<Tool> {
    const declaration = getTool(readConfigurations().values(), tool);
    const installer = declaration.installers['npm'];
    if (installer === undefined) throw new Error(`The tool ${tool} has no npm installer.`);
    if (declaration.version === undefined) throw new Error(UNPINNED_NPM_MESSAGE);
    await fakeNpmPackage(root, {
        name: installer.name,
        version: declaration.version,
        bin: tool,
        toolArguments: ['--line', declaration.version],
    });
    return declaration;
}

export function buildPythonToolFiles(tool: string): Record<string, string> {
    const declaration = getTool(readConfigurations().values(), tool);
    const name = declaration.installers.pypi?.name;
    if (name === undefined) throw new Error(`The tool ${tool} has no PyPI installer.`);
    const folder = `${name}-${String(declaration.version)}.dist-info`;
    return { [`${GSPOT_PATHS.pythonEnvironment}/lib/python3/site-packages/${folder}/METADATA`]: '' };
}

export async function fakeNpmPackage(
    root: string,
    npmPackage: { name: string; version: string; toolArguments: string[]; bin?: string },
): Promise<void> {
    const { name, version, toolArguments, bin = name } = npmPackage;
    const path = join(root, GSPOT_PATHS.nodeModules, name);
    await mkdir(path, { recursive: true });
    await writeFile(join(path, 'package.json'), JSON.stringify({ name, version }));
    await writeProgramCommand(root, `${GSPOT_PATHS.nodeModules}/.bin/${bin}`, 'fakes/tool', ...toolArguments);
}

export function hasToolBuild(name: string): boolean {
    const operatingSystem = readHost().platform;
    const pin = getTool(readConfigurations().values(), name);
    return findMissingBuild(pin, { platform: operatingSystem, arch: process.arch }) === undefined;
}

export function buildVenvExecutablePath(folder: string, name: string): string {
    return join(folder, executableLayout.environmentFolder, name + executableLayout.environmentSuffix);
}
