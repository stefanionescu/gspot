import { isTable } from '#cli/system/tables.ts';
import { find } from '#cli/system/files/reads.ts';
import { GspotError } from '#cli/system/errors.ts';
import type { Session } from '#cli/types/session.ts';
import type { Settings } from '#cli/types/settings/file.ts';
import { parseTomlFile } from '#cli/parsers/formats/toml.ts';
import { getTool, getToolName } from '#cli/manifests/tools.ts';
import { getOperatingSystem } from '#cli/system/environment.ts';
import type { Scope } from '#cli/types/settings/inheritance.ts';
import { getTable, getRootScope } from '#cli/settings/scopes.ts';
import type { Check, ScopeCheck } from '#cli/types/manifests.ts';
import { joinScope, listNestedScopes } from '#cli/repository/scopes.ts';
import { findFirstSkip, findSettingsSkip } from '#cli/planning/skips.ts';
import { isRootOnlyCheck, selectCheckFiles } from '#cli/planning/files.ts';
import { PYPROJECT_TOML } from '#cli/config/parsers/projects/dependencies.ts';
import { ROOT_RUNS, COVERAGE_DIMENSIONS, COVERAGE_INI_SECTION } from '#cli/config/planning/checks.ts';
import { type PlanOptions, type PlannedScope, type PlannedCheck, type ConfiguredCheck } from '#cli/types/planning.ts';

function listScopeChecks(settings: Settings, scope: Scope): ScopeCheck[] {
    const isRoot = scope.path === '';
    const configuredChecks = scope.configurations.flatMap((configuration) =>
        configuration.checks
            .map((check) => ({ check, configuration }))
            .filter((configured) => isRoot || !isRootOnlyCheck(configuration, configured.check)),
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
    const isRootCheck = (ROOT_RUNS as readonly string[]).includes(check.runs);
    const rootScope = getRootScope(session.scopes);
    const name = getToolName(check);
    const tool = name === undefined ? undefined : getTool(session.configurationsByName.values(), name);
    const plannedCheck: PlannedCheck = {
        scope: isRootCheck ? rootScope : scope,
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

function planScope(planned: PlannedScope, plannedRepositoryChecks: Set<string>): PlannedCheck[] {
    const checks: PlannedCheck[] = [];
    const wanted = listScopeChecks(planned.session.settings, planned.scope).filter((configured) =>
        isWanted(configured.check, planned.options),
    );
    for (const configured of wanted) {
        const isRootCheck = (ROOT_RUNS as readonly string[]).includes(configured.check.runs);
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
    const scopePaths = session.scopes.map(({ path }) => path);
    return session.scopes.map((scope) => {
        const context: PlannedScope = {
            session,
            scope,
            options,
            host,
            narrowedPaths,
            children: listNestedScopes(scopePaths, scope.path),
        };
        return planScope(context, plannedRepositoryChecks);
    });
}

/**
Check whether a planned check has files, deleted trigger paths, a commit message, or pushed commits to read.

@param planned the plan to inspect.
*/
// eslint-disable-next-line gspot/no-trivial-functions -- reason: Inlining this step puts its callers over the complexity limit.
export function isActive(planned: PlannedCheck): boolean {
    return (
        planned.files.length > 0 ||
        planned.triggerPaths.length > 0 ||
        planned.check.stage === 'message' ||
        (planned.check.runs === 'history' && (planned.commits?.length ?? 0) > 0)
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
    const singleRuns = new Set<string>();
    return scopes.flatMap((scope) =>
        listScopeChecks(settings, scope).flatMap(({ check, configuration }) => {
            if (!isWanted(check, { stage: 'any' }) || findSettingsSkip(settings, scope, check) !== undefined) return [];
            const rootOnly = (ROOT_RUNS as readonly string[]).includes(check.runs);
            if (rootOnly && singleRuns.has(check.id)) return [];
            if (rootOnly) singleRuns.add(check.id);
            const name = getToolName(check);
            const tool =
                name === undefined
                    ? undefined
                    : getTool(
                          scopes.flatMap((each) => each.configurations),
                          name,
                      );
            return [{ scope: rootOnly ? root : scope, check, configuration, tool }];
        }),
    );
}

/**
Check whether the project supplies coverage.py settings.

@param session the repository read cache.
@param scope the project folder relative to the repository.
@returns whether pytest must use the project's coverage configuration.
*/
export function hasProjectCoverage(session: Session, scope: string): boolean {
    if (find(session.reads, joinScope(scope, '.coveragerc')) !== undefined) return true;
    const pyproject = find(session.reads, joinScope(scope, PYPROJECT_TOML));
    const project = pyproject === undefined ? undefined : parseTomlFile(joinScope(scope, PYPROJECT_TOML), pyproject);
    if (isTable(project?.['tool']) && Object.hasOwn(project['tool'], 'coverage')) return true;
    return ['setup.cfg', 'tox.ini'].some((name) =>
        COVERAGE_INI_SECTION.test(find(session.reads, joinScope(scope, name)) ?? ''),
    );
}
