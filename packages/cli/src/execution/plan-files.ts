// Which files a planned check runs over: what it claims, less excluded and child-scope paths, narrowed to a selection.
import type { Session } from '#cli/execution/session.ts';
import type { ScopeSelection } from '#cli/policy/resolve.ts';
import type { CheckSpec } from '#cli/configurations/schema.ts';
import { claimedByClaims } from '#cli/configurations/claims.ts';
import type { Manifest } from '#cli/configurations/manifests.ts';
import { isInScope, pathMatcher } from '#cli/repository/paths.ts';
import { configurationName } from '#cli/configurations/targets.ts';
import type { TrackedFile } from '#cli/repository/file-classification.ts';
import type { PlanContext, PlanEntry, PlannedCheck } from '#cli/execution/plan.ts';

// Every tracked file under the scope.
function projectFiles(context: PlanContext, scopeForFiles: string): TrackedFile[] {
    const prefix = scopeForFiles === '' ? '' : `${scopeForFiles}/`;
    return context.session.repository.files.filter((file) => file.path.startsWith(prefix));
}

// The files a project-wide check runs over: the scope's tree, when its claims select anything in it.
function projectClaimed(context: PlanContext, spec: CheckSpec, scopeForFiles: string): TrackedFile[] {
    const { session, scope, children } = context;
    const isPerScope = spec.runs === 'per-scope';
    const claimed =
        spec.claims === undefined
            ? undefined
            : claimedByClaims(spec.claims, scope.selected, session.repository.files, scopeForFiles);
    const owned = isPerScope ? claimed?.filter((file) => isOutsideChildren(file, children)) : claimed;
    if (owned?.length === 0) return [];
    const files = projectFiles(context, scopeForFiles);
    if (isPerScope) return files.filter((file) => isOutsideChildren(file, children));
    return files.filter((file) => file.nature !== 'binary');
}

// The files a per-file check runs over: its own claims, its manifest's, or the paths a policy check names.
function listClaimed(context: PlanContext, entry: PlanEntry, scopeForFiles: string): TrackedFile[] {
    const { session, scope } = context;
    const { spec, manifest } = entry;
    if (!manifest) return session.repository.files.filter((file) => pathMatcher(spec.claims?.paths ?? [])(file.path));
    const claims = spec.claims ?? manifest.claims;
    return claimedByClaims(claims, scope.selected, session.repository.files, scopeForFiles);
}

// The files the check claims in the scope.
function claimedFor(context: PlanContext, entry: PlanEntry, scopeForFiles: string): TrackedFile[] {
    if (entry.spec.runs !== 'per-file-list') return projectClaimed(context, entry.spec, scopeForFiles);
    return listClaimed(context, entry, scopeForFiles);
}

// The files less those the scope's exclude setting names.
function withoutExcluded(files: TrackedFile[], spec: CheckSpec, scope: ScopeSelection): TrackedFile[] {
    if (spec.exclude_setting === undefined) return files;
    const excluded = (scope.view.settings[spec.exclude_setting] as { paths: string[] }[] | undefined) ?? [];
    const patterns = excluded.flatMap((entry) => entry.paths);
    if (patterns.length === 0) return files;
    const isExcluded = pathMatcher(patterns);
    return files.filter((file) => !isExcluded(file.path));
}

// Whether the selection touches the policy or its generated files, which can change what any check finds.
function isPolicyTouched(narrow: Set<string>): boolean {
    return narrow.has('gspot.toml') || narrow.values().some((path) => path.startsWith('.gspot/'));
}

// The policy changed, so the check runs over everything it claims, with the check's own claims kept.
function reclaimed(context: PlanContext, entry: PlanEntry): TrackedFile[] {
    const { scope, children } = context;
    const files = claimedFor(context, entry, scope.scope.path);
    return entry.manifest === undefined ? files : files.filter((file) => isOutsideChildren(file, children));
}

// The files narrowed to the selection: a project check keeps everything when the selection touches it.
function narrowed(context: PlanContext, entry: PlanEntry, files: TrackedFile[]): TrackedFile[] {
    const { narrow } = context;
    if (!narrow) return files;
    const inNarrowed = files.filter((file) => narrow.has(file.path));
    const isTouched = isPolicyTouched(narrow);
    if (entry.spec.runs !== 'per-file-list') return !isTouched && inNarrowed.length === 0 ? [] : files;
    if (!isTouched || !entry.manifest || inNarrowed.length > 0) return inNarrowed;
    return reclaimed(context, entry);
}

// Selected paths that are no longer in the tree but still trigger a project check.
function missingTriggers(context: PlanContext, spec: CheckSpec, scopePath: string): string[] {
    if (spec.runs === 'per-file-list' || context.narrow === undefined) return [];
    const readable = new Set(context.session.repository.files.map((file) => file.path));
    return [...context.narrow].filter((path) => !readable.has(path) && isInScope(path, scopePath));
}

/**
 * The scopes nested inside a scope, whose files belong to them and not to it.
 * @param session the session
 * @param scope the scope
 * @returns the child scope paths
 */
export function childScopes(session: Session, scope: ScopeSelection): string[] {
    const own = scope.scope.path;
    return session.scopes
        .map((entry) => entry.scope.path)
        .filter((path) => path !== '' && path !== own && (own === '' || path.startsWith(`${own}/`)));
}

/**
 * Whether a file lies outside every child scope.
 * @param file the tracked file
 * @param children the child scope paths
 * @returns true when no child scope holds the file
 */
export function isOutsideChildren(file: TrackedFile, children: string[]): boolean {
    return children.every((child) => file.path !== child && !file.path.startsWith(`${child}/`));
}

/**
 * A policy check that reads a scoped configuration must run against that scope's file partition.
 * @param manifest the manifest that declares the check
 * @param spec the check
 * @returns true when the check runs once for the repository
 */
export function isRepositoryPolicy(manifest: Manifest, spec: CheckSpec): boolean {
    if (manifest.configuration.kind !== 'policy' || manifest.claims.from_languages || spec.runs === 'per-scope')
        return false;
    const command = [...(spec.command ?? []), ...Object.values(spec.env ?? {})];
    return !manifest.configs.some(
        (config) =>
            config.per_scope &&
            !config.fragment &&
            command.some((part) => part.includes(`{config:${configurationName(config.target)}}`)),
    );
}

/**
 * The files and deleted trigger paths a planned check runs over.
 * @param context the scope being planned
 * @param entry the check
 * @param isWholeCheck whether the check runs once for the repository
 * @returns the selected files and the trigger paths
 */
export function filesFor(
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
