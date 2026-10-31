import which from 'which';
import { join, relative } from 'node:path';
import { isInside } from '#cli/system/paths.ts';
import type { Tool } from '#cli/types/manifests.ts';
import { openFiles } from '#cli/system/files/open.ts';
import { PACKAGE_JSON } from '#cli/config/parsers/projects.ts';
import { findToolProjectPackage } from '#cli/manifests/tools.ts';
import { GSPOT_PATHS, GSPOT_FOLDER } from '#cli/config/files/gspot.ts';
import type { ToolAvailability } from '#cli/types/executables/executables.ts';
import type { InstalledDependency } from '#cli/types/repository/javascript.ts';
import { readToolVersion, classifyToolVersion } from '#cli/executables/versions.ts';
import { readToolProjectPackage, findInstalledDependency } from '#cli/executables/packages.ts';
import { listExecutablePaths, listRepositoryExecutablePaths } from '#cli/executables/locate.ts';
import type { ToolSearch, InspectedTool, ToolInspection } from '#cli/types/executables/inspection.ts';
import { MISE_TOOL, INSTALL_HELP, MISE_INSTALL_URL, AVAILABLE_TOOL_STATES } from '#cli/config/executables.ts';

function buildInstallHelp(tool: Tool): string {
    const toolProjectPackage = findToolProjectPackage(tool);
    if (toolProjectPackage !== undefined || tool.system !== true) {
        return toolProjectPackage === undefined && which.sync(MISE_TOOL, { nothrow: true }) === null
            ? `Install mise (${MISE_INSTALL_URL}), or install ${tool.name} ${tool.version ?? ''} yourself.`
            : INSTALL_HELP;
    }
    return tool.install_help ?? `Install ${tool.name}.`;
}

function buildLibraryInspection(inspected: InspectedTool, path: string, found: string): ToolInspection {
    const { tool, help, want } = inspected;
    const minimum = tool.min_version ?? tool.version ?? found;
    const state = tool.system !== true && tool.version === undefined ? 'ok' : classifyToolVersion(found, want, minimum);
    return { name: tool.name, state, path, found, help, minimumVersion: minimum, want };
}

function inspectLibraryCommand(inspected: InspectedTool, command: string[]): ToolInspection {
    const { root, cwd, tool, timeoutSeconds } = inspected;
    const program = command[0] as string;
    const commandArguments = command.slice(1);
    const [path] = listExecutablePaths(root, program, { timeoutSeconds, folders: [cwd, root] });
    return path === undefined
        ? inspected.missing
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
        const files = openFiles(root);
        const path = join(root, GSPOT_PATHS.nodeModules, name, PACKAGE_JSON);
        installed = { path, version: readToolProjectPackage(files, root, path)?.version };
    }
    return installed?.version === undefined
        ? inspected.missing
        : buildLibraryInspection(inspected, installed.path, installed.version);
}

function inspectExecutablePath(inspected: InspectedTool, path: string): ToolInspection {
    const { tool, help, want } = inspected;
    if (want === undefined && tool.version_command === undefined && tool.min_version === undefined)
        return { name: tool.name, state: 'system', path, help };
    const read = readToolVersion(inspected, path);
    if ('state' in read) return { name: tool.name, path, help, want, ...read };
    const minimum = tool.min_version ?? want;
    const state = classifyToolVersion(read.version, want, minimum);
    return {
        name: tool.name,
        state,
        path,
        help,
        found: read.version,
        want,
        minimumVersion: minimum,
    };
}

function inspectProjectExecutable(inspected: InspectedTool): ToolInspection | undefined {
    const { root, cwd, tool, timeoutSeconds } = inspected;
    if (tool.system !== true) return undefined;
    const toolProjectPackage = findToolProjectPackage(tool);
    if (toolProjectPackage === undefined) return undefined;
    const [project] = listRepositoryExecutablePaths(root, tool.name, { folders: [cwd, root] });
    if (project !== undefined) return inspectExecutablePath(inspected, project);
    const [toolProjectPath] = listExecutablePaths(root, tool.name, {
        timeoutSeconds,
        folders: [cwd, root],
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
        ? { folders: [cwd, root] }
        : {
              folders: [join(root, GSPOT_FOLDER)],
              miseBinPaths,
              toolFolderKind: findToolProjectPackage(tool)?.kind,
          };
    const [path] = listExecutablePaths(root, tool.name, { timeoutSeconds, ...search });
    return path === undefined ? inspected.missing : inspectExecutablePath(inspected, path);
}

/**
Explain why the required tool cannot run.

@param tool the tool to explain.
@param inspection the observed installation.
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
*/
export function inspectTool(search: ToolSearch, tool: Tool): ToolInspection {
    const { root, inspections } = search;
    const cwd = search.cwd ?? root;
    const key = JSON.stringify([root, cwd, tool]);
    const cached = inspections.get(key);
    if (cached) return cached;
    const toolsRoot = search.toolsRoot ?? root;
    const help = buildInstallHelp(tool);
    const want = tool.system === true ? undefined : tool.version;
    const inspected: InspectedTool = {
        root: toolsRoot,
        cwd: isInside(relative(root, cwd)) ? join(toolsRoot, relative(root, cwd)) : cwd,
        tool,
        help,
        missing: { name: tool.name, state: 'missing', help, want },
        timeoutSeconds: search.timeoutSeconds,
        want,
        miseBinPaths: search.miseBinPaths,
    };
    const inspection = tool.kind === 'library' ? inspectLibrary(inspected) : inspectExecutable(inspected);
    if (inspection.state === 'ok') delete inspection.help;
    inspections.set(key, inspection);
    return inspection;
}

/**
Resolve a usable executable, or a failure with the next step.

@param tool the tool and its pin.
@param inspection the resolved path, version, and install command.
*/
export function buildToolAvailability(tool: Tool, inspection: ToolInspection): ToolAvailability {
    if (AVAILABLE_TOOL_STATES.has(inspection.state) && inspection.path !== undefined) return { path: inspection.path };
    return inspection.state === 'error'
        ? { status: 'error', note: inspection.note ?? `gspot could not read the version of ${tool.name}.` }
        : { status: 'missing', note: formatUnavailableNote(tool, inspection) };
}
