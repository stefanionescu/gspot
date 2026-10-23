// Builds tool pins, tool searches, and install states, and reads the tool project files that gspot install writes.
import { join } from 'node:path';
import type { Writer } from '#cli/types/apply.ts';
import { open, readFile } from 'node:fs/promises';
import type { Session } from '#cli/types/session.ts';
import { generate } from '#cli/generation/generate.ts';
import { isOnDisk } from '#tests/setup/system/files.ts';
import type { Tool } from '#cli/types/configurations.ts';
import type { ToolInstall } from '#cli/types/install/tools.ts';
import type { ToolSearch } from '#cli/types/tools/inspection.ts';
import type { ToolProjectFiles } from '#tests/types/packages.ts';
import { DOT_GSPOT, GSPOT_PATHS } from '#cli/config/gspot-folder.ts';
import { selectLockfileName } from '#cli/install/npm/package-json.ts';
import { listDistinctTools } from '#cli/configurations/declared-tools.ts';
import type { PackageManager } from '#cli/types/repository/npm/package-manager.ts';
import { SETTING_DEFINITIONS } from '#cli/config/settings/definitions/all-settings.ts';

/** Read a tool project file, its lockfile, and the lockfile mode. */
export async function readToolProjectFiles(
    root: string,
    packageManager: PackageManager['name'] | 'uv',
): Promise<ToolProjectFiles> {
    const python = packageManager === 'uv';
    const lockfilePath = join(root, DOT_GSPOT, python ? 'uv.lock' : selectLockfileName(packageManager));
    await using lockfile = await open(lockfilePath, 'r');
    const attributes = await lockfile.stat();
    return {
        projectFile: await readFile(join(root, DOT_GSPOT, python ? 'pyproject.toml' : 'package.json')),
        lockfilePath,
        lockfile: await lockfile.readFile(),
        mode: attributes.mode,
    };
}

/**
 * Build the tool install for a sandbox.
 *
 * @param session the open sandbox.
 * @param writer holds the repository lock and saves files.
 * @returns the session, writer, generated files, and tools that the install steps read.
 */
export function buildToolInstall(session: Session, writer: Writer): ToolInstall {
    return {
        session,
        writer,
        generated: generate(session),
        tools: listDistinctTools(session.neededToolConfigurations),
        misePath: null,
        steps: [],
    };
}

/**
 * A program pin, with an npm installer when npm names a package.
 *
 * @param name executable to pin.
 * @param version release to pin.
 * @param npm package that ships the program.
 * @returns a tool with that program pinned.
 */
export function buildProgramPin(name: string, version: string, npm?: string): Tool {
    return {
        name,
        kind: 'program',
        version,
        installers: npm === undefined ? {} : { npm: { name: npm, version } },
    };
}

/**
 * List the npm install folder and lockfile of the tool project that exist, to show that a command installed nothing.
 *
 * @param root the repository.
 * @returns the paths from the repository root.
 */
export async function listToolInstallFiles(root: string): Promise<string[]> {
    const paths = [GSPOT_PATHS.nodeModules, `${DOT_GSPOT}/package-lock.json`];
    const found = await Promise.all(paths.map(async (path) => ((await isOnDisk(join(root, path))) ? [path] : [])));
    return found.flat();
}

/** What tool search reads, for tests that inspect installed tools. */
export function buildToolSearch(root: string, fields: Partial<ToolSearch> = {}): ToolSearch {
    return {
        root,
        timeoutSeconds: SETTING_DEFINITIONS['tool_timeout_seconds'].default,
        inspections: new Map(),
        ...fields,
    };
}
