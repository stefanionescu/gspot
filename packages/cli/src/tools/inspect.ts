// Locate declared tools, inspect their versions, and report an actionable installation command.
import semver from 'semver';
import { join, relative } from 'node:path';
import { runBlocking } from '#cli/platform/spawn.ts';
import { openRoot } from '#cli/platform/root/open.ts';
import type { ToolPin } from '#cli/types/configurations.ts';
import { parseVersionOutput } from '#cli/parsers/tool/version.ts';
import { installedPackage } from '#cli/repository/package-manifests.ts';
import { misePin, toolProjectPackage } from '#cli/configurations/pins.ts';
import type { ParsedToolVersion } from '#cli/types/parsers/tool-version.ts';
import { HOST_HINTS, VERSION_TIMEOUT_MS } from '#cli/config/tools/install.ts';
import { OPERATING_SYSTEMS } from '#cli/config/platform/operating-systems.ts';
import { DOT_GSPOT, NODE_MODULES_DIRECTORY } from '#cli/config/platform/locations.ts';
import { packageVersion, locateCandidates, locateRepositoryCandidates } from '#cli/tools/locate.ts';

import type {
    Inspected,
    ToolSearch,
    ToolInspection,
    ToolAvailability,
    AvailableToolInspection,
} from '#cli/types/tools/install.ts';

/**
 * The installation command for managed tools, or platform guidance for a host tool.
 * @param tool the pin
 * @param runner the declared installation integration
 * @returns the hint
 */
function installHint(tool: ToolPin, runner?: string): string {
    if (toolProjectPackage(tool, runner) !== undefined || (tool.system !== true && runner === 'mise'))
        return 'Run: gspot install';
    const [command] = OPERATING_SYSTEMS.filter(({ node }) => node === process.platform).flatMap((system) =>
        system.installers.flatMap(({ installer, command }) => {
            const pin = tool.installers[installer];
            return pin === undefined ? [] : [`${command} ${pin.name}`];
        }),
    );
    if (command !== undefined) return command;
    if (tool.system === true) return HOST_HINTS[tool.name] ?? `install ${tool.name}`;
    const pin = misePin(tool);
    if (pin === undefined) return `Install ${tool.name} using its supported installer.`;
    const requirement = [pin.name, pin.version].filter((value) => value !== undefined).join('@');
    return `Install mise (https://mise.jdx.dev/getting-started.html), then run: mise install ${requirement}`;
}

// An npm tool is the version its package says. For example, `license-checker-rseidelsohn@5.0.1` prints `4.4.2`.
function readToolVersion(root: string, cwd: string, path: string, tool: ToolPin): ParsedToolVersion {
    const npm = tool.installers['npm'];
    const installedVersion = packageVersion(root, path, npm?.name);
    const result = runBlocking([path, ...(tool.version_command ?? ['--version'])], {
        cwd,
        timeoutMs: VERSION_TIMEOUT_MS,
        env: { NO_COLOR: '1', ...tool.env },
    });
    return parseVersionOutput(tool, result, installedVersion);
}

// The inspection of a library whose tool-project package.json declares a version.
function libraryInspection(root: string, tool: ToolPin, path: string, found: string, hint: string): ToolInspection {
    const want = tool.version === undefined ? {} : { want: tool.version };
    const floor = tool.min_version ?? tool.version ?? found;
    const state = tool.version === undefined ? 'ok' : toolVersionState(found, tool.version, floor);
    return { name: tool.name, state, path: join(root, path), found, hint, floor, ...want };
}

// Read library versions from the tool project installation used by generated configurations.
function inspectLibrary(root: string, tool: ToolPin): ToolInspection {
    using files = openRoot(root);
    const hint = installHint(tool);
    const name = tool.installers['npm']?.name ?? tool.name;
    const path = `${NODE_MODULES_DIRECTORY}/${name}/package.json`;
    const parsed = installedPackage(files, root, join(root, path));
    if (parsed?.version === undefined) return missingInspection(tool, hint);
    return libraryInspection(root, tool, path, parsed.version, hint);
}

// The inspection of a tool that is not installed anywhere gspot looks.

function missingInspection(tool: ToolPin, hint: string): ToolInspection {
    const want = tool.version === undefined ? {} : { want: tool.version };
    return { name: tool.name, state: 'missing', hint, ...want };
}

// The inspection of a host tool, or an unpinned one: present, with the version it prints when it has a version command.
// A version below the floor the manifest names makes it outdated.
function hostInspection(inspected: Inspected): ToolInspection {
    const { root, cwd, tool, path, hint } = inspected;
    if (tool.version_command === undefined) return { name: tool.name, state: 'host', path, hint };
    const read = readToolVersion(root, cwd, path, tool);
    if ('state' in read) return { name: tool.name, path, hint, ...read };
    if (tool.min_version === undefined) return { name: tool.name, state: 'host', path, hint, found: read.version };
    const isBelow = isBelowFloor(read.version, tool.min_version);
    return {
        name: tool.name,
        state: isBelow ? 'outdated' : 'host',
        path,
        hint,
        found: read.version,
        floor: tool.min_version,
    };
}

// The inspection of a pinned tool: its printed version against the pin and the floor.
function pinnedInspection(inspected: Inspected, want: string): ToolInspection {
    const { root, cwd, tool, path, hint } = inspected;
    const read = readToolVersion(root, cwd, path, tool);
    if ('state' in read) return { name: tool.name, path, hint, want, ...read };
    const floor = tool.min_version ?? want;
    const state = toolVersionState(read.version, want, floor);
    return { name: tool.name, state, path, want, found: read.version, hint, floor };
}

// Project compilers keep their native ownership; a declared tool-project package supplies the compiler when absent.
function inspectProjectExecutable(
    context: ToolSearch,
    cwd: string,
    tool: ToolPin,
    runner?: string,
): ToolInspection | undefined {
    if (tool.system !== true) return undefined;
    const installation = toolProjectPackage(tool, runner);
    if (installation === undefined) return undefined;
    const { root } = context;
    const hint = installHint(tool, runner);
    const [project] = locateRepositoryCandidates(root, tool.name, {
        searchFolders: [cwd, root].flatMap((folder) =>
            context.installedRoot === undefined
                ? [folder]
                : [folder, join(context.installedRoot, relative(root, folder))],
        ),
        installedRoot: context.installedRoot,
    });
    if (project !== undefined) return executableInspection({ root, cwd, tool, path: project, hint });
    if (isInstallationPending(context, tool, runner)) return pendingInspection(tool);
    const [toolProjectPath] = locateCandidates(root, tool.name, {
        searchFolders: [cwd, root],
        toolProjectKind: installation.kind,
        installedRoot: context.installedRoot,
    });
    if (toolProjectPath !== undefined)
        return pinnedInspection({ root, cwd, tool, path: toolProjectPath, hint }, tool.version ?? installation.version);
    return undefined;
}

// Both project lookup and ordinary executable discovery apply the same host/pin classification.
function executableInspection(inspected: Inspected): ToolInspection {
    const { tool } = inspected;
    return tool.system === true || tool.version === undefined
        ? hostInspection(inspected)
        : pinnedInspection(inspected, tool.version);
}

function inspectExecutable(context: ToolSearch, cwd: string, tool: ToolPin, runner?: string): ToolInspection {
    const project = inspectProjectExecutable(context, cwd, tool, runner);
    if (project !== undefined) return project;
    const { root } = context;
    const isExternal = tool.system === true || (runner === 'mise' && tool.installers['mise'] !== undefined);
    const searchFolders = isExternal ? [cwd, root] : [join(root, DOT_GSPOT), cwd, root];
    const installation = toolProjectPackage(tool, runner);
    const kind = installation?.kind;
    const hint = installHint(tool, runner);
    const [path] = locateCandidates(root, tool.name, {
        searchFolders,
        toolProjectKind: tool.system === true ? undefined : kind,
        installedRoot: context.installedRoot,
    });
    if (path === undefined) return missingInspection(tool, hint);
    const inspected: Inspected = { root, cwd, tool, path, hint };
    return executableInspection(inspected);
}

// Only the selected tool project installation can make its tool unavailable while installation is pending.
function isInstallationPending(
    search: Pick<ToolSearch, 'root' | 'installedRoot' | 'getPendingInstallations'>,
    tool: ToolPin,
    runner?: string,
): boolean {
    const installation = toolProjectPackage(tool, runner);
    const pending = search.getPendingInstallations?.(search.installedRoot ?? search.root);
    return installation !== undefined && pending?.includes(installation.kind) === true;
}

// Incomplete tool project installations block their tools, including a compiler selected after project lookup.
function pendingInspection(tool: ToolPin): ToolInspection {
    return {
        name: tool.name,
        state: 'error',
        hint: 'Run: gspot install',
        note: 'Tool installation is incomplete. Run: gspot install',
    };
}

// The accepted floor applies equally to host tools and pinned tool-project tools.
function isBelowFloor(found: string, floor: string): boolean {
    const version = semver.coerce(found);
    const lowest = semver.coerce(floor);
    return version !== null && lowest !== null && semver.lt(version, lowest);
}

// A missing executable or outdated version needs the install command recorded by its inspection.
function unavailableNote(tool: ToolPin, inspection: ToolInspection): string {
    const hint = inspection.hint ?? installHint(tool);
    const version = tool.version === undefined ? '' : ` ${tool.version}`;
    return inspection.state === 'outdated'
        ? `${tool.name} ${inspection.found ?? '?'} is below ${inspection.floor ?? '?'}. ${hint}`
        : `${tool.name}${version} is not installed. ${hint}`;
}

/**
 * Classify a reported version against its pin and floor.
 * @param found the version the tool reported
 * @param want the pinned version
 * @param floor the lowest version the configuration accepts
 * @returns ok, outdated below the floor, newer above the pin, or error for no version
 */
export function toolVersionState(found: string, want: string, floor: string): ToolInspection['state'] {
    const version = semver.coerce(found);
    if (version === null) return 'error';
    if (isBelowFloor(found, floor)) return 'outdated';
    const pinned = semver.coerce(want);
    return pinned !== null && semver.gt(version, pinned) ? 'newer' : 'ok';
}

/**
 * Inspect one tool, reusing an inspection already made in this command session.
 * @param context the repository root and session reads
 * @param tool the pin
 * @returns where the tool is, its version, and its state
 */
export function inspectTool(context: ToolSearch, tool: ToolPin): ToolInspection {
    const { root, inspections } = context;
    const runner = context.policyFiles?.policy.runner;
    const pending = isInstallationPending(context, tool, runner);
    if (tool.system !== true && pending) return pendingInspection(tool);
    const cwd = context.cwd ?? root;
    const key = JSON.stringify([root, cwd, tool, runner, pending]);
    const cached = inspections.get(key);
    if (cached) return cached;
    const inspection =
        tool.kind === 'library'
            ? inspectLibrary(context.installedRoot ?? root, tool)
            : inspectExecutable(context, cwd, tool, runner);
    inspections.set(key, inspection);
    return inspection;
}

/**
 * Whether the inspected tool can run at a supported version.
 * @param inspection the executable inspection
 * @returns whether a resolved, usable executable is available
 */
export function isToolAvailable(inspection: ToolInspection): inspection is AvailableToolInspection {
    return ['ok', 'host', 'newer'].includes(inspection.state) && inspection.path !== undefined;
}

/**
 * Resolve a usable executable or an actionable inspection failure.
 * @param tool the selected pin
 * @param inspection the resolved path, version, and installation details
 * @returns the executable path or its unavailable status and diagnostic
 */
export function toolAvailability(tool: ToolPin, inspection: ToolInspection): ToolAvailability {
    if (isToolAvailable(inspection)) return { path: inspection.path };
    if (inspection.state === 'error')
        return { status: 'error', note: inspection.note ?? `${tool.name} version inspection failed.` };
    return { status: 'missing', note: unavailableNote(tool, inspection) };
}
