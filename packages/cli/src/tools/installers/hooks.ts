import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import { GspotError } from '#cli/system/errors.ts';
import { LINE_BREAK } from '#cli/config/parsers.ts';
import { readHooks } from '#cli/repository/setup.ts';
import { GSPOT_PATHS } from '#cli/config/manifests.ts';
import { runGitBlocking } from '#cli/repository/git/run.ts';
import type { Repository, RepositorySetup } from '#cli/types/repository.ts';
import type { Session, HookName, HookPlan, HookStatus, ConfiguredCheck } from '#cli/types/tools.ts';

import {
    CHECK_HOOKS,
    HOOK_CHECKS,
    SET_HOOKS_PATH,
    UNSET_HOOKS_NOTE,
    UNSET_HOOKS_PATH,
    HOOK_COMMENT_LINE,
    HOOK_FOLDER_KINDS,
    NOT_INSTALLED_STATUS,
} from '#cli/config/tools/installers.ts';

function describeForeignHooks(
    hooks: RepositorySetup['hooks'],
    session: Session,
): Required<Pick<HookStatus, 'lines' | 'text'>> {
    const lines = listHookNames(session.configuredChecks).map((name) => `${name}: ${GSPOT_PATHS.hooks}/${name} "$@"`);
    const indented = lines.map((line) => `  ${line}`).join('\n');
    return {
        lines,
        text: `hooks already run from ${hooks.map((hook) => hook.path).join(', ')}; add these gspot lines to them:\n${indented}`,
    };
}

async function planHooks(session: Session): Promise<HookPlan> {
    const { repository } = session;
    const { settings } = session;
    const { hooksPath, hooks } = await readHooks(repository);
    if (!settings.hooks.enabled)
        return hooksPath === GSPOT_PATHS.hooks ? { command: UNSET_HOOKS_PATH, note: UNSET_HOOKS_NOTE } : { note: '' };
    if (hooksPath === GSPOT_PATHS.hooks) return { note: '' };
    if (hooks.length > 0) return { note: describeForeignHooks(hooks, session).text };
    return {
        command: [...SET_HOOKS_PATH, GSPOT_PATHS.hooks],
        note: `set core.hooksPath to ${GSPOT_PATHS.hooks}`,
    };
}

function hasHookCommand(root: string, hook: RepositorySetup['hooks'][number], name: HookName): boolean {
    const paths = HOOK_FOLDER_KINDS.has(hook.kind)
        ? hook.files.filter((file) => file === name).map((file) => resolve(root, hook.path, file))
        : [resolve(root, hook.path)];
    const lines = paths.flatMap((path) => readFileSync(path, 'utf8').split(LINE_BREAK));
    const command = `${GSPOT_PATHS.hooks}/${name}`;
    return lines.some((line) => !HOOK_COMMENT_LINE.test(line) && line.includes(command));
}

/**
Set the planned Git setting, or report the instructions for existing hooks.

@param session what the hook plan reads.
@param steps collects each command that install runs.
@returns the command that install ran, with the line that reports it, or only the instructions for existing hooks.
*/
export async function installHooks(session: Session, steps: (readonly string[])[]): Promise<HookPlan> {
    const plan = await planHooks(session);
    if (plan.command !== undefined) {
        steps.push(plan.command);
        const result = runGitBlocking(session.repository.root, plan.command.slice(1));
        if (result.code !== 0) throw new GspotError('install', `Cannot set core.hooksPath: ${result.stderr.trim()}`);
    }
    return plan;
}

/**
Check whether the hooks in the settings run in this repository.

@param session the settings, runner, and configured checks.
@param repository the Git repository whose hooks to inspect.
*/
export async function readHookStatus(session: Session, repository: Pick<Repository, 'root'>): Promise<HookStatus> {
    const { settings } = session;
    if (!settings.hooks.enabled) return { ready: true, text: 'none' };
    const { hooksPath, hooks: foreign } = await readHooks(repository);
    if (hooksPath === GSPOT_PATHS.hooks) return { ready: true, text: 'installed', tool: 'gspot' };
    if (foreign.length > 0) {
        const ready = listHookNames(session.configuredChecks).every((name) =>
            foreign.some((hook) => hasHookCommand(repository.root, hook, name)),
        );
        const tool = foreign.map((hook) => hook.kind).join(', ');
        if (ready) return { ready, tool, text: `run from ${foreign.map((hook) => hook.path).join(', ')}` };
        const { lines, text } = describeForeignHooks(foreign, session);
        return { ready, tool, lines, text: `not installed; ${text}` };
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
