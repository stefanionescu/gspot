// Locate and version every tool: node_modules/.bin, .venv/bin, PATH, mise shims.
import semver from 'semver';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import type { ToolPin } from '#types/manifest.ts';
import { runBlocking } from '#cli/platform/spawn.ts';
import { stripVTControlCharacters } from 'node:util';
import { miseHome } from '#cli/platform/environment.ts';
import { installHint } from '#cli/platform/install-hints.ts';
import type { PackageFacts, ToolProbe } from '#types/doctor.ts';
import { existsSync, readFileSync, realpathSync } from 'node:fs';

const VERSION_TIMEOUT_MS = 15_000;
const VERSION_FLAGS: Record<string, string[]> = {
    gitleaks: ['version'],
    periphery: ['version'],
    plutil: ['-help'],
    xcodebuild: ['-version'],
};

// What a mise shim prints when no configuration in reach names a version of the tool.
const NO_VERSION = 'No version is set for shim';
const probeCache = new Map<string, ToolProbe>();

function candidates(root: string, name: string): string[] {
    const isWindows = process.platform === 'win32';
    const names = isWindows ? [`${name}.cmd`, `${name}.exe`, name] : [name];
    const directories = [
        join(root, 'node_modules', '.bin'),
        join(root, '.venv', 'bin'),
        join(root, '.venv', 'Scripts'),
    ];
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
function printedVersion(root: string, path: string, tool: ToolPin): string {
    const command = tool.version_command ?? VERSION_FLAGS[tool.name] ?? ['--version'];
    const result = runBlocking([path, ...command], {
        cwd: root,
        timeoutMs: VERSION_TIMEOUT_MS,
        env: { NO_COLOR: '1', ...tool.env },
    });
    return stripVTControlCharacters(`${result.stdout}\n${result.stderr}`);
}

function parsedVersion(text: string, tool: ToolPin): string | undefined {
    if (tool.version_regex === undefined) return semver.coerce(text)?.version;
    const match = new RegExp(tool.version_regex, 'u').exec(text);
    return match?.[1] ?? match?.[0];
}

// An npm tool is the version its package says. Some print another one: license-checker-rseidelsohn 5.0.1 prints 4.4.2.
// A shim that no configuration gives a version starts nothing, whatever mise keeps installed for other repositories.
function readVersion(root: string, path: string, tool: ToolPin): string | undefined {
    const npm = tool.installers['npm'];
    const name = npm?.version === tool.version ? npm?.name : undefined;
    const held = packageVersion(path, name);
    if (held !== undefined) return held;
    const text = printedVersion(root, path, tool);
    if (text.includes(NO_VERSION)) return NO_VERSION;
    return miseVersion(path, tool) ?? parsedVersion(text, tool);
}

function stateFor(found: string, want: string, floor: string): ToolProbe['state'] {
    const version = semver.coerce(found);
    if (version === null) return 'ok';
    const lowest = semver.coerce(floor);
    if (lowest !== null && semver.lt(version, lowest)) return 'outdated';
    const pinned = semver.coerce(want);
    return pinned !== null && semver.gt(version, pinned) ? 'newer' : 'ok';
}

// A library is imported, never run: its version is the one its package.json holds, in the root or in a scope.
function libraryVersion(root: string, scopes: string[], name: string): { path: string; version: string } | undefined {
    for (const scope of ['', ...scopes]) {
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

function probeUncached(root: string, tool: ToolPin): ToolProbe {
    const [path] = candidates(root, tool.name);
    const hint = installHint(tool);
    if (path === undefined)
        return {
            name: tool.name,
            state: 'missing',
            hint,
            ...(tool.version === undefined ? {} : { want: tool.version }),
        };
    if (tool.provider === 'host' || tool.version === undefined) return { name: tool.name, state: 'host', path, hint };
    const found = readVersion(root, path, tool);
    if (found === NO_VERSION) return { name: tool.name, state: 'missing', hint, want: tool.version };
    if (found === undefined) return { name: tool.name, state: 'ok', path, want: tool.version, found: 'unknown', hint };
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
    return candidates(root, name)[0];
}

/**
 * Probes one tool. Cached per process.
 * @param root the repository root
 * @param tool the pin
 * @param scopes the scope paths, where a library may be installed beside the root
 * @returns where the tool is, its version and its state
 */
export function probeTool(root: string, tool: ToolPin, scopes: string[] = []): ToolProbe {
    const key = `${root}\n${tool.name}`;
    const cached = probeCache.get(key);
    if (cached) return cached;
    const probe = tool.kind === 'library' ? probeLibrary(root, scopes, tool) : probeUncached(root, tool);
    probeCache.set(key, probe);
    return probe;
}
