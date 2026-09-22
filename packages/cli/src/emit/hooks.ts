import { HOOK_FILES } from '#cli/checks/integrity-definitions.ts';
import { HOOK_HEADER } from '#cli/emit/markers-definitions.ts';
import type { HookName, LefthookBlock } from '#cli/emit/types.ts';

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

/** Resolve gspot locally, without downloading a missing launcher. */
export function runnerExec(runner: string | undefined, binaryPath?: string): string {
    return (
        RUNNER_EXEC[runner ?? ''] ?? (binaryPath === undefined ? 'gspot' : `'${binaryPath.replaceAll("'", "'\"'\"'")}'`)
    );
}

/** Execute an existing hook as a subprocess before checking the same Git input. */
export function hookBody(name: HookName, runner: string | undefined, binaryPath?: string, original = false): string {
    const push = name === 'pre-push';
    return [
        '#!/usr/bin/env bash',
        HOOK_HEADER,
        '# Runtime: Bash 3.2+, macOS, Linux, and Git for Windows.',
        'set -euo pipefail',
        ...(push && original
            ? [
                  'input=$(mktemp "${TMPDIR:-/tmp}/gspot-push.XXXXXXXX")',
                  `trap 'rm -f "\${input}"' EXIT`,
                  `trap 'exit 129' HUP`,
                  `trap 'exit 130' INT`,
                  `trap 'exit 143' TERM`,
                  'cat >"${input}"',
              ]
            : []),
        ...(original ? [`"$0.gspot-original" "$@"${push ? ' <"${input}"' : ''}`] : []),
        'status=0',
        `GSPOT_HOOK=${name} ${runnerExec(runner, binaryPath)} ${HOOK_ARGS[name]}${push && original ? ' <"${input}"' : ''} || status=$?`,
        'if [[ ${status} -eq 126 || ${status} -eq 127 ]]; then',
        '    printf "%s\\n" "The pinned gspot executable is unavailable. Install gspot, then run: gspot install" >&2',
        'fi',
        'exit "${status}"',
        '',
    ].join('\n');
}

/**
 * The husky files: one line each, appended to whatever the person has.
 * @param runner the task runner
 * @param binaryPath the gspot binary to call when there is no runner
 * @returns the line per husky file
 */
export function huskyLines(runner: string | undefined, binaryPath?: string): { path: string; line: string }[] {
    const exec = runnerExec(runner, binaryPath);
    return HOOK_FILES.map((name) => ({
        path: `.husky/${name}`,
        line: `${exec} ${HOOK_ARGS[name]}`,
    }));
}

/**
 * The lefthook block.
 * @param runner the task runner
 * @param binaryPath the gspot binary to call when there is no runner
 * @returns the three hook tables lefthook.yml carries
 */
export function lefthookBlock(runner: string | undefined, binaryPath?: string): LefthookBlock {
    const exec = runnerExec(runner, binaryPath);
    return {
        'pre-commit': { commands: { gspot: { run: `${exec} check --staged` } } },
        'pre-push': { commands: { gspot: { run: `${exec} check --push -- {1} {2}` } } },
        'commit-msg': { commands: { gspot: { run: `${exec} check --stage message --message-file {1}` } } },
    };
}
