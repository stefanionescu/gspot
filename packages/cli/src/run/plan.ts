import { SelectionError } from '#cli/configurations/select.ts';
import { checkVerifiedSecrets } from '#cli/checks/secrets/verified.ts';
import { checkSecretHistory } from '#cli/checks/secrets/history.ts';
import { checkCommitMessages } from '#cli/checks/commits/messages.ts';
import { prettierInputs } from '#cli/run/prettier-inputs.ts';
import { checkState, waitingSetting } from '#cli/policy/check-state.ts';
import { toolPin } from '#cli/tools/tool-probe.ts';
import { resolveEngine, runEngineCheck } from '#cli/run/engines.ts';
import { checkTypescript } from '#cli/checks/typescript/tsc.ts';
import { runToolCheck } from '#cli/run/tool-runner.ts';
import { configurationName } from '#cli/run/scope-paths.ts';
// The check graph for a run: stage, scope, file sets, requirements, skips.
import type { RepositoryCheck } from '#cli/types/policy.ts';
import type { TrackedFile } from '#cli/types/repository.ts';
import type { CheckSpec, Manifest, Stage, ToolPin } from '#cli/types/configurations.ts';
import { claimedByClaims, isInScope, pathMatcher } from '#cli/configurations/claims.ts';

import type {
    CheckRunner,
    PlanEntry,
    PlanContext,
    PlanOptions,
    PlannedCheck,
    ScopeSelection,
    Session,
    StageFilter,
} from '#cli/types/execution.ts';

const PLATFORM_NAMES: Record<string, string> = { darwin: 'macos', linux: 'linux', win32: 'windows' };

const HISTORY_ANALYSES = new Set(['commit-messages', 'gitleaks-history', 'verified-secrets']);

function isStageWanted(filter: StageFilter, stage: Stage): boolean {
    if (filter === 'all') return stage === 'commit' || stage === 'push';
    return filter === stage;
}

function childScopes(session: Session, scope: ScopeSelection): string[] {
    const own = scope.scope.path;
    return session.scopes
        .map((entry) => entry.scope.path)
        .filter((path) => path !== '' && path !== own && (own === '' || path.startsWith(`${own}/`)));
}

function isOutsideChildren(file: TrackedFile, children: string[]): boolean {
    return children.every((child) => file.path !== child && !file.path.startsWith(`${child}/`));
}

function toolFor(spec: CheckSpec, manifest: Manifest | undefined, session: Session): ToolPin | undefined {
    const name = spec.tool ?? spec.command?.[0];
    if (name === undefined) return undefined;
    const own = manifest?.tools.find((tool) => tool.name === name);
    if (own) return own;
    return toolPin(session.manifests.values(), name);
}

/** Normalize a repository command into the check definition used by planning and explanations. */
export function repositoryCheckSpec(entry: RepositoryCheck): CheckSpec {
    const { paths, ...definition } = entry;
    return {
        ...definition,
        level: 'recommended',
        runs: 'per-file-list',
        coverage: [],
        summary: entry.summary ?? `Runs the repository's own check ${entry.name}.`,
        why: 'The repository declared this command in gspot.toml as part of its gate.',
        help: entry.help ?? 'Read the command output; the repository owns this check.',
        claims: {
            extensions: [],
            filenames: [],
            tags: [],
            paths,
            from_languages: false,
            natures: ['source', 'generated'],
        },
    };
}

// A policy check that reads a scoped configuration must run against that scope's file partition.
function isRepositoryPolicy(manifest: Manifest, spec: CheckSpec): boolean {
    if (manifest.configuration.kind !== 'policy' || manifest.claims.from_languages || spec.runs === 'per-scope') return false;
    const command = [...(spec.command ?? []), ...Object.values(spec.env ?? {})];
    return !manifest.configs.some(
        (config) =>
            config.per_scope &&
            !config.fragment &&
            command.some((part) => part.includes(`{config:${configurationName(config.target)}}`)),
    );
}

function manifestEntries(manifest: Manifest, seenRepoChecks: Set<string>): PlanEntry[] {
    const fresh = manifest.checks.filter(
        (spec) => !isRepositoryPolicy(manifest, spec) || !seenRepoChecks.has(spec.name),
    );
    for (const spec of fresh) if (isRepositoryPolicy(manifest, spec)) seenRepoChecks.add(spec.name);
    return fresh.map((spec) => ({ spec, manifest }));
}

function entriesFor(session: Session, scope: ScopeSelection, seenRepoChecks: Set<string>): PlanEntry[] {
    const isRoot = scope.scope.path === '';
    const entries = scope.selected.flatMap((manifest) =>
        manifestEntries(manifest, seenRepoChecks).filter(
            (entry) => isRoot || !isRepositoryPolicy(manifest, entry.spec),
        ),
    );
    if (isRoot)
        for (const selected of session.scopes)
            for (const manifest of selected.selected)
                for (const spec of manifest.checks)
                    if (
                        manifest.configuration.check_references?.includes(spec.name) &&
                        !entries.some((entry) => entry.spec.name === spec.name)
                    )
                        entries.push({ spec, manifest });
    const own = isRoot ? session.policyFiles.policy.checks.map((entry) => ({ spec: repositoryCheckSpec(entry) })) : [];
    return [...entries, ...own];
}

function isStageOk(spec: CheckSpec, options: PlanOptions): boolean {
    if (spec.stage === 'message') return options.stage === 'message';
    const isOnlyOverride = options.only !== undefined && options.stage === 'all';
    return isOnlyOverride || isStageWanted(options.stage, spec.stage);
}

function isWanted(spec: CheckSpec, options: PlanOptions): boolean {
    if (options.only !== undefined && !options.only.includes(spec.name)) return false;
    return isStageOk(spec, options);
}

function projectFiles(context: PlanContext, scopeForFiles: string): TrackedFile[] {
    const prefix = scopeForFiles === '' ? '' : `${scopeForFiles}/`;
    return context.session.repository.files.filter((file) => file.path.startsWith(prefix));
}

function claimedFor(context: PlanContext, entry: PlanEntry, scopeForFiles: string): TrackedFile[] {
    const { session, scope } = context;
    const { spec, manifest } = entry;
    if (spec.runs !== 'per-file-list') {
        const claims = spec.claims;
        const claimed =
            claims === undefined
                ? undefined
                : claimedByClaims(claims, scope.selected, session.repository.files, scopeForFiles);
        const owned =
            spec.runs === 'per-scope' ? claimed?.filter((file) => isOutsideChildren(file, context.children)) : claimed;
        const hasNothingClaimed = owned?.length === 0;
        if (hasNothingClaimed) return [];
        const files = projectFiles(context, scopeForFiles);
        return spec.runs === 'per-scope'
            ? files.filter((file) => isOutsideChildren(file, context.children))
            : files.filter((file) => file.nature !== 'binary');
    }
    if (!manifest) return session.repository.files.filter((file) => pathMatcher(spec.claims?.paths ?? [])(file.path));
    if (spec.claims) return claimedByClaims(spec.claims, scope.selected, session.repository.files, scopeForFiles);
    return claimedByClaims(manifest.claims, scope.selected, session.repository.files, scopeForFiles);
}

function withoutExcluded(files: TrackedFile[], spec: CheckSpec, scope: ScopeSelection): TrackedFile[] {
    if (spec.exclude_setting === undefined) return files;
    const excluded = (scope.view.settings[spec.exclude_setting] as { paths: string[] }[] | undefined) ?? [];
    const patterns = excluded.flatMap((entry) => entry.paths);
    if (patterns.length === 0) return files;
    const isExcluded = pathMatcher(patterns);
    return files.filter((file) => !isExcluded(file.path));
}

function isPolicyTouched(narrow: Set<string>): boolean {
    return narrow.has('gspot.toml') || narrow.values().some((path) => path.startsWith('.gspot/'));
}

// The policy changed, so the check runs over everything it claims, with the check's own claims kept.
function reclaimed(context: PlanContext, entry: PlanEntry): TrackedFile[] {
    const { scope, children } = context;
    const files = claimedFor(context, entry, scope.scope.path);
    return entry.manifest === undefined ? files : files.filter((file) => isOutsideChildren(file, children));
}

function narrowed(context: PlanContext, entry: PlanEntry, files: TrackedFile[]): TrackedFile[] {
    const { narrow } = context;
    if (!narrow) return files;
    const inNarrowed = files.filter((file) => narrow.has(file.path));
    const isTouched = isPolicyTouched(narrow);
    if (entry.spec.runs !== 'per-file-list') return !isTouched && inNarrowed.length === 0 ? [] : files;
    if (!isTouched || !entry.manifest || inNarrowed.length > 0) return inNarrowed;
    return reclaimed(context, entry);
}

function filesFor(
    context: PlanContext,
    entry: PlanEntry,
    isWholeCheck: boolean,
): Pick<PlannedCheck, 'files' | 'triggerPaths'> {
    const { scope, children } = context;
    const { spec, manifest } = entry;
    const scopePath = isWholeCheck ? '' : scope.scope.path;
    const triggerPaths = missingTriggers(context, spec, scopePath);
    const isWhole = spec.runs !== 'per-file-list' || (manifest !== undefined && isRepositoryPolicy(manifest, spec));
    let files = triggerPaths.length === 0 ? claimedFor(context, entry, scopePath) : projectFiles(context, scopePath);
    if (!isWhole && manifest !== undefined) files = files.filter((file) => isOutsideChildren(file, children));
    const selected = withoutExcluded(files, spec, scope);
    return { files: triggerPaths.length === 0 ? narrowed(context, entry, selected) : selected, triggerPaths };
}

function platformSkipFor(spec: CheckSpec, tool: ToolPin | undefined, platform: string): PlannedCheck['skip'] {
    if (spec.platform && !spec.platform.some((candidate) => candidate === platform))
        return { source: 'platform', note: `runs on ${spec.platform.join(', ')} only; this is ${platform}` };
    if (platform === 'windows' && tool && !tool.windows)
        return { source: 'platform', note: `${tool.name} has no Windows build` };
    return undefined;
}

function skipFor(check: PlannedCheck, options: PlanOptions, platform: string): PlannedCheck['skip'] {
    const { spec, tool } = check;
    const ignored = check.scope.view
        .ignoresFor(spec.name)
        .find((entry) => entry.rule === undefined && (entry.paths === undefined || entry.paths.length === 0));
    if (ignored !== undefined)
        return {
            source: 'ignore',
            note: `disabled by gspot.toml${ignored.reason === undefined ? '' : `: ${ignored.reason}`}`,
        };
    const waiting = waitingFor(check);
    if (waiting) return waiting;
    if (spec.reported_by !== undefined) return { source: 'rules', note: `its findings come from ${spec.reported_by}` };
    const platformSkip = platformSkipFor(spec, tool, platform);
    if (platformSkip !== undefined) return platformSkip;
    if (options.skips.includes(spec.name)) return { source: 'flag', note: 'skipped by --skip' };
    return undefined;
}

function waitingFor(check: PlannedCheck): PlannedCheck['skip'] {
    const setting = waitingSetting(check.scope, check.spec);
    return setting === undefined ? undefined : { source: 'rules', note: `set ${setting} to turn this on` };
}

function missingTriggers(context: PlanContext, spec: CheckSpec, scopePath: string): string[] {
    if (spec.runs === 'per-file-list' || context.narrow === undefined) return [];
    const readable = new Set(context.session.repository.files.map((file) => file.path));
    return [...context.narrow].filter((path) => !readable.has(path) && isInScope(path, scopePath));
}

function runnerFor(spec: CheckSpec): CheckRunner {
    if (spec.engine !== undefined) {
        const engine = resolveEngine(spec);
        return (session, planned, staged) => runEngineCheck(session, engine, planned, staged);
    }
    if (spec.analysis === 'verified-secrets') return checkVerifiedSecrets;
    if (spec.analysis === 'gitleaks-history') return checkSecretHistory;
    if (spec.analysis === 'commit-messages') return checkCommitMessages;
    if (spec.analysis === 'typescript') return checkTypescript;
    if (spec.reported_by !== undefined)
        return async (_session, planned) => ({
            check: spec.name,
            scope: planned.scope.scope.path,
            status: 'skipped',
            note: `its findings come from ${spec.reported_by}`,
            files: 0,
            duration: 0,
            findings: [],
        });
    return (session, planned) => runToolCheck(session, planned);
}

function restrictIgnoredPaths(check: PlannedCheck): PlannedCheck {
    if (check.skip !== undefined || check.spec.runs !== 'per-file-list' || check.files.length === 0) return check;
    const ignored = check.scope.view
        .ignoresFor(check.check)
        .filter((entry) => entry.rule === undefined && entry.paths !== undefined && entry.paths.length > 0)
        .map((entry) => pathMatcher(entry.paths!));
    if (ignored.length === 0) return check;
    const files = check.files.filter((file) => !ignored.some((matches) => matches(file.path)));
    return files.length === 0
        ? { ...check, skip: { source: 'ignore', note: 'all selected paths are disabled by gspot.toml' } }
        : { ...check, files };
}

function planOne(context: PlanContext, entry: PlanEntry, isWholeCheck: boolean): PlannedCheck {
    const { session, scope, options, platform } = context;
    const { spec, manifest } = entry;
    const rootScope = session.scopes[0] ?? scope;
    const check: PlannedCheck = {
        run: runnerFor(spec),
        check: spec.name,
        scope: isWholeCheck ? rootScope : scope,
        spec,
        ...filesFor(context, entry, isWholeCheck),
        projectWide: spec.runs !== 'per-file-list',
    };
    if (manifest) check.manifest = manifest;
    const tool = spec.engine === undefined ? toolFor(spec, manifest, session) : undefined;
    if (tool) check.tool = tool;
    if (options.commits !== undefined) check.commits = options.commits;
    if (options.messageFile !== undefined) check.messageFile = options.messageFile;
    const skip = skipFor(check, options, platform);
    if (skip) check.skip = skip;
    return restrictIgnoredPaths(check);
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

/** Whether a planned check has source input, a deleted trigger, or a commit message to inspect. */
export function isActive(check: PlannedCheck): boolean {
    return (
        check.files.length > 0 ||
        check.triggerPaths.length > 0 ||
        check.spec.stage === 'message' ||
        (HISTORY_ANALYSES.has(check.spec.analysis ?? '') && (check.commits?.length ?? 0) > 0)
    );
}

/** Checks enabled by persistent policy, before evaluating executable tool configurations. */
export function configuredChecks(session: Session): PlannedCheck[] {
    const only = [
        ...session.scopes.flatMap((scope) =>
            scope.selected.flatMap((manifest) => manifest.checks.map((check) => check.name)),
        ),
        ...session.policyFiles.policy.checks.map((check) => check.name),
    ];
    return planScopes(session, { stage: 'all', only, skips: [] })
        .flatMap(yielded)
        .filter((check) => isActive(check) && check.skip === undefined);
}

/** Source claims of a planned check, separate from inputs supplied to project-wide analysis. */
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
