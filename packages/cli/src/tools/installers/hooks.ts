import { readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

import cliPackage from '#cli-package' with { type: 'json' };
import { GSPOT_PATHS } from '#cli/config/manifests.ts';
import { COMMENT_LINE, PRE_COMMIT_FILE } from '#cli/config/repository/setup.ts';
import { EXECUTABLE_BITS, LINE_BREAK } from '#cli/config/system.ts';
import {
    CHECK_HOOKS,
    HOOK_CHECKS,
    HOOK_FOLDER_KINDS,
    HOOK_PROGRAM,
    NOT_INSTALLED_STATUS,
    SET_HOOKS_PATH,
    UNSET_HOOKS_NOTE,
    UNSET_HOOKS_PATH,
} from '#cli/config/tools/installers.ts';
import { VERSION_FLAG } from '#cli/config/tools/programs.ts';
import { runGit } from '#cli/repository/git/run.ts';
import { readHooks } from '#cli/repository/setup/read.ts';
import { GspotError } from '#cli/system/errors.ts';
import { runProcess } from '#cli/system/processes/run.ts';
import type { Repository, RepositorySetup } from '#cli/types/repository.ts';
import type { HookName, HookPlan, HookStatus, ScopeCheck, Session } from '#cli/types/tools.ts';

function formatPreCommitLines(names: HookName[]): string {
    const entries = names.filter((name) => name !== 'pre-push');
    const hookTypes = entries.map((name) => `--hook-type ${name}`).join(' ');
    const pushLines = names.includes('pre-push')
        ? [
              'pre-commit keeps the push input from its hooks, so add this line to .git/hooks/pre-push instead:',
              `  ${GSPOT_PATHS.hooks}/pre-push "$@"`,
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

function formatHookLines(hooks: RepositorySetup['hooks'], names: HookName[]): string {
    if (hooks.some((hook) => hook.kind === 'pre-commit')) return formatPreCommitLines(names);
    const lefthook = hooks.find((hook) => hook.kind === 'lefthook');
    if (lefthook !== undefined)
        return [`add this to ${lefthook.path}:`, ...names.flatMap((name) => formatLefthookEntry(name))].join('\n');
    const lines = names.map((name) => `  ${name}: ${GSPOT_PATHS.hooks}/${name} "$@"`);
    return ['add these gspot lines to them:', ...lines].join('\n');
}

function formatForeignHooks(
    hooks: RepositorySetup['hooks'],
    session: Session,
): Required<Pick<HookStatus, 'lines' | 'text'>> {
    const instructions = formatHookLines(hooks, listHookNames(session.configuredChecks));
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
    if (hooks.length > 0) return { note: formatForeignHooks(hooks, session).text };
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
    if (hook.kind === 'pre-commit' && name === 'pre-push') return false;
    const paths = HOOK_FOLDER_KINDS.has(hook.kind)
        ? hook.files.filter((file) => file === name).map((file) => resolve(root, hook.path, file))
        : [resolve(root, hook.path)];
    const lines = paths.flatMap((path) => readFileSync(path, 'utf8').split(LINE_BREAK));
    const command = `${GSPOT_PATHS.hooks}/${name}`;
    return lines.some((line) => !COMMENT_LINE.test(line) && line.includes(command));
}

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
        const { lines, text } = formatForeignHooks(foreign, session);
        return { ready: isReady, tool, lines, text: `not installed; ${text}` };
    }
    return { ready: false, text: NOT_INSTALLED_STATUS };
}

export async function readHookRunnerStatus(session: Session): Promise<HookStatus> {
    const hooks = await readHookStatus(session, session.repository);
    if (!hooks.ready || !session.settings.hooks.enabled) return hooks;
    const { command, hasBinFolder, installCommand } = session.startRunner;
    // A hook starts gspot from the bin folder, so a package manager that puts another Node.js first changes nothing.
    const versionCommand = hasBinFolder ? [HOOK_PROGRAM, VERSION_FLAG] : [...command.split(' '), VERSION_FLAG];
    const started = hasBinFolder ? [join(session.root, HOOK_PROGRAM), VERSION_FLAG] : versionCommand;
    const result = await runProcess(started, {
        cwd: session.root,
        timeoutSeconds: session.settings.tool_timeout_seconds,
    });
    if (result.code === 0) return hooks;
    const cause = result.stderr
        .split('\n')
        .map((line) => line.trim())
        .find((line) => line !== '');
    const install = installCommand.replace('<version>', () => cliPackage.version);
    const reason = cause === undefined ? '' : `: ${cause.replace(/\.$/u, '')}`;
    const failure = `${versionCommand.join(' ')} fails${reason}. Install gspot with: ${install}`;
    return { ...hooks, ready: false, lines: [failure], text: `${hooks.text}, but ${failure}` };
}

export function listHookNames(checks: ScopeCheck[]): HookName[] {
    const stages = new Set<string>(checks.map((planned) => planned.check.stage));
    return CHECK_HOOKS.filter((name) => HOOK_CHECKS[name].stages.some((stage) => stages.has(stage)));
}
