// The Git hooks gspot writes: one short script per stage in .gspot/hooks, each running one gspot check.
import { runGitBlocking } from '#cli/platform/git.ts';
import { hashHeader } from '#cli/generation/headers.ts';
import { isGitRepository } from '#cli/repository/root.ts';
import type { Policy } from '#cli/types/policy/settings.ts';
import type { HookName } from '#cli/types/generation/hooks.ts';
import { HOOKS_DIRECTORY } from '#cli/config/platform/locations.ts';
import type { GeneratedFile } from '#cli/types/generation/output.ts';
import { HOOK_ARGS, HOOK_FILES, HOOK_RUNNERS } from '#cli/config/generation/hooks.ts';

// The script of one hook. Git runs it from the top level; a commit message path Git gives relative to there
// becomes absolute first, in the Windows spelling under Git for Windows.
function hookScript(name: HookName, runner: Policy['run_with'], prefix: string, version: string): string {
    const program = runner ?? 'gspot';
    const { acquisition } = HOOK_RUNNERS[program];
    const quoted = prefix.replaceAll("'", String.raw`'\''`);
    const absolutePath =
        name === 'commit-msg'
            ? [
                  'case "$1" in /*|[A-Za-z]:*) message=$1 ;; *) message="$PWD/$1" ;; esac',
                  'if command -v cygpath >/dev/null 2>&1; then message=$(cygpath -w "$message"); fi',
                  'set -- "$message"',
              ]
            : [];
    const body = [
        ...absolutePath,
        ...(prefix === '' ? [] : [`cd '${quoted}' || exit 2`]),
        `command -v ${program} >/dev/null 2>&1 || { echo '${program} is not installed. ${acquisition}' >&2; exit 2; }`,
        `GSPOT_HOOK=${name} exec ${hookLine(name, runner)}`,
        '',
    ].join('\n');
    return `#!/bin/sh\n${hashHeader(version)}${body}`;
}

/**
 * The path from the Git top level to the repository root, which Git runs hooks from.
 * @param root the repository root
 * @returns the prefix with a trailing slash, '' at the top level or outside Git
 */
export function hookPrefix(root: string): string {
    if (!isGitRepository(root)) return '';
    const result = runGitBlocking(root, ['rev-parse', '--show-prefix']);
    if (result.code !== 0) throw new Error(`Cannot resolve the hook directory: ${result.stderr.trim()}`);
    return result.stdout.replace(/\n$/u, '');
}

/**
 * The command a hook runs for one stage, through the runner of the policy or the gspot on PATH.
 * @param name the hook
 * @param runner the task runner the policy names, or undefined
 * @returns the command line
 */
export function hookLine(name: HookName, runner: Policy['run_with']): string {
    return `${HOOK_RUNNERS[runner ?? 'gspot'].command} ${HOOK_ARGS[name]}`;
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
        content: hookScript(name, policy.run_with, prefix, version),
        readOnly: true,
        executable: true,
        kind: 'hook',
    }));
}
