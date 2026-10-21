import { GspotError } from '#cli/system/errors.ts';
import { stripUndefined } from '#cli/system/values.ts';
import { COVERAGE_DIMENSIONS } from '#cli/config/planning.ts';
import { isOutsideChildren } from '#cli/repository/scopes.ts';
import { listCoveredFiles } from '#cli/repository/coverage.ts';
import { getOperatingSystem } from '#cli/system/environment.ts';
import type { ScopeSelection } from '#cli/types/settings/values.ts';
import type { TrackedFile } from '#cli/types/repository/inventory.ts';
import { getTable, findRootSelection } from '#cli/settings/scope-view.ts';
import { findFirstSkip, stripToolIgnoredFiles } from '#cli/planning/skips.ts';
import { getToolName, getToolDeclaration } from '#cli/configurations/tools.ts';
import { type KnownCheck, type CheckDeclaration } from '#cli/types/configurations.ts';
import type { Session, PlanInputs, PlanOptions, PlannedCheck } from '#cli/types/planning.ts';
import { isRootOnlyCheck, listChildScopes, selectCheckFiles, isRepositoryCheck } from '#cli/planning/files.ts';

function listCheckCandidates(session: Session, selection: ScopeSelection): KnownCheck[] {
    const isRoot = selection.scope.path === '';
    const entries = selection.selected.flatMap((manifest) =>
        manifest.checks
            .map((check) => ({ check, configuration: manifest }))
            .filter((entry) => isRoot || !isRootOnlyCheck(manifest, entry.check)),
    );
    if (!isRoot) return entries;
    const own = Object.values(session.settingsFile.settings.commandChecks).map((entry) => ({ check: entry }));
    return [...entries, ...own];
}

function isWanted(check: CheckDeclaration, options: PlanOptions): boolean {
    if (options.only !== undefined && !options.only.includes(check.name)) return false;
    if (options.stage === 'any') return true;
    if (check.stage === 'message') return options.stage === 'message';
    if (options.stage === 'all')
        return options.only !== undefined || check.stage === 'commit' || check.stage === 'push';
    return options.stage === check.stage;
}

function planOne(context: PlanInputs, entry: KnownCheck): PlannedCheck {
    const { session, selection: scope, options } = context;
    const { check, configuration: manifest } = entry;
    const isRootCheck = isRepositoryCheck(check);
    const rootScope = findRootSelection(session.scopes);
    const name = getToolName(check);
    const tool = name === undefined ? undefined : getToolDeclaration(session.manifests.values(), name);
    const planned: PlannedCheck = {
        selection: isRootCheck ? rootScope : scope,
        check,
        ...selectCheckFiles(context, entry),
        ...stripUndefined({
            manifest,
            tool,
            base: options.base,
            commits: options.commits,
            messageFile: options.messageFile,
        }),
    };
    const skip = findFirstSkip(planned, context);
    const result = skip === undefined ? planned : { ...planned, skip };
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

function planScope(context: PlanInputs, wholeSeen: Set<string>): PlannedCheck[] {
    const planned: PlannedCheck[] = [];
    const entries = listCheckCandidates(context.session, context.selection).filter((entry) =>
        isWanted(entry.check, context.options),
    );
    for (const entry of entries) {
        const isRootCheck = isRepositoryCheck(entry.check);
        if (isRootCheck && wholeSeen.has(entry.check.name)) continue;
        const check = planOne(context, entry);
        if (check.skip?.cause === 'level') continue;
        if (isRootCheck) wholeSeen.add(entry.check.name);
        planned.push(check);
    }
    return planned;
}

function planScopes(session: Session, options: PlanOptions): PlannedCheck[][] {
    const wholeSeen = new Set<string>();
    const host = { platform: getOperatingSystem(), arch: process.arch };
    const narrow = buildNarrowedPaths(options);
    return session.scopes.map((scope) => {
        const context: PlanInputs = {
            session,
            selection: scope,
            options,
            host,
            narrow,
            children: listChildScopes(session.scopes, scope),
        };
        return planScope(context, wholeSeen);
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
 * List the files that the configurations of a check own, apart from the inputs of a project-wide run.
 *
 * @param selections the scopes.
 * @param check the plan to read.
 *
 * @returns the files that the owners of the check select.
 */
export function listCoveredInputs(selections: ScopeSelection[], check: PlannedCheck): TrackedFile[] {
    const owners = check.check.files ?? check.manifest?.files;
    const children = check.check.runs === 'scope' ? listChildScopes(selections, check.selection) : [];
    const files = check.files.filter((file) => isOutsideChildren(file.path, children));
    return owners === undefined
        ? []
        : listCoveredFiles(owners, files, {
              selected: check.selection.selected,
              scope: check.selection.scope.path,
              view: check.selection.view,
          });
}

/**
 * Plan every check for the run.
 *
 * @param session the repository to check.
 * @param options what the run narrows to.
 *
 * @returns the planned checks in scope order.
 */
export function planRun(session: Session, options: PlanOptions): PlannedCheck[] {
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
    planned: Pick<PlannedCheck, 'check' | 'selection' | 'manifest'>,
    options: Pick<CheckDeclaration, 'command'>,
): string[] | undefined {
    const command = options.command ?? planned.check.command;
    if (command === undefined || options.command !== undefined || planned.manifest === undefined) return command;
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
export function isCoverageOff(selection: ScopeSelection): boolean {
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
