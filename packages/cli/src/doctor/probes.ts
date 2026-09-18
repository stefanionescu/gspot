// Locate and version every tool: node_modules/.bin, .venv/bin, mise shims, PATH.
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

import semver from 'semver';

import { installHint } from '#cli/platform/install-hints.ts';
import { runSync } from '#cli/platform/spawn.ts';
import type { ToolPin } from '#types/manifest.ts';
import type { ToolProbe } from '#types/doctor.ts';

const VERSION_FLAGS: Record<string, string[]> = {
    bash: ['--version'],
    shellcheck: ['--version'],
    shfmt: ['--version'],
    typos: ['--version'],
    prettier: ['--version'],
    ec: ['--version'],
    eslint: ['--version'],
    tsc: ['--version'],
    knip: ['--version'],
    'markdownlint-cli2': ['--version'],
    lychee: ['--version'],
    vale: ['--version'],
    sg: ['--version'],
    'ast-grep': ['--version'],
    gitleaks: ['version'],
    swiftlint: ['--version'],
    swiftformat: ['--version'],
    periphery: ['version'],
    sqlfluff: ['--version'],
    squawk: ['--version'],
    hadolint: ['--version'],
    semgrep: ['--version'],
    'osv-scanner': ['--version'],
    trivy: ['--version'],
    ruff: ['--version'],
    basedpyright: ['--version'],
    deno: ['--version'],
    supabase: ['--version'],
    docker: ['--version'],
    plutil: ['-help'],
    xcodebuild: ['-version'],
    commitlint: ['--version'],
    jscpd: ['--version'],
    stylelint: ['--version'],
    'html-validate': ['--version'],
    git: ['--version'],
};

const probeCache = new Map<string, ToolProbe>();

function candidates(root: string, name: string): string[] {
    const windows = process.platform === 'win32';
    const names = windows ? [`${name}.cmd`, `${name}.exe`, name] : [name];
    const dirs = [
        join(root, 'node_modules', '.bin'),
        join(root, '.venv', 'bin'),
        join(root, '.venv', 'Scripts'),
        join(homedir(), '.local', 'share', 'mise', 'shims'),
    ];
    const found: string[] = [];
    for (const dir of dirs) for (const file of names) if (existsSync(join(dir, file))) found.push(join(dir, file));
    const onPath = Bun.which(name);
    if (onPath) found.push(onPath);
    return found;
}

function readVersion(path: string, tool: ToolPin): string | undefined {
    const command = tool.version_command ?? VERSION_FLAGS[tool.name] ?? ['--version'];
    const result = runSync([path, ...command], { cwd: process.cwd(), timeoutMs: 15_000 });
    const text = `${result.stdout}\n${result.stderr}`;
    if (tool.version_regex) {
        const match = text.match(new RegExp(tool.version_regex));
        return match?.[1] ?? match?.[0];
    }
    const match = text.match(/(\d+\.\d+\.\d+)/);
    return match?.[1];
}

/** Probes one tool. Cached per process. */
export function probeTool(root: string, tool: ToolPin): ToolProbe {
    const key = `${root}\n${tool.name}`;
    const cached = probeCache.get(key);
    if (cached) return cached;
    const probe = probeUncached(root, tool);
    probeCache.set(key, probe);
    return probe;
}

function probeUncached(root: string, tool: ToolPin): ToolProbe {
    const paths = candidates(root, tool.name);
    const hint = installHint(tool);
    if (paths.length === 0)
        return { name: tool.name, state: 'missing', hint, ...(tool.version ? { want: tool.version } : {}) };
    const path = paths[0]!;
    if (tool.provider === 'host' || tool.version === undefined) return { name: tool.name, state: 'host', path, hint };
    const found = readVersion(path, tool);
    if (found === undefined) return { name: tool.name, state: 'ok', path, want: tool.version, found: 'unknown', hint };
    const floor = tool.floor ?? tool.version;
    const base: ToolProbe = { name: tool.name, state: 'ok', path, want: tool.version, found, hint, floor };
    if (semver.valid(semver.coerce(found)) && semver.lt(semver.coerce(found)!, semver.coerce(floor)!))
        return { ...base, state: 'outdated' };
    if (semver.valid(semver.coerce(found)) && semver.gt(semver.coerce(found)!, semver.coerce(tool.version)!))
        return { ...base, state: 'newer' };
    return base;
}

/** The executable path a probe found, or undefined. */
export function toolPath(root: string, tool: ToolPin): string | undefined {
    return probeTool(root, tool).path;
}

/** Drops the probe cache; tests use it after planting a tool. */
export function resetProbes(): void {
    probeCache.clear();
}
