import { GspotError } from '#cli/system/errors.ts';
import { stripUndefined } from '#cli/system/values.ts';
import { isOutsideChildren } from '#cli/repository/scopes.ts';
import { listCoveredFiles } from '#cli/repository/coverage.ts';
import { getOperatingSystem } from '#cli/system/environment.ts';
import type { ScopeSelection } from '#cli/types/settings/values.ts';
import type { TrackedFile } from '#cli/types/repository/inventory.ts';
import type { Stage, CheckDeclaration } from '#cli/types/configurations.ts';
import { findFirstSkip, stripToolIgnoredFiles } from '#cli/planning/skips.ts';
import { getToolName, getToolDeclaration } from '#cli/configurations/tools.ts';
import { FLAG_VALUE, COVERAGE_FLAGS, COVERAGE_DIMENSIONS } from '#cli/config/planning.ts';
import { isRootOnlyCheck, listChildScopes, selectCheckFiles } from '#cli/planning/files.ts';
import type { Session, PlanInputs, PlanOptions, PlannedCheck, CheckCandidate } from '#cli/types/planning.ts';

function isStageWanted(filter: PlanOptions['stage'], stage: Stage): boolean {
    if (filter === 'any') return true;
    if (filter === 'all') return stage === 'commit' || stage === 'push';
    return filter === stage;
}

function listCheckCandidates(session: Session, selection: ScopeSelection): CheckCandidate[] {
    const isRoot = selection.scope.path === '';
    const entries = selection.selected.flatMap((manifest) =>
        manifest.checks
            .map((check) => ({ check, manifest }))
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
    return (options.only !== undefined && options.stage === 'all') || isStageWanted(options.stage, check.stage);
}

function planOne(context: PlanInputs, entry: CheckCandidate): PlannedCheck {
    const { session, selection: scope, options } = context;
    const { check, manifest } = entry;
    const isRootCheck = check.runs === 'once' || check.runs === 'history';
    // Repository inventory always places the root scope first.
    const rootScope = session.scopes[0] as ScopeSelection;
    const name = getToolName(check);
    const tool = name === undefined ? undefined : getToolDeclaration(session.manifests.values(), name, manifest);
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
    return stripToolIgnoredFiles(session, skip === undefined ? planned : { ...planned, skip });
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
        const isRootCheck = entry.check.runs === 'once' || entry.check.runs === 'history';
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
    const platform = getOperatingSystem();
    const narrow = buildNarrowedPaths(options);
    return session.scopes.map((scope) => {
        const context: PlanInputs = {
            session,
            selection: scope,
            options,
            platform,
            narrow,
            children: listChildScopes(session, scope),
            dependencyFiles: session.dependencyFiles,
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
 * List the checks that the settings turn on, in each scope.
 *
 * @param session the repository and its scopes.
 *
 * @returns the planned checks.
 */
export function listConfiguredChecks(session: Session): PlannedCheck[] {
    return planScopes(session, { stage: 'any' })
        .flatMap((planned) => skipReplacedChecks(planned))
        .filter((check) => isActive(check) && check.skip === undefined);
}

/**
 * List the files that the configurations of a check own, apart from the inputs of a project-wide run.
 *
 * @param session the scopes.
 * @param check the plan to read.
 *
 * @returns the files that the owners of the check select.
 */
export function listCoveredInputs(session: Pick<Session, 'scopes'>, check: PlannedCheck): TrackedFile[] {
    const owners = check.check.files ?? check.manifest?.files;
    const children = check.check.runs === 'scope' ? listChildScopes(session, check.selection) : [];
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
    const flags = command.map((part) => COVERAGE_FLAGS.has(part.replace(FLAG_VALUE, '')));
    if (!flags.some(Boolean)) return command;
    const coverage = planned.selection.view.options('coverage');
    return COVERAGE_DIMENSIONS.every((name) => coverage[name] === 0)
        ? command.filter((_, index) => flags[index] !== true)
        : command;
}
