import { join, relative } from 'node:path';
import { remember } from '#cli/system/cache.ts';
import type { Tool } from '#cli/types/manifests.ts';
import { NODE_MODULES } from '#cli/config/system.ts';
import { joinScope } from '#cli/repository/scopes.ts';
import { openFiles } from '#cli/system/files/open.ts';
import { findProgram } from '#cli/system/programs.ts';
import { GSPOT_PATHS } from '#cli/config/manifests.ts';
import { MISE_TOOL } from '#cli/config/tools/installers.ts';
import { findMisePin, findPackagePin } from '#cli/tools/pins.ts';
import { PACKAGE_JSON, GSPOT_FOLDER } from '#cli/config/parsers.ts';
import { isInside, listEnclosingFolders } from '#cli/system/paths.ts';
import { readToolVersion, classifyToolVersion } from '#cli/tools/versions.ts';
import { START_RUNNERS, GSPOT_PACKAGES } from '#cli/config/repository/javascript.ts';
import { detectPackageManager } from '#cli/repository/javascript/package-manager.ts';
import { readToolProjectPackage, findInstalledDependency } from '#cli/tools/packages.ts';
import { readPackageJson, listProjectDependencyNames } from '#cli/repository/dependencies.ts';
import { INSTALL_HELP, MISE_INSTALL_URL, AVAILABLE_TOOL_STATES } from '#cli/config/tools/programs.ts';
import { readToolBinPaths, listExecutablePaths, listRepositoryExecutablePaths } from '#cli/tools/locate.ts';

import type {
    Session,
    ToolSearch,
    ScopeCheck,
    ToolFolders,
    InspectedTool,
    ToolInspection,
    ProcessFailure,
    ToolAvailability,
    ToolLookupSession,
    InstalledDependency,
} from '#cli/types/tools.ts';

const TOOL_LOOKUPS = Symbol('tool lookups');

const PROJECT_DEPENDENCIES_MESSAGE = 'Install the project dependencies first: node_modules is missing in {folder}.';

const ROOT_FOLDER_NAME = 'the repository root';

function buildProjectInstallHelp(folders: ToolFolders, name: string): string {
    const { root, cwd } = folders;
    const project = readPackageJson(cwd, PACKAGE_JSON);
    if (project?.dependencies?.[name] !== undefined || project?.devDependencies?.[name] !== undefined) {
        const scopePath = relative(root, cwd);
        return PROJECT_DEPENDENCIES_MESSAGE.replace('{folder}', () =>
            scopePath === '' ? ROOT_FOLDER_NAME : scopePath,
        );
    }
    const { installCommand } = START_RUNNERS[detectPackageManager(root, []).name];
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
    return toolProjectPackage === undefined && findProgram(MISE_TOOL) === undefined
        ? `Install mise (${MISE_INSTALL_URL}), or install ${tool.name} ${tool.version ?? ''} yourself.`
        : INSTALL_HELP;
}

function buildLibraryInspection(inspected: InspectedTool, path: string, found: string): ToolInspection {
    const { tool, help, want } = inspected;
    const minimum = tool.min_version ?? tool.version ?? found;
    const state = tool.system !== true && tool.version === undefined ? 'ok' : classifyToolVersion(found, want, minimum);
    return { name: tool.name, state, path, found, help, minimumVersion: minimum, want };
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
    const { tool, help, want } = inspected;
    if (want === undefined && tool.version_command === undefined && tool.min_version === undefined)
        return { name: tool.name, state: 'system', path, help };
    const read = await readToolVersion(inspected, path);
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
    if (path !== undefined) return inspectExecutablePath(inspected, path);
    return failure === undefined ? inspected.missing : { ...inspected.missing, note: failure };
}

function formatMissingProgram(tool: Tool, inspection: ToolInspection): string {
    const version = tool.version === undefined ? '' : ` ${tool.version}`;
    const isMiseTool = tool.system !== true && findPackagePin(tool) === undefined;
    return isMiseTool && inspection.state === 'missing' && findProgram(MISE_TOOL) === undefined
        ? 'mise is not on PATH.'
        : `${tool.name}${version} is not installed.`;
}

function buildInspectedTool(search: ToolSearch, tool: Tool): InspectedTool {
    const { root } = search;
    const cwd = search.cwd ?? root;
    const toolsRoot = search.toolsRoot ?? root;
    const help = buildInstallHelp(tool, { root, cwd });
    const want = tool.system === true ? undefined : tool.version;
    const missing: ToolInspection = { name: tool.name, state: 'missing', help, want };
    return {
        root: toolsRoot,
        cwd: isInside(relative(root, cwd)) ? join(toolsRoot, relative(root, cwd)) : cwd,
        tool,
        help,
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

/**
Require the installed npm dependencies of the scope before a check whose types or imports come from them. Without
them, every imported type reads as any, and the typed rules report each use. The packages of gspot itself give the
project no types, so a scope that declares only them can run.

@param session the repository and the folder that holds its installed packages.
@param planned the check and its project scope.
@returns the missing-dependencies result, or undefined when the check can run.
*/
export function findMissingDependencies(
    session: Pick<Session, 'repository' | 'toolsRoot'>,
    planned: Pick<ScopeCheck, 'check' | 'scope'>,
): ProcessFailure | undefined {
    if (planned.check.needs?.includes('dependencies') !== true) return undefined;
    const scopePath = planned.scope.path;
    const names = listProjectDependencyNames(session.repository.dependencyFiles, scopePath);
    if (names.every((name) => (GSPOT_PACKAGES as readonly string[]).includes(name))) return undefined;
    const files = openFiles(session.toolsRoot);
    const isInstalled = listEnclosingFolders(scopePath).some((folder) => {
        const modules = files.findStats(joinScope(folder, NODE_MODULES));
        return modules?.isDirectory() === true || modules?.isSymbolicLink() === true;
    });
    const folder = scopePath === '' ? ROOT_FOLDER_NAME : scopePath;
    return isInstalled
        ? undefined
        : { status: 'missing', note: PROJECT_DEPENDENCIES_MESSAGE.replace('{folder}', () => folder) };
}

/**
Explain why the required tool cannot run.

@param tool the tool to explain.
@param inspection the observed installation.
*/
export function formatUnavailableNote(tool: Tool, inspection: ToolInspection): string {
    const help = inspection.help ?? buildInstallHelp(tool);
    if (inspection.state === 'missing' && inspection.path === undefined && inspection.note !== undefined)
        return inspection.note;
    return inspection.state === 'outdated'
        ? `${tool.name} ${inspection.found ?? '?'} is below ${inspection.minimumVersion ?? '?'}. ${help}`
        : `${formatMissingProgram(tool, inspection)} ${help}`;
}

/**
Inspect one tool.

@param search where to search.
@param tool the tool to inspect.
*/
export async function inspectTool(search: ToolSearch, tool: Tool): Promise<ToolInspection> {
    const inspected = buildInspectedTool(search, tool);
    const inspection = await (tool.kind === 'package' ? inspectPackage(inspected) : inspectExecutable(inspected));
    if (inspection.state === 'ok') delete inspection.help;
    return inspection;
}

/**
Inspect one tool once per run. The working folder counts only for a system tool, which a project can supply. Only a
tool that mise installs waits for the folders that mise lists.

@param session the run, with its tool cache.
@param tool the tool to inspect.
@param cwd the working folder of the tool.
*/
export function lookUpTool(session: ToolLookupSession, tool: Tool, cwd: string): Promise<ToolInspection> {
    const folder = tool.system === true ? relative(session.root, cwd) : '';
    const isMiseTool = tool.system !== true && findPackagePin(tool) === undefined;
    return remember(session.toolCache, TOOL_LOOKUPS, JSON.stringify([folder, tool]), async () => {
        const { folders, failure } = isMiseTool ? await readToolBinPaths(session) : { folders: [], failure: undefined };
        return inspectTool({ ...session, cwd, miseBinPaths: folders, miseFailure: failure }, tool);
    });
}

/**
Find the path of a tool once per run, or the failure with the next step.

@param session the run, with its tool cache.
@param tool the tool to find.
@param cwd the working folder of the tool.
*/
// eslint-disable-next-line gspot/no-trivial-functions -- reason: The check runner, the fixers, and the docker test read a path or its failure through it at each call site.
export async function findToolPath(session: ToolLookupSession, tool: Tool, cwd: string): Promise<ToolAvailability> {
    return buildToolAvailability(tool, await lookUpTool(session, tool, cwd));
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
