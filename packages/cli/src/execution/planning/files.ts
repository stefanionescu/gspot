// Which files a planned check runs over: what it owns, less excluded and child-scope paths, narrowed to a selection.
import { ownedBy } from '#cli/kits/owners.ts';
import { kitName } from '#cli/kits/targets.ts';
import type { Session } from '#cli/types/tools/tools.ts';
import type { Manifest, CheckSpec } from '#cli/types/kits.ts';
import type { ScopeSelection } from '#cli/types/policy/policy.ts';
import type { PlannedCheck } from '#cli/types/execution/execution.ts';
import { isInScope, pathMatcher } from '#cli/repository/selectors.ts';
import type { TrackedFile } from '#cli/types/repository/repository.ts';
import type { PlanEntry, PlanInputs } from '#cli/types/execution/planning.ts';

// Every tracked file under the scope.
function projectFiles(context: PlanInputs, scopeForFiles: string): TrackedFile[] {
    const prefix = scopeForFiles === '' ? '' : `${scopeForFiles}/`;
    return context.session.repository.files.filter((file) => file.path.startsWith(prefix));
}

// The files a project-wide check runs over: the scope's tree, when its files select anything in it.
function projectOwned(context: PlanInputs, spec: CheckSpec, scopeForFiles: string): TrackedFile[] {
    const { session, scope, children } = context;
    const isPerScope = spec.runs === 'scope';
    const selectedFiles =
        spec.files === undefined
            ? undefined
            : ownedBy(spec.files, scope.selected, session.repository.files, scopeForFiles);
    const owned = isPerScope
        ? selectedFiles?.filter((file) => children.every((child) => !isInScope(file.path, child)))
        : selectedFiles;
    if (owned?.length === 0) return [];
    const files = projectFiles(context, scopeForFiles);
    if (isPerScope) return files.filter((file) => children.every((child) => !isInScope(file.path, child)));
    return files.filter((file) => file.kind !== 'binary');
}

// The files a per-file check runs over: its own files, its manifest's, or the paths a policy check names.
function listOwned(context: PlanInputs, entry: PlanEntry, scopeForFiles: string): TrackedFile[] {
    const { session, scope } = context;
    const { spec, manifest } = entry;
    if (!manifest) return session.repository.files.filter((file) => pathMatcher(spec.files?.paths ?? [])(file.path));
    const owners = spec.files ?? manifest.files;
    return ownedBy(owners, scope.selected, session.repository.files, scopeForFiles);
}

// The files the check owns in the scope.
function ownedFor(context: PlanInputs, entry: PlanEntry, scopeForFiles: string): TrackedFile[] {
    if (entry.spec.runs !== 'files') return projectOwned(context, entry.spec, scopeForFiles);
    return listOwned(context, entry, scopeForFiles);
}

// The files less the paths the check's tool excludes, such as tools.semgrep.exclude. Only entries with paths count;
// the Prettier ignore lines go to .prettierignore instead.
function withoutExcluded(files: TrackedFile[], spec: CheckSpec, scope: ScopeSelection): TrackedFile[] {
    const tool = spec.tool ?? spec.command?.[0];
    const excluded = tool === undefined ? undefined : scope.view.settings[`tools.${tool}.exclude`];
    const patterns = (Array.isArray(excluded) ? excluded : []).flatMap((entry: { paths?: unknown }) =>
        Array.isArray(entry.paths) ? entry.paths.map(String) : [],
    );
    if (patterns.length === 0) return files;
    const isExcluded = pathMatcher(patterns);
    return files.filter((file) => !isExcluded(file.path));
}

// The policy changed, so the check runs over everything it owns, with the check's own files kept.
function allOwned(context: PlanInputs, entry: PlanEntry): TrackedFile[] {
    const { scope, children } = context;
    const files = ownedFor(context, entry, scope.scope.path);
    return entry.manifest === undefined
        ? files
        : files.filter((file) => children.every((child) => !isInScope(file.path, child)));
}

// The files narrowed to the selection: a project check keeps everything when the selection touches it.
function narrowed(context: PlanInputs, entry: PlanEntry, files: TrackedFile[]): TrackedFile[] {
    const { narrow } = context;
    if (!narrow) return files;
    const inNarrowed = files.filter((file) => narrow.has(file.path));
    const isTouched = narrow.has('gspot.toml') || narrow.values().some((path) => path.startsWith('.gspot/'));
    if (inNarrowed.length > 0) return entry.spec.runs === 'files' ? inNarrowed : files;
    if (!isTouched) return [];
    if (entry.spec.runs !== 'files') return files;
    if (entry.manifest === undefined) return [];
    return allOwned(context, entry);
}

// Selected paths deleted from the tree but still trigger a project check.
function missingTriggers(context: PlanInputs, spec: CheckSpec, scopePath: string): string[] {
    if (spec.runs === 'files' || context.narrow === undefined) return [];
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
        .filter((path) => path !== '' && path !== own && isInScope(path, own));
}
/**
 * A policy check that reads a scoped configuration must run against that scope's file partition.
 * @param manifest the manifest that declares the check
 * @param spec the check
 * @returns true when the check runs once for the repository
 */
export function isRepositoryPolicy(manifest: Manifest, spec: CheckSpec): boolean {
    if (manifest.kit.kind !== 'general' || manifest.files.languages || spec.runs === 'scope') return false;
    const command = [...(spec.command ?? []), ...Object.values(spec.env ?? {})];
    return !manifest.configs.some(
        (config) =>
            config.scoped &&
            !config.fragment &&
            command.some((part) => part.includes(`{config:${kitName(config.target)}}`)),
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
    context: PlanInputs,
    entry: PlanEntry,
    isWholeCheck: boolean,
): Pick<PlannedCheck, 'files' | 'triggerPaths'> {
    const { scope, children } = context;
    const { spec, manifest } = entry;
    const scopePath = isWholeCheck ? '' : scope.scope.path;
    const triggerPaths = missingTriggers(context, spec, scopePath);
    const isWhole = spec.runs !== 'files' || (manifest !== undefined && isRepositoryPolicy(manifest, spec));
    let files = triggerPaths.length === 0 ? ownedFor(context, entry, scopePath) : projectFiles(context, scopePath);
    if (!isWhole && manifest !== undefined)
        files = files.filter((file) => children.every((child) => !isInScope(file.path, child)));
    const selected = withoutExcluded(files, spec, scope);
    return { files: triggerPaths.length === 0 ? narrowed(context, entry, selected) : selected, triggerPaths };
}
