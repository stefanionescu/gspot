// .gspot/hooks/*, core.hooksPath, the husky and lefthook forms.
import { HOOK_HEADER } from '#config/markers.ts';
import { git } from '#cli/platform/spawn.ts';
import type { GeneratedFile } from '#types/render.ts';

export type HookName = 'pre-commit' | 'pre-push' | 'commit-msg';

const HOOK_ARGS: Record<HookName, string> = {
    'pre-commit': 'check --staged',
    'pre-push': 'check',
    'commit-msg': 'check --stage message --message-file',
};

/** The command that resolves the pinned gspot for a runner. */
export function runnerExec(surface: string, binaryPath?: string): string {
    switch (surface) {
        case 'mise':
            return 'mise exec -- gspot';
        case 'bun':
            return 'bunx gspot';
        case 'npm':
            return 'npx gspot';
        case 'pnpm':
            return 'pnpm exec gspot';
        default:
            return binaryPath ?? 'gspot';
    }
}

/** The body of one hook. */
export function hookBody(name: HookName, surface: string, binaryPath?: string): string {
    const lfs = name === 'pre-push' ? 'if command -v git-lfs >/dev/null 2>&1; then git lfs pre-push "$@"; fi\n' : '';
    return [
        '#!/usr/bin/env bash',
        HOOK_HEADER,
        'set -euo pipefail',
        `${lfs}read -ra gspot_command <<<"\${GSPOT_BIN:-${runnerExec(surface, binaryPath)}}"`,
        `exec "\${gspot_command[@]}" ${HOOK_ARGS[name]} "$@"`,
        '',
    ].join('\n');
}

/** The three gspot hook files. */
export function gspotHooks(surface: string, binaryPath?: string): GeneratedFile[] {
    return (['pre-commit', 'pre-push', 'commit-msg'] as HookName[]).map((name) => ({
        path: `.gspot/hooks/${name}`,
        content: hookBody(name, surface, binaryPath),
        readOnly: false,
        executable: true,
        kind: 'hook',
    }));
}

/** Points core.hooksPath at .gspot/hooks. */
export function installHooksPath(root: string): void {
    git(root, ['config', 'core.hooksPath', '.gspot/hooks']);
}

/** Removes core.hooksPath when it points at gspot. */
export function removeHooksPath(root: string): void {
    const current = git(root, ['config', '--get', 'core.hooksPath'])?.trim();
    if (current === '.gspot/hooks') git(root, ['config', '--unset', 'core.hooksPath']);
}

/** The husky files: one line each, appended to whatever the person has. */
export function huskyLines(surface: string, binaryPath?: string): { path: string; line: string }[] {
    const exec = runnerExec(surface, binaryPath);
    return (['pre-commit', 'pre-push', 'commit-msg'] as HookName[]).map((name) => ({
        path: `.husky/${name}`,
        line: `${exec} ${HOOK_ARGS[name]}${name === 'commit-msg' ? ' "$1"' : ''}`,
    }));
}

/** The lefthook block. */
export function lefthookBlock(surface: string, binaryPath?: string): Record<string, unknown> {
    const exec = runnerExec(surface, binaryPath);
    return {
        'pre-commit': { commands: { gspot: { run: `${exec} check --staged` } } },
        'pre-push': { commands: { gspot: { run: `${exec} check` } } },
        'commit-msg': { commands: { gspot: { run: `${exec} check --stage message --message-file {1}` } } },
    };
}
