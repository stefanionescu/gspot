// What the tool prints about its version, with no color codes: their numbers read as a version.

import semver from 'semver';
import { join } from 'node:path';
import { runBlocking } from '#cli/platform/spawn.ts';
import { stripVTControlCharacters } from 'node:util';
import { kitManifests } from '#cli/kits/manifests.ts';
import { openRoot } from '#cli/platform/filesystem.ts';
import type { ToolPin, Manifest } from '#cli/types/kits.ts';
import { hasPolicy, readPolicy } from '#cli/policy/read.ts';
import { NODE_MODULES_DIRECTORY } from '#cli/config/kits.ts';
import { privateToolInstallation } from '#cli/tools/pins.ts';
import type { SpawnResult } from '#cli/types/platform/platform.ts';
import { miseVersion, packageVersion, locateCandidates } from '#cli/tools/locate.ts';
import type { Package, Inspected, ToolSearch, VersionRead, ToolInspection } from '#cli/types/tools/tools.ts';

import {
    HOST_HINTS,
    NO_VERSION,
    MISE_BACKENDS,
    VERSION_TIMEOUT_MS,
    PLATFORM_INSTALLERS,
} from '#cli/config/tools/tools.ts';

function parsedVersion(text: string, tool: ToolPin): string | undefined {
    if (tool.version_regex === undefined) return semver.coerce(text)?.version;
    const match = new RegExp(tool.version_regex, 'u').exec(text);
    return match?.[1] ?? match?.[0];
}

function versionFailure(
    result: SpawnResult,
    tool: ToolPin,
    text: string,
    expectedExit: number,
): VersionRead | undefined {
    if (result.isTimedOut === true) return { state: 'error', note: `${tool.name} version inspection timed out.` };
    if (result.missing || text.includes(NO_VERSION)) return { state: 'missing', note: text };
    if (result.code !== expectedExit)
        return { state: 'error', note: `${tool.name} version inspection exited ${String(result.code)}: ${text}` };
    return undefined;
}

// An npm tool is the version its package says. For example, `license-checker-rseidelsohn@5.0.1` prints `4.4.2`.
// A shim that no configuration gives a version starts nothing, whatever mise keeps installed for other repositories.
function versionOf(root: string, cwd: string, path: string, tool: ToolPin): VersionRead {
    const npm = tool.installers['npm'];
    const installedPackage = packageVersion(root, path, npm?.name);
    const result = runBlocking([path, ...(tool.version_command ?? ['--version'])], {
        cwd,
        timeoutMs: VERSION_TIMEOUT_MS,
        env: { NO_COLOR: '1', ...tool.env },
    });
    return readVersion(tool, result, installedPackage, miseVersion(path, tool));
}

// The inspection of a library whose private package.json declares a version.
function libraryInspection(root: string, tool: ToolPin, path: string, found: string, hint: string): ToolInspection {
    const want = tool.version === undefined ? {} : { want: tool.version };
    const floor = tool.floor ?? tool.version ?? found;
    const state = tool.version === undefined ? 'ok' : toolVersionState(found, tool.version, floor);
    return { name: tool.name, state, path: join(root, path), found, hint, floor, ...want };
}

// Read library versions from the private installation used by generated configurations.
function inspectLibrary(root: string, tool: ToolPin): ToolInspection {
    using files = openRoot(root);
    const hint = installHint(tool);
    const name = tool.installers['npm']?.name ?? tool.name;
    const path = `${NODE_MODULES_DIRECTORY}/${name}/package.json`;
    const file = files.read(path);
    const parsed = file === undefined ? undefined : (JSON.parse(file.bytes.toString('utf8')) as Package);
    if (parsed?.version === undefined) return missingInspection(tool, hint);
    return libraryInspection(root, tool, path, parsed.version, hint);
}

// The inspection of a tool that is not installed anywhere gspot looks.
// eslint-disable-next-line gspot/no-trivial-functions -- reason: Two inspections report a missing tool; the caller sits at the complexity limit.
function missingInspection(tool: ToolPin, hint: string): ToolInspection {
    const want = tool.version === undefined ? {} : { want: tool.version };
    return { name: tool.name, state: 'missing', hint, ...want };
}

// The inspection of a host tool, or an unpinned one: present, with the version it prints when it has a version command.
// A version below the floor the manifest names makes it outdated.
function hostInspection(inspected: Inspected): ToolInspection {
    const { root, cwd, tool, path, hint } = inspected;
    if (tool.version_command === undefined) return { name: tool.name, state: 'host', path, hint };
    const read = versionOf(root, cwd, path, tool);
    if ('state' in read) return { name: tool.name, path, hint, ...read };
    if (tool.floor === undefined) return { name: tool.name, state: 'host', path, hint, found: read.version };
    const isBelow = toolVersionState(read.version, read.version, tool.floor) === 'outdated';
    return {
        name: tool.name,
        state: isBelow ? 'outdated' : 'host',
        path,
        hint,
        found: read.version,
        floor: tool.floor,
    };
}

// The inspection of a pinned tool: its printed version against the pin and the floor.
function pinnedInspection(inspected: Inspected, want: string): ToolInspection {
    const { root, cwd, tool, path, hint } = inspected;
    const read = versionOf(root, cwd, path, tool);
    if ('state' in read) return { name: tool.name, path, hint, want, ...read };
    const floor = tool.floor ?? want;
    const state = toolVersionState(read.version, want, floor);
    return { name: tool.name, state, path, want, found: read.version, hint, floor };
}

function inspectUncached(context: ToolSearch, cwd: string, tool: ToolPin, runner?: string): ToolInspection {
    const { root } = context;
    const isExternal = tool.provider === 'host' || (runner === 'mise' && tool.installers['mise'] !== undefined);
    const roots = isExternal ? [cwd, root] : [join(root, '.gspot'), cwd, root];
    const kind = privateToolInstallation(tool, runner)?.kind;
    const [path] = locateCandidates(root, roots, tool.name, kind, context.installedRoot);
    const hint = installHint(tool);
    if (path === undefined) return missingInspection(tool, hint);
    const inspected: Inspected = { root, cwd, tool, path, hint };
    if (tool.provider === 'host' || tool.version === undefined) return hostInspection(inspected);
    return pinnedInspection(inspected, tool.version);
}

// Only the selected private installation can make its tool unavailable while installation is pending.
function isInstallationPending(
    search: Pick<ToolSearch, 'root' | 'installedRoot' | 'installations'>,
    tool: ToolPin,
    runner?: string,
): boolean {
    const installation = privateToolInstallation(tool, runner);
    const pending = search.installations?.(search.installedRoot ?? search.root);
    return installation !== undefined && pending?.includes(installation.kind) === true;
}

// The exit code the version command is expected to end with: the package's own when the package is installed.
function expectedExitCode(tool: ToolPin, installedPackage: string | undefined): number {
    const npm = tool.installers['npm'];
    const fromPackage = installedPackage === undefined ? undefined : npm?.version_exit_code;
    return fromPackage ?? tool.version_exit_code ?? 0;
}

/**
 * Interpret an executable version response for both installation and later inspections.
 * @param tool the pin.
 * @param result what the version command printed and how it exited.
 * @param installedPackage the version the private npm package declares, when the tool is one.
 * @param installedMiseVersion the version mise installed, when the tool is a mise tool.
 * @returns the version, or the state and note of a tool that gave none.
 */
export function readVersion(
    tool: ToolPin,
    result: SpawnResult,
    installedPackage?: string,
    installedMiseVersion?: string,
): VersionRead {
    const npm = tool.installers['npm'];
    const text = stripVTControlCharacters(`${result.stdout}\n${result.stderr}`).trim();
    const failure = versionFailure(result, tool, text, expectedExitCode(tool, installedPackage));
    if (failure !== undefined) return failure;
    const version =
        (npm?.version === tool.version ? installedPackage : undefined) ??
        installedMiseVersion ??
        parsedVersion(text, tool);
    if (version === undefined || semver.coerce(version) === null)
        return { state: 'error', note: `${tool.name} did not report a valid version: ${text}` };
    return { version };
}

/**
 * Classify a native version against its selected pin and accepted floor.
 * @param found the version the tool reported
 * @param want the pinned version
 * @param floor the lowest version the configuration accepts
 * @returns ok, outdated below the floor, newer above the pin, or error for no version
 */
export function toolVersionState(found: string, want: string, floor: string): ToolInspection['state'] {
    const version = semver.coerce(found);
    if (version === null) return 'error';
    const lowest = semver.coerce(floor);
    if (lowest !== null && semver.lt(version, lowest)) return 'outdated';
    const pinned = semver.coerce(want);
    return pinned !== null && semver.gt(version, pinned) ? 'newer' : 'ok';
}

/**
 * Where a tool is, searching the repository's bin folders, PATH, and mise shims, or undefined.
 * @param root the repository root
 * @param name the executable name
 * @param pending the installations an interrupted gspot install left pending
 * @returns the first path found
 */
export function locateTool(root: string, name: string, pending?: string[]): string | undefined {
    const runner = hasPolicy(root) ? readPolicy(root).policy.runner?.tool : undefined;
    const tool = toolPin(kitManifests().values(), name);
    if (isInstallationPending({ root, installations: () => pending }, tool, runner))
        throw new Error('Tool installation is incomplete. Run: gspot install');
    const isExternal = tool.provider === 'host' || (runner === 'mise' && tool.installers['mise'] !== undefined);
    const roots = isExternal ? [root] : [join(root, '.gspot'), root];
    return locateCandidates(root, roots, name, privateToolInstallation(tool, runner)?.kind)[0];
}

/**
 * Inspections one tool, sharing identical reads within its command session.
 * @param context the repository root and session reads
 * @param tool the pin
 * @returns where the tool is, its version, and its state
 */
export function inspectTool(context: ToolSearch, tool: ToolPin): ToolInspection {
    const { root, inspections } = context;
    const runner = context.policyFiles?.policy.runner?.tool;
    if (isInstallationPending(context, tool, runner))
        return {
            name: tool.name,
            state: 'error',
            hint: 'Run: gspot install',
            note: 'Tool installation is incomplete. Run: gspot install',
        };
    const cwd = context.cwd ?? root;
    const key = JSON.stringify([root, cwd, tool, runner]);
    const cached = inspections.get(key);
    if (cached) return cached;
    const inspection =
        tool.kind === 'library' ? inspectLibrary(root, tool) : inspectUncached(context, cwd, tool, runner);
    inspections.set(key, inspection);
    return inspection;
}

/**
 * Resolve a declared executable pin, or a repository-owned host command.
 * @param manifests the manifests that may declare the tool
 * @param name the tool name
 * @returns the declared pin, or a host command pin when no manifest declares it
 */
export function toolPin(manifests: Iterable<Manifest>, name: string): ToolPin {
    for (const manifest of manifests) {
        const pin = manifest.tools.find((tool) => tool.name === name);
        if (pin !== undefined) return pin;
    }
    return { name, provider: 'host', installers: {} };
}

/**
 * The installation command for managed tools, or platform guidance for a host tool.
 * @param tool the pin
 * @returns the hint
 */
export function installHint(tool: ToolPin): string {
    if (tool.provider === 'host') return HOST_HINTS[tool.name] ?? `install ${tool.name}`;
    if (MISE_BACKENDS.some(({ installer }) => tool.installers[installer] !== undefined)) return 'Run: gspot install';
    const match = PLATFORM_INSTALLERS.find(
        ({ platform, installer }) => platform === process.platform && tool.installers[installer] !== undefined,
    );
    if (match !== undefined) return `${match.command} ${tool.installers[match.installer]?.name ?? ''}`;
    return tool.version === undefined ? `install ${tool.name}` : `install ${tool.name} ${tool.version}`;
}
