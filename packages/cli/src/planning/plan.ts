// The check graph for a run: stage, scope, file sets, requirements, skips.
import { GspotError } from '#cli/platform/errors.ts';
import { ownedBy } from '#cli/configurations/owners.ts';
import { HISTORY_CHECKS } from '#cli/config/planning.ts';
import { hostPlatform } from '#cli/platform/environment.ts';
import { isOutsideChildren } from '#cli/repository/selectors.ts';
import type { ScopeSelection } from '#cli/types/policy/settings.ts';
import type { CheckDeclaration } from '#cli/types/configurations.ts';
import type { TrackedFile } from '#cli/types/repository/inventory.ts';
import { filesFor, runsAtRoot, childScopes } from '#cli/planning/files.ts';
import { readPackageManifests } from '#cli/repository/package-manifests.ts';
import { toolPin, toolName, checkToolPin } from '#cli/configurations/pins.ts';
import { skipFor, selectionStatus, restrictIgnoredPaths } from '#cli/planning/skips.ts';
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
    const own = Object.values(session.policyFiles.policy.check).map((entry) => ({ check: entry }));
    return [...entries, ...own];
}

function isWanted(check: CheckDeclaration, options: PlanOptions): boolean {
    if (options.only !== undefined && !options.only.includes(check.name)) return false;
    if (options.stage === 'any') return true;
    if (check.stage === 'message') return options.stage === 'message';
    return (options.only !== undefined && options.stage === 'all') || isStageWanted(options.stage, check.stage);
}

function planOne(context: PlanInputs, entry: PlanEntry, isRootCheck: boolean): PlannedCheck {
    const { session, scope, options, platform } = context;
    const { check, manifest } = entry;
    // Repository inventory always places the root scope first.
    const rootScope = session.scopes[0] as ScopeSelection;
    const name = toolName(check);
    const tool =
        name === undefined ? undefined : checkToolPin(toolPin(session.manifests.values(), name, manifest), check);
    const planned: PlannedCheck = {
        scope: isRootCheck ? rootScope : scope,
        check,
        ...filesFor(context, entry, isRootCheck),
        ...(manifest === undefined ? {} : { manifest }),
        ...(tool === undefined ? {} : { tool }),
        ...(options.commits === undefined ? {} : { commits: options.commits }),
        ...(options.messageFile === undefined ? {} : { messageFile: options.messageFile }),
    };
    const skip = skipFor(
        planned,
        options,
        { platform, arch: process.arch },
        session.repository.hasGit,
        session.policyFiles.policy,
        context.projects,
    );
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
            check.check.replaces === undefined || check.skip !== undefined || !isActive(check)
                ? []
                : [[check.check.replaces, check.check.name]],
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
    const entries = entriesFor(context.session, context.scope).filter(
        ({ check }) => selectionStatus(context.session.policyFiles.policy, context.scope, check)?.cause !== 'level',
    );
    for (const entry of entries) {
        if (!isWanted(entry.check, context.options)) continue;
        const isRootCheck = entry.check.runs === 'once';
        if (isRootCheck && wholeSeen.has(entry.check.name)) continue;
        if (isRootCheck) wholeSeen.add(entry.check.name);
        planned.push(planOne(context, entry, isRootCheck));
    }
    return planned;
}

function planScopes(session: Session, options: PlanOptions): PlannedCheck[][] {
    const wholeSeen = new Set<string>();
    const platform = hostPlatform();
    const narrow = narrowSet(options);
    const needsDependencies = session.scopes.some((scope) =>
        entriesFor(session, scope).some(
            ({ check }) => isWanted(check, options) && check.when?.dependencies !== undefined,
        ),
    );
    const projects = needsDependencies ? readPackageManifests(session.root, session.repository.files) : [];
    return session.scopes.map((scope) => {
        const context: PlanInputs = {
            session,
            scope,
            options,
            platform,
            narrow,
            children: childScopes(session, scope),
            projects,
        };
        return planScope(context, wholeSeen);
    });
}

/**
 * Whether a planned check has source input, a deleted trigger, or a commit message to inspect.
 * @param check the planned check
 * @returns whether the check has something to run over
 */
export function isActive(check: PlannedCheck): boolean {
    return (
        check.files.length > 0 ||
        check.triggerPaths.length > 0 ||
        check.check.stage === 'message' ||
        (HISTORY_CHECKS.has(check.check.name) && (check.commits?.length ?? 0) > 0)
    );
}

/**
 * Checks enabled by persistent policy, before evaluating executable tool configurations.
 * @param session the open session
 * @param includeUnsupported whether to include requirements for other platforms
 * @returns every check the policy turns on, in each scope it applies to
 */
export function configuredChecks(session: Session, includeUnsupported = false): PlannedCheck[] {
    return planScopes(session, { stage: 'any', skips: [], includeUnsupported })
        .flatMap((planned) => skipReplacedChecks(planned))
        .filter((check) => isActive(check) && check.skip === undefined);
}

/**
 * Source owners of a planned check, separate from inputs supplied to project-wide analysis.
 * @param session the open session
 * @param check the planned check
 * @returns the files the check's owners select
 */
export function ownedInputs(session: Session, check: PlannedCheck): TrackedFile[] {
    const owners = check.check.files ?? check.manifest?.files;
    const children = check.check.runs === 'scope' ? childScopes(session, check.scope) : [];
    const files = check.files.filter((file) => isOutsideChildren(file.path, children));
    return owners === undefined ? [] : ownedBy(owners, check.scope.selected, files, check.scope.scope.path);
}

/**
 * Plans every check for the run.
 * @param session the session
 * @param options stage, paths, only, skips, and the staged or ref-relative file sets
 * @returns the planned checks in scope order
 */
export function planRun(session: Session, options: PlanOptions): PlannedCheck[] {
    const checks = planScopes(session, options).flatMap((planned) => skipReplacedChecks(planned));
    if (options.historyComplete === false) {
        const historyChecks = checks.filter(
            (check) => check.skip === undefined && HISTORY_CHECKS.has(check.check.name),
        );
        if (historyChecks.length > 0)
            throw new GspotError('selection', [
                `Pushed history is incomplete for ${historyChecks.map((check) => check.check.name).join(', ')}. Run git fetch --unshallow and retry.`,
            ]);
    }
    return checks;
}
