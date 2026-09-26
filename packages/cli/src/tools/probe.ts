import semver from 'semver';
import { homedir } from 'node:os';
import { dirname, join, relative } from 'node:path';
import { runBlocking } from '#cli/platform/spawn.ts';
import { stripVTControlCharacters } from 'node:util';
import type { PolicyFiles } from '#cli/policy/read.ts';
import { miseHome } from '#cli/platform/environment.ts';
import type { SpawnResult } from '#cli/platform/spawn.ts';
import { installHint } from '#cli/tools/install-hints.ts';
import { hasPolicy, readPolicy } from '#cli/policy/read.ts';
import { readOwnership } from '#cli/lifecycle/ownership.ts';
import { privateToolInstallation } from '#cli/tools/pins.ts';
import { openConfinedRoot } from '#cli/platform/filesystem.ts';
import { readFileSync, realpathSync, statSync } from 'node:fs';
import type { Manifest, ToolPin } from '#cli/configurations/manifests.ts';
import { configurationManifests } from '#cli/configurations/manifests.ts';
import { NODE_MODULES_DIRECTORY, PYTHON_ENVIRONMENT_DIRECTORY } from '#cli/platform/paths.ts';

/** The two facts of a package.json that say which package it is. */
type PackageFacts = { name?: string; version?: string };

type VersionObservation = { version: string } | { state: 'missing' | 'error'; note: string };

const VERSION_TIMEOUT_MS = 15_000;
// What a mise shim prints when no configuration in reach names a version of the tool.
const NO_VERSION = 'No version is set for shim';

function candidates(root: string, roots: string[], name: string, privateKind?: 'npm' | 'python'): string[] {
    const isWindows = process.platform === 'win32';
    const names = isWindows ? [`${name}.cmd`, `${name}.exe`, name] : [name];
    const directories =
        privateKind === 'npm'
            ? [join(root, NODE_MODULES_DIRECTORY, '.bin')]
            : privateKind === 'python'
              ? [join(root, PYTHON_ENVIRONMENT_DIRECTORY, isWindows ? 'Scripts' : 'bin')]
              : [...new Set(roots)].flatMap((root) => [
                    join(root, 'node_modules', '.bin'),
                    join(root, '.venv', 'bin'),
                    join(root, '.venv', 'Scripts'),
                ]);
    const files = openConfinedRoot(root);
    const found: string[] = [];
    try {
        for (const path of directories.flatMap((dir) => names.map((file) => join(dir, file)))) {
            const local = relative(root, path).replaceAll('\\', '/');
            if (!local.startsWith('.gspot/')) {
                if (statSync(path, { throwIfNoEntry: false }) !== undefined) found.push(path);
                continue;
            }
            try {
                files.source(local);
                found.push(path);
            } catch (error) {
                if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
            }
        }
    } finally {
        files.close();
    }
    if (privateKind !== undefined) return found;
    const onPath = Bun.which(name);
    if (onPath !== null) found.push(onPath);
    const miseBin = join(miseHome() ?? join(homedir(), '.local', 'share', 'mise'), 'shims');
    return [
        ...found,
        ...names
            .map((file) => join(miseBin, file))
            .filter((path) => statSync(path, { throwIfNoEntry: false }) !== undefined),
    ];
}

// The version a package.json above the real file of an npm tool holds, for the package the pin names.
function packageVersion(root: string, path: string, name: string | undefined): string | undefined {
    if (name === undefined) return undefined;
    const managed = relative(root, path).replaceAll('\\', '/').startsWith('.gspot/');
    const files = managed ? openConfinedRoot(root) : undefined;
    try {
        let folder = dirname(
            files === undefined ? realpathSync(path) : files.source(relative(root, path).replaceAll('\\', '/')),
        );
        while (folder !== dirname(folder)) {
            const manifest = join(folder, 'package.json');
            const local = relative(root, manifest).replaceAll('\\', '/');
            if (managed && !local.startsWith('.gspot/')) return undefined;
            const text =
                files === undefined
                    ? statSync(manifest, { throwIfNoEntry: false }) === undefined
                        ? undefined
                        : readFileSync(manifest, 'utf8')
                    : files.read(local)?.bytes.toString('utf8');
            const parsed = text === undefined ? undefined : (JSON.parse(text) as PackageFacts);
            if (parsed?.name === name) return parsed.version;
            folder = dirname(folder);
        }
        return undefined;
    } finally {
        files?.close();
    }
}

// A mise shim is one file for every version, so the version installed is read from the folder mise keeps it in.
function miseVersion(path: string, tool: ToolPin): string | undefined {
    const npm = tool.installers['npm'];
    if (npm?.version === undefined || npm.version !== tool.version) return undefined;
    const home = miseHome() ?? join(homedir(), '.local', 'share', 'mise');
    if (!path.startsWith(join(home, 'shims'))) return undefined;
    const installed = join(home, 'installs', `npm-${npm.name.replaceAll('/', '-')}`, npm.version);
    return statSync(installed, { throwIfNoEntry: false }) === undefined ? undefined : npm.version;
}

// What the tool prints about its version, with no color codes: their numbers read as a version.
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
    if (result.isTimedOut === true) return { state: 'error', note: `${tool.name} version probe timed out.` };
    if (result.missing || text.includes(NO_VERSION)) return { state: 'missing', note: text };
    if (result.code !== expectedExit)
        return { state: 'error', note: `${tool.name} version probe exited ${String(result.code)}: ${text}` };
    return undefined;
}

// An npm tool is the version its package says. Some print another one: license-checker-rseidelsohn 5.0.1 prints 4.4.2.
// A shim that no configuration gives a version starts nothing, whatever mise keeps installed for other repositories.
function readVersion(root: string, cwd: string, path: string, tool: ToolPin): VersionObservation {
    const npm = tool.installers['npm'];
    const installedPackage = packageVersion(root, path, npm?.name);
    return observeToolVersion(tool, printedVersion(cwd, path, tool), installedPackage, miseVersion(path, tool));
}

// Read library versions from the private installation used by generated configurations.
function probeLibrary(root: string, tool: ToolPin): ToolProbe {
    const files = openConfinedRoot(root);
    const hint = installHint(tool);
    const name = tool.installers['npm']?.name ?? tool.name;
    const path = `${NODE_MODULES_DIRECTORY}/${name}/package.json`;
    const want = tool.version === undefined ? {} : { want: tool.version };
    try {
        const file = files.read(path);
        if (file === undefined) return { name: tool.name, state: 'missing', hint, ...want };
        const parsed = JSON.parse(file.bytes.toString('utf8')) as PackageFacts;
        if (parsed.version === undefined) return { name: tool.name, state: 'missing', hint, ...want };
        const floor = tool.floor ?? tool.version ?? parsed.version;
        const state = tool.version === undefined ? 'ok' : toolVersionState(parsed.version, tool.version, floor);
        return { name: tool.name, state, path: join(root, path), found: parsed.version, hint, floor, ...want };
    } finally {
        files.close();
    }
}

function probeUncached(root: string, cwd: string, tool: ToolPin, runner?: string): ToolProbe {
    const roots = tool.provider === 'host' ? [cwd, root] : [join(root, '.gspot'), cwd, root];
    const [path] = candidates(root, roots, tool.name, privateToolInstallation(tool, runner)?.kind);
    const hint = installHint(tool);
    if (path === undefined)
        return {
            name: tool.name,
            state: 'missing',
            hint,
            ...(tool.version === undefined ? {} : { want: tool.version }),
        };
    if (tool.provider === 'host' || tool.version === undefined) {
        if (tool.version_command === undefined) return { name: tool.name, state: 'host', path, hint };
        const observed = readVersion(root, cwd, path, tool);
        return 'state' in observed
            ? { name: tool.name, path, hint, ...observed }
            : { name: tool.name, state: 'host', path, hint, found: observed.version };
    }
    const observed = readVersion(root, cwd, path, tool);
    if ('state' in observed) return { name: tool.name, path, hint, want: tool.version, ...observed };
    const found = observed.version;
    const floor = tool.floor ?? tool.version;
    return {
        name: tool.name,
        state: toolVersionState(found, tool.version, floor),
        path,
        want: tool.version,
        found,
        hint,
        floor,
    };
}

type ToolState = 'ok' | 'outdated' | 'newer' | 'missing' | 'host' | 'error';

/**
 * Interpret an executable version response for both installation and later probes.
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
    const expectedExit =
        (installedPackage === undefined ? undefined : npm?.version_exit_code) ?? tool.version_exit_code ?? 0;
    const text = stripVTControlCharacters(`${result.stdout}\n${result.stderr}`).trim();
    const failure = versionFailure(result, tool, text, expectedExit);
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
export function toolVersionState(found: string, want: string, floor: string): ToolProbe['state'] {
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
    return candidates(root, roots, name, privateToolInstallation(tool, runner)?.kind)[0];
}

/**
 * Probes one tool, sharing identical observations within its command session.
 * @param context the repository root and session observations
 * @param tool the pin
 * @returns where the tool is, its version and its state
 */
export function probeTool(context: ToolContext, tool: ToolPin): ToolProbe {
    const { root, probes } = context;
    const pending = readOwnership(root).installations;
    if (
        tool.provider !== 'host' &&
        ((pending?.includes('npm') === true && tool.installers['npm'] !== undefined) ||
            (pending?.includes('python') === true && tool.installers['pypi'] !== undefined))
    )
        return {
            name: tool.name,
            state: 'error',
            hint: 'Run: gspot install',
            note: 'Tool installation is incomplete. Run: gspot install',
        };
    const cwd = context.cwd ?? root;
    const runner = context.policyFiles?.policy.runner?.tool;
    const key = JSON.stringify([root, cwd, tool, runner]);
    const cached = probes.get(key);
    if (cached) return cached;
    const probe = tool.kind === 'library' ? probeLibrary(root, tool) : probeUncached(root, cwd, tool, runner);
    probes.set(key, probe);
    return probe;
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

export type ToolProbe = {
    name: string;
    state: ToolState;
    want?: string;
    found?: string;
    path?: string;
    hint?: string;
    note?: string;
    floor?: string;
};

export type ToolContext = {
    root: string;
    cwd?: string;
    probes: Map<string, ToolProbe>;
    policyFiles?: PolicyFiles;
};

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
