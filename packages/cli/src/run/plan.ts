// The check graph for a run: stage, scope, file sets, requirements, skips.
import type { RepositoryCheck } from '#types/config.ts';
import type { TrackedFile } from '#types/repository.ts';
import type { CheckSpec, Manifest, Stage, ToolPin } from '#types/manifest.ts';
import { claimedByClaims, claimedFiles, isInScope, pathMatcher } from '#cli/presets/claims.ts';

import type {
    PlanEntry,
    PlanContext,
    PlanOptions,
    PlannedCheck,
    ScopeSelection,
    Session,
    StageFilter,
} from '#types/run.ts';

const PLATFORM_NAMES: Record<string, string> = { darwin: 'macos', linux: 'linux', win32: 'windows' };

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
    for (const other of session.manifests.values()) {
        const found = other.tools.find((tool) => tool.name === name);
        if (found) return found;
    }
    return { name, windows: true, installers: {} };
}

function fromRepoCheck(entry: RepositoryCheck): CheckSpec {
    const { paths, ...definition } = entry;
    return {
        ...definition,
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

function isRepositoryWide(manifest: Manifest): boolean {
    return manifest.preset.kind === 'concern' && !manifest.claims.from_languages;
}

function manifestEntries(manifest: Manifest, seenRepoChecks: Set<string>): PlanEntry[] {
    if (!isRepositoryWide(manifest)) return manifest.checks.map((spec) => ({ spec, manifest }));
    const fresh = manifest.checks.filter((spec) => !seenRepoChecks.has(spec.name));
    for (const spec of fresh) seenRepoChecks.add(spec.name);
    return fresh.map((spec) => ({ spec, manifest }));
}

function entriesFor(session: Session, scope: ScopeSelection, seenRepoChecks: Set<string>): PlanEntry[] {
    const isRoot = scope.scope.path === '';
    const entries = scope.selected
        .filter((manifest) => isRoot || !isRepositoryWide(manifest))
        .flatMap((manifest) => manifestEntries(manifest, seenRepoChecks));
    const own = isRoot ? session.policyFiles.policy.checks.map((entry) => ({ spec: fromRepoCheck(entry) })) : [];
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
    return context.session.repository.files.filter((file) => file.path.startsWith(prefix) && file.nature !== 'binary');
}

function claimedFor(context: PlanContext, entry: PlanEntry, scopeForFiles: string): TrackedFile[] {
    const { session, scope } = context;
    const { spec, manifest } = entry;
    if (spec.runs !== 'per-file-list') {
        // A check that walks the scope still needs a reason to run: with claims of its own, at least one file they name.
        const hasNothingClaimed =
            spec.claims !== undefined &&
            claimedByClaims(spec.claims, scope.selected, session.repository.files, scopeForFiles).length === 0;
        return hasNothingClaimed ? [] : projectFiles(context, scopeForFiles);
    }
    if (!manifest) return session.repository.files.filter((file) => pathMatcher(spec.claims?.paths ?? [])(file.path));
    if (spec.claims) return claimedByClaims(spec.claims, scope.selected, session.repository.files, scopeForFiles);
    return claimedFiles(manifest, scope.selected, session.repository.files, scopeForFiles);
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
    return claimedFor(context, entry, scope.scope.path).filter((file) => isOutsideChildren(file, children));
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
    const isWhole = spec.runs !== 'per-file-list' || (manifest !== undefined && isRepositoryWide(manifest));
    let files = triggerPaths.length === 0 ? claimedFor(context, entry, scopePath) : projectFiles(context, scopePath);
    if (!isWhole) files = files.filter((file) => isOutsideChildren(file, children));
    const selected = withoutExcluded(files, spec, scope);
    return { files: triggerPaths.length === 0 ? narrowed(context, entry, selected) : selected, triggerPaths };
}

function platformSkipFor(spec: CheckSpec, tool: ToolPin | undefined, platform: string): PlannedCheck['skip'] {
    if (spec.platform && !spec.platform.includes(platform))
        return { source: 'platform', note: `runs on ${spec.platform.join(', ')} only; this is ${platform}` };
    if (platform === 'windows' && tool && !tool.windows)
        return { source: 'platform', note: `${tool.name} has no Windows build` };
    return undefined;
}

function skipFor(check: PlannedCheck, options: PlanOptions, platform: string): PlannedCheck['skip'] {
    const { spec, tool } = check;
    const waiting = waitingFor(check);
    if (waiting) return waiting;
    if (spec.reported_by !== undefined) return { source: 'rules', note: `its findings come from ${spec.reported_by}` };
    const platformSkip = platformSkipFor(spec, tool, platform);
    if (platformSkip !== undefined) return platformSkip;
    if (options.localSkips.includes(spec.name)) return { source: 'local', note: 'skipped by gspot.local.toml' };
    if (options.skips.includes(spec.name)) return { source: 'flag', note: 'skipped by --skip' };
    return undefined;
}

function waitingFor(check: PlannedCheck): PlannedCheck['skip'] {
    const setting = check.spec.waits_for;
    if (setting === undefined) return undefined;
    const value = check.scope.view.settings[setting];
    const isEmpty =
        value === undefined || value === false || value === '' || (Array.isArray(value) && value.length === 0);
    return isEmpty ? { source: 'rules', note: `set ${setting} to turn this on` } : undefined;
}

function missingTriggers(context: PlanContext, spec: CheckSpec, scopePath: string): string[] {
    if (spec.runs === 'per-file-list' || context.narrow === undefined) return [];
    const readable = new Set(context.session.repository.files.map((file) => file.path));
    return [...context.narrow].filter((path) => !readable.has(path) && isInScope(path, scopePath));
}

function planOne(context: PlanContext, entry: PlanEntry, isWholeCheck: boolean): PlannedCheck {
    const { session, scope, options, platform } = context;
    const { spec, manifest } = entry;
    const rootScope = session.scopes[0] ?? scope;
    const check: PlannedCheck = {
        check: spec.name,
        scope: isWholeCheck ? rootScope : scope,
        spec,
        ...filesFor(context, entry, isWholeCheck),
        projectWide: spec.runs !== 'per-file-list',
    };
    if (manifest) check.manifest = manifest;
    const tool = spec.engine === undefined ? toolFor(spec, manifest, session) : undefined;
    if (tool) check.tool = tool;
    if (options.messageFile !== undefined) check.messageFile = options.messageFile;
    const skip = skipFor(check, options, platform);
    if (skip) check.skip = skip;
    return check;
}

function narrowSet(options: PlanOptions): Set<string> | undefined {
    const changed = options.staged ?? options.since;
    if (options.paths === undefined) return changed === undefined ? undefined : new Set(changed);
    return new Set(options.paths.filter((path) => changed === undefined || changed.includes(path)));
}

// A check that takes another over runs that work itself, so the other one yields in the same scope.
// Naming the other check on the command line changes nothing: the taker still owns the work here.
function yielded(planned: PlannedCheck[], entries: PlanEntry[], options: PlanOptions): PlannedCheck[] {
    const skipped = new Set([...options.skips, ...options.localSkips]);
    const takers = new Map(
        entries.flatMap(({ spec }): [string, string][] =>
            spec.takes_over === undefined || skipped.has(spec.name) ? [] : [[spec.takes_over, spec.name]],
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
    const entries = entriesFor(context.session, context.scope, seenRepoChecks);
    for (const entry of entries) {
        if (!isWanted(entry.spec, context.options)) continue;
        const isWholeCheck = entry.spec.runs === 'once';
        if (isWholeCheck && wholeSeen.has(entry.spec.name)) continue;
        if (isWholeCheck) wholeSeen.add(entry.spec.name);
        planned.push(planOne(context, entry, isWholeCheck));
    }
    return yielded(planned, entries, context.options);
}

/**
 * Plans every check for the run.
 * @param session the session
 * @param options stage, scope, only, skips, and the staged or ref-relative file sets
 * @returns the planned checks in scope order
 */
export function planRun(session: Session, options: PlanOptions): PlannedCheck[] {
    const seenRepoChecks = new Set<string>();
    const wholeSeen = new Set<string>();
    const platform = PLATFORM_NAMES[process.platform] ?? process.platform;
    const narrow = narrowSet(options);
    return session.scopes
        .filter((scope) => options.scope === undefined || scope.scope.path === options.scope)
        .flatMap((scope) => {
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
