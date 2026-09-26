// The check graph for a run: stage, scope, file sets, requirements, skips.
import { toolPin } from '#cli/tools/inspect.ts';
import { SelectionError } from '#cli/configurations/select.ts';
import { claimedByClaims } from '#cli/configurations/claims.ts';
import type { ScopeSelection } from '#cli/types/policy/policy.ts';
import { prettierInputs } from '#cli/execution/prettier-inputs.ts';
import type { TrackedFile } from '#cli/types/repository/repository.ts';
import { checkState, repositoryCheckSpec } from '#cli/policy/check-state.ts';
import { restrictIgnoredPaths, skipFor } from '#cli/execution/plan-skips.ts';
import type { CheckSpec, Manifest, Stage, ToolPin } from '#cli/types/configurations.ts';
import { HISTORY_ANALYSES, PLATFORM_NAMES } from '#cli/constants/execution/execution.ts';
import { childScopes, filesFor, isOutsideChildren, isRepositoryPolicy } from '#cli/execution/plan-files.ts';

import type {
    Session,
    PlanContext,
    PlanEntry,
    PlanOptions,
    PlannedCheck,
    StageFilter,
} from '#cli/types/execution/execution.ts';

function isStageWanted(filter: StageFilter, stage: Stage): boolean {
    if (filter === 'all') return stage === 'commit' || stage === 'push';
    return filter === stage;
}

function toolFor(spec: CheckSpec, manifest: Manifest | undefined, session: Session): ToolPin | undefined {
    const name = spec.tool ?? spec.command?.[0];
    if (name === undefined) return undefined;
    const own = manifest?.tools.find((tool) => tool.name === name);
    if (own) return own;
    return toolPin(session.manifests.values(), name);
}

function manifestEntries(manifest: Manifest, seenRepoChecks: Set<string>): PlanEntry[] {
    const fresh = manifest.checks.filter(
        (spec) => !isRepositoryPolicy(manifest, spec) || !seenRepoChecks.has(spec.name),
    );
    for (const spec of fresh) if (isRepositoryPolicy(manifest, spec)) seenRepoChecks.add(spec.name);
    return fresh.map((spec) => ({ spec, manifest }));
}

// The checks a manifest references from another configuration.
function referencedChecks(manifest: Manifest): PlanEntry[] {
    const references = manifest.configuration.check_references ?? [];
    return manifest.checks.filter((spec) => references.includes(spec.name)).map((spec) => ({ spec, manifest }));
}

// The checks any scope references from another configuration, once each, unless the root already plans them.
function referencedEntries(session: Session, planned: PlanEntry[]): PlanEntry[] {
    const seen = new Set(planned.map((entry) => entry.spec.name));
    const referenced: PlanEntry[] = [];
    const candidates = session.scopes.flatMap((selected) =>
        selected.selected.flatMap((manifest) => referencedChecks(manifest)),
    );
    for (const entry of candidates) {
        if (seen.has(entry.spec.name)) continue;
        seen.add(entry.spec.name);
        referenced.push(entry);
    }
    return referenced;
}

function entriesFor(session: Session, scope: ScopeSelection, seenRepoChecks: Set<string>): PlanEntry[] {
    const isRoot = scope.scope.path === '';
    const entries = scope.selected.flatMap((manifest) =>
        manifestEntries(manifest, seenRepoChecks).filter(
            (entry) => isRoot || !isRepositoryPolicy(manifest, entry.spec),
        ),
    );
    if (!isRoot) return entries;
    const referenced = referencedEntries(session, entries);
    const own = session.policyFiles.policy.checks.map((entry) => ({ spec: repositoryCheckSpec(entry) }));
    return [...entries, ...referenced, ...own];
}

function isWanted(spec: CheckSpec, options: PlanOptions): boolean {
    if (options.only !== undefined && !options.only.includes(spec.name)) return false;
    if (spec.stage === 'message') return options.stage === 'message';
    return (options.only !== undefined && options.stage === 'all') || isStageWanted(options.stage, spec.stage);
}

// The commit range and message file the run supplies, when it has them.
function runInputs(options: PlanOptions): Pick<PlannedCheck, 'commits' | 'messageFile'> {
    return {
        ...(options.commits === undefined ? {} : { commits: options.commits }),
        ...(options.messageFile === undefined ? {} : { messageFile: options.messageFile }),
    };
}

function planOne(context: PlanContext, entry: PlanEntry, isWholeCheck: boolean): PlannedCheck {
    const { session, scope, options, platform } = context;
    const { spec, manifest } = entry;
    const rootScope = session.scopes[0] ?? scope;
    const tool = spec.engine === undefined ? toolFor(spec, manifest, session) : undefined;
    const check: PlannedCheck = {
        check: spec.name,
        scope: isWholeCheck ? rootScope : scope,
        spec,
        ...filesFor(context, entry, isWholeCheck),
        projectWide: spec.runs !== 'per-file-list',
        ...(manifest === undefined ? {} : { manifest }),
        ...(tool === undefined ? {} : { tool }),
        ...runInputs(options),
    };
    const skip = skipFor(check, options, platform, session.repository.hasGit);
    return restrictIgnoredPaths(skip === undefined ? check : { ...check, skip });
}

function narrowSet(options: PlanOptions): Set<string> | undefined {
    const changed = options.staged ?? options.changed;
    if (options.paths === undefined) return changed === undefined ? undefined : new Set(changed);
    return new Set(options.paths.filter((path) => changed === undefined || changed.includes(path)));
}

// Only an active replacement in this execution plan can own another check's work.
function yielded(planned: PlannedCheck[]): PlannedCheck[] {
    const takers = new Map(
        planned.flatMap((check): [string, string][] =>
            check.spec.takes_over === undefined || check.skip !== undefined || !isActive(check)
                ? []
                : [[check.spec.takes_over, check.check]],
        ),
    );
    return planned.map((check) => {
        const taker = takers.get(check.check);
        if (taker === undefined || check.skip) return check;
        return { ...check, skip: { source: 'rules', note: `${taker} runs it here` } };
    });
}

function planScope(context: PlanContext, seenRepoChecks: Set<string>, wholeSeen: Set<string>): PlannedCheck[] {
    const planned: PlannedCheck[] = [];
    const entries = entriesFor(context.session, context.scope, seenRepoChecks).filter(
        ({ spec }) => checkState(context.session.policyFiles.policy, context.scope, spec) !== 'off (level)',
    );
    for (const entry of entries) {
        if (!isWanted(entry.spec, context.options)) continue;
        const isWholeCheck = entry.spec.runs === 'once';
        if (isWholeCheck && wholeSeen.has(entry.spec.name)) continue;
        if (isWholeCheck) wholeSeen.add(entry.spec.name);
        planned.push(planOne(context, entry, isWholeCheck));
    }
    return planned;
}

function planScopes(session: Session, options: PlanOptions): PlannedCheck[][] {
    const seenRepoChecks = new Set<string>();
    const wholeSeen = new Set<string>();
    const platform = PLATFORM_NAMES[process.platform] ?? process.platform;
    const narrow = narrowSet(options);
    return session.scopes.map((scope) => {
        const context: PlanContext = {
            session,
            scope,
            options,
            platform,
            narrow,
            children: childScopes(session, scope),
        };
        return planScope(context, seenRepoChecks, wholeSeen);
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
        (HISTORY_ANALYSES.has(check.spec.analysis ?? '') && (check.commits?.length ?? 0) > 0)
    );
}

/**
 * Checks enabled by persistent policy, before evaluating executable tool configurations.
 * @param session the open session
 * @returns every check the policy turns on, in each scope it applies to
 */
export function configuredChecks(session: Session): PlannedCheck[] {
    const only = [
        ...session.scopes.flatMap((scope) =>
            scope.selected.flatMap((manifest) => manifest.checks.map((check) => check.name)),
        ),
        ...session.policyFiles.policy.checks.map((check) => check.name),
    ];
    return planScopes(session, { stage: 'all', only, skips: [] })
        .flatMap((planned) => yielded(planned))
        .filter((check) => isActive(check) && check.skip === undefined);
}

/**
 * Source claims of a planned check, separate from inputs supplied to project-wide analysis.
 * @param session the open session
 * @param check the planned check
 * @returns the files the check's claims select
 */
export function claimedInputs(session: Session, check: PlannedCheck): TrackedFile[] {
    const claims = check.spec.claims ?? check.manifest?.claims;
    const children = check.spec.runs === 'per-scope' ? childScopes(session, check.scope) : [];
    const files = check.files.filter((file) => isOutsideChildren(file, children));
    return claims === undefined ? [] : claimedByClaims(claims, check.scope.selected, files, check.scope.scope.path);
}

/**
 * Plans every check for the run.
 * @param session the session
 * @param options stage, paths, only, skips, and the staged or ref-relative file sets
 * @returns the planned checks in scope order
 */
export async function planRun(session: Session, options: PlanOptions): Promise<PlannedCheck[]> {
    const planned = planScopes(session, options);
    const resolved = await Promise.all(
        planned.map(async (checks) =>
            yielded(await Promise.all(checks.map((check) => prettierInputs(session, check)))),
        ),
    );
    const checks = resolved.flat();
    if (options.historyComplete === false) {
        const historyChecks = checks.filter(
            (check) => check.skip === undefined && HISTORY_ANALYSES.has(check.spec.analysis ?? ''),
        );
        if (historyChecks.length > 0)
            throw new SelectionError([
                `Pushed history is incomplete for ${historyChecks.map((check) => check.check).join(', ')}. Run git fetch --unshallow and retry.`,
            ]);
    }
    return checks;
}
