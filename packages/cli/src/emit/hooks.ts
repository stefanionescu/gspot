// .gspot/hooks/*, core.hooksPath, the husky and lefthook forms.
import { git } from '#cli/platform/spawn.ts';
import { HOOK_HEADER } from '#config/markers.ts';
import type { HookName, GeneratedFile, LefthookBlock } from '#types/emit.ts';

const RUNTIME_LINE = '# Runtime: Bash 3.2+, macOS and Linux.';
const HOOK_NAMES: HookName[] = ['pre-commit', 'pre-push', 'commit-msg'];
const HOOK_ARGS: Record<HookName, string> = {
    'pre-commit': 'check --staged',
    'pre-push': 'check',
    'commit-msg': 'check --at message --message-file',
};
const RUNNER_EXEC: Record<string, string> = {
    mise: 'mise exec -- gspot',
    bun: 'bunx gspot',
    npm: 'npx gspot',
    pnpm: 'pnpm exec gspot',
};

/**
 * The command that resolves the pinned gspot for a runner.
 * @param runner the task runner
 * @param binaryPath the gspot binary to call when there is no runner
 * @returns the command prefix
 */
export function runnerExec(runner: string, binaryPath?: string): string {
    return RUNNER_EXEC[runner] ?? binaryPath ?? 'gspot';
}

/**
 * The body of one hook.
 * @param name the hook
 * @param runner the task runner
 * @param binaryPath the gspot binary to call when there is no runner
 * @returns the script text; only commit-msg forwards an argument (the message file), because git hands pre-push the remote name and URL
 */
export function hookBody(name: HookName, runner: string, binaryPath?: string): string {
    const lfs =
        name === 'pre-push'
            ? ['    if command -v git-lfs >/dev/null 2>&1; then', '        git lfs pre-push "$@"', '    fi']
            : [];
    const exec = runnerExec(runner, binaryPath)
        .split(' ')
        .map((word) => `'${word}'`)
        .join(' ');
    return [
        '#!/usr/bin/env bash',
        '#',
        HOOK_HEADER,
        RUNTIME_LINE,
        'set -euo pipefail',
        '',
        'main() {',
        '    local -a gspot_command',
        '    read -ra gspot_command <<<"${GSPOT_BIN-}"',
        '    if [[ ${#gspot_command[@]} -eq 0 ]]; then',
        `        gspot_command=(${exec})`,
        '    fi',
        ...lfs,
        `    exec "\${gspot_command[@]}" ${HOOK_ARGS[name]}${name === 'commit-msg' ? ' "$1"' : ''}`,
        '}',
        '',
        'main "$@"',
        '',
    ].join('\n');
}

/**
 * The three gspot hook files.
 * @param runner the task runner
 * @param binaryPath the gspot binary to call when there is no runner
 * @returns the executable hook files under .gspot/hooks
 */
export function gspotHooks(runner: string, binaryPath?: string): GeneratedFile[] {
    return HOOK_NAMES.map((name) => ({
        path: `.gspot/hooks/${name}`,
        content: hookBody(name, runner, binaryPath),
        readOnly: false,
        executable: true,
        kind: 'hook',
    }));
}

/**
 * Points core.hooksPath at .gspot/hooks.
 * @param root the repository root
 */
export function installHooksPath(root: string): void {
    git(root, ['config', 'core.hooksPath', '.gspot/hooks']);
}

/**
 * Removes core.hooksPath when it points at gspot.
 * @param root the repository root
 */
export function removeHooksPath(root: string): void {
    const current = git(root, ['config', '--get', 'core.hooksPath'])?.trim();
    if (current === '.gspot/hooks') git(root, ['config', '--unset', 'core.hooksPath']);
}

/**
 * The husky files: one line each, appended to whatever the person has.
 * @param runner the task runner
 * @param binaryPath the gspot binary to call when there is no runner
 * @returns the line per husky file
 */
export function huskyLines(runner: string, binaryPath?: string): { path: string; line: string }[] {
    const exec = runnerExec(runner, binaryPath);
    return HOOK_NAMES.map((name) => ({
        path: `.husky/${name}`,
        line: `${exec} ${HOOK_ARGS[name]}${name === 'commit-msg' ? ' "$1"' : ''}`,
    }));
}

/**
 * The lefthook block.
 * @param runner the task runner
 * @param binaryPath the gspot binary to call when there is no runner
 * @returns the three hook tables lefthook.yml carries
 */
export function lefthookBlock(runner: string, binaryPath?: string): LefthookBlock {
    const exec = runnerExec(runner, binaryPath);
    return {
        'pre-commit': { commands: { gspot: { run: `${exec} check --staged` } } },
        'pre-push': { commands: { gspot: { run: `${exec} check` } } },
        'commit-msg': { commands: { gspot: { run: `${exec} check --at message --message-file {1}` } } },
    };
}
