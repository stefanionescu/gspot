import { join, relative } from 'node:path';

import { GSPOT_PATHS } from '#cli/config/manifests.ts';
import { PACKAGE_JSON } from '#cli/config/parsers/projects.ts';
import { GSPOT_FOLDER, MISE_PROGRAM } from '#cli/config/system.ts';
import {
    AVAILABLE_TOOL_STATES,
    INSTALL_HELP,
    MISE_INSTALL_URL,
    PROJECT_DEPENDENCIES_MESSAGE,
    ROOT_FOLDER_NAME,
} from '#cli/config/tools/programs.ts';
import { readPackageJson } from '#cli/parsers/projects/dependencies.ts';
import { detectPackageManager } from '#cli/repository/projects/package-manager.ts';
import { selectInstallCommand } from '#cli/repository/projects/runner.ts';
import { remember } from '#cli/system/cache.ts';
import { openFiles } from '#cli/system/files/open.ts';
import { isInside } from '#cli/system/paths.ts';
import { findProgram } from '#cli/system/processes/programs.ts';
import { findMisePin, findPackagePin } from '#cli/tools/pins.ts';
import { listExecutablePaths, listRepositoryExecutablePaths } from '#cli/tools/programs/locate.ts';
import { readToolBinPaths } from '#cli/tools/programs/mise.ts';
import { findInstalledDependency, readToolProjectPackage } from '#cli/tools/programs/packages.ts';
import { classifyToolVersion, readToolVersion } from '#cli/tools/programs/versions.ts';
import type { Tool } from '#cli/types/manifests.ts';
import type {
    InspectedTool,
    InstalledDependency,
    ToolAvailability,
    ToolFolders,
    ToolInspection,
    ToolLookupSession,
    ToolSearch,
} from '#cli/types/tools.ts';

const TOOL_LOOKUPS = Symbol('tool lookups');

function buildProjectInstallHelp(folders: ToolFolders, name: string): string {
    const { root, cwd } = folders;
    const project = readPackageJson(cwd, PACKAGE_JSON);
    if (project?.dependencies?.[name] !== undefined || project?.devDependencies?.[name] !== undefined) {
        const scopePath = relative(root, cwd);
        return PROJECT_DEPENDENCIES_MESSAGE.replace('{folder}', () =>
            scopePath === '' ? ROOT_FOLDER_NAME : scopePath,
        );
    }
    const installCommand = selectInstallCommand(detectPackageManager(root, []).name, cwd);
    return `Run ${installCommand.replace('<package>@<version>', () => name)}.`;
}

function buildSystemInstallHelp(tool: Tool, folders: ToolFolders | undefined): string {
    if (tool.install_help !== undefined) return tool.install_help;
    const npm = tool.installers['npm'];
    return npm === undefined || folders === undefined
        ? `Install ${tool.name}.`
        : buildProjectInstallHelp(folders, npm.name);
}

function buildInstallHelp(tool: Tool, folders?: ToolFolders): string {
    const toolProjectPackage = findPackagePin(tool);
    if (toolProjectPackage === undefined && tool.system === true) return buildSystemInstallHelp(tool, folders);
    return toolProjectPackage === undefined && findProgram(MISE_PROGRAM) === undefined
        ? `Install mise (${MISE_INSTALL_URL}), or install ${tool.name} ${tool.version ?? ''} yourself.`
        : INSTALL_HELP;
}

function buildLibraryInspection(inspected: InspectedTool, path: string, found: string): ToolInspection {
    const { tool, want } = inspected;
    const minimum = tool.min_version ?? tool.version ?? found;
    const state = tool.system !== true && tool.version === undefined ? 'ok' : classifyToolVersion(found, want, minimum);
    return { name: tool.name, state, path, found, minimumVersion: minimum, want };
}

async function inspectLibraryCommand(inspected: InspectedTool, command: string[]): Promise<ToolInspection> {
    const { root, cwd, tool, timeoutSeconds } = inspected;
    const program = command[0] as string;
    const commandArguments = command.slice(1);
    const { paths } = await listExecutablePaths(root, program, { timeoutSeconds, folders: [cwd, root] });
    const [path] = paths;
    return path === undefined
        ? inspected.missing
        : inspectExecutablePath({ ...inspected, tool: { ...tool, version_command: commandArguments } }, path);
}

async function inspectPackage(inspected: InspectedTool): Promise<ToolInspection> {
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

async function inspectExecutablePath(inspected: InspectedTool, path: string): Promise<ToolInspection> {
    const { tool, want } = inspected;
    if (want === undefined && tool.version_command === undefined && tool.min_version === undefined)
        return { name: tool.name, state: 'system', path };
    const read = await readToolVersion(inspected, path);
    if ('state' in read) return { name: tool.name, path, want, ...read };
    const minimum = tool.min_version ?? want;
    const state = classifyToolVersion(read.version, want, minimum);
    return {
        name: tool.name,
        state,
        path,
        found: read.version,
        want,
        minimumVersion: minimum,
    };
}

async function inspectProjectExecutable(inspected: InspectedTool): Promise<ToolInspection | undefined> {
    const { root, cwd, tool, timeoutSeconds } = inspected;
    if (tool.system !== true) return undefined;
    const toolProjectPackage = findPackagePin(tool);
    if (toolProjectPackage === undefined) return undefined;
    const [project] = listRepositoryExecutablePaths(root, tool.name, { folders: [cwd, root] });
    if (project !== undefined) return inspectExecutablePath(inspected, project);
    const { paths } = await listExecutablePaths(root, tool.name, {
        timeoutSeconds,
        folders: [cwd, root],
        toolFolderKind: toolProjectPackage.kind,
    });
    const [toolProjectPath] = paths;
    if (toolProjectPath !== undefined)
        return inspectExecutablePath(
            { ...inspected, want: tool.version ?? toolProjectPackage.version },
            toolProjectPath,
        );
    return undefined;
}

/**
Pick what the search for a program says. A refused mise lookup is why a program that mise installs is absent, so its
note stays unless the system search path holds a program that the pin accepts.
*/
function selectSearchInspection(
    inspected: InspectedTool,
    found: ToolInspection | undefined,
    failure: string | undefined,
): ToolInspection {
    const isRefused = inspected.tool.system !== true && inspected.missing.note !== undefined;
    if (found !== undefined) return isRefused && !AVAILABLE_TOOL_STATES.has(found.state) ? inspected.missing : found;
    return failure === undefined || isRefused ? inspected.missing : { ...inspected.missing, note: failure };
}

async function inspectExecutable(inspected: InspectedTool): Promise<ToolInspection> {
    const { root, cwd, tool, timeoutSeconds, miseBinPaths } = inspected;
    const project = await inspectProjectExecutable(inspected);
    if (project !== undefined) return project;
    const isExternal = tool.system === true;
    const search = isExternal
        ? { folders: [cwd, root] }
        : {
              folders: [join(root, GSPOT_FOLDER)],
              miseBinPaths,
              toolFolderKind: findPackagePin(tool)?.kind,
          };
    const { paths, failure } = await listExecutablePaths(root, tool.name, { timeoutSeconds, ...search });
    const [path] = paths;
    const found = path === undefined ? undefined : await inspectExecutablePath(inspected, path);
    return selectSearchInspection(inspected, found, failure);
}

function formatMissingProgram(tool: Tool, inspection: ToolInspection): string {
    const version = tool.version === undefined ? '' : ` ${tool.version}`;
    const isMiseTool = tool.system !== true && findPackagePin(tool) === undefined;
    return isMiseTool && inspection.state === 'missing' && findProgram(MISE_PROGRAM) === undefined
        ? 'mise is not on PATH.'
        : `${tool.name}${version} is not installed.`;
}

function buildInspectedTool(search: ToolSearch, tool: Tool): InspectedTool {
    const { root } = search;
    const cwd = search.cwd ?? root;
    const toolsRoot = search.toolsRoot ?? root;
    const want = tool.system === true ? undefined : tool.version;
    const missing: ToolInspection = { name: tool.name, state: 'missing', want };
    return {
        root: toolsRoot,
        cwd: isInside(relative(root, cwd)) ? join(toolsRoot, relative(root, cwd)) : cwd,
        tool,
        missing:
            search.miseFailure === undefined || findMisePin(tool) === undefined
                ? missing
                : { ...missing, note: search.miseFailure },
        timeoutSeconds: search.settings.tool_timeout_seconds,
        want,
        miseBinPaths: search.miseBinPaths,
        runsVersionCommand: search.runsVersionCommand,
    };
}

export function formatUnavailableNote(tool: Tool, inspection: ToolInspection): string {
    const help = inspection.help ?? buildInstallHelp(tool);
    if (inspection.state === 'missing' && inspection.path === undefined && inspection.note !== undefined)
        return inspection.note;
    return inspection.state === 'outdated'
        ? `${tool.name} ${inspection.found ?? '?'} is below ${inspection.minimumVersion ?? '?'}. ${help}`
        : `${formatMissingProgram(tool, inspection)} ${help}`;
}

export async function inspectTool(search: ToolSearch, tool: Tool): Promise<ToolInspection> {
    const inspected = buildInspectedTool(search, tool);
    const inspection = await (tool.kind === 'package' ? inspectPackage(inspected) : inspectExecutable(inspected));
    return inspection.state === 'ok'
        ? inspection
        : { ...inspection, help: buildInstallHelp(tool, { root: search.root, cwd: search.cwd ?? search.root }) };
}

/**
Inspect one tool once per run. The working folder counts only for a system tool, which a project can supply. Only a
tool that mise installs waits for the folders that mise lists.
*/
export function lookUpTool(session: ToolLookupSession, tool: Tool, cwd: string): Promise<ToolInspection> {
    const folder = tool.system === true ? relative(session.root, cwd) : '';
    const isMiseTool = tool.system !== true && findPackagePin(tool) === undefined;
    return remember(session.toolCache, TOOL_LOOKUPS, JSON.stringify([folder, tool]), async () => {
        const { folders, failure } = isMiseTool ? await readToolBinPaths(session) : { folders: [], failure: undefined };
        return inspectTool({ ...session, cwd, miseBinPaths: folders, miseFailure: failure }, tool);
    });
}

export async function findToolPath(session: ToolLookupSession, tool: Tool, cwd: string): Promise<ToolAvailability> {
    return buildToolAvailability(tool, await lookUpTool(session, tool, cwd));
}

export function buildToolAvailability(tool: Tool, inspection: ToolInspection): ToolAvailability {
    if (AVAILABLE_TOOL_STATES.has(inspection.state) && inspection.path !== undefined) return { path: inspection.path };
    return inspection.state === 'error'
        ? { status: 'error', note: inspection.note ?? `gspot could not read the version of ${tool.name}.` }
        : { status: 'missing', note: formatUnavailableNote(tool, inspection) };
}
