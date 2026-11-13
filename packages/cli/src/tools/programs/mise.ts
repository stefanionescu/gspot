import { realpathSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';

import { GSPOT_PATHS, MISE_CONFIG_FILE } from '#cli/config/manifests.ts';
import { GSPOT_FOLDER, LINE_BREAK, MISE_PROGRAM } from '#cli/config/system.ts';
import {
    MISE_BIN_PATHS_ARGUMENTS,
    MISE_CEILING_PATHS_VARIABLE,
    MISE_CONFIG_NAMES,
    MISE_CONFIG_PREFIXES,
    MISE_PROJECT_FILES,
    MISE_PROJECT_MESSAGE,
    MISE_STALE_PROJECT_MESSAGE,
    MISE_TOOL_SOURCE_ARGUMENTS,
    MISE_TRUSTED_PATHS_VARIABLE,
    MISE_WHICH,
} from '#cli/config/tools/mise.ts';
import { PYTHON_EXECUTABLE, TOOL_ENVIRONMENT } from '#cli/config/tools/programs.ts';
import { parseToolOutput } from '#cli/parsers/formats/tool-output.ts';
import { miseToolSourcesSchema } from '#cli/schemas/tools.ts';
import { listSelectedConfigurations } from '#cli/settings/scopes.ts';
import { remember } from '#cli/system/cache.ts';
import { openFiles } from '#cli/system/files/open.ts';
import { isInside } from '#cli/system/paths.ts';
import { findProgram } from '#cli/system/processes/programs.ts';
import { runProcess } from '#cli/system/processes/run.ts';
import { listMisePins } from '#cli/tools/pins.ts';
import { buildMiseInstall } from '#cli/tools/projects.ts';
import type { SpawnResult } from '#cli/types/system.ts';
import type { MiseBinPaths, MiseTrust, ToolLookupSession } from '#cli/types/tools.ts';

const MISE_FOLDERS = Symbol('mise folders');

export function formatMiseFailure(subcommand: string, result: SpawnResult): string {
    const detail = result.stderr.trim();
    const failure = `mise ${subcommand} failed (exit ${String(result.code)})`;
    return detail === '' ? `${failure}.` : `${failure}: ${detail}`;
}

/**
Build the variables that let one mise call read the mise tool project. mise may read it only when it holds the bytes
that gspot generates and no other mise config file sits in .gspot. mise then reads no config of the repository above.
*/
export function buildMiseTrust(root: string, project: string): MiseTrust {
    const files = openFiles(root);
    if (files.read(GSPOT_PATHS.miseProject)?.bytes.toString('utf8') !== project)
        return { refusal: MISE_STALE_PROJECT_MESSAGE };
    const names = files.list(GSPOT_FOLDER);
    const configNames = names.filter(
        (name) => MISE_CONFIG_NAMES.has(name) || MISE_CONFIG_PREFIXES.some((prefix) => name.startsWith(prefix)),
    );
    if (configNames.some((name) => !MISE_PROJECT_FILES.has(name))) return { refusal: MISE_PROJECT_MESSAGE };
    const folder = realpathSync(join(root, GSPOT_FOLDER));
    return {
        variables: {
            [MISE_TRUSTED_PATHS_VARIABLE]: join(folder, MISE_CONFIG_FILE),
            [MISE_CEILING_PATHS_VARIABLE]: dirname(folder),
        },
    };
}

export async function readMiseBinPaths(
    root: string,
    toolNames: string[],
    options: { timeoutSeconds: number; project: string },
): Promise<MiseBinPaths> {
    if (toolNames.length === 0 || findProgram(MISE_PROGRAM) === undefined) return { folders: [] };
    const trust = buildMiseTrust(root, options.project);
    if ('refusal' in trust) return { folders: [], failure: trust.refusal };
    const command = [...MISE_BIN_PATHS_ARGUMENTS, ...toolNames];
    const result = await runProcess(command, {
        cwd: join(root, GSPOT_FOLDER),
        timeoutSeconds: options.timeoutSeconds,
        env: { ...TOOL_ENVIRONMENT, ...trust.variables },
    });
    return result.code === 0
        ? { folders: result.stdout.trim().split(LINE_BREAK).filter(Boolean) }
        : { folders: [], failure: formatMiseFailure(MISE_BIN_PATHS_ARGUMENTS[1], result) };
}

/**
Find the Python that a mise config file of the repository sets for a folder. A Python that only a config file above the
repository names does not count, because the repository does not ask for it.
*/
export async function findRepositoryPython(
    root: string,
    cwd: string,
    options: { misePath: string; timeoutSeconds: number; cancelSignal?: AbortSignal | undefined },
): Promise<string | undefined> {
    const { misePath, ...limits } = options;
    const spawn = { cwd, env: TOOL_ENVIRONMENT, ...limits };
    const listed = await runProcess([misePath, ...MISE_TOOL_SOURCE_ARGUMENTS, PYTHON_EXECUTABLE], spawn);
    if (listed.code !== 0) return undefined;
    const source = parseToolOutput(MISE_PROGRAM, listed.stdout, miseToolSourcesSchema)[0]?.source?.path;
    if (source === undefined || !isInside(relative(root, source))) return undefined;
    const found = await runProcess([misePath, MISE_WHICH, PYTHON_EXECUTABLE], spawn);
    const python = found.stdout.trim();
    return found.code === 0 && python !== '' ? python : undefined;
}

export function readToolBinPaths(session: ToolLookupSession): Promise<MiseBinPaths> {
    return remember(session.toolCache, MISE_FOLDERS, session.toolsRoot, async () => {
        const pins = listMisePins(listSelectedConfigurations(session.scopes));
        return readMiseBinPaths(session.toolsRoot, [...new Set(pins.map((pin) => pin.name))], {
            timeoutSeconds: session.settings.tool_timeout_seconds,
            project: buildMiseInstall(session.toolConfigurations).content,
        });
    });
}
