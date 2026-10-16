import which from 'which';
import { statSync } from 'node:fs';
import { TOOL_ENV } from '#cli/config/tools/run.ts';
import { openFiles } from '#cli/system/files/open.ts';
import { stripUndefined } from '#cli/system/values.ts';
import type { Files } from '#cli/types/system/files.ts';
import { isInGspotFolder } from '#cli/repository/classify.ts';
import { spawnProcessBlocking } from '#cli/system/processes.ts';
import type { ToolAvailability } from '#cli/types/tools/run.ts';
import type { ToolDeclaration } from '#cli/types/configurations.ts';
import { toolProjectPackage } from '#cli/configurations/tool-pins.ts';
import { PACKAGE_JSON } from '#cli/config/parsers/dependency-files.ts';
import { PYTHON_ENVIRONMENT_FOLDER } from '#cli/config/tools/python.ts';
import { join, dirname, basename, relative, isAbsolute } from 'node:path';
import { readToolVersion, toolVersionState } from '#cli/tools/versions.ts';
import { installedPackage, findInstalledDependency } from '#cli/tools/npm/packages.ts';
import { isInside, buildVenvBinPath, convertToPosixPath, listExecutableNames } from '#cli/system/paths.ts';
import { DOT_GSPOT, NODE_MODULES_DIRECTORY, PYTHON_ENVIRONMENT_DIRECTORY } from '#cli/config/system/locations.ts';

import type {
    Inspected,
    ToolSearch,
    LocateOptions,
    ToolInspection,
    AvailableToolInspection,
} from '#cli/types/tools/find.ts';
import {
    MISE_WHICH,
    MISE_PROGRAM,
    NPM_BIN_FOLDER,
    MISE_INSTALL_URL,
    MISE_SHIMS_FOLDER,
    AVAILABLE_TOOL_STATES,
    MISE_BIN_PATHS_ARGUMENTS,
} from '#cli/config/tools/find.ts';

// Search folders for tool-project and system executables. A copy has no tool projects or virtual
// environments of its own: they run from the working tree the copy stands for.
function searchDirectories(root: string, options: LocateOptions): string[] {
    const { searchFolders, toolProjectKind, installedRoot = root } = options;
    if (toolProjectKind === 'npm') return [join(installedRoot, DOT_GSPOT, NPM_BIN_FOLDER)];
    if (toolProjectKind === 'python') return [buildVenvBinPath(join(installedRoot, PYTHON_ENVIRONMENT_DIRECTORY))];
    // A copy's tool projects run from the original working tree.
    return [...new Set(searchFolders)].flatMap((folder) => [
        join(basename(folder) === DOT_GSPOT ? join(installedRoot, relative(root, folder)) : folder, NPM_BIN_FOLDER),
        buildVenvBinPath(join(installedRoot, relative(root, folder), PYTHON_ENVIRONMENT_FOLDER)),
    ]);
}

// Whether a candidate exists: a managed path must resolve through the root boundary, read other candidates directly from disk.
function candidateExists(files: Files, root: string, path: string): boolean {
    const local = convertToPosixPath(relative(root, path));
    if (!isInGspotFolder(local)) return statSync(path, { throwIfNoEntry: false }) !== undefined;
    try {
        files.realPath(local);
        return true;
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
        return false;
    }
}

function systemCandidates(root: string, name: string, timeoutSeconds: number): string[] {
    const paths = which.sync(name, { nothrow: true, all: true }) ?? [];
    const mise = which.sync(MISE_PROGRAM, { nothrow: true });
    return paths.flatMap((path) => {
        if (basename(dirname(path)) !== MISE_SHIMS_FOLDER || mise === null) return [path];
        const result = spawnProcessBlocking([mise, MISE_WHICH, name], {
            cwd: root,
            env: TOOL_ENV,
            timeoutSeconds: timeoutSeconds,
        });
        const selected = result.stdout.trim();
        return result.code === 0 && selected !== '' ? [selected] : [];
    });
}

/**
 * The install command for managed tools, or platform guidance for a host tool.
 *
 * @param tool the pin.
 *
 * @returns the hint.
 */
function installHint(tool: ToolDeclaration): string {
    if (toolProjectPackage(tool) !== undefined || tool.system !== true) {
        if (toolProjectPackage(tool) !== undefined || which.sync('mise', { nothrow: true }) !== null)
            return 'Run: gspot install';
        return `Install mise (${MISE_INSTALL_URL}), or install ${tool.name} ${tool.version ?? ''} yourself.`;
    }
    return tool.install_hint ?? `Install ${tool.name}.`;
}

/**
 * Executables owned by the repository or its selected tool project installation, without executables from the system search path.
 *
 * @param root the repository root.
 * @param name the executable name.
 * @param options the search folders and installation ownership.
 *
 * @returns repository candidates in preference order.
 */
function locateRepositoryCandidates(root: string, name: string, options: LocateOptions): string[] {
    if (isAbsolute(name)) return statSync(name, { throwIfNoEntry: false }) === undefined ? [] : [name];
    using files = openFiles(root);
    const paths = searchDirectories(root, options).flatMap((directory) =>
        listExecutableNames(name).map((file) => join(directory, file)),
    );
    return paths.filter((path) => candidateExists(files, root, path));
}

// The inspection of a library whose tool-project package.json declares a version.
function libraryInspection(
    inputs: Omit<Inspected, 'path'>,
    path: string,
    found: string,
    want: string | undefined,
): ToolInspection {
    const { root, tool, hint } = inputs;
    const floor = tool.min_version ?? tool.version ?? found;
    let state = tool.version === undefined ? 'ok' : toolVersionState(found, tool.version, floor);
    if (tool.system === true) state = toolVersionState(found, undefined, floor);
    return {
        name: tool.name,
        state,
        path: tool.system === true ? path : join(root, path),
        found,
        hint,
        floor,
        ...stripUndefined({ want }),
    };
}

// Query a host library through the declared executable and its complete argument list.
function inspectLibraryCommand(
    context: ToolSearch,
    inputs: Omit<Inspected, 'path'>,
    command: string[],
    want: string | undefined,
): ToolInspection {
    const { root, cwd, tool, hint } = inputs;
    const program = command[0] as string;
    const args = command.slice(1);
    const [path] = locateCandidates(root, program, {
        timeoutSeconds: context.timeoutSeconds,
        searchFolders: [cwd, root],
        installedRoot: context.installedRoot,
    });
    return path === undefined
        ? missingInspection(tool, hint, want)
        : executableInspection(
              {
                  timeoutSeconds: context.timeoutSeconds,
                  root,
                  cwd,
                  tool: { ...tool, version_command: args },
                  path,
                  hint,
              },
              want,
          );
}

// Read library versions from the tool project installation used by generated tool files.
function inspectLibrary(
    context: ToolSearch,
    inputs: Omit<Inspected, 'path'>,
    want: string | undefined,
): ToolInspection {
    const { root, cwd, tool, hint } = inputs;
    if (tool.system === true && tool.version_command !== undefined)
        return inspectLibraryCommand(context, inputs, tool.version_command, want);
    const name = tool.installers['npm']?.name ?? tool.name;
    using files = openFiles(root);
    const path = `${NODE_MODULES_DIRECTORY}/${name}/package.json`;
    const installed =
        tool.system === true
            ? findInstalledDependency(root, join(relative(root, cwd), PACKAGE_JSON), name)
            : { ...installedPackage(files, root, join(root, path)), path };
    if (installed?.version === undefined) return missingInspection(tool, hint, want);
    return libraryInspection(inputs, installed.path, installed.version, want);
}

// The inspection of a tool without an installation in the search directories.
function missingInspection(tool: ToolDeclaration, hint: string, want: string | undefined): ToolInspection {
    return { name: tool.name, state: 'missing', hint, ...stripUndefined({ want }) };
}

// Query an executable once and assemble its host or selected-version inspection.
function executableInspection(inspected: Inspected, want: string | undefined): ToolInspection {
    const { root, cwd, tool, path, hint } = inspected;
    if (want === undefined && tool.version_command === undefined && tool.min_version === undefined)
        return { name: tool.name, state: 'system', path, hint };
    const read = readToolVersion(root, cwd, path, tool, inspected.timeoutSeconds);
    const expected = stripUndefined({ want });
    if ('state' in read) return { name: tool.name, path, hint, ...expected, ...read };
    const floor = tool.min_version ?? want;
    const state = toolVersionState(read.version, want, floor);
    return { name: tool.name, state, path, hint, found: read.version, ...expected, ...stripUndefined({ floor }) };
}

// Project compilers keep their ownership; a declared tool-project package supplies the compiler when absent.
function inspectProjectExecutable(
    context: ToolSearch,
    inputs: Omit<Inspected, 'path'>,
    want: string | undefined,
): ToolInspection | undefined {
    const { root, cwd, tool } = inputs;
    if (tool.system !== true) return undefined;
    const installation = toolProjectPackage(tool);
    if (installation === undefined) return undefined;
    const [project] = locateRepositoryCandidates(root, tool.name, {
        searchFolders: [cwd, root].flatMap((folder) =>
            context.installedRoot === undefined
                ? [folder]
                : [folder, join(context.installedRoot, relative(root, folder))],
        ),
        installedRoot: context.installedRoot,
    });
    if (project !== undefined) return executableInspection({ ...inputs, path: project }, want);
    const [toolProjectPath] = locateCandidates(root, tool.name, {
        timeoutSeconds: context.timeoutSeconds,
        searchFolders: [cwd, root],
        toolProjectKind: installation.kind,
        installedRoot: context.installedRoot,
    });
    if (toolProjectPath !== undefined)
        return executableInspection({ ...inputs, path: toolProjectPath }, tool.version ?? installation.version);
    return undefined;
}

function inspectExecutable(
    context: ToolSearch,
    inputs: Omit<Inspected, 'path'>,
    want: string | undefined,
): ToolInspection {
    const { root, cwd, tool } = inputs;
    const project = inspectProjectExecutable(context, inputs, want);
    if (project !== undefined) return project;
    const isExternal = tool.system === true;
    const searchFolders = isExternal ? [cwd, root] : [join(root, DOT_GSPOT), cwd, root];
    const installation = toolProjectPackage(tool);
    const kind = installation?.kind;
    const [path] = locateCandidates(root, tool.name, {
        timeoutSeconds: context.timeoutSeconds,
        searchFolders,
        miseBinPaths: tool.system === true ? undefined : (context.miseBinPaths ?? []),
        toolProjectKind: tool.system === true ? undefined : kind,
        installedRoot: context.installedRoot,
    });
    if (path === undefined) return missingInspection(tool, inputs.hint, want);
    return executableInspection({ ...inputs, path }, want);
}

/**
 * Read the selected program folders once for a command session.
 *
 * @param root the repository root.
 * @param toolNames the selected mise tool names.
 * @param timeoutSeconds the tool timeout in seconds.
 * @param steps the commands attempted during installation.
 *
 * @returns the installed executable directories selected by mise.
 */
function readMiseBinPaths(
    root: string,
    toolNames: string[],
    timeoutSeconds: number,
    steps: (readonly string[])[],
): string[] {
    if (
        toolNames.length === 0 ||
        which.sync('mise', { nothrow: true }) === null ||
        statSync(join(root, DOT_GSPOT), { throwIfNoEntry: false }) === undefined
    )
        return [];
    const command = [...MISE_BIN_PATHS_ARGUMENTS, ...toolNames];
    steps.push(command);
    const result = spawnProcessBlocking(command, {
        cwd: join(root, DOT_GSPOT),
        timeoutSeconds: timeoutSeconds,
        env: TOOL_ENV,
    });
    return result.code === 0 ? result.stdout.trim().split(/\r?\n/u).filter(Boolean) : [];
}

/**
 * Explain why the required tool cannot run.
 *
 * @param tool the declared tool.
 * @param inspection the observed installation.
 *
 * @returns the actionable installation note.
 */
function unavailableNote(tool: ToolDeclaration, inspection: ToolInspection): string {
    const hint = inspection.hint ?? installHint(tool);
    const version = tool.version === undefined ? '' : ` ${tool.version}`;
    return inspection.state === 'outdated'
        ? `${tool.name} ${inspection.found ?? '?'} is below ${inspection.floor ?? '?'}. ${hint}`
        : `${tool.name}${version} is not installed. ${hint}`;
}

/**
 * Every executable of the name, in the order gspot prefers them.
 *
 * @param root the repository root.
 * @param name the executable name.
 * @param options the search folders and tool project installation ownership.
 *
 * @returns the paths that exist.
 */
function locateCandidates(root: string, name: string, options: LocateOptions & { timeoutSeconds: number }): string[] {
    const found = locateRepositoryCandidates(root, name, options);
    if (isAbsolute(name) || options.toolProjectKind !== undefined) return found;
    const programs = (options.miseBinPaths ?? [])
        .flatMap((directory) => listExecutableNames(name).map((file) => join(directory, file)))
        .filter((path) => statSync(path, { throwIfNoEntry: false }) !== undefined);
    const paths =
        options.miseBinPaths === undefined
            ? systemCandidates(options.installedRoot ?? root, name, options.timeoutSeconds)
            : (which.sync(name, { nothrow: true, all: true }) ?? []);
    return [...programs, ...found, ...paths];
}

/**
 * Inspect one tool, reusing an inspection already made in this command session.
 *
 * @param context the repository root and session reads.
 * @param tool the pin.
 *
 * @returns the tool path, version, and availability.
 */
function inspectTool(context: ToolSearch, tool: ToolDeclaration): ToolInspection {
    const { root, inspections } = context;
    const cwd = context.cwd ?? root;
    const key = JSON.stringify([root, cwd, tool]);
    const cached = inspections.get(key);
    if (cached) return cached;
    const installedRoot = context.installedRoot ?? root;
    const inputs = {
        root: installedRoot,
        cwd: isInside(relative(root, cwd)) ? join(installedRoot, relative(root, cwd)) : cwd,
        tool,
        hint: installHint(tool),
        timeoutSeconds: context.timeoutSeconds,
    };
    const want = tool.system === true ? undefined : tool.version;
    const inspection =
        tool.kind === 'library' ? inspectLibrary(context, inputs, want) : inspectExecutable(context, inputs, want);
    inspections.set(key, inspection);
    return inspection;
}

/**
 * Whether the inspected tool can run at a supported version.
 *
 * @param inspection the executable inspection.
 *
 * @returns whether inspection found a usable executable.
 */
function isToolAvailable(inspection: ToolInspection): inspection is AvailableToolInspection {
    return new Set<string>(AVAILABLE_TOOL_STATES).has(inspection.state) && inspection.path !== undefined;
}

/**
 * Resolve a usable executable or an actionable inspection failure.
 *
 * @param tool the selected pin.
 * @param inspection the resolved path, version, and install command.
 *
 * @returns the executable path or its unavailable status and diagnostic.
 */
function toolAvailability(tool: ToolDeclaration, inspection: ToolInspection): ToolAvailability {
    if (isToolAvailable(inspection)) return { path: inspection.path };
    if (inspection.state === 'error')
        return { status: 'error', note: inspection.note ?? `${tool.name} version inspection failed.` };
    return { status: 'missing', note: unavailableNote(tool, inspection) };
}

export { inspectTool, unavailableNote, isToolAvailable, readMiseBinPaths, locateCandidates, toolAvailability };
