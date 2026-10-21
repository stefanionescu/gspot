import { GspotError } from '#cli/system/errors.ts';
import type { Session } from '#cli/types/session.ts';
import { findFirstSkip } from '#cli/planning/skips.ts';
import { stripUndefined } from '#cli/system/tables.ts';
import { COVERAGE_DIMENSIONS } from '#cli/config/planning.ts';
import { getOperatingSystem } from '#cli/system/environment.ts';
import type { Scope } from '#cli/types/settings/inheritance.ts';
import type { Check, KnownCheck } from '#cli/types/configurations.ts';
import { getTable, findRootSelection } from '#cli/settings/scope-view.ts';
import { getTool, getToolName } from '#cli/configurations/declared-tools.ts';
import type { PlanOptions, PlannedScope, PlannedCheck } from '#cli/types/planning.ts';

import {
    isRootOnlyCheck,
    listChildScopes,
    selectCheckFiles,
    isRepositoryCheck,
    stripToolIgnoredFiles,
} from '#cli/planning/files.ts';

function listCheckCandidates(session: Session, selection: Scope): KnownCheck[] {
    const isRoot = selection.scope.path === '';
    const entries = selection.selected.flatMap((configuration) =>
        configuration.checks
            .map((check) => ({ check, configuration: configuration }))
            .filter((entry) => isRoot || !isRootOnlyCheck(configuration, entry.check)),
    );
    if (!isRoot) return entries;
    const own = Object.values(session.settingsFile.settings.commandChecks).map((entry) => ({ check: entry }));
    return [...entries, ...own];
}

function isWanted(check: Check, options: PlanOptions): boolean {
    if (options.only !== undefined && !options.only.includes(check.name)) return false;
    if (options.stage === 'any') return true;
    if (check.stage === 'message') return options.stage === 'message';
    if (options.stage === 'all')
        return options.only !== undefined || check.stage === 'commit' || check.stage === 'push';
    return options.stage === check.stage;
}

function planCheck(planned: PlannedScope, entry: KnownCheck): PlannedCheck {
    const { session, selection: scope, options } = planned;
    const { check, configuration } = entry;
    const isRootCheck = isRepositoryCheck(check);
    const rootScope = findRootSelection(session.scopes);
    const name = getToolName(check);
    const tool = name === undefined ? undefined : getTool(session.configurations.values(), name);
    const plannedCheck: PlannedCheck = {
        selection: isRootCheck ? rootScope : scope,
        check,
        ...selectCheckFiles(planned, entry),
        ...stripUndefined({
            configuration,
            tool,
            base: options.base,
            commits: options.commits,
            messageFile: options.messageFile,
        }),
    };
    const skip = findFirstSkip(plannedCheck, planned);
    const result = skip === undefined ? plannedCheck : { ...plannedCheck, skip };
    // gspot writes the tool ignore files from the configured checks, so the configuration cannot depend on them.
    return options.forConfiguration === true ? result : stripToolIgnoredFiles(session, result);
}

function buildNarrowedPaths(options: PlanOptions): Set<string> | undefined {
    const changed = options.staged ?? options.changed;
    if (options.paths === undefined) return changed === undefined ? undefined : new Set(changed);
    return new Set(options.paths.filter((path) => changed === undefined || changed.includes(path)));
}

// Only an active replacement in this plan can take over the work of another check.
function skipReplacedChecks(planned: PlannedCheck[]): PlannedCheck[] {
    const replacers = new Map(
        planned.flatMap((check): [string, string][] =>
            check.check.instead_of === undefined || check.skip !== undefined || !isActive(check)
                ? []
                : [[check.check.instead_of, check.check.name]],
        ),
    );
    return planned.map((check) => {
        const replacer = replacers.get(check.check.name);
        if (replacer === undefined || check.skip) return check;
        return { ...check, skip: { cause: 'replaced', note: `${replacer} runs it here` } };
    });
}

function planScope(planned: PlannedScope, plannedRepositoryChecks: Set<string>): PlannedCheck[] {
    const checks: PlannedCheck[] = [];
    const entries = listCheckCandidates(planned.session, planned.selection).filter((entry) =>
        isWanted(entry.check, planned.options),
    );
    for (const entry of entries) {
        const isRootCheck = isRepositoryCheck(entry.check);
        if (isRootCheck && plannedRepositoryChecks.has(entry.check.name)) continue;
        const check = planCheck(planned, entry);
        if (check.skip?.cause === 'level') continue;
        if (isRootCheck) plannedRepositoryChecks.add(entry.check.name);
        checks.push(check);
    }
    return checks;
}

function planScopes(session: Session, options: PlanOptions): PlannedCheck[][] {
    const plannedRepositoryChecks = new Set<string>();
    const host = { platform: getOperatingSystem(), arch: process.arch };
    const narrowedPaths = buildNarrowedPaths(options);
    return session.scopes.map((scope) => {
        const context: PlannedScope = {
            session,
            selection: scope,
            options,
            host,
            narrowedPaths,
            children: listChildScopes(session.scopes, scope),
        };
        return planScope(context, plannedRepositoryChecks);
    });
}

/**
 * Check whether a planned check has source input, a deleted trigger, or a commit message to read.
 *
 * @param check the plan to inspect.
 *
 * @returns whether the check has something to run over.
 */
export function isActive(check: PlannedCheck): boolean {
    return (
        check.files.length > 0 ||
        check.triggerPaths.length > 0 ||
        check.check.stage === 'message' ||
        (check.check.runs === 'history' && (check.commits?.length ?? 0) > 0)
    );
}

/**
 * Plan every check for the run.
 *
 * @param session the repository to check.
 * @param options what the run narrows to.
 *
 * @returns the planned checks in scope order.
 */
export function planChecks(session: Session, options: PlanOptions): PlannedCheck[] {
    const checks = planScopes(session, options).flatMap((planned) => skipReplacedChecks(planned));
    if (options.historyComplete === false) {
        const historyChecks = checks.filter((check) => check.skip === undefined && check.check.runs === 'history');
        if (historyChecks.length > 0)
            throw new GspotError(
                'git',
                `Pushed history is incomplete for ${historyChecks.map((check) => check.check.name).join(', ')}. Run git fetch --unshallow and retry.`,
            );
    }
    return checks;
}

/**
 * Keep authored commands, and drop shipped coverage arguments when no floor needs them.
 *
 * @param planned the check and its scope settings.
 * @param options the command and workspace.
 *
 * @returns the command, with coverage only when a floor needs it.
 */
export function stripCoverageArguments(
    planned: Pick<PlannedCheck, 'check' | 'selection' | 'configuration'>,
    options: Pick<Check, 'command'>,
): string[] | undefined {
    const command = options.command ?? planned.check.command;
    if (command === undefined || options.command !== undefined || planned.configuration === undefined) return command;
    const declaredArguments = planned.check.coverage_arguments ?? [];
    if (!hasCoverageArguments(command, declaredArguments) || !isCoverageOff(planned.selection)) return command;
    return command.filter((part) => !hasCoverageArguments([part], declaredArguments));
}

/**
 * Check whether every coverage requirement of a scope equals zero.
 *
 * @param selection the resolved coverage settings.
 * @returns whether the scope needs no coverage output.
 */
export function isCoverageOff(selection: Scope): boolean {
    const coverage = getTable(selection.view, 'coverage');
    return COVERAGE_DIMENSIONS.every((name) => coverage[name] === 0);
}

/**
 * Check whether a command uses one of the declared coverage arguments.
 *
 * @param command the program and arguments.
 * @param declaredArguments the coverage flags of the check.
 * @returns whether the command requests coverage output.
 */
export function hasCoverageArguments(
    command: readonly string[] | undefined,
    declaredArguments: readonly string[] | undefined,
): boolean {
    return (
        command?.some(
            (part) =>
                declaredArguments?.some((argument) => part === argument || part.startsWith(`${argument}=`)) === true,
        ) === true
    );
}
