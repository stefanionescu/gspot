import { GspotError } from '#cli/system/errors.ts';
import type { Session } from '#cli/types/session.ts';
import { findFirstSkip } from '#cli/planning/skips.ts';
import { stripUndefined } from '#cli/system/tables.ts';
import { listNestedScopes } from '#cli/repository/scopes.ts';
import { getOperatingSystem } from '#cli/system/environment.ts';
import type { Scope } from '#cli/types/settings/inheritance.ts';
import { getTable, findRootScope } from '#cli/settings/scopes.ts';
import { getTool, getToolName } from '#cli/configurations/tools.ts';
import { COVERAGE_DIMENSIONS } from '#cli/config/planning/checks.ts';
import type { Check, ScopeCheck } from '#cli/types/configurations.ts';
import { isRootOnlyCheck, selectCheckFiles } from '#cli/planning/files.ts';
import type { PlanOptions, PlannedScope, PlannedCheck } from '#cli/types/planning.ts';

function listScopeChecks(session: Session, scope: Scope): ScopeCheck[] {
    const isRoot = scope.folder.path === '';
    const configuredChecks = scope.configurations.flatMap((configuration) =>
        configuration.checks
            .map((check) => ({ check, configuration }))
            .filter((configured) => isRoot || !isRootOnlyCheck(configuration, configured.check)),
    );
    if (!isRoot) return configuredChecks;
    const own = Object.values(session.settingsFile.settings.commandChecks).map((commandCheck) => ({
        check: commandCheck,
    }));
    return [...configuredChecks, ...own];
}

function isWanted(check: Check, options: PlanOptions): boolean {
    if (options.only !== undefined && !options.only.includes(check.id)) return false;
    if (options.stage === 'any') return true;
    if (check.stage === 'message') return options.stage === 'message';
    if (options.stage === 'all')
        return options.only !== undefined || check.stage === 'commit' || check.stage === 'push';
    return options.stage === check.stage;
}

function planCheck(planned: PlannedScope, scopeCheck: ScopeCheck): PlannedCheck {
    const { session, scope, options } = planned;
    const { check, configuration } = scopeCheck;
    const isRootCheck = check.runs === 'once' || check.runs === 'history';
    const rootScope = findRootScope(session.scopes);
    const name = getToolName(check);
    const tool = name === undefined ? undefined : getTool(session.configurations.values(), name);
    const plannedCheck: PlannedCheck = {
        scope: isRootCheck ? rootScope : scope,
        check,
        ...selectCheckFiles(planned, scopeCheck),
        ...stripUndefined({
            configuration,
            tool,
            base: options.base,
            commits: options.commits,
            messageFile: options.messageFile,
        }),
    };
    const skip = findFirstSkip(plannedCheck, planned);
    return skip === undefined ? plannedCheck : { ...plannedCheck, skip };
}

function buildNarrowedPaths(options: PlanOptions): Set<string> | undefined {
    const changed = options.staged ?? options.changed;
    if (options.paths === undefined) return changed === undefined ? undefined : new Set(changed);
    return new Set(options.paths.filter((path) => changed === undefined || changed.includes(path)));
}

function skipReplacedChecks(planned: PlannedCheck[]): PlannedCheck[] {
    const replacers = new Map(
        planned.flatMap((check): [string, string][] =>
            check.check.instead_of === undefined || check.skip !== undefined || !isActive(check)
                ? []
                : [[check.check.instead_of, check.check.id]],
        ),
    );
    return planned.map((check) => {
        const replacer = replacers.get(check.check.id);
        if (replacer === undefined || check.skip) return check;
        return { ...check, skip: { cause: 'replaced', note: `${replacer} runs it here` } };
    });
}

function planScope(planned: PlannedScope, plannedRepositoryChecks: Set<string>): PlannedCheck[] {
    const checks: PlannedCheck[] = [];
    const wanted = listScopeChecks(planned.session, planned.scope).filter((configured) =>
        isWanted(configured.check, planned.options),
    );
    for (const configured of wanted) {
        const isRootCheck = configured.check.runs === 'once' || configured.check.runs === 'history';
        if (isRootCheck && plannedRepositoryChecks.has(configured.check.id)) continue;
        const check = planCheck(planned, configured);
        if (check.skip?.cause === 'level') continue;
        if (isRootCheck) plannedRepositoryChecks.add(configured.check.id);
        checks.push(check);
    }
    return checks;
}

function planScopes(session: Session, options: PlanOptions): PlannedCheck[][] {
    const plannedRepositoryChecks = new Set<string>();
    const host = { platform: getOperatingSystem(), arch: process.arch };
    const narrowedPaths = buildNarrowedPaths(options);
    const scopePaths = session.scopes.map(({ folder }) => folder.path);
    return session.scopes.map((scope) => {
        const context: PlannedScope = {
            session,
            scope,
            options,
            host,
            narrowedPaths,
            children: listNestedScopes(scopePaths, scope.folder.path),
        };
        return planScope(context, plannedRepositoryChecks);
    });
}

/**
Check whether a planned check has files, deleted trigger paths, a commit message, or pushed commits to read.

@param check the plan to inspect.
@returns whether the check has something to run over.
*/
// eslint-disable-next-line gspot/no-trivial-functions -- reason: 12 calls in 6 files share it.
export function isActive(check: PlannedCheck): boolean {
    return (
        check.files.length > 0 ||
        check.triggerPaths.length > 0 ||
        check.check.stage === 'message' ||
        (check.check.runs === 'history' && (check.commits?.length ?? 0) > 0)
    );
}

/**
Plan the checks of every scope, skip each check that another check replaces, and refuse history checks when the
pushed history lacks commits.

@param session the repository to check.
@param options what the run narrows to.
@returns the planned checks in scope order.
*/
export function planChecks(session: Session, options: PlanOptions): PlannedCheck[] {
    const checks = planScopes(session, options).flatMap((planned) => skipReplacedChecks(planned));
    if (options.shallow === true) {
        const historyChecks = checks.filter((check) => check.skip === undefined && check.check.runs === 'history');
        if (historyChecks.length > 0)
            throw new GspotError(
                'git',
                `Pushed history is incomplete for ${historyChecks.map((check) => check.check.id).join(', ')}. Run git fetch --unshallow and retry.`,
            );
    }
    return checks;
}

/**
Keep an override command, and drop the shipped coverage arguments when every coverage minimum equals 0.

@param planned the check and its scope settings.
@param authored the command and workspace.
@returns the command, with coverage only when a coverage minimum needs it.
*/
export function stripCoverageArguments(
    planned: Pick<PlannedCheck, 'check' | 'scope' | 'configuration'>,
    authored: Pick<Check, 'command'>,
): string[] | undefined {
    const command = authored.command ?? planned.check.command;
    if (command === undefined || authored.command !== undefined || planned.configuration === undefined) return command;
    const coverageArguments = planned.check.coverage_arguments ?? [];
    if (!hasCoverageArguments(command, coverageArguments) || !isCoverageOff(planned.scope)) return command;
    return command.filter((argument) => !hasCoverageArguments([argument], coverageArguments));
}

/**
Check whether every coverage requirement of a scope equals zero.

@param scope the resolved coverage settings.
@returns whether the scope needs no coverage output.
*/
export function isCoverageOff(scope: Scope): boolean {
    const coverage = getTable(scope.settings, 'coverage');
    return COVERAGE_DIMENSIONS.every((name) => coverage[name] === 0);
}

/**
Check whether a command uses one of the declared coverage arguments.

@param command the program and arguments.
@param coverageArguments the coverage flags of the check.
@returns whether the command requests coverage output.
*/
export function hasCoverageArguments(
    command: readonly string[] | undefined,
    coverageArguments: readonly string[] | undefined,
): boolean {
    return (
        command?.some(
            (word) =>
                coverageArguments?.some((argument) => word === argument || word.startsWith(`${argument}=`)) === true,
        ) === true
    );
}
