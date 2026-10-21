// Inspect tool versions and report installation guidance.
import which from 'which';
import { join, relative } from 'node:path';
import { isInside } from '#cli/system/paths.ts';
import { openFiles } from '#cli/system/files/open.ts';
import { stripUndefined } from '#cli/system/values.ts';
import type { ToolAvailability } from '#cli/types/tools/run.ts';
import { PACKAGE_JSON } from '#cli/config/parsers/dependencies.ts';
import type { ToolDeclaration } from '#cli/types/configurations.ts';
import { findToolProjectPackage } from '#cli/configurations/tools.ts';
import { readToolVersion, classifyToolVersion } from '#cli/tools/versions.ts';
import type { InstalledDependency } from '#cli/types/parsers/dependencies.ts';
import { locateCandidates, locateRepositoryCandidates } from '#cli/tools/locate.ts';
import { DOT_GSPOT, GSPOT_NODE_MODULES_PATH } from '#cli/config/system/locations.ts';
import type { ToolSearch, InspectedTool, ToolInspection } from '#cli/types/tools/find.ts';
import { readToolProjectPackage, findInstalledDependency } from '#cli/repository/packages.ts';
import { MISE_PROGRAM, MISE_INSTALL_URL, AVAILABLE_TOOL_STATES } from '#cli/config/tools/find.ts';

/**
 * Build the install command for managed tools, or the install advice for a system tool.
 *
 * @param tool the pin.
 *
 * @returns the next install step.
 */
function buildInstallHint(tool: ToolDeclaration): string {
    const installation = findToolProjectPackage(tool);
    if (installation !== undefined || tool.system !== true) {
        if (installation !== undefined || which.sync(MISE_PROGRAM, { nothrow: true }) !== null)
            return 'Run: gspot install';
        return `Install mise (${MISE_INSTALL_URL}), or install ${tool.name} ${tool.version ?? ''} yourself.`;
    }
    return tool.install_hint ?? `Install ${tool.name}.`;
}

// Build the inspection of a library whose tool-project package.json declares a version.
function buildLibraryInspection(inspected: InspectedTool, path: string, found: string): ToolInspection {
    const { tool, hint, want } = inspected;
    const floor = tool.min_version ?? tool.version ?? found;
    const state = tool.system !== true && tool.version === undefined ? 'ok' : classifyToolVersion(found, want, floor);
    return { name: tool.name, state, path, found, hint, floor, ...stripUndefined({ want }) };
}

// Query a system library through the declared executable and its complete argument list.
function inspectLibraryCommand(inspected: InspectedTool, command: string[]): ToolInspection {
    const { root, cwd, tool, timeoutSeconds } = inspected;
    const program = command[0] as string;
    const commandArguments = command.slice(1);
    const [path] = locateCandidates(root, program, { search: 'mise', timeoutSeconds, searchFolders: [cwd, root] });
    return path === undefined
        ? buildMissingInspection(inspected)
        : inspectExecutablePath({ ...inspected, tool: { ...tool, version_command: commandArguments } }, path);
}

// Read library versions from the tool project installation used by generated tool files.
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
        const path = join(root, GSPOT_NODE_MODULES_PATH, name, PACKAGE_JSON);
        installed = { path, version: readToolProjectPackage(files, root, path)?.version };
    }
    return installed?.version === undefined
        ? buildMissingInspection(inspected)
        : buildLibraryInspection(inspected, installed.path, installed.version);
}

// Build the inspection of a tool without an installation in the search folders.
function buildMissingInspection(inspected: InspectedTool): ToolInspection {
    const { tool, hint, want } = inspected;
    return { name: tool.name, state: 'missing', hint, ...stripUndefined({ want }) };
}

// Query an executable once, and build its system or pinned-version inspection.
function inspectExecutablePath(inspected: InspectedTool, path: string): ToolInspection {
    const { tool, hint, want } = inspected;
    if (want === undefined && tool.version_command === undefined && tool.min_version === undefined)
        return { name: tool.name, state: 'system', path, hint };
    const read = readToolVersion(inspected, path);
    const expected = stripUndefined({ want });
    if ('state' in read) return { name: tool.name, path, hint, ...expected, ...read };
    const floor = tool.min_version ?? want;
    const state = classifyToolVersion(read.version, want, floor);
    return { name: tool.name, state, path, hint, found: read.version, ...expected, ...stripUndefined({ floor }) };
}

// Project compilers keep their ownership; a declared tool-project package supplies the compiler when absent.
function inspectProjectExecutable(inspected: InspectedTool): ToolInspection | undefined {
    const { root, cwd, tool, timeoutSeconds } = inspected;
    if (tool.system !== true) return undefined;
    const installation = findToolProjectPackage(tool);
    if (installation === undefined) return undefined;
    const [project] = locateRepositoryCandidates(root, tool.name, { searchFolders: [cwd, root] });
    if (project !== undefined) return inspectExecutablePath(inspected, project);
    const [toolProjectPath] = locateCandidates(root, tool.name, {
        search: 'mise',
        timeoutSeconds,
        searchFolders: [cwd, root],
        toolProjectKind: installation.kind,
    });
    if (toolProjectPath !== undefined)
        return inspectExecutablePath({ ...inspected, want: tool.version ?? installation.version }, toolProjectPath);
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
              toolProjectKind: findToolProjectPackage(tool)?.kind,
          };
    const [path] = locateCandidates(root, tool.name, { timeoutSeconds, ...search });
    return path === undefined ? buildMissingInspection(inspected) : inspectExecutablePath(inspected, path);
}

/**
 * Explain why the required tool cannot run.
 *
 * @param tool the declaration to explain.
 * @param inspection the observed installation.
 *
 * @returns the install note, with the next step.
 */
export function formatUnavailableNote(tool: ToolDeclaration, inspection: ToolInspection): string {
    const hint = inspection.hint ?? buildInstallHint(tool);
    const version = tool.version === undefined ? '' : ` ${tool.version}`;
    return inspection.state === 'outdated'
        ? `${tool.name} ${inspection.found ?? '?'} is below ${inspection.floor ?? '?'}. ${hint}`
        : `${tool.name}${version} is not installed. ${hint}`;
}

/**
 * Inspect one tool, and reuse an inspection from earlier in this run.
 *
 * @param context where to search, with the run cache.
 * @param tool the pin.
 *
 * @returns the tool path, version, and availability.
 */
export function inspectTool(context: ToolSearch, tool: ToolDeclaration): ToolInspection {
    const { root, inspections } = context;
    const cwd = context.cwd ?? root;
    const key = JSON.stringify([root, cwd, tool]);
    const cached = inspections.get(key);
    if (cached) return cached;
    const installedRoot = context.installedRoot ?? root;
    const inspected: InspectedTool = {
        root: installedRoot,
        cwd: isInside(relative(root, cwd)) ? join(installedRoot, relative(root, cwd)) : cwd,
        tool,
        hint: buildInstallHint(tool),
        timeoutSeconds: context.timeoutSeconds,
        want: tool.system === true ? undefined : tool.version,
        miseBinPaths: context.miseBinPaths,
    };
    const inspection = tool.kind === 'library' ? inspectLibrary(inspected) : inspectExecutable(inspected);
    inspections.set(key, inspection);
    return inspection;
}

/**
 * Resolve a usable executable, or a failure with the next step.
 *
 * @param tool the declaration and its pin.
 * @param inspection the resolved path, version, and install command.
 *
 * @returns the executable path, or the unavailable status and its message.
 */
export function buildToolAvailability(tool: ToolDeclaration, inspection: ToolInspection): ToolAvailability {
    if (AVAILABLE_TOOL_STATES.has(inspection.state) && inspection.path !== undefined) return { path: inspection.path };
    if (inspection.state === 'error')
        return { status: 'error', note: inspection.note ?? `${tool.name} version inspection failed.` };
    return { status: 'missing', note: formatUnavailableNote(tool, inspection) };
}
