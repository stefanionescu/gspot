import which from 'which';
import { join, relative } from 'node:path';
import { isInside } from '#cli/system/paths.ts';
import { openFiles } from '#cli/system/files/open.ts';
import { stripUndefined } from '#cli/system/tables.ts';
import { MISE_TOOL } from '#cli/config/tools/locate.ts';
import type { Tool } from '#cli/types/configurations.ts';
import type { ToolAvailability } from '#cli/types/tools/run.ts';
import { DOT_GSPOT, GSPOT_PATHS } from '#cli/config/gspot-folder.ts';
import { findToolProjectPackage } from '#cli/configurations/tools.ts';
import { PACKAGE_JSON } from '#cli/config/parsers/projects/dependencies.ts';
import { readToolVersion, classifyToolVersion } from '#cli/tools/versions.ts';
import { MISE_INSTALL_URL, AVAILABLE_TOOL_STATES } from '#cli/config/tools/inspect.ts';
import { listExecutablePaths, listRepositoryExecutablePaths } from '#cli/tools/locate.ts';
import type { InstalledDependency } from '#cli/types/repository/npm/installed-packages.ts';
import type { ToolSearch, InspectedTool, ToolInspection } from '#cli/types/tools/inspection.ts';
import { readToolProjectPackage, findInstalledDependency } from '#cli/repository/npm/installed-packages.ts';

function buildInstallHelp(tool: Tool): string {
    const toolProjectPackage = findToolProjectPackage(tool);
    if (toolProjectPackage !== undefined || tool.system !== true) {
        if (toolProjectPackage !== undefined || which.sync(MISE_TOOL, { nothrow: true }) !== null)
            return 'Run gspot install.';
        return `Install mise (${MISE_INSTALL_URL}), or install ${tool.name} ${tool.version ?? ''} yourself.`;
    }
    return tool.install_help ?? `Install ${tool.name}.`;
}

function buildLibraryInspection(inspected: InspectedTool, path: string, found: string): ToolInspection {
    const { tool, help, want } = inspected;
    const minimum = tool.min_version ?? tool.version ?? found;
    const state = tool.system !== true && tool.version === undefined ? 'ok' : classifyToolVersion(found, want, minimum);
    return { name: tool.name, state, path, found, help, minimumVersion: minimum, ...stripUndefined({ want }) };
}

function inspectLibraryCommand(inspected: InspectedTool, command: string[]): ToolInspection {
    const { root, cwd, tool, timeoutSeconds } = inspected;
    const program = command[0] as string;
    const commandArguments = command.slice(1);
    const [path] = listExecutablePaths(root, program, { search: 'mise', timeoutSeconds, searchFolders: [cwd, root] });
    return path === undefined
        ? buildMissingInspection(inspected)
        : inspectExecutablePath({ ...inspected, tool: { ...tool, version_command: commandArguments } }, path);
}

function inspectLibrary(inspected: InspectedTool): ToolInspection {
    const { root, cwd, tool } = inspected;
    if (tool.system === true && tool.version_command !== undefined)
        return inspectLibraryCommand(inspected, tool.version_command);
    const name = tool.installers['npm'] === undefined ? tool.name : tool.installers['npm'].name;
    let installed: InstalledDependency | undefined;
    if (tool.system === true) {
        installed = findInstalledDependency(root, join(relative(root, cwd), PACKAGE_JSON), name);
    } else {
        using files = openFiles(root);
        const path = join(root, GSPOT_PATHS.nodeModules, name, PACKAGE_JSON);
        installed = { path, version: readToolProjectPackage(files, root, path)?.version };
    }
    return installed?.version === undefined
        ? buildMissingInspection(inspected)
        : buildLibraryInspection(inspected, installed.path, installed.version);
}

// eslint-disable-next-line gspot/no-trivial-functions -- reason: 3 calls in this file share it.
function buildMissingInspection(inspected: InspectedTool): ToolInspection {
    const { tool, help, want } = inspected;
    return { name: tool.name, state: 'missing', help, ...stripUndefined({ want }) };
}

function inspectExecutablePath(inspected: InspectedTool, path: string): ToolInspection {
    const { tool, help, want } = inspected;
    if (want === undefined && tool.version_command === undefined && tool.min_version === undefined)
        return { name: tool.name, state: 'system', path, help };
    const read = readToolVersion(inspected, path);
    const expected = stripUndefined({ want });
    if ('state' in read) return { name: tool.name, path, help, ...expected, ...read };
    const minimum = tool.min_version ?? want;
    const state = classifyToolVersion(read.version, want, minimum);
    return {
        name: tool.name,
        state,
        path,
        help,
        found: read.version,
        ...expected,
        ...stripUndefined({ minimumVersion: minimum }),
    };
}

function inspectProjectExecutable(inspected: InspectedTool): ToolInspection | undefined {
    const { root, cwd, tool, timeoutSeconds } = inspected;
    if (tool.system !== true) return undefined;
    const toolProjectPackage = findToolProjectPackage(tool);
    if (toolProjectPackage === undefined) return undefined;
    const [project] = listRepositoryExecutablePaths(root, tool.name, { searchFolders: [cwd, root] });
    if (project !== undefined) return inspectExecutablePath(inspected, project);
    const [toolProjectPath] = listExecutablePaths(root, tool.name, {
        search: 'mise',
        timeoutSeconds,
        searchFolders: [cwd, root],
        toolFolderKind: toolProjectPackage.kind,
    });
    if (toolProjectPath !== undefined)
        return inspectExecutablePath(
            { ...inspected, want: tool.version ?? toolProjectPackage.version },
            toolProjectPath,
        );
    return undefined;
}

function inspectExecutable(inspected: InspectedTool): ToolInspection {
    const { root, cwd, tool, timeoutSeconds, miseBinPaths } = inspected;
    const project = inspectProjectExecutable(inspected);
    if (project !== undefined) return project;
    const isExternal = tool.system === true;
    const search = isExternal
        ? { search: 'mise' as const, searchFolders: [cwd, root] }
        : {
              search: 'path' as const,
              searchFolders: [join(root, DOT_GSPOT), cwd, root],
              miseBinPaths,
              toolFolderKind: findToolProjectPackage(tool)?.kind,
          };
    const [path] = listExecutablePaths(root, tool.name, { timeoutSeconds, ...search });
    return path === undefined ? buildMissingInspection(inspected) : inspectExecutablePath(inspected, path);
}

/**
Explain why the required tool cannot run.

@param tool the tool to explain.
@param inspection the observed installation.
@returns the install note, with the next step.
*/
export function formatUnavailableNote(tool: Tool, inspection: ToolInspection): string {
    const help = inspection.help ?? buildInstallHelp(tool);
    const version = tool.version === undefined ? '' : ` ${tool.version}`;
    return inspection.state === 'outdated'
        ? `${tool.name} ${inspection.found ?? '?'} is below ${inspection.minimumVersion ?? '?'}. ${help}`
        : `${tool.name}${version} is not installed. ${help}`;
}

/**
Inspect one tool, and reuse an inspection from earlier in this run.

@param search where to search, with the run cache.
@param tool the tool to inspect.
@returns the tool path, version, and availability.
*/
export function inspectTool(search: ToolSearch, tool: Tool): ToolInspection {
    const { root, inspections } = search;
    const cwd = search.cwd ?? root;
    const key = JSON.stringify([root, cwd, tool]);
    const cached = inspections.get(key);
    if (cached) return cached;
    const installedRoot = search.installedRoot ?? root;
    const inspected: InspectedTool = {
        root: installedRoot,
        cwd: isInside(relative(root, cwd)) ? join(installedRoot, relative(root, cwd)) : cwd,
        tool,
        help: buildInstallHelp(tool),
        timeoutSeconds: search.timeoutSeconds,
        want: tool.system === true ? undefined : tool.version,
        miseBinPaths: search.miseBinPaths,
    };
    const inspection = tool.kind === 'library' ? inspectLibrary(inspected) : inspectExecutable(inspected);
    inspections.set(key, inspection);
    return inspection;
}

/**
Resolve a usable executable, or a failure with the next step.

@param tool the tool and its pin.
@param inspection the resolved path, version, and install command.
@returns the executable path, or the unavailable status and its message.
*/
export function buildToolAvailability(tool: Tool, inspection: ToolInspection): ToolAvailability {
    if (AVAILABLE_TOOL_STATES.has(inspection.state) && inspection.path !== undefined) return { path: inspection.path };
    if (inspection.state === 'error')
        return { status: 'error', note: inspection.note ?? `gspot could not read the version of ${tool.name}.` };
    return { status: 'missing', note: formatUnavailableNote(tool, inspection) };
}
