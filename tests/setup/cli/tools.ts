// Builds tool pins, tool searches, and install states, and reads the tool project files that gspot install writes.
import { join } from 'node:path';
import { open, readFile } from 'node:fs/promises';
import type { Session } from '#cli/types/session.ts';
import type { Writer } from '#cli/types/ownership.ts';
import { generate } from '#cli/generation/generate.ts';
import type { Tool } from '#cli/types/configurations.ts';
import { SETTING_FACTS } from '#cli/config/settings/facts.ts';
import type { ToolInstall } from '#cli/types/install/tools.ts';
import type { ToolSearch } from '#cli/types/tools/inspection.ts';
import type { ToolProjectFiles } from '#tests/types/packages.ts';
import { selectLockfileName } from '#cli/install/npm/tool-project.ts';
import { listDistinctTools } from '#cli/configurations/declared-tools.ts';
import type { PackageManager } from '#cli/types/repository/package-manager.ts';

/** Read a tool project file, its lockfile, and the lockfile mode. */
export async function readToolProjectFiles(
    root: string,
    packageManager: PackageManager['name'] | 'uv',
): Promise<ToolProjectFiles> {
    const python = packageManager === 'uv';
    const lockfilePath = join(root, '.gspot', python ? 'uv.lock' : selectLockfileName(packageManager));
    await using lockfile = await open(lockfilePath, 'r');
    const attributes = await lockfile.stat();
    return {
        projectFile: await readFile(join(root, '.gspot', python ? 'pyproject.toml' : 'package.json')),
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

/** What tool search reads, for tests that inspect installed tools. */
export function buildToolSearch(root: string, fields: Partial<ToolSearch> = {}): ToolSearch {
    return {
        root,
        timeoutSeconds: SETTING_FACTS['tool_timeout_seconds'].default,
        inspections: new Map(),
        ...fields,
    };
}
