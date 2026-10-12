import { GspotError } from '#cli/errors.ts';
import { coveredBy } from '#cli/repository/select.ts';
import { isOutsideChildren } from '#cli/repository/scopes.ts';
import { currentOperatingSystem } from '#cli/system/environment.ts';
import type { ScopeSelection } from '#cli/types/settings/values.ts';
import type { CheckDeclaration } from '#cli/types/configurations.ts';
import type { TrackedFile } from '#cli/types/repository/inventory.ts';
import { skipFor, restrictIgnoredPaths } from '#cli/planning/skips.ts';
import { filesFor, runsAtRoot, childScopes } from '#cli/planning/files.ts';
import { toolName, toolDeclaration } from '#cli/configurations/tool-pins.ts';
import { FLAG_VALUE, COVERAGE_FLAGS, COVERAGE_DIMENSIONS } from '#cli/config/planning.ts';
import type { Stage, Session, PlanEntry, PlanInputs, PlanOptions, PlannedCheck } from '#cli/types/planning.ts';

function isStageWanted(filter: PlanOptions['stage'], stage: Stage): boolean {
    if (filter === 'any') return true;
    if (filter === 'all') return stage === 'commit' || stage === 'push';
    return filter === stage;
}

function entriesFor(session: Session, scope: ScopeSelection): PlanEntry[] {
    const isRoot = scope.scope.path === '';
    const entries = scope.selected.flatMap((manifest) =>
        manifest.checks
            .map((check) => ({ check, manifest }))
            .filter((entry) => isRoot || !runsAtRoot(manifest, entry.check)),
    );
    if (!isRoot) return entries;
    const own = Object.values(session.settingsFile.settings.check).map((entry) => ({ check: entry }));
    return [...entries, ...own];
}

function isWanted(check: CheckDeclaration, options: PlanOptions): boolean {
    if (options.only !== undefined && !options.only.includes(check.name)) return false;
    if (options.stage === 'any') return true;
    if (check.stage === 'message') return options.stage === 'message';
    return (options.only !== undefined && options.stage === 'all') || isStageWanted(options.stage, check.stage);
}

function planOne(context: PlanInputs, entry: PlanEntry, isRootCheck: boolean): PlannedCheck {
    const { session, scope, options } = context;
    const { check, manifest } = entry;
    // Repository inventory always places the root scope first.
    const rootScope = session.scopes[0] as ScopeSelection;
    const name = toolName(check);
    const tool = name === undefined ? undefined : toolDeclaration(session.manifests.values(), name, manifest);
    const planned: PlannedCheck = {
        scope: isRootCheck ? rootScope : scope,
        check,
        ...filesFor(context, entry, isRootCheck),
        ...(manifest === undefined ? {} : { manifest }),
        ...(tool === undefined ? {} : { tool }),
        ...(options.commits === undefined ? {} : { commits: options.commits }),
        ...(options.messageFile === undefined ? {} : { messageFile: options.messageFile }),
    };
    const skip = skipFor(planned, context);
    return restrictIgnoredPaths(session, skip === undefined ? planned : { ...planned, skip });
}

function narrowSet(options: PlanOptions): Set<string> | undefined {
    const changed = options.staged ?? options.changed;
    if (options.paths === undefined) return changed === undefined ? undefined : new Set(changed);
    return new Set(options.paths.filter((path) => changed === undefined || changed.includes(path)));
}

// Only an active replacement in this execution plan can own another check's work.
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
    const entries = entriesFor(context.session, context.scope).filter((entry) =>
        isWanted(entry.check, context.options),
    );
    for (const entry of entries) {
        const isRootCheck = entry.check.runs === 'once' || entry.check.runs === 'history';
        if (isRootCheck && wholeSeen.has(entry.check.name)) continue;
        const check = planOne(context, entry, isRootCheck);
        if (check.skip?.cause === 'level') continue;
        if (isRootCheck) wholeSeen.add(entry.check.name);
        planned.push(check);
    }
    return planned;
}

function planScopes(session: Session, options: PlanOptions): PlannedCheck[][] {
    const wholeSeen = new Set<string>();
    const platform = currentOperatingSystem();
    const narrow = narrowSet(options);
    return session.scopes.map((scope) => {
        const context: PlanInputs = {
            session,
            scope,
            options,
            platform,
            narrow,
            children: childScopes(session, scope),
            projects: session.packageManifests,
        };
        return planScope(context, wholeSeen);
    });
}

/**
 * Whether a planned check has source input, a deleted trigger, or a commit message to inspect.
 *
 * @param check the planned check.
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
 * List settings-enabled checks for each applicable scope.
 *
 * @param session the open session.
 *
 * @returns every check the settings turns on, in each scope it applies to.
 */
export function configuredChecks(session: Session): PlannedCheck[] {
    return planScopes(session, { stage: 'any' })
        .flatMap((planned) => skipReplacedChecks(planned))
        .filter((check) => isActive(check) && check.skip === undefined);
}

/**
 * The enabled checks, including requirements for other operating systems.
 *
 * @param session the repository session.
 *
 * @returns the active checks across supported operating systems.
 */
export function configuredSystemChecks(session: Session): PlannedCheck[] {
    return planScopes(session, { stage: 'any', includeUnsupported: true })
        .flatMap((element) => skipReplacedChecks(element))
        .filter((check) => isActive(check) && check.skip === undefined);
}

/**
 * Source owners of a planned check, separate from inputs supplied to project-wide analysis.
 *
 * @param session the open session.
 * @param check the planned check.
 *
 * @returns the files the check's owners select.
 */
export function coveredInputs(session: Session, check: PlannedCheck): TrackedFile[] {
    const owners = check.check.files ?? check.manifest?.files;
    const children = check.check.runs === 'scope' ? childScopes(session, check.scope) : [];
    const files = check.files.filter((file) => isOutsideChildren(file.path, children));
    return owners === undefined
        ? []
        : coveredBy(
              owners,
              check.scope.selected,
              files,
              check.scope.scope.path,
              check.scope.view.test_files,
              check.scope.view.settings,
          );
}

/**
 * Plans every check for the run.
 *
 * @param session the session.
 * @param options stage, paths, only, skips, and the staged or ref-relative file sets.
 *
 * @returns the planned checks in scope order.
 */
export function planRun(session: Session, options: PlanOptions): PlannedCheck[] {
    const checks = planScopes(session, options).flatMap((planned) => skipReplacedChecks(planned));
    if (options.historyComplete === false) {
        const historyChecks = checks.filter((check) => check.skip === undefined && check.check.runs === 'history');
        if (historyChecks.length > 0)
            throw new GspotError('git', [
                `Pushed history is incomplete for ${historyChecks.map((check) => check.check.name).join(', ')}. Run git fetch --unshallow and retry.`,
            ]);
    }
    return checks;
}

/**
 * Keep authored commands and omit shipped coverage arguments when no floor requires them.
 *
 * @param planned the selected declaration and its scope settings.
 * @param options the supplied command and workspace.
 *
 * @returns the command with coverage enabled only when a floor requires it.
 */
export function coverageArguments(
    planned: Pick<PlannedCheck, 'check' | 'scope' | 'manifest'>,
    options: Pick<CheckDeclaration, 'command'>,
): string[] | undefined {
    const command = options.command ?? planned.check.command;
    if (command === undefined || options.command !== undefined || planned.manifest === undefined) return command;
    const flags = command.map((part) => COVERAGE_FLAGS.has(part.replace(FLAG_VALUE, '')));
    if (!flags.some(Boolean)) return command;
    const coverage = planned.scope.view.options('coverage');
    return COVERAGE_DIMENSIONS.every((name) => coverage[name] === 0)
        ? command.filter((_, index) => flags[index] !== true)
        : command;
}
