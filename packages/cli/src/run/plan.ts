// The check graph for a run: stage, scope, file sets, requirements, skips.
import { hasEngine } from '#cli/run/engines.ts';
import type { RepositoryCheck } from '#types/config.ts';
import type { TrackedFile } from '#types/repository.ts';
import type { CheckSpec, Manifest, Stage, ToolPin } from '#types/manifest.ts';
import { claimedByClaims, claimedFiles, pathMatcher } from '#cli/presets/claims.ts';

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
    const spec: CheckSpec = {
        id: entry.id,
        stage: entry.stage,
        runs: 'per-file-list',
        command: entry.command,
        inspection: [],
        summary: entry.summary ?? `Runs the repository's own check ${entry.id}.`,
        why: 'The repository declared this command in gspot.toml as part of its gate.',
        fix: 'Read the command output; the repository owns this check.',
        claims: {
            extensions: [],
            filenames: [],
            tags: [],
            paths: entry.paths,
            from_languages: false,
            natures: ['source', 'generated'],
        },
    };
    if (entry.fix) {
        spec.fix_command = entry.fix;
        spec.fix_order = 'codemod';
    }
    if (entry.count_regex !== undefined) spec.count_regex = entry.count_regex;
    if (entry.requires !== undefined) spec.requires = entry.requires;
    if (entry.platform !== undefined) spec.platform = entry.platform;
    return spec;
}

function isRepositoryWide(manifest: Manifest): boolean {
    return manifest.preset.kind === 'concern' && !manifest.claims.from_languages;
}

function manifestEntries(manifest: Manifest, seenRepoChecks: Set<string>): PlanEntry[] {
    if (!isRepositoryWide(manifest)) return manifest.checks.map((spec) => ({ spec, manifest }));
    const fresh = manifest.checks.filter((spec) => !seenRepoChecks.has(spec.id));
    for (const spec of fresh) seenRepoChecks.add(spec.id);
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
    if (options.only !== undefined && spec.id !== options.only) return false;
    if (!isStageOk(spec, options)) return false;
    return spec.engine === undefined || hasEngine(spec.engine);
}

function projectFiles(context: PlanContext, scopeForFiles: string): TrackedFile[] {
    const prefix = scopeForFiles === '' ? '' : `${scopeForFiles}/`;
    return context.session.repository.files.filter((file) => file.path.startsWith(prefix) && file.nature !== 'binary');
}

function claimedFor(context: PlanContext, entry: PlanEntry, scopeForFiles: string): TrackedFile[] {
    const { session, scope } = context;
    const { spec, manifest } = entry;
    if (spec.runs !== 'per-file-list') return projectFiles(context, scopeForFiles);
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

function filesFor(context: PlanContext, entry: PlanEntry, isWholeCheck: boolean): TrackedFile[] {
    const { scope, children } = context;
    const { spec, manifest } = entry;
    const isWhole =
        isWholeCheck || spec.runs !== 'per-file-list' || (manifest !== undefined && isRepositoryWide(manifest));
    let files = claimedFor(context, entry, isWholeCheck ? '' : scope.scope.path);
    if (!isWhole) files = files.filter((file) => isOutsideChildren(file, children));
    return narrowed(context, entry, withoutExcluded(files, spec, scope));
}

function platformSkipFor(spec: CheckSpec, tool: ToolPin | undefined, platform: string): PlannedCheck['skip'] {
    if (spec.platform && !spec.platform.includes(platform))
        return { source: 'platform', note: `runs on ${spec.platform.join(', ')} only; this is ${platform}` };
    if (platform === 'windows' && tool && !tool.windows)
        return { source: 'platform', note: `${tool.name} has no Windows build` };
    return undefined;
}

function skipFor(
    spec: CheckSpec,
    tool: ToolPin | undefined,
    options: PlanOptions,
    platform: string,
): PlannedCheck['skip'] {
    if (spec.reported_by !== undefined) return { source: 'rules', note: `its findings come from ${spec.reported_by}` };
    const platformSkip = platformSkipFor(spec, tool, platform);
    if (platformSkip !== undefined) return platformSkip;
    if (options.localSkips.includes(spec.id)) return { source: 'local', note: 'skipped by gspot.local.toml' };
    if (options.skips.includes(spec.id)) return { source: 'flag', note: 'skipped by --skip' };
    return undefined;
}

function planOne(context: PlanContext, entry: PlanEntry, isWholeCheck: boolean): PlannedCheck {
    const { session, scope, options, platform } = context;
    const { spec, manifest } = entry;
    const rootScope = session.scopes[0] ?? scope;
    const check: PlannedCheck = {
        id: spec.id,
        scope: isWholeCheck ? rootScope : scope,
        spec,
        files: filesFor(context, entry, isWholeCheck),
        projectWide: spec.runs !== 'per-file-list',
    };
    if (manifest) check.manifest = manifest;
    const tool = spec.engine === undefined ? toolFor(spec, manifest, session) : undefined;
    if (tool) check.tool = tool;
    if (options.messageFile !== undefined) check.messageFile = options.messageFile;
    const skip = skipFor(spec, tool, options, platform);
    if (skip) check.skip = skip;
    return check;
}

function narrowSet(options: PlanOptions): Set<string> | undefined {
    if (options.staged) return new Set(options.staged);
    return options.since ? new Set(options.since) : undefined;
}

function planScope(context: PlanContext, seenRepoChecks: Set<string>, wholeSeen: Set<string>): PlannedCheck[] {
    const planned: PlannedCheck[] = [];
    for (const entry of entriesFor(context.session, context.scope, seenRepoChecks)) {
        if (!isWanted(entry.spec, context.options)) continue;
        const isWholeCheck = entry.spec.runs === 'once';
        if (isWholeCheck && wholeSeen.has(entry.spec.id)) continue;
        if (isWholeCheck) wholeSeen.add(entry.spec.id);
        planned.push(planOne(context, entry, isWholeCheck));
    }
    return planned;
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
