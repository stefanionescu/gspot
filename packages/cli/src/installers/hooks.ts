import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import { LINE_BREAK } from '#cli/config/text.ts';
import { GspotError } from '#cli/system/errors.ts';
import { runGitBlocking } from '#cli/system/git.ts';
import { readHooks } from '#cli/repository/setup.ts';
import type { Session } from '#cli/types/session.ts';
import { GSPOT_PATHS } from '#cli/config/gspot-folder.ts';
import type { ConfiguredCheck } from '#cli/types/planning.ts';
import type { HookName } from '#cli/types/generation/files.ts';
import { type Repository } from '#cli/types/repository/files.ts';
import { type RepositorySetup } from '#cli/types/repository/setup.ts';
import { CHECK_HOOKS, HOOK_CHECKS } from '#cli/config/generation/hooks.ts';
import type { HookPlan, HookStatus } from '#cli/types/installers/hooks.ts';

import {
    NO_GIT_STATUS,
    SET_HOOKS_PATH,
    UNSET_HOOKS_NOTE,
    UNSET_HOOKS_PATH,
    HOOK_COMMENT_LINE,
    HOOK_FOLDER_KINDS,
    NOT_INSTALLED_STATUS,
} from '#cli/config/installers/hooks.ts';

function formatForeignHooks(hooks: RepositorySetup['hooks'], session: Session): string {
    const runner = session.startRunner;
    const names = listHookNames(session.configuredChecks);
    const lines = names.map((name) => `  ${name}: ${runner.command} ${HOOK_CHECKS[name].arguments}`);
    return `hooks already run from ${hooks.map((hook) => hook.path).join(', ')}; add these gspot lines to them:\n${lines.join('\n')}`;
}

function planHooks(session: Session): HookPlan {
    const { repository } = session;
    const { settings } = session;
    const { hooksPath, hooks } = readHooks(repository);
    if (settings.hooks?.enabled !== true)
        return hooksPath === GSPOT_PATHS.hooks ? { command: UNSET_HOOKS_PATH, note: UNSET_HOOKS_NOTE } : { note: '' };
    if (hooksPath === GSPOT_PATHS.hooks) return { note: '' };
    if (hooks.length > 0) return { note: formatForeignHooks(hooks, session) };
    return {
        command: [...SET_HOOKS_PATH, GSPOT_PATHS.hooks],
        note: `set core.hooksPath to ${GSPOT_PATHS.hooks}`,
    };
}

/**
Set the planned Git setting, or report the instructions for existing hooks.

@param session what the hook plan reads.
@param steps collects each command that install runs.
@returns the command that install ran, with the line that reports it, or only the instructions for existing hooks.
*/
export function installHooks(session: Session, steps: (readonly string[])[]): HookPlan {
    const plan = planHooks(session);
    if (plan.command !== undefined) {
        steps.push(plan.command);
        const result = runGitBlocking(session.repository.root, plan.command.slice(1));
        if (result.code !== 0) throw new GspotError('install', `Cannot set core.hooksPath: ${result.stderr.trim()}`);
    }
    return plan;
}

function hasHookCommand(root: string, hook: RepositorySetup['hooks'][number], name: HookName): boolean {
    const paths = HOOK_FOLDER_KINDS.has(hook.kind)
        ? hook.files.filter((file) => file === name).map((file) => resolve(root, hook.path, file))
        : [resolve(root, hook.path)];
    const lines = paths.flatMap((path) => readFileSync(path, 'utf8').split(LINE_BREAK));
    return lines.some((line) => !HOOK_COMMENT_LINE.test(line) && line.includes(`check --hook ${name}`));
}

/**
Check whether the hooks in the settings run in this repository.

@param session the settings, runner, and configured checks.
@param repository the Git repository whose hooks to inspect.
*/
export function readHookStatus(session: Session, repository: Pick<Repository, 'root' | 'hasGit'>): HookStatus {
    const { settings } = session;
    if (settings.hooks?.enabled !== true) return { ready: true, text: 'none' };
    if (!repository.hasGit) return { ready: false, text: NO_GIT_STATUS };
    const { hooksPath, hooks: foreign } = readHooks(repository);
    if (hooksPath === GSPOT_PATHS.hooks) return { ready: true, text: 'installed' };
    if (foreign.length > 0) {
        const ready = listHookNames(session.configuredChecks).every((name) =>
            foreign.some((hook) => hasHookCommand(repository.root, hook, name)),
        );
        return {
            ready,
            text: ready
                ? `run from ${foreign.map((hook) => hook.path).join(', ')}`
                : `not installed; ${formatForeignHooks(foreign, session)}`,
        };
    }
    return { ready: false, text: NOT_INSTALLED_STATUS };
}

/**
List the hooks that run at least one configured check.

@param checks the configured checks.

@returns the hook names, in the order Git runs them.
*/
export function listHookNames(checks: ConfiguredCheck[]): HookName[] {
    const stages = new Set<string>(checks.map((planned) => planned.check.stage));
    return CHECK_HOOKS.filter((name) => HOOK_CHECKS[name].stages.some((stage) => stages.has(stage)));
}
