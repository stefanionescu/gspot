// Which files a planned check runs over: what it owns, less excluded and child-scope paths, narrowed to a selection.
import { kindOf } from '#cli/repository/public.ts';
import { ownedBy } from '#cli/repository/selection/public.ts';
import { toolFileName } from '#cli/configurations/contracts.ts';
import { tagEntry } from '#cli/repository/discovery/contracts.ts';
import type { ScopeSelection } from '#cli/types/policy/settings.ts';
import type { TrackedFile } from '#cli/types/repository/inventory.ts';
import { DOT_GSPOT, POLICY_FILE } from '#cli/config/platform/locations.ts';
import type { Manifest, CheckDeclaration } from '#cli/types/configurations.ts';
import type { Session, PlanEntry, PlanInputs, PlannedCheck } from '#cli/types/planning.ts';
import { isInScope, pathMatcher, isOutsideChildren, isToolProjectPath } from '#cli/repository/paths/public.ts';

// Every tracked file under the scope.
function projectFiles(context: PlanInputs, scopePath: string, runs: CheckDeclaration['runs']): TrackedFile[] {
    const prefix = scopePath === '' ? '' : `${scopePath}/`;
    return context.session.repository.files.filter(
        (file) => file.path.startsWith(prefix) && (runs !== 'scope' || isOutsideChildren(file.path, context.children)),
    );
}

// The files a project-wide check runs over: the scope's tree, when its files select anything in it.
function projectOwned(context: PlanInputs, entry: PlanEntry, scopePath: string): TrackedFile[] {
    const { check, manifest } = entry;
    const { scope } = context;
    const owners = check.files ?? (manifest?.configuration.kind === 'language' ? manifest.files : undefined);
    const candidates = projectFiles(context, scopePath, check.runs);
    const applicationInputs =
        manifest === undefined ? candidates : candidates.filter((file) => !isToolProjectPath(file.path));
    if (owners !== undefined && ownedBy(owners, scope.selected, applicationInputs, scopePath).length === 0) return [];
    return check.runs === 'scope' ? candidates : candidates.filter((file) => file.kind !== 'binary');
}

// The files a per-file check runs over: its own files, its manifest's, or the paths a policy check IDs.
function listOwned(context: PlanInputs, entry: PlanEntry, scopePath: string): TrackedFile[] {
    const { session, scope } = context;
    const { check, manifest } = entry;
    if (!manifest) return session.repository.files.filter((file) => pathMatcher(check.files?.paths ?? [])(file.path));
    const owners = check.files ?? manifest.files;
    return ownedBy(owners, scope.selected, session.repository.files, scopePath);
}

// The files the check owns in the scope.
function ownedFor(context: PlanInputs, entry: PlanEntry, scopePath: string): TrackedFile[] {
    if (entry.check.runs !== 'files') return projectOwned(context, entry, scopePath);
    return listOwned(context, entry, scopePath);
}

// Check-specific policy ignores apply to live files and deleted project triggers alike.
function withoutIgnored(
    files: TrackedFile[],
    check: CheckDeclaration,
    scope: ScopeSelection,
): Pick<PlannedCheck, 'files' | 'skip'> {
    const paths = scope.view.ignoresFor(check.name).flatMap((entry) => (entry.rule === undefined ? entry.paths : []));
    const isIgnored = pathMatcher(paths);
    const selected = files.filter((file) => !isIgnored(file.path));
    return {
        files: selected,
        ...(files.length > 0 && selected.length === 0
            ? { skip: { cause: 'ignore' as const, note: 'all selected paths are disabled by gspot.toml' } }
            : {}),
    };
}

// The files narrowed to the selection: a project check keeps everything when the selection touches it.
function narrowed(context: PlanInputs, entry: PlanEntry, files: TrackedFile[]): TrackedFile[] {
    const { narrow } = context;
    if (!narrow) return files;
    const inNarrowed = files.filter((file) => narrow.has(file.path));
    const isTouched = narrow.has(POLICY_FILE) || narrow.values().some((path) => path.startsWith(`${DOT_GSPOT}/`));
    if (inNarrowed.length > 0) return entry.check.runs === 'files' ? inNarrowed : files;
    if (!isTouched) return [];
    if (entry.check.runs !== 'files') return files;
    if (entry.manifest === undefined) return [];
    return files;
}

// Selected paths deleted from the tree but still trigger a project check.
function missingTriggers(context: PlanInputs, entry: PlanEntry, scopePath: string): string[] {
    const { check, manifest } = entry;
    if (check.runs === 'files' || context.narrow === undefined) return [];
    const { session, children, scope } = context;
    const readable = new Set(session.repository.files.map((file) => file.path));
    const paths = [...context.narrow].filter(
        (path) =>
            !readable.has(path) &&
            (manifest === undefined || !isToolProjectPath(path)) &&
            isInScope(path, scopePath) &&
            (check.runs !== 'scope' || isOutsideChildren(path, children)),
    );
    const owners = check.files ?? manifest?.files;
    if (owners === undefined) return paths;
    const missing = paths.map((path): TrackedFile => {
        const raw = { path, size: 0, executable: false, symlink: false };
        const prefix = Buffer.alloc(0);
        const tagged = tagEntry(raw, prefix);
        const verdict = kindOf(
            { root: session.root, entry: raw, isBinary: tagged.binary, prefix },
            { declarations: session.policyFiles.policy.declarations, attributes: session.repository.attributes },
        );
        return { ...raw, prefix, tags: tagged.tags, kind: verdict.kind, kindSource: verdict.source };
    });
    return withoutIgnored(ownedBy(owners, scope.selected, missing, scopePath), check, scope).files.map(
        (file) => file.path,
    );
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
        .filter((path) => path !== '' && path !== own && isInScope(path, own));
}

/**
 * Whether a general per-file check runs once at the root unless it reads a scoped config file.
 * @param manifest the manifest that declares the check
 * @param check the check
 * @returns true when the check runs once for the repository
 */
export function runsAtRoot(manifest: Manifest | undefined, check: CheckDeclaration): boolean {
    if (manifest === undefined) return true;
    if (manifest.configuration.kind !== 'general' || manifest.files.languages || check.runs === 'scope') return false;
    const command = [...(check.command ?? []), ...(check.env === undefined ? [] : Object.values(check.env))];
    return !manifest.toolFiles.some(
        (config) =>
            config.per_scope &&
            !config.fragment &&
            (config.check.includes(check.name) ||
                command.some((part) => part.includes(`{tool_file:${toolFileName(config.target)}}`))),
    );
}

/**
 * The files and deleted trigger paths a planned check runs over.
 * @param context the scope being planned
 * @param entry the check
 * @param isRootCheck whether the check runs once for the repository
 * @returns the selected files and the trigger paths
 */
export function filesFor(
    context: PlanInputs,
    entry: PlanEntry,
    isRootCheck: boolean,
): Pick<PlannedCheck, 'files' | 'triggerPaths' | 'skip'> {
    const { scope, children } = context;
    const { check, manifest } = entry;
    const scopePath = isRootCheck ? '' : scope.scope.path;
    const triggerPaths = missingTriggers(context, entry, scopePath);
    const keepsChildScopes = check.runs !== 'files' || runsAtRoot(manifest, check);
    let files =
        triggerPaths.length === 0 ? ownedFor(context, entry, scopePath) : projectFiles(context, scopePath, check.runs);
    if (!keepsChildScopes) files = files.filter((file) => isOutsideChildren(file.path, children));
    if (check.runs === 'files' && triggerPaths.length === 0)
        return { ...withoutIgnored(narrowed(context, entry, files), check, scope), triggerPaths };
    const selected = withoutIgnored(files, check, scope);
    return {
        ...selected,
        files: triggerPaths.length === 0 ? narrowed(context, entry, selected.files) : selected.files,
        triggerPaths,
    };
}
