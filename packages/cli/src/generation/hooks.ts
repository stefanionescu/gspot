// The Git hooks gspot writes: one short script per stage in .gspot/hooks, each running one gspot check.
import { runBlocking } from '#cli/platform/spawn.ts';
import type { GeneratedFile } from '#cli/types/kits.ts';
import { headerLines } from '#cli/generation/headers.ts';
import type { Policy } from '#cli/types/policy/policy.ts';
import { isGitRepository } from '#cli/repository/tracked.ts';
import type { HookName } from '#cli/types/generation/generation.ts';

import {
    HOOK_ARGS,
    HOOK_FILES,
    RUNNER_EXEC,
    HOOKS_DIRECTORY,
    HOOK_UNAVAILABLE,
} from '#cli/config/generation/generation.ts';

// The script of one hook. Git runs it from the top level; a commit message path Git gives relative to there
// becomes absolute first, in the Windows spelling under Git for Windows.
function hookScript(name: HookName, runner: string | undefined, prefix: string, version: string): string {
    const program = (RUNNER_EXEC[runner ?? ''] ?? 'gspot').split(' ', 1)[0] ?? 'gspot';
    const quoted = prefix.replaceAll("'", String.raw`'\''`);
    const absolutePath =
        name === 'commit-msg'
            ? [
                  'case "$1" in /*|[A-Za-z]:*) message=$1 ;; *) message="$PWD/$1" ;; esac',
                  'if command -v cygpath >/dev/null 2>&1; then message=$(cygpath -w "$message"); fi',
                  'set -- "$message"',
              ]
            : [];
    return [
        '#!/bin/sh',
        ...headerLines(version).map((line) => `# ${line}`),
        ...absolutePath,
        ...(prefix === '' ? [] : [`cd '${quoted}' || exit 2`]),
        `command -v ${program} >/dev/null 2>&1 || { echo '${HOOK_UNAVAILABLE}' >&2; exit 2; }`,
        `GSPOT_HOOK=${name} exec ${hookLine(name, runner)}`,
        '',
    ].join('\n');
}

/**
 * The path from the Git top level to the repository root, which Git runs hooks from.
 * @param root the repository root
 * @returns the prefix with a trailing slash, '' at the top level or outside Git
 */
export function hookPrefix(root: string): string {
    if (!isGitRepository(root)) return '';
    const result = runBlocking(['git', 'rev-parse', '--show-prefix'], { cwd: root });
    if (result.code !== 0) throw new Error(`Cannot resolve the hook directory: ${result.stderr.trim()}`);
    return result.stdout.replace(/\n$/u, '');
}

/**
 * The command a hook runs for one stage, through the runner of the policy or the gspot on PATH.
 * @param name the hook
 * @param runner the task runner the policy names, or undefined
 * @returns the command line
 */
// eslint-disable-next-line gspot/no-trivial-functions -- reason: The hook scripts and the lines install prints for a repository with its own hooks must name the same command.
export function hookLine(name: HookName, runner: string | undefined): string {
    return `${RUNNER_EXEC[runner ?? ''] ?? 'gspot'} ${HOOK_ARGS[name]}`;
}

/**
 * The hook scripts, one per stage, in the hooks folder of the repository, when the policy selects hooks.
 * @param root the repository root
 * @param policy the repository policy
 * @param version the gspot version the header names
 * @returns the generated files
 */
export function hookFiles(root: string, policy: Policy, version: string): GeneratedFile[] {
    if (policy.hooks === undefined) return [];
    const prefix = hookPrefix(root);
    return HOOK_FILES.map((name) => ({
        path: `${HOOKS_DIRECTORY}/${name}`,
        content: hookScript(name, policy.runner?.tool, prefix, version),
        readOnly: true,
        executable: true,
        kind: 'hook',
    }));
}
