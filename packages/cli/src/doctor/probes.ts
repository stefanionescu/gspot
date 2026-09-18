// Locate and version every tool: node_modules/.bin, .venv/bin, mise shims, PATH.
import semver from 'semver';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { existsSync } from 'node:fs';
import type { ToolPin } from '#types/manifest.ts';
import type { ToolProbe } from '#types/doctor.ts';
import { runBlocking } from '#cli/platform/spawn.ts';
import { installHint } from '#cli/platform/install-hints.ts';

const VERSION_TIMEOUT_MS = 15_000;
const VERSION_FLAGS: Record<string, string[]> = {
    gitleaks: ['version'],
    periphery: ['version'],
    plutil: ['-help'],
    xcodebuild: ['-version'],
};

const probeCache = new Map<string, ToolProbe>();

function candidates(root: string, name: string): string[] {
    const isWindows = process.platform === 'win32';
    const names = isWindows ? [`${name}.cmd`, `${name}.exe`, name] : [name];
    const directories = [
        join(root, 'node_modules', '.bin'),
        join(root, '.venv', 'bin'),
        join(root, '.venv', 'Scripts'),
        join(homedir(), '.local', 'share', 'mise', 'shims'),
    ];
    const found = directories.flatMap((dir) => names.map((file) => join(dir, file))).filter((path) => existsSync(path));
    const onPath = Bun.which(name);
    return onPath === null ? found : [...found, onPath];
}

function readVersion(path: string, tool: ToolPin): string | undefined {
    const command = tool.version_command ?? VERSION_FLAGS[tool.name] ?? ['--version'];
    const result = runBlocking([path, ...command], { cwd: process.cwd(), timeoutMs: VERSION_TIMEOUT_MS });
    const text = `${result.stdout}\n${result.stderr}`;
    if (tool.version_regex !== undefined) {
        const match = new RegExp(tool.version_regex, 'u').exec(text);
        return match?.[1] ?? match?.[0];
    }
    return semver.coerce(text)?.version;
}

function stateFor(found: string, want: string, floor: string): ToolProbe['state'] {
    const version = semver.coerce(found);
    if (version === null) return 'ok';
    const lowest = semver.coerce(floor);
    if (lowest !== null && semver.lt(version, lowest)) return 'outdated';
    const pinned = semver.coerce(want);
    return pinned !== null && semver.gt(version, pinned) ? 'newer' : 'ok';
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
    const found = readVersion(path, tool);
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
 * Where a tool is, searching the repository's own bin folders, the mise shims and PATH, or undefined.
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
 * @returns where the tool is, its version and its state
 */
export function probeTool(root: string, tool: ToolPin): ToolProbe {
    const key = `${root}\n${tool.name}`;
    const cached = probeCache.get(key);
    if (cached) return cached;
    const probe = probeUncached(root, tool);
    probeCache.set(key, probe);
    return probe;
}
