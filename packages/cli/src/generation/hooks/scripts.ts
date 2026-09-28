import { runBlocking } from '#cli/platform/spawn.ts';
import type { HookName } from '#cli/types/generation.ts';
import { isGitRepository } from '#cli/repository/tracked.ts';
import { HOOK_ARGS, HOOK_HEADER, RUNNER_EXEC } from '#cli/constants/generation.ts';
import { SIMPLE_GIT_HOOKS_DIRECTORY as DIRECTORY } from '#cli/constants/repository/repository.ts';

/**
 * Locate policy-owned hook configuration relative to the working directory Git uses for hooks.
 * @param root the repository root
 * @returns the path prefix from the Git top level to the root, '' at the top level or outside Git
 */
export function hookPrefix(root: string): string {
    if (!isGitRepository(root)) return '';
    const result = runBlocking(['git', 'rev-parse', '--show-prefix'], { cwd: root });
    if (result.code !== 0) throw new Error(`Cannot resolve the hook configuration directory: ${result.stderr.trim()}`);
    return result.stdout.replace(/\n$/u, '');
}

/**
 * Resolve gspot locally, without downloading a missing launcher.
 * @param runner the task runner the policy names, or undefined
 * @param binaryPath the pinned executable when no runner resolves gspot
 * @returns the shell text that runs gspot
 */
export function runnerExec(runner: string | undefined, binaryPath?: string): string {
    return (
        RUNNER_EXEC[runner ?? ''] ?? (binaryPath === undefined ? 'gspot' : `'${binaryPath.replaceAll("'", "'\"'\"'")}'`)
    );
}

/**
 * The check invocation for one Git hook.
 * @param name the hook.
 * @param runner the task runner the policy names, or undefined.
 * @param binaryPath the pinned executable when no runner resolves gspot.
 * @param directory the directory to enter first, '' for the working directory.
 * @returns the shell text that runs the hook's check, or explains an unavailable executable.
 */
export function hookCommand(name: HookName, runner: string | undefined, binaryPath?: string, directory = ''): string {
    const at = directory === '' ? '' : `cd '${directory.replaceAll("'", "'\"'\"'")}' && `;
    const args = name === 'commit-msg' ? 'check --stage message --message-file "${gspot_message}"' : HOOK_ARGS[name];
    const executable = runner !== undefined && Object.hasOwn(RUNNER_EXEC, runner) ? runner : (binaryPath ?? 'gspot');
    return String.raw`${at}{ gspot_executable=$(command -v '${executable.replaceAll("'", "'\"'\"'")}') && [ -x "$gspot_executable" ] || { printf "%s\n" "The pinned gspot executable is unavailable. Install gspot, then run: gspot install" >&2; exit 2; }; ${runnerExec(runner, binaryPath)} ${args}; }`;
}

/**
 * Execute an existing hook as a subprocess before checking the same Git input.
 * @param name the hook.
 * @param original whether a preserved original hook runs first.
 * @param commands the check commands to run.
 * @returns the hook script.
 */
export function hookBody(name: HookName, original: boolean, commands: string[]): string {
    const buffered = name === 'pre-push' && (original || commands.length > 1);
    const input = buffered ? ' <"${input}"' : '';
    return [
        '#!/usr/bin/env bash',
        HOOK_HEADER,
        '# Runtime: Bash 3.2+, macOS, Linux, and Git for Windows.',
        'set -euo pipefail',
        ...(name === 'commit-msg'
            ? [
                  'gspot_message=$1',
                  'if [[ ${gspot_message} != /* && ${gspot_message} != [[:alpha:]]:* ]]; then gspot_message="${PWD}/${gspot_message}"; fi',
              ]
            : []),
        ...(buffered
            ? [
                  'input=$(mktemp "${TMPDIR:-/tmp}/gspot-push.XXXXXXXX")',
                  `trap 'rm -f "\${input}"' EXIT`,
                  `trap 'exit 129' HUP`,
                  `trap 'exit 130' INT`,
                  `trap 'exit 143' TERM`,
                  'cat >"${input}"',
              ]
            : []),
        ...(original ? [`"$0.gspot-original" "$@"${input}`] : []),
        ...commands.flatMap((command) => [
            'status=0',
            `(export GSPOT_HOOK=${name}; ${command})${input} || status=$?`,
            'if [[ ${status} -eq 126 || ${status} -eq 127 ]]; then',
            String.raw`    printf "%s\n" "The pinned gspot executable is unavailable. Install gspot, then run: gspot install" >&2`,
            '    status=2',
            'fi',
            'if [[ ${status} -ne 0 ]]; then exit "${status}"; fi',
        ]),
        'exit 0',
        '',
    ].join('\n');
}

/**
 * Invoke the generated integration from the Git working directory.
 * @param prefix the path prefix from the Git top level to the repository root
 * @param name the hook
 * @returns the simple-git-hooks command text
 */
export function simpleGitHookCommand(prefix: string, name: string): string {
    const program = `${prefix}${DIRECTORY}/${name}`.replaceAll("'", "'\"'\"'");
    return `bash '${program}' "$@"`;
}
