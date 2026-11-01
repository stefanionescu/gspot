import { GspotError } from '#cli/system/errors.ts';
import { getTool, findToolName } from '#cli/tools/pins.ts';
import { readConfigurations } from '#cli/manifests/read.ts';
import { listNestedScopes } from '#cli/repository/scopes.ts';
import type { Scope, Settings } from '#cli/types/settings.ts';
import { getOperatingSystem } from '#cli/system/environment.ts';
import { getTable, getRootScope } from '#cli/settings/scopes.ts';
import type { Check, ScopeCheck } from '#cli/types/manifests.ts';
import type { Session, ConfiguredCheck } from '#cli/types/tools.ts';
import { findFirstSkip, findSettingsSkip } from '#cli/engine/skips.ts';
import type { PlanOptions, PlannedScope, PlannedCheck } from '#cli/types/engine/plan.ts';
import { isRootOnlyCheck, isRepositoryRun, selectCheckFiles } from '#cli/engine/files.ts';
import { OFF_BY_LEVEL, NO_MATCHING_FILES, COVERAGE_DIMENSIONS } from '#cli/config/engine.ts';

function listScopeChecks(settings: Settings, scope: Scope, root: Scope): ScopeCheck[] {
    const isRoot = scope.path === '';
    const atRoot = new Set(root.configurations.map(({ name }) => name));
    const configuredChecks = scope.configurations.flatMap((configuration) =>
        configuration.checks
            .map((check) => ({ check, configuration }))
            .filter(
                (configured) =>
                    isRoot || !atRoot.has(configuration.name) || !isRootOnlyCheck(configuration, configured.check),
            ),
    );
    if (!isRoot) return configuredChecks;
    const own = Object.values(settings.commandChecks).map((commandCheck) => ({
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
    const rootScope = getRootScope(session.scopes);
    const name = findToolName(check);
    const tool = name === undefined ? undefined : getTool(readConfigurations().values(), name);
    const plannedCheck: PlannedCheck = {
        scope: isRepositoryRun(check) ? rootScope : scope,
        check,
        ...selectCheckFiles(planned, scopeCheck),
        configuration,
        tool,
        base: options.base,
        commits: options.commits,
        range: options.range,
        messageFile: options.messageFile,
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

function enumerateScopeChecks(
    settings: Settings,
    scopes: Scope[],
    isKept: (scope: Scope, check: Check) => boolean,
): (ScopeCheck & { scope: Scope })[] {
    const root = getRootScope(scopes);
    const repositoryRuns = new Set<string>();
    return scopes.flatMap((scope) =>
        listScopeChecks(settings, scope, root)
            .filter(({ check }) => {
                if (!isKept(scope, check)) return false;
                if (!isRepositoryRun(check)) return true;
                if (repositoryRuns.has(check.id)) return false;
                repositoryRuns.add(check.id);
                return true;
            })
            .map((scopeCheck) => ({ ...scopeCheck, scope })),
    );
}

function planScopes(session: Session, options: PlanOptions): PlannedCheck[][] {
    const { settings, scopes } = session;
    const host = { platform: getOperatingSystem(), arch: process.arch };
    const narrowedPaths = buildNarrowedPaths(options);
    const scopePaths = scopes.map(({ path }) => path);
    const enumerated = Map.groupBy(
        enumerateScopeChecks(settings, scopes, (_scope, check) => isWanted(check, options)),
        ({ scope }) => scope.path,
    );
    return scopes.map((scope) => {
        const context: PlannedScope = {
            session,
            scope,
            options,
            host,
            narrowedPaths,
            children: listNestedScopes(scopePaths, scope.path),
        };
        const checks = (enumerated.get(scope.path) ?? []).map((configured) => planCheck(context, configured));
        return options.keepLevelOff === true ? checks : checks.filter(({ skip }) => skip?.cause !== 'level');
    });
}

/**
Check whether a planned check has files, deleted trigger paths, a commit message, or pushed commits to read.

@param planned the plan to inspect.
*/
// eslint-disable-next-line gspot/no-trivial-functions -- reason: Planning, check, and list decide whether a planned check has work through this one rule.
export function isActive(planned: PlannedCheck): boolean {
    return (
        planned.files.length > 0 ||
        planned.triggerPaths.length > 0 ||
        planned.check.stage === 'message' ||
        (planned.check.runs === 'history' && (planned.commits?.length ?? 0) > 0)
    );
}

/**
Word the state of a planned check for list and explain.

@param planned the plan of the check, or undefined when the level leaves it out of the plan.
*/
export function formatCheckState(planned: PlannedCheck | undefined): string {
    if (planned === undefined) return OFF_BY_LEVEL;
    if (planned.skip !== undefined) return `off (${planned.skip.cause})`;
    return isActive(planned) ? 'on' : NO_MATCHING_FILES;
}

/**
Plan the checks of every scope, and skip each check that another check replaces. Leave out the checks that the run
skips, and refuse history checks when the pushed history lacks commits.

@param session the repository to check.
@param options what the run narrows to.
@returns the planned checks in scope order.
*/
export function planChecks(session: Session, options: PlanOptions): PlannedCheck[] {
    const checks = planScopes(session, options)
        .flatMap((planned) => skipReplacedChecks(planned))
        .filter(({ check }) => options.skip?.includes(check.id) !== true);
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
    if (authored.command !== undefined) return authored.command;
    const { command } = planned.check;
    const coverageArguments = planned.check.coverage_arguments ?? [];
    if (
        command === undefined ||
        planned.configuration === undefined ||
        !hasCoverageArguments(command, coverageArguments) ||
        COVERAGE_DIMENSIONS.some(
            (name) =>
                command.some((word) => word.includes(`{setting:coverage.${name}}`)) &&
                getTable(planned.scope.settings, 'coverage')[name] > 0,
        )
    )
        return command;
    return command.filter((argument) => !hasCoverageArguments([argument], coverageArguments));
}

/**
Check whether every coverage requirement of a scope equals zero.

@param scope the resolved coverage settings.
*/
export function isCoverageOff(scope: Scope): boolean {
    const coverage = getTable(scope.settings, 'coverage');
    return COVERAGE_DIMENSIONS.every((name) => coverage[name] === 0);
}

/**
Check whether a command uses one of the declared coverage arguments.

@param command the program and arguments.
@param coverageArguments the coverage flags of the check.
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

/**
List each check that a scope runs at some stage, with no files.

@param scopes the scopes of the repository.
@param settings the authored selections, rule overrides, and stage choices.
@returns one entry for each scope and check.
*/
export function listEnabledChecks(scopes: Scope[], settings: Settings): ConfiguredCheck[] {
    const root = getRootScope(scopes);
    const configurations = scopes.flatMap((each) => each.configurations);
    return enumerateScopeChecks(
        settings,
        scopes,
        (scope, check) => isWanted(check, { stage: 'any' }) && findSettingsSkip(settings, scope, check) === undefined,
    ).map(({ scope, check, configuration }) => {
        const name = findToolName(check);
        const tool = name === undefined ? undefined : getTool(configurations, name);
        return { scope: isRepositoryRun(check) ? root : scope, check, configuration, tool };
    });
}
