import { HOOK_FILES } from '#cli/repository/hooks.ts';
import { currentBlock, blockSpan } from '#cli/emit/managed-blocks.ts';
import { HOOK_HEADER } from '#cli/emit/markers.ts';
import { isGitRepository } from '#cli/repository/tracked.ts';
import { runBlocking } from '#cli/platform/spawn.ts';
import { openConfinedRoot } from '#cli/filesystem/confined.ts';
import type { ConfigurationOutput, HookName, LefthookBlock } from '#cli/types/generation.ts';

const HOOK_ARGS: Record<HookName, string> = {
    'pre-commit': 'check --staged',
    'pre-push': 'check --push -- "$@"',
    'commit-msg': 'check --stage message --message-file "$1"',
};
const RUNNER_EXEC: Record<string, string> = {
    mise: 'mise exec -- gspot',
    bun: 'bun run --no-install gspot',
    npm: 'npm exec --no -- gspot',
    pnpm: 'pnpm exec gspot',
    yarn: 'yarn exec gspot',
};

/** Locate policy-owned hook configuration relative to the working directory Git uses for hooks. */
export function hookPrefix(root: string): string {
    if (!isGitRepository(root)) return '';
    const result = runBlocking(['git', 'rev-parse', '--show-prefix'], { cwd: root });
    if (result.code !== 0) throw new Error(`Cannot resolve the hook configuration directory: ${result.stderr.trim()}`);
    return result.stdout.replace(/\n$/u, '');
}

/** Resolve gspot locally, without downloading a missing launcher. */
export function runnerExec(runner: string | undefined, binaryPath?: string): string {
    return (
        RUNNER_EXEC[runner ?? ''] ?? (binaryPath === undefined ? 'gspot' : `'${binaryPath.replaceAll("'", "'\"'\"'")}'`)
    );
}

/** The check invocation for one Git hook. */
export function hookCommand(name: HookName, runner: string | undefined, binaryPath?: string, directory = ''): string {
    const at = directory === '' ? '' : `cd '${directory.replaceAll("'", "'\"'\"'")}' && `;
    const args = name === 'commit-msg' ? 'check --stage message --message-file "${gspot_message}"' : HOOK_ARGS[name];
    const executable = runner !== undefined && Object.hasOwn(RUNNER_EXEC, runner) ? runner : (binaryPath ?? 'gspot');
    return `${at}{ gspot_executable=$(command -v '${executable.replaceAll("'", "'\"'\"'")}') && [ -x "$gspot_executable" ] || { printf "%s\\n" "The pinned gspot executable is unavailable. Install gspot, then run: gspot install" >&2; exit 2; }; ${runnerExec(runner, binaryPath)} ${args}; }`;
}

/** Execute an existing hook as a subprocess before checking the same Git input. */
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
            '    printf "%s\\n" "The pinned gspot executable is unavailable. Install gspot, then run: gspot install" >&2',
            '    status=2',
            'fi',
            'if [[ ${status} -ne 0 ]]; then exit "${status}"; fi',
        ]),
        'exit 0',
        '',
    ].join('\n');
}

/** The managed invocation in each authored Husky script. */
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

/** Verify the invocation without claiming ownership of authored Husky commands. */
export function huskyReady(root: string, runner: string | undefined, binaryPath?: string): boolean {
    const files = openConfinedRoot(root);
    try {
        return huskyLines(root, runner, binaryPath).every(({ path, line }) => {
            const current = files.read(path);
            if (current === undefined) return false;
            const text = current.bytes.toString('utf8');
            return blockSpan(text, 'hash') !== undefined && currentBlock(text, 'hash') === line;
        });
    } finally {
        files.close();
    }
}

/** Preserve the gspot verdict before the native manager combines job results. */
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
        'if [ "$gspot_status" -eq 126 ] || [ "$gspot_status" -eq 127 ]; then printf "%s\\n" "The pinned gspot executable is unavailable. Install gspot, then run: gspot install" >&2; gspot_status=2; fi',
        'if [ -n "${GSPOT_LEFTHOOK_RESULT:-}" ]; then printf "%s\\n" "$gspot_status" > "$GSPOT_LEFTHOOK_RESULT"; fi',
        'exit "$gspot_status"',
    ].join('; ');
}

/** The owned command in each supported Lefthook hook. */
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

/** Select the authored Lefthook file and own only the gspot commands. */
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
