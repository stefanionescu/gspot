import { readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

import { GSPOT_PATHS } from '#cli/config/manifests.ts';
import { LINE_BREAK } from '#cli/config/parsers.ts';
import { EXECUTABLE_BITS } from '#cli/config/repository/files.ts';
import { PRE_COMMIT_FILE } from '#cli/config/repository/setup.ts';
import {
    CHECK_HOOKS,
    HOOK_CHECKS,
    HOOK_COMMENT_LINE,
    HOOK_FOLDER_KINDS,
    NOT_INSTALLED_STATUS,
    SET_HOOKS_PATH,
    UNSET_HOOKS_NOTE,
    UNSET_HOOKS_PATH,
} from '#cli/config/tools/installers.ts';
import { runGit } from '#cli/repository/git/run.ts';
import { readHooks } from '#cli/repository/setup.ts';
import { GspotError } from '#cli/system/errors.ts';
import type { Repository, RepositorySetup } from '#cli/types/repository.ts';
import type { HookName, HookPlan, HookStatus, ScopeCheck, Session } from '#cli/types/tools.ts';

const PRE_PUSH_HOOK = 'pre-push';

function describePreCommitLines(names: HookName[]): string {
    const entries = names.filter((name) => name !== PRE_PUSH_HOOK);
    const hookTypes = entries.map((name) => `--hook-type ${name}`).join(' ');
    const pushLines = names.includes(PRE_PUSH_HOOK)
        ? [
              'pre-commit keeps the push input from its hooks, so add this line to .git/hooks/pre-push instead:',
              `  ${GSPOT_PATHS.hooks}/${PRE_PUSH_HOOK} "$@"`,
          ]
        : [];
    return [
        `add this to the repos of ${PRE_COMMIT_FILE}:`,
        '  - repo: local',
        '    hooks:',
        ...entries.flatMap((name) => [
            `      - id: gspot-${name}`,
            `        name: gspot ${name}`,
            `        entry: ${GSPOT_PATHS.hooks}/${name}`,
            '        language: system',
            '        always_run: true',
            ...(name === 'commit-msg' ? [] : ['        pass_filenames: false']),
            `        stages: [${name}]`,
        ]),
        `Then run pre-commit install ${hookTypes}.`,
        ...pushLines,
    ].join('\n');
}

function formatLefthookEntry(name: HookName): string[] {
    const command = `${GSPOT_PATHS.hooks}/${name}`;
    const runLines = {
        'pre-commit': [`      run: ${command}`],
        'pre-push': [`      run: ${command} {0}`, '      use_stdin: true'],
        'commit-msg': [`      run: ${command} {1}`],
    }[name];
    return [`  ${name}:`, '    commands:', '      gspot:', ...runLines.map((line) => `  ${line}`)];
}

function describeHookLines(hooks: RepositorySetup['hooks'], names: HookName[]): string {
    if (hooks.some((hook) => hook.kind === 'pre-commit')) return describePreCommitLines(names);
    const lefthook = hooks.find((hook) => hook.kind === 'lefthook');
    if (lefthook !== undefined)
        return [`add this to ${lefthook.path}:`, ...names.flatMap((name) => formatLefthookEntry(name))].join('\n');
    const lines = names.map((name) => `  ${name}: ${GSPOT_PATHS.hooks}/${name} "$@"`);
    return ['add these gspot lines to them:', ...lines].join('\n');
}

function describeForeignHooks(
    hooks: RepositorySetup['hooks'],
    session: Session,
): Required<Pick<HookStatus, 'lines' | 'text'>> {
    const instructions = describeHookLines(hooks, listHookNames(session.configuredChecks));
    const text = `hooks already run from ${hooks.map((hook) => hook.path).join(', ')}; ${instructions}`;
    return { lines: [text], text };
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

function listBrokenHooks(root: string, names: HookName[]): string[] {
    return names.flatMap((name) => {
        const path = `${GSPOT_PATHS.hooks}/${name}`;
        const stats = statSync(resolve(root, path), { throwIfNoEntry: false });
        if (stats?.isFile() !== true)
            return [`${path} is missing, so Git skips the ${name} checks. Run gspot install.`];
        const isExecutable = process.platform === 'win32' || (stats.mode & EXECUTABLE_BITS) !== 0;
        return isExecutable ? [] : [`${path} is not executable, so Git skips the ${name} checks. Run gspot install.`];
    });
}

function hasHookCommand(root: string, hook: RepositorySetup['hooks'][number], name: HookName): boolean {
    if (hook.kind === 'pre-commit' && name === PRE_PUSH_HOOK) return false;
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
export async function installHooks(session: Session, steps: Array<readonly string[]>): Promise<HookPlan> {
    const plan = await planHooks(session);
    if (plan.command !== undefined) {
        steps.push(plan.command);
        const result = await runGit(session.repository.root, plan.command.slice(1), {});
        if (result.code !== 0) throw new GspotError('install', `Cannot set core.hooksPath: ${result.stderr.trim()}`);
    }
    return plan;
}

/**
Check whether the hooks in the settings run in this repository. Git skips a hook file that is missing or, off Windows,
not executable without a word, so each hook of gspot must be a file with an executable bit.

@param session the settings, runner, and configured checks.
@param repository the Git repository whose hooks to inspect.
*/
export async function readHookStatus(session: Session, repository: Pick<Repository, 'root'>): Promise<HookStatus> {
    const { settings } = session;
    if (!settings.hooks.enabled) return { ready: true, text: 'none' };
    const { hooksPath, hooks: foreign } = await readHooks(repository);
    if (hooksPath === GSPOT_PATHS.hooks) {
        const broken = listBrokenHooks(repository.root, listHookNames(session.configuredChecks));
        return broken.length === 0
            ? { ready: true, text: 'installed', tool: 'gspot' }
            : { ready: false, tool: 'gspot', lines: broken, text: `not ready; ${broken.join(' ')}` };
    }
    if (foreign.length > 0) {
        const installed = new Set(foreign.filter((hook) => hook.kind === 'hooksPath').flatMap((hook) => hook.files));
        const isReady = listHookNames(session.configuredChecks).every((name) =>
            foreign.some(
                (hook) =>
                    hasHookCommand(repository.root, hook, name) &&
                    (HOOK_FOLDER_KINDS.has(hook.kind) || installed.has(name)),
            ),
        );
        const tool = foreign.map((hook) => hook.kind).join(', ');
        if (isReady) return { ready: isReady, tool, text: `run from ${foreign.map((hook) => hook.path).join(', ')}` };
        const { lines, text } = describeForeignHooks(foreign, session);
        return { ready: isReady, tool, lines, text: `not installed; ${text}` };
    }
    return { ready: false, text: NOT_INSTALLED_STATUS };
}

/**
List the hooks that run at least one configured check.

@param checks the configured checks.

@returns the hook names, in the order Git runs them.
*/
export function listHookNames(checks: ScopeCheck[]): HookName[] {
    const stages = new Set<string>(checks.map((planned) => planned.check.stage));
    return CHECK_HOOKS.filter((name) => HOOK_CHECKS[name].stages.some((stage) => stages.has(stage)));
}
