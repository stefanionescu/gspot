import { runBlocking } from '#cli/platform/spawn.ts';
import { isGitRepository } from '#cli/repository/tracked.ts';
import { openConfinedRoot } from '#cli/platform/filesystem.ts';
import { HOOK_ARGS, HOOK_HEADER, RUNNER_EXEC } from '#cli/constants/generation.ts';
import type { ConfigurationOutput, HookName, LefthookBlock } from '#cli/types/generation.ts';
import { HOOK_FILES, SIMPLE_GIT_HOOKS_DIRECTORY as DIRECTORY } from '#cli/constants/repository/repository.ts';

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
 * @param name the hook
 * @param runner the task runner the policy names, or undefined
 * @param binaryPath the pinned executable when no runner resolves gspot
 * @param directory the directory to enter first, '' for the working directory
 * @returns the shell text that runs the hook's check, or explains an unavailable executable
 */
export function hookCommand(name: HookName, runner: string | undefined, binaryPath?: string, directory = ''): string {
    const at = directory === '' ? '' : `cd '${directory.replaceAll("'", "'\"'\"'")}' && `;
    const args = name === 'commit-msg' ? 'check --stage message --message-file "${gspot_message}"' : HOOK_ARGS[name];
    const executable = runner !== undefined && Object.hasOwn(RUNNER_EXEC, runner) ? runner : (binaryPath ?? 'gspot');
    return String.raw`${at}{ gspot_executable=$(command -v '${executable.replaceAll("'", "'\"'\"'")}') && [ -x "$gspot_executable" ] || { printf "%s\n" "The pinned gspot executable is unavailable. Install gspot, then run: gspot install" >&2; exit 2; }; ${runnerExec(runner, binaryPath)} ${args}; }`;
}

/**
 * Execute an existing hook as a subprocess before checking the same Git input.
 * @param name the hook
 * @param runner the task runner the policy names, or undefined
 * @param binaryPath the pinned executable when no runner resolves gspot
 * @param original whether a preserved original hook runs first
 * @param commands the check commands to run, one gspot invocation by default
 * @returns the hook script
 */
export function hookBody(
    name: HookName,
    runner: string | undefined,
    binaryPath?: string,
    original = false,
    commands = [hookCommand(name, runner, binaryPath)],
): string {
    const buffered = name === 'pre-push' && (original || commands.length > 1);
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
        ...(original ? [`"$0.gspot-original" "$@"${buffered ? ' <"${input}"' : ''}`] : []),
        ...commands.flatMap((command) => [
            'status=0',
            `(export GSPOT_HOOK=${name}; ${command})${buffered ? ' <"${input}"' : ''} || status=$?`,
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
 * The managed invocation in each authored Husky script.
 * @param root the repository root
 * @param runner the task runner the policy names, or undefined
 * @param binaryPath the pinned executable when no runner resolves gspot
 * @returns the Husky script path and the one line gspot owns in it, per hook
 */
export function huskyLines(
    root: string,
    runner: string | undefined,
    binaryPath?: string,
): { path: string; line: string }[] {
    const prefix = hookPrefix(root);
    return HOOK_FILES.map((name) => ({
        path: `.husky/${name}`,
        line: [
            '(gspot_status=0',
            'cd "${GSPOT_HUSKY_ROOT:-$(git rev-parse --show-toplevel)}" || exit 2',
            ...(name === 'pre-push'
                ? ['set -- "${GSPOT_HUSKY_REMOTE_NAME-$1}" "${GSPOT_HUSKY_REMOTE_LOCATION-$2}"']
                : []),
            ...(name === 'commit-msg'
                ? [
                      'gspot_message=${GSPOT_HUSKY_MESSAGE-$1}',
                      'case "$gspot_message" in /*|[[:alpha:]]:*) ;; *) gspot_message="$PWD/$gspot_message" ;; esac',
                  ]
                : []),
            `(${hookCommand(name, runner, binaryPath, prefix)})${name === 'pre-push' ? ' < "${GSPOT_HUSKY_INPUT:-/dev/stdin}"' : ''} || gspot_status=$?`,
            'if [ -n "${GSPOT_HUSKY_RESULT:-}" ]; then printf "%s\\n" "$gspot_status" > "$GSPOT_HUSKY_RESULT"; fi',
            'exit "$gspot_status")',
        ].join('; '),
    }));
}

/**
 * Preserve the gspot verdict before the native manager combines job results.
 * @param name the hook
 * @param runner the task runner the policy names, or undefined
 * @param binaryPath the pinned executable when no runner resolves gspot
 * @returns the Lefthook command text
 */
export function lefthookCommand(name: HookName, runner: string | undefined, binaryPath?: string): string {
    const args =
        name === 'pre-push'
            ? 'check --push -- "${GSPOT_LEFTHOOK_REMOTE_NAME:?Run gspot install, then use the Git hook}" "${GSPOT_LEFTHOOK_REMOTE_LOCATION:?Run gspot install, then use the Git hook}"'
            : name === 'commit-msg'
              ? 'check --stage message --message-file "${GSPOT_LEFTHOOK_MESSAGE:?Run gspot install, then use the Git hook}"'
              : 'check --staged';
    return [
        'gspot_status=0',
        `${runnerExec(runner, binaryPath)} ${args} || gspot_status=$?`,
        String.raw`if [ "$gspot_status" -eq 126 ] || [ "$gspot_status" -eq 127 ]; then printf "%s\n" "The pinned gspot executable is unavailable. Install gspot, then run: gspot install" >&2; gspot_status=2; fi`,
        'if [ -n "${GSPOT_LEFTHOOK_RESULT:-}" ]; then printf "%s\\n" "$gspot_status" > "$GSPOT_LEFTHOOK_RESULT"; fi',
        'exit "$gspot_status"',
    ].join('; ');
}

/**
 * The owned command in each supported Lefthook hook.
 * @param runner the task runner the policy names, or undefined
 * @param binaryPath the pinned executable when no runner resolves gspot
 * @returns the hooks table Lefthook reads, keyed by hook
 */
export function lefthookBlock(runner: string | undefined, binaryPath?: string): LefthookBlock {
    return Object.fromEntries(
        HOOK_FILES.map((name) => [
            name,
            {
                commands: {
                    gspot: {
                        run: lefthookCommand(name, runner, binaryPath),
                        ...(name === 'pre-push' ? { use_stdin: true } : {}),
                    },
                },
            },
        ]),
    );
}

/**
 * Select the authored Lefthook file and own only the gspot commands.
 * @param root the repository root
 * @param runner the task runner the policy names, or undefined
 * @param binary the pinned executable when no runner resolves gspot
 * @returns the shared configuration output with the keys gspot installs
 */
export function lefthookConfiguration(
    root: string,
    runner: string | undefined,
    binary: string | undefined,
): ConfigurationOutput {
    if (hookPrefix(root) !== '')
        throw new Error('Lefthook reads configuration at the Git root. Configure its integration from that directory.');
    const files = openConfinedRoot(root);
    let path: string;
    try {
        path = ['lefthook.yml', '.lefthook.yml'].find((name) => files.read(name) !== undefined) ?? 'lefthook.yml';
    } finally {
        files.close();
    }
    return {
        path,
        format: 'yaml',
        changes: [
            { path: ['no_auto_install'], value: true },
            ...Object.entries(lefthookBlock(runner, binary)).flatMap(([hook, { commands }]) =>
                Object.entries(commands).map(([name, value]) => ({ path: [hook, 'commands', name], value })),
            ),
        ],
    };
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
