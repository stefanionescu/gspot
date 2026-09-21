// Locate and version managed tools under .gspot, project host tools, PATH executables and mise shims.
import semver from 'semver';
import { readOwnership } from '#cli/lifecycle/ownership.ts';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import type { Manifest, ToolPin } from '#types/manifest.ts';
import { runBlocking } from '#cli/platform/spawn.ts';
import { stripVTControlCharacters } from 'node:util';
import type { SpawnResult } from '#types/platform.ts';
import { miseHome } from '#cli/platform/environment.ts';
import { installHint } from '#cli/platform/install-hints.ts';
import { existsSync, readFileSync, realpathSync } from 'node:fs';
import type { PackageFacts, ToolProbe, VersionObservation, ToolContext } from '#types/doctor.ts';

const VERSION_TIMEOUT_MS = 15_000;
// What a mise shim prints when no configuration in reach names a version of the tool.
const NO_VERSION = 'No version is set for shim';

function candidates(roots: string[], name: string): string[] {
    const isWindows = process.platform === 'win32';
    const names = isWindows ? [`${name}.cmd`, `${name}.exe`, name] : [name];
    const directories = [...new Set(roots)].flatMap((root) => [
        join(root, 'node_modules', '.bin'),
        join(root, '.venv', 'bin'),
        join(root, '.venv', 'Scripts'),
    ]);
    const found = directories.flatMap((dir) => names.map((file) => join(dir, file))).filter((path) => existsSync(path));
    const onPath = Bun.which(name);
    if (onPath !== null) found.push(onPath);
    const miseBin = join(miseHome() ?? join(homedir(), '.local', 'share', 'mise'), 'shims');
    return [...found, ...names.map((file) => join(miseBin, file)).filter((path) => existsSync(path))];
}

// The version a package.json above the real file of an npm tool holds, for the package the pin names.
function packageVersion(path: string, name: string | undefined): string | undefined {
    if (name === undefined) return undefined;
    let folder = dirname(realpathSync(path));
    while (folder !== dirname(folder)) {
        const manifest = join(folder, 'package.json');
        const parsed = existsSync(manifest) ? (JSON.parse(readFileSync(manifest, 'utf8')) as PackageFacts) : undefined;
        if (parsed?.name === name) return parsed.version;
        folder = dirname(folder);
    }
    return undefined;
}

// A mise shim is one file for every version, so the version installed is read from the folder mise keeps it in.
function miseVersion(path: string, tool: ToolPin): string | undefined {
    const npm = tool.installers['npm'];
    if (npm?.version === undefined || npm.version !== tool.version) return undefined;
    const home = miseHome() ?? join(homedir(), '.local', 'share', 'mise');
    if (!path.startsWith(join(home, 'shims'))) return undefined;
    const installed = join(home, 'installs', `npm-${npm.name.replaceAll('/', '-')}`, npm.version);
    return existsSync(installed) ? npm.version : undefined;
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
function readVersion(root: string, path: string, tool: ToolPin): VersionObservation {
    const npm = tool.installers['npm'];
    const installedPackage = packageVersion(path, npm?.name);
    const expectedExit =
        (installedPackage === undefined ? undefined : npm?.version_exit_code) ?? tool.version_exit_code ?? 0;
    const result = printedVersion(root, path, tool);
    const text = stripVTControlCharacters(`${result.stdout}\n${result.stderr}`).trim();
    const failure = versionFailure(result, tool, text, expectedExit);
    if (failure !== undefined) return failure;
    const version =
        (npm?.version === tool.version ? installedPackage : undefined) ??
        miseVersion(path, tool) ??
        parsedVersion(text, tool);
    if (version === undefined || semver.coerce(version) === null)
        return { state: 'error', note: `${tool.name} did not report a valid version: ${text}` };
    return { version };
}

function stateFor(found: string, want: string, floor: string): ToolProbe['state'] {
    const version = semver.coerce(found);
    if (version === null) return 'error';
    const lowest = semver.coerce(floor);
    if (lowest !== null && semver.lt(version, lowest)) return 'outdated';
    const pinned = semver.coerce(want);
    return pinned !== null && semver.gt(version, pinned) ? 'newer' : 'ok';
}

// A library is imported, never run: its version is the one its package.json holds, in the root or in a scope.
function libraryVersion(root: string, scopes: string[], name: string): { path: string; version: string } | undefined {
    for (const scope of ['.gspot', '', ...scopes]) {
        const path = join(root, scope, 'node_modules', name, 'package.json');
        if (!existsSync(path)) continue;
        const parsed = JSON.parse(readFileSync(path, 'utf8')) as { version?: string };
        if (parsed.version !== undefined) return { path, version: parsed.version };
    }
    return undefined;
}

function probeLibrary(root: string, scopes: string[], tool: ToolPin): ToolProbe {
    const hint = installHint(tool);
    const name = tool.installers['npm']?.name ?? tool.name;
    const found = libraryVersion(root, scopes, name);
    const want = tool.version === undefined ? {} : { want: tool.version };
    if (found === undefined) return { name: tool.name, state: 'missing', hint, ...want };
    const floor = tool.floor ?? tool.version ?? found.version;
    const state = tool.version === undefined ? 'ok' : stateFor(found.version, tool.version, floor);
    return { name: tool.name, state, path: found.path, found: found.version, hint, floor, ...want };
}

function probeUncached(root: string, cwd: string, tool: ToolPin): ToolProbe {
    const roots = tool.provider === 'host' ? [cwd, root] : [join(root, '.gspot'), cwd, root];
    const [path] = candidates(roots, tool.name);
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
        const observed = readVersion(cwd, path, tool);
        return 'state' in observed
            ? { name: tool.name, path, hint, ...observed }
            : { name: tool.name, state: 'host', path, hint, found: observed.version };
    }
    const observed = readVersion(cwd, path, tool);
    if ('state' in observed) return { name: tool.name, path, hint, want: tool.version, ...observed };
    const found = observed.version;
    const floor = tool.floor ?? tool.version;
    return {
        name: tool.name,
        state: stateFor(found, tool.version, floor),
        path,
        want: tool.version,
        found,
        hint,
        floor,
    };
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
    return candidates([join(root, '.gspot'), root], name)[0];
}

/**
 * Probes one tool, sharing identical observations within its command session.
 * @param context the repository root and session observations
 * @param tool the pin
 * @param scopes the scope paths, where a library may be installed beside the root
 * @returns where the tool is, its version and its state
 */
export function probeTool(context: ToolContext, tool: ToolPin, scopes: string[] = []): ToolProbe {
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
    const key = JSON.stringify([root, cwd, tool, scopes]);
    const cached = probes.get(key);
    if (cached) return cached;
    const probe = tool.kind === 'library' ? probeLibrary(root, scopes, tool) : probeUncached(root, cwd, tool);
    probes.set(key, probe);
    return probe;
}

/** Resolve a declared executable pin, or a repository-owned host command. */
export function toolPin(manifests: Iterable<Manifest>, name: string): ToolPin {
    for (const manifest of manifests) {
        const pin = manifest.tools.find((tool) => tool.name === name);
        if (pin !== undefined) return pin;
    }
    return { name, provider: 'host', windows: true, installers: {} };
}
