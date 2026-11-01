import { join, relative } from 'node:path';
import { isInside } from '#cli/system/paths.ts';
import { findPackagePin } from '#cli/tools/pins.ts';
import type { Tool } from '#cli/types/manifests.ts';
import { openFiles } from '#cli/system/files/open.ts';
import { findProgram } from '#cli/system/programs.ts';
import { GSPOT_PATHS } from '#cli/config/manifests.ts';
import { MISE_TOOL } from '#cli/config/tools/installers.ts';
import { PACKAGE_JSON, GSPOT_FOLDER } from '#cli/config/parsers.ts';
import { readToolVersion, classifyToolVersion } from '#cli/tools/versions.ts';
import { readToolProjectPackage, findInstalledDependency } from '#cli/tools/packages.ts';
import { listExecutablePaths, listRepositoryExecutablePaths } from '#cli/tools/locate.ts';
import { INSTALL_HELP, MISE_INSTALL_URL, AVAILABLE_TOOL_STATES } from '#cli/config/tools/programs.ts';

import type {
    ToolSearch,
    InspectedTool,
    ToolInspection,
    ToolAvailability,
    InstalledDependency,
} from '#cli/types/tools.ts';

function buildInstallHelp(tool: Tool): string {
    const toolProjectPackage = findPackagePin(tool);
    if (toolProjectPackage !== undefined || tool.system !== true) {
        return toolProjectPackage === undefined && findProgram(MISE_TOOL) === undefined
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

function inspectPackage(inspected: InspectedTool): ToolInspection {
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
    const toolProjectPackage = findPackagePin(tool);
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
              toolFolderKind: findPackagePin(tool)?.kind,
          };
    const [path] = listExecutablePaths(root, tool.name, { timeoutSeconds, ...search });
    return path === undefined ? inspected.missing : inspectExecutablePath(inspected, path);
}

function formatMissingProgram(tool: Tool, inspection: ToolInspection): string {
    const version = tool.version === undefined ? '' : ` ${tool.version}`;
    const needsMise = tool.system !== true && findPackagePin(tool) === undefined;
    if (inspection.state === 'missing' && needsMise && findProgram(MISE_TOOL) === undefined)
        return 'mise is not on PATH.';
    return `${tool.name}${version} is not installed.`;
}

/**
Explain why the required tool cannot run.

@param tool the tool to explain.
@param inspection the observed installation.
*/
export function formatUnavailableNote(tool: Tool, inspection: ToolInspection): string {
    const help = inspection.help ?? buildInstallHelp(tool);
    if (inspection.state === 'outdated')
        return `${tool.name} ${inspection.found ?? '?'} is below ${inspection.minimumVersion ?? '?'}. ${help}`;
    return `${formatMissingProgram(tool, inspection)} ${help}`;
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
    const inspection = tool.kind === 'package' ? inspectPackage(inspected) : inspectExecutable(inspected);
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
