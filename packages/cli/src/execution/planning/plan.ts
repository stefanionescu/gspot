// The check graph for a run: stage, scope, file sets, requirements, skips.
import { GspotError } from '#cli/platform/errors.ts';
import { toolPin, toolName } from '#cli/tools/pins.ts';
import { ownedBy } from '#cli/configurations/owners.ts';
import { hostPlatform } from '#cli/platform/environment.ts';
import type { CheckSpec } from '#cli/types/configurations.ts';
import type { Session } from '#cli/types/execution/session.ts';
import { isOutsideChildren } from '#cli/repository/selectors.ts';
import { HISTORY_CHECKS } from '#cli/config/execution/runtime.ts';
import type { PlannedCheck } from '#cli/types/execution/runtime.ts';
import type { ScopeSelection } from '#cli/types/policy/settings.ts';
import type { TrackedFile } from '#cli/types/repository/inventory.ts';
import { filesFor, runsAtRoot, childScopes } from '#cli/execution/planning/files.ts';
import type { Stage, PlanEntry, PlanInputs, PlanOptions } from '#cli/types/execution/planning.ts';
import { skipFor, selectionStatus, restrictIgnoredPaths } from '#cli/execution/planning/skips.ts';

function isStageWanted(filter: PlanOptions['stage'], stage: Stage): boolean {
    if (filter === 'any') return true;
    if (filter === 'all') return stage === 'commit' || stage === 'push';
    return filter === stage;
}

// The checks any scope references from another configuration, once each, unless the root already plans them.
function referencedEntries(session: Session, planned: PlanEntry[]): PlanEntry[] {
    const seen = new Set(planned.map((entry) => entry.spec.name));
    const referenced: PlanEntry[] = [];
    const candidates = session.scopes.flatMap((scope) =>
        scope.selected.flatMap((manifest) => {
            const references = manifest.configuration.borrowed_checks;
            return manifest.checks.filter((spec) => references.includes(spec.name)).map((spec) => ({ spec, manifest }));
        }),
    );
    for (const entry of candidates) {
        if (seen.has(entry.spec.name)) continue;
        seen.add(entry.spec.name);
        referenced.push(entry);
    }
    return referenced;
}

function entriesFor(session: Session, scope: ScopeSelection): PlanEntry[] {
    const isRoot = scope.scope.path === '';
    const entries = scope.selected.flatMap((manifest) =>
        manifest.checks
            .map((spec) => ({ spec, manifest }))
            .filter((entry) => isRoot || !runsAtRoot(manifest, entry.spec)),
    );
    if (!isRoot) return entries;
    const referenced = referencedEntries(session, entries);
    const own = session.policyFiles.policy.checks.map((entry) => ({ spec: entry }));
    return [...entries, ...referenced, ...own];
}

function isWanted(spec: CheckSpec, options: PlanOptions): boolean {
    if (options.only !== undefined && !options.only.includes(spec.name)) return false;
    if (options.stage === 'any') return true;
    if (spec.stage === 'message') return options.stage === 'message';
    return (options.only !== undefined && options.stage === 'all') || isStageWanted(options.stage, spec.stage);
}

function planOne(context: PlanInputs, entry: PlanEntry, isRootCheck: boolean): PlannedCheck {
    const { session, scope, options, platform } = context;
    const { spec, manifest } = entry;
    // Repository inventory always places the root scope first.
    const rootScope = session.scopes[0] as ScopeSelection;
    const name = toolName(spec);
    const tool = name === undefined ? undefined : toolPin(session.manifests.values(), name, manifest);
    const check: PlannedCheck = {
        scope: isRootCheck ? rootScope : scope,
        spec,
        ...filesFor(context, entry, isRootCheck),
        ...(manifest === undefined ? {} : { manifest }),
        ...(tool === undefined ? {} : { tool }),
        ...(options.commits === undefined ? {} : { commits: options.commits }),
        ...(options.messageFile === undefined ? {} : { messageFile: options.messageFile }),
    };
    const skip = skipFor(
        check,
        options,
        { platform, arch: process.arch },
        session.repository.hasGit,
        session.policyFiles.policy,
    );
    return restrictIgnoredPaths(session, skip === undefined ? check : { ...check, skip });
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
            check.spec.replaces === undefined || check.skip !== undefined || !isActive(check)
                ? []
                : [[check.spec.replaces, check.spec.name]],
        ),
    );
    return planned.map((check) => {
        const replacer = replacers.get(check.spec.name);
        if (replacer === undefined || check.skip) return check;
        return { ...check, skip: { cause: 'replaced', note: `${replacer} runs it here` } };
    });
}

function planScope(context: PlanInputs, wholeSeen: Set<string>): PlannedCheck[] {
    const planned: PlannedCheck[] = [];
    const entries = entriesFor(context.session, context.scope).filter(
        ({ spec }) => selectionStatus(context.session.policyFiles.policy, context.scope, spec)?.cause !== 'level',
    );
    for (const entry of entries) {
        if (!isWanted(entry.spec, context.options)) continue;
        const isRootCheck = entry.spec.runs === 'once';
        if (isRootCheck && wholeSeen.has(entry.spec.name)) continue;
        if (isRootCheck) wholeSeen.add(entry.spec.name);
        planned.push(planOne(context, entry, isRootCheck));
    }
    return planned;
}

function planScopes(session: Session, options: PlanOptions): PlannedCheck[][] {
    const wholeSeen = new Set<string>();
    const platform = hostPlatform();
    const narrow = narrowSet(options);
    return session.scopes.map((scope) => {
        const context: PlanInputs = {
            session,
            scope,
            options,
            platform,
            narrow,
            children: childScopes(session, scope),
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
        check.spec.stage === 'message' ||
        (HISTORY_CHECKS.has(check.spec.name) && (check.commits?.length ?? 0) > 0)
    );
}

/**
 * Checks enabled by persistent policy, before evaluating executable tool configurations.
 * @param session the open session
 * @param includeUnsupported whether to include requirements for other platforms
 * @returns every check the policy turns on, in each scope it applies to
 */
export function configuredChecks(session: Session, includeUnsupported = false): PlannedCheck[] {
    return skipReplacedChecks(planScopes(session, { stage: 'any', skips: [], includeUnsupported }).flat()).filter(
        (check) => isActive(check) && check.skip === undefined,
    );
}

/**
 * Source owners of a planned check, separate from inputs supplied to project-wide analysis.
 * @param session the open session
 * @param check the planned check
 * @returns the files the check's owners select
 */
export function ownedInputs(session: Session, check: PlannedCheck): TrackedFile[] {
    const owners = check.spec.files ?? check.manifest?.files;
    const children = check.spec.runs === 'scope' ? childScopes(session, check.scope) : [];
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
        const historyChecks = checks.filter((check) => check.skip === undefined && HISTORY_CHECKS.has(check.spec.name));
        if (historyChecks.length > 0)
            throw new GspotError('selection', [
                `Pushed history is incomplete for ${historyChecks.map((check) => check.spec.name).join(', ')}. Run git fetch --unshallow and retry.`,
            ]);
    }
    return checks;
}
