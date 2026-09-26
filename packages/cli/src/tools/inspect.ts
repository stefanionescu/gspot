// What the tool prints about its version, with no color codes: their numbers read as a version.

import semver from 'semver';
import { join } from 'node:path';
import { runBlocking } from '#cli/platform/spawn.ts';
import { stripVTControlCharacters } from 'node:util';
import type { SpawnResult } from '#cli/types/platform.ts';
import { installHint } from '#cli/tools/install-hints.ts';
import { hasPolicy, readPolicy } from '#cli/policy/read.ts';
import { readOwnership } from '#cli/lifecycle/ownership.ts';
import { privateToolInstallation } from '#cli/tools/pins.ts';
import { openConfinedRoot } from '#cli/platform/filesystem.ts';
import { NODE_MODULES_DIRECTORY } from '#cli/constants/platform.ts';
import type { Manifest, ToolPin } from '#cli/types/configurations.ts';
import { configurationManifests } from '#cli/configurations/manifests.ts';
import { NO_VERSION, VERSION_TIMEOUT_MS } from '#cli/constants/tools/tools.ts';
import { locateCandidates, miseVersion, packageVersion } from '#cli/tools/locate.ts';

import type {
    PackageFacts,
    Inspected,
    ToolContext,
    ToolInspection,
    VersionObservation,
} from '#cli/types/tools/tools.ts';

// A mise shim answers for the folder it runs in, so the command runs in the repository.
function printedVersion(root: string, path: string, tool: ToolPin): SpawnResult {
    const command = tool.version_command ?? ['--version'];
    return runBlocking([path, ...command], {
        cwd: root,
        timeoutMs: VERSION_TIMEOUT_MS,
        env: { NO_COLOR: '1', ...tool.env },
    });
}

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
): VersionObservation | undefined {
    if (result.isTimedOut === true) return { state: 'error', note: `${tool.name} version inspection timed out.` };
    if (result.missing || text.includes(NO_VERSION)) return { state: 'missing', note: text };
    if (result.code !== expectedExit)
        return { state: 'error', note: `${tool.name} version inspection exited ${String(result.code)}: ${text}` };
    return undefined;
}

// An npm tool is the version its package says. Some print another one: license-checker-rseidelsohn 5.0.1 prints 4.4.2.
// A shim that no configuration gives a version starts nothing, whatever mise keeps installed for other repositories.
function readVersion(root: string, cwd: string, path: string, tool: ToolPin): VersionObservation {
    const npm = tool.installers['npm'];
    const installedPackage = packageVersion(root, path, npm?.name);
    return observeToolVersion(tool, printedVersion(cwd, path, tool), installedPackage, miseVersion(path, tool));
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
    const files = openConfinedRoot(root);
    const hint = installHint(tool);
    const name = tool.installers['npm']?.name ?? tool.name;
    const path = `${NODE_MODULES_DIRECTORY}/${name}/package.json`;
    try {
        const file = files.read(path);
        const parsed = file === undefined ? undefined : (JSON.parse(file.bytes.toString('utf8')) as PackageFacts);
        if (parsed?.version === undefined) return missingInspection(tool, hint);
        return libraryInspection(root, tool, path, parsed.version, hint);
    } finally {
        files.close();
    }
}

// The inspection of a tool that is not installed anywhere gspot looks.
function missingInspection(tool: ToolPin, hint: string): ToolInspection {
    const want = tool.version === undefined ? {} : { want: tool.version };
    return { name: tool.name, state: 'missing', hint, ...want };
}

// The inspection of a host tool, or an unpinned one: present, with the version it prints when it has a version command.
function hostInspection(inspected: Inspected): ToolInspection {
    const { root, cwd, tool, path, hint } = inspected;
    if (tool.version_command === undefined) return { name: tool.name, state: 'host', path, hint };
    const observed = readVersion(root, cwd, path, tool);
    if ('state' in observed) return { name: tool.name, path, hint, ...observed };
    return { name: tool.name, state: 'host', path, hint, found: observed.version };
}

// The inspection of a pinned tool: its printed version against the pin and the floor.
function pinnedInspection(inspected: Inspected, want: string): ToolInspection {
    const { root, cwd, tool, path, hint } = inspected;
    const observed = readVersion(root, cwd, path, tool);
    if ('state' in observed) return { name: tool.name, path, hint, want, ...observed };
    const floor = tool.floor ?? want;
    const state = toolVersionState(observed.version, want, floor);
    return { name: tool.name, state, path, want, found: observed.version, hint, floor };
}

function inspectUncached(root: string, cwd: string, tool: ToolPin, runner?: string): ToolInspection {
    const roots = tool.provider === 'host' ? [cwd, root] : [join(root, '.gspot'), cwd, root];
    const [path] = locateCandidates(root, roots, tool.name, privateToolInstallation(tool, runner)?.kind);
    const hint = installHint(tool);
    if (path === undefined) return missingInspection(tool, hint);
    const inspected: Inspected = { root, cwd, tool, path, hint };
    if (tool.provider === 'host' || tool.version === undefined) return hostInspection(inspected);
    return pinnedInspection(inspected, tool.version);
}

// Whether a pending private installation covers the tool, so a inspection cannot say anything true about it.
function isInstallationPending(pending: string[] | undefined, tool: ToolPin): boolean {
    if (tool.provider === 'host' || pending === undefined) return false;
    const npmPending = pending.includes('npm') && tool.installers['npm'] !== undefined;
    const pythonPending = pending.includes('python') && tool.installers['pypi'] !== undefined;
    return npmPending || pythonPending;
}

// The exit code the version command is expected to end with: the package's own when the package is installed.
function expectedExitCode(tool: ToolPin, installedPackage: string | undefined): number {
    const npm = tool.installers['npm'];
    const fromPackage = installedPackage === undefined ? undefined : npm?.version_exit_code;
    return fromPackage ?? tool.version_exit_code ?? 0;
}

/**
 * Interpret an executable version response for both installation and later inspections.
 * @param tool the pin
 * @param result what the version command printed and how it exited
 * @param installedPackage the version the private npm package declares, when the tool is one
 * @param installedMiseVersion the version mise installed, when the tool is a mise tool
 * @returns the version, or the state and note of a tool that gave none
 */
export function observeToolVersion(
    tool: ToolPin,
    result: SpawnResult,
    installedPackage?: string,
    installedMiseVersion?: string,
): VersionObservation {
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
 * @returns the first path found
 */
export function locateTool(root: string, name: string): string | undefined {
    if ((readOwnership(root).installations?.length ?? 0) > 0)
        throw new Error('Tool installation is incomplete. Run: gspot install');
    const runner = hasPolicy(root) ? readPolicy(root).policy.runner?.tool : undefined;
    const tool = toolPin(configurationManifests().values(), name);
    const roots = tool.provider === 'host' ? [root] : [join(root, '.gspot'), root];
    return locateCandidates(root, roots, name, privateToolInstallation(tool, runner)?.kind)[0];
}

/**
 * Inspections one tool, sharing identical observations within its command session.
 * @param context the repository root and session observations
 * @param tool the pin
 * @returns where the tool is, its version and its state
 */
export function inspectTool(context: ToolContext, tool: ToolPin): ToolInspection {
    const { root, inspections } = context;
    if (isInstallationPending(readOwnership(root).installations, tool))
        return {
            name: tool.name,
            state: 'error',
            hint: 'Run: gspot install',
            note: 'Tool installation is incomplete. Run: gspot install',
        };
    const cwd = context.cwd ?? root;
    const runner = context.policyFiles?.policy.runner?.tool;
    const key = JSON.stringify([root, cwd, tool, runner]);
    const cached = inspections.get(key);
    if (cached) return cached;
    const inspection = tool.kind === 'library' ? inspectLibrary(root, tool) : inspectUncached(root, cwd, tool, runner);
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
    return { name, provider: 'host', windows: true, installers: {} };
}

/** Thrown by an analysis when the command it runs is not installed. */
export class MissingToolError extends Error {
    /**
     * Names the command that is absent.
     * @param text what is missing and, where the analysis knows it, how to install it
     */
    constructor(text: string) {
        super(text);
        this.name = 'MissingToolError';
    }
}
