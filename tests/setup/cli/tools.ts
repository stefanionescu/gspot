import { join } from 'node:path';
import { parse } from '@decimalturn/toml-patch';
import { open, readFile } from 'node:fs/promises';
import type { Session } from '#cli/types/session.ts';
import { generate } from '#cli/generation/generate.ts';
import type { Files } from '#cli/types/system/files.ts';
import { isOnDisk } from '#tests/setup/system/files.ts';
import type { Tool } from '#cli/types/configurations.ts';
import type { RuntimePins } from '#tests/types/runner.ts';
import { runtimePinsSchema } from '#tests/schemas/runner.ts';
import { TOOL_PINS_FILE } from '#tests/config/setup/runner.ts';
import type { NpmToolInstall } from '#cli/types/install/npm.ts';
import { listDistinctTools } from '#cli/configurations/tools.ts';
import type { ToolSearch } from '#cli/types/tools/inspection.ts';
import type { ToolProjectFiles } from '#tests/types/packages.ts';
import { readInstallPackageManager } from '#cli/install/tools.ts';
import { getTable, findRootScope } from '#cli/settings/scopes.ts';
import { selectLockfileName } from '#cli/install/npm/lockfiles.ts';
import { REPOSITORY_ROOT } from '#tests/setup/runner/run-folder.ts';
import { DOT_GSPOT, GSPOT_PATHS } from '#cli/config/gspot-folder.ts';
import { readRegistryEnvironment } from '#cli/install/npm/registry.ts';
import type { ToolInstall, ToolPackageManager } from '#cli/types/install/tools.ts';
import type { PackageManager } from '#cli/types/repository/npm/package-manager.ts';
import { SETTING_DEFINITIONS } from '#cli/config/settings/definitions/all-settings.ts';

/**
Read a tool project file, its lockfile, and the lockfile mode.
*/
export async function readToolProjectFiles(
    root: string,
    packageManager: PackageManager['name'] | 'uv',
): Promise<ToolProjectFiles> {
    const isPython = packageManager === 'uv';
    const lockfilePath = join(root, DOT_GSPOT, isPython ? 'uv.lock' : selectLockfileName(packageManager));
    await using lockfile = await open(lockfilePath, 'r');
    const attributes = await lockfile.stat();
    return {
        projectFile: await readFile(join(root, DOT_GSPOT, isPython ? 'pyproject.toml' : 'package.json')),
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

// eslint-disable-next-line gspot/no-trivial-functions -- reason: 15 calls in 6 files share it.
export function buildToolInstall(session: Session, writer: Files): ToolInstall {
    return {
        session,
        packageManager: readInstallPackageManager(session),
        releaseAgeDays: getTable(findRootScope(session.scopes).settings, 'dependencies').min_release_age_days,
        writer,
        generated: generate(session),
        tools: listDistinctTools(session.toolConfigurations),
        misePath: null,
        steps: [],
    };
}

/**
Build the npm tool install for a sandbox whose session has a package manager, with its registry settings.

@param session the open sandbox.
@param writer holds the repository lock and saves files.
@returns the tool install with the package manager and the registry variables that the npm steps read.
*/
// eslint-disable-next-line gspot/no-trivial-functions -- reason: 8 calls in 2 files share it.
export async function buildNpmToolInstall(session: Session, writer: Files): Promise<NpmToolInstall> {
    const install = buildToolInstall(session, writer);
    return {
        ...install,
        packageManager: install.packageManager as ToolPackageManager,
        registryEnvironment: await readRegistryEnvironment(session.root),
    };
}

/**
A program pin, with an npm installer when npm names a package.

@param name executable to pin.
@param version release to pin.
@param npm package that ships the program.
@returns a tool with that program pinned.
*/

// eslint-disable-next-line gspot/no-trivial-functions -- reason: 14 calls in 3 files share it.
export function buildProgramPin(name: string, version: string, npm?: string): Tool {
    return {
        name,
        kind: 'program',
        version,
        installers: npm === undefined ? {} : { npm: { name: npm, version } },
    };
}

/**
List the npm install folder and lockfile of the tool project that exist, to show that a command installed nothing.

@param root the repository.
@returns the paths from the repository root.
*/
export async function listToolInstallFiles(root: string): Promise<string[]> {
    const paths = [GSPOT_PATHS.nodeModules, `${DOT_GSPOT}/package-lock.json`];
    const found = await Promise.all(paths.map(async (path) => ((await isOnDisk(join(root, path))) ? [path] : [])));
    return found.flat();
}

/**
What tool search reads, for tests that inspect installed tools.
*/

// eslint-disable-next-line gspot/no-trivial-functions -- reason: 30 calls in 3 files share it.
export function buildToolSearch(root: string, fields: Partial<ToolSearch> = {}): ToolSearch {
    return {
        root,
        timeoutSeconds: SETTING_DEFINITIONS['tool_timeout_seconds'].default,
        inspections: new Map(),
        ...fields,
    };
}

/**
Read this checkout's validated Bun and Node pins.

@returns the two pinned runtime versions.
*/
// eslint-disable-next-line gspot/no-trivial-functions -- reason: The e2e and integration tests read the runtime pins through it.
export async function readRuntimePins(): Promise<RuntimePins['tools']> {
    const runtimeSettings: unknown = parse(await readFile(join(REPOSITORY_ROOT, TOOL_PINS_FILE), 'utf8'));
    return runtimePinsSchema.parse(runtimeSettings).tools;
}
