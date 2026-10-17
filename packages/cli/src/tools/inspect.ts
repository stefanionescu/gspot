// Inspect tool versions and report installation guidance.
import which from 'which';
import { join, relative } from 'node:path';
import { isInside } from '#cli/system/paths.ts';
import { openFiles } from '#cli/system/files/open.ts';
import { stripUndefined } from '#cli/system/values.ts';
import type { ToolAvailability } from '#cli/types/tools/run.ts';
import type { ToolDeclaration } from '#cli/types/configurations.ts';
import { findToolProjectPackage } from '#cli/configurations/tools.ts';
import { PACKAGE_JSON } from '#cli/config/parsers/dependency-files.ts';
import { readToolVersion, classifyToolVersion } from '#cli/tools/versions.ts';
import { locateCandidates, locateRepositoryCandidates } from '#cli/tools/locate.ts';
import { DOT_GSPOT, GSPOT_NODE_MODULES_PATH } from '#cli/config/system/locations.ts';
import type { Inspected, ToolSearch, ToolInspection } from '#cli/types/tools/find.ts';
import { readToolProjectPackage, findInstalledDependency } from '#cli/tools/npm/packages.ts';
import { MISE_PROGRAM, MISE_INSTALL_URL, AVAILABLE_TOOL_STATES } from '#cli/config/tools/find.ts';

/**
 * Build the install command for managed tools, or the install advice for a system tool.
 *
 * @param tool the pin.
 *
 * @returns the next install step.
 */
function installHint(tool: ToolDeclaration): string {
    const installation = findToolProjectPackage(tool);
    if (installation !== undefined || tool.system !== true) {
        if (installation !== undefined || which.sync(MISE_PROGRAM, { nothrow: true }) !== null)
            return 'Run: gspot install';
        return `Install mise (${MISE_INSTALL_URL}), or install ${tool.name} ${tool.version ?? ''} yourself.`;
    }
    return tool.install_hint ?? `Install ${tool.name}.`;
}

// Build the inspection of a library whose tool-project package.json declares a version.
function buildLibraryInspection(
    inputs: Omit<Inspected, 'path'>,
    path: string,
    found: string,
    want: string | undefined,
): ToolInspection {
    const { root, tool, hint } = inputs;
    const floor = tool.min_version ?? tool.version ?? found;
    let state = tool.version === undefined ? 'ok' : classifyToolVersion(found, tool.version, floor);
    if (tool.system === true) state = classifyToolVersion(found, undefined, floor);
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

// Query a system library through the declared executable and its complete argument list.
function inspectLibraryCommand(
    context: ToolSearch,
    inputs: Omit<Inspected, 'path'>,
    command: string[],
    want: string | undefined,
): ToolInspection {
    const { root, cwd, tool, hint } = inputs;
    const program = command[0] as string;
    const commandArguments = command.slice(1);
    const [path] = locateCandidates(root, program, {
        search: 'mise',
        timeoutSeconds: context.timeoutSeconds,
        searchFolders: [cwd, root],
        installedRoot: context.installedRoot,
    });
    return path === undefined
        ? buildMissingInspection(tool, hint, want)
        : inspectExecutablePath(
              {
                  timeoutSeconds: context.timeoutSeconds,
                  root,
                  cwd,
                  tool: { ...tool, version_command: commandArguments },
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
    const path = `${GSPOT_NODE_MODULES_PATH}/${name}/package.json`;
    const installed =
        tool.system === true
            ? findInstalledDependency(root, join(relative(root, cwd), PACKAGE_JSON), name)
            : { ...readToolProjectPackage(files, root, join(root, path)), path };
    if (installed?.version === undefined) return buildMissingInspection(tool, hint, want);
    return buildLibraryInspection(inputs, installed.path, installed.version, want);
}

// Build the inspection of a tool without an installation in the search folders.
function buildMissingInspection(tool: ToolDeclaration, hint: string, want: string | undefined): ToolInspection {
    return { name: tool.name, state: 'missing', hint, ...stripUndefined({ want }) };
}

// Query an executable once, and build its system or pinned-version inspection.
function inspectExecutablePath(inspected: Inspected, want: string | undefined): ToolInspection {
    const { root, cwd, tool, path, hint } = inspected;
    if (want === undefined && tool.version_command === undefined && tool.min_version === undefined)
        return { name: tool.name, state: 'system', path, hint };
    const read = readToolVersion(root, cwd, path, tool, inspected.timeoutSeconds);
    const expected = stripUndefined({ want });
    if ('state' in read) return { name: tool.name, path, hint, ...expected, ...read };
    const floor = tool.min_version ?? want;
    const state = classifyToolVersion(read.version, want, floor);
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
    const installation = findToolProjectPackage(tool);
    if (installation === undefined) return undefined;
    const [project] = locateRepositoryCandidates(root, tool.name, {
        searchFolders: [cwd, root].flatMap((folder) =>
            context.installedRoot === undefined
                ? [folder]
                : [folder, join(context.installedRoot, relative(root, folder))],
        ),
        installedRoot: context.installedRoot,
    });
    if (project !== undefined) return inspectExecutablePath({ ...inputs, path: project }, want);
    const [toolProjectPath] = locateCandidates(root, tool.name, {
        search: 'mise',
        timeoutSeconds: context.timeoutSeconds,
        searchFolders: [cwd, root],
        toolProjectKind: installation.kind,
        installedRoot: context.installedRoot,
    });
    if (toolProjectPath !== undefined)
        return inspectExecutablePath({ ...inputs, path: toolProjectPath }, tool.version ?? installation.version);
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
    const search = isExternal
        ? { search: 'mise' as const, searchFolders: [cwd, root] }
        : {
              search: 'path' as const,
              searchFolders: [join(root, DOT_GSPOT), cwd, root],
              miseBinPaths: context.miseBinPaths,
              toolProjectKind: findToolProjectPackage(tool)?.kind,
          };
    const [path] = locateCandidates(root, tool.name, {
        timeoutSeconds: context.timeoutSeconds,
        ...search,
        installedRoot: context.installedRoot,
    });
    if (path === undefined) return buildMissingInspection(tool, inputs.hint, want);
    return inspectExecutablePath({ ...inputs, path }, want);
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
    const hint = inspection.hint ?? installHint(tool);
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
