// Runs the development gspot and git in a planted repository.
import { join } from 'node:path';
import type { Outcome } from '#types/run.ts';
import { environmentVariables } from '#cli/platform/environment.ts';

const root = new URL('../..', import.meta.url).pathname;

/** How long a planted-repository test may take: it spawns real tools. */
export const PLANTED_TIMEOUT_MS = 60_000;

/** The development entry point, run with bun. */
export const gspot = join(root, 'packages', 'cli', 'src', 'main.ts');

/** A clean bash script every planted repository starts from. */
export const script =
    '#!/usr/bin/env bash\n#\n# Builds the thing.\n# Runtime: Bash 4.0+, macOS and Linux.\nset -euo pipefail\nshopt -s inherit_errexit\n\nmain() {\n    echo "hello $1"\n}\n\nmain "$@"\n';

/**
 * Runs gspot in a directory with color off and CI set.
 * @param cwd the planted repository
 * @param argv the command line after gspot
 * @param environment extra variables
 * @returns the exit code and both streams
 */
export function run(cwd: string, argv: string[], environment: Record<string, string> = {}): Outcome {
    const result = Bun.spawnSync(['bun', gspot, ...argv], {
        cwd,
        env: { ...environmentVariables(), NO_COLOR: '1', CI: '1', ...environment },
        stdout: 'pipe',
        stderr: 'pipe',
    });
    return { code: result.exitCode, stdout: result.stdout.toString(), stderr: result.stderr.toString() };
}

/**
 * Runs git with a throwaway identity.
 * @param cwd the planted repository
 * @param argv the command line after git
 * @param environment extra variables
 * @returns the exit code and both streams
 */
export function git(cwd: string, argv: string[], environment: Record<string, string> = {}): Outcome {
    const result = Bun.spawnSync(['git', '-c', 'user.email=t@t', '-c', 'user.name=t', ...argv], {
        cwd,
        env: { ...environmentVariables(), ...environment },
        stdout: 'pipe',
        stderr: 'pipe',
    });
    return { code: result.exitCode, stdout: result.stdout.toString(), stderr: result.stderr.toString() };
}

/**
 * A PATH that starts with the folders of the named mise-installed tools, for a planted repository outside this one.
 * @param names the tool names as mise knows them (`taplo`, `npm:v8r`)
 * @returns the PATH value
 */
export function toolsPath(names: string[]): string {
    const folders = names.flatMap((name) => {
        const result = Bun.spawnSync(['mise', 'which', name.replace(/^[a-z]+:/u, '')], {
            cwd: root,
            stdout: 'pipe',
            stderr: 'pipe',
        });
        const found = result.stdout.toString().trim();
        return found !== '' && result.exitCode === 0 ? [found.slice(0, found.lastIndexOf('/'))] : [];
    });
    return [...folders, environmentVariables()['PATH'] ?? ''].join(':');
}

/**
 * Makes the planted directory a git repository with one commit, the state init expects.
 * @param cwd the planted repository
 */
export function commitAll(cwd: string): void {
    git(cwd, ['init', '-q']);
    git(cwd, ['add', '-A']);
    git(cwd, ['commit', '-qm', 'init']);
}
