// Which files a planned check runs over: what it owns, less excluded and child-scope paths, narrowed to a selection.
// Which files a planned check runs over: what it owns, less excluded and child-scope paths, narrowed to a selection.
import { listCoveredFiles } from '#cli/repository/coverage.ts';
import { buildPathMatcher } from '#cli/repository/matchers.ts';
import { SETTINGS_FILE } from '#cli/config/system/locations.ts';
import { toolFileName } from '#cli/configurations/manifests.ts';
import type { ScopeSelection } from '#cli/types/settings/values.ts';
import type { TrackedFile } from '#cli/types/repository/inventory.ts';
import { classifyFile, isInGspotFolder } from '#cli/repository/classify.ts';
import type { Manifest, CheckDeclaration } from '#cli/types/configurations.ts';
import { isInScope, joinScope, isOutsideChildren } from '#cli/repository/scopes.ts';
import type { Session, PlanEntry, PlanInputs, PlannedCheck } from '#cli/types/planning.ts';

// Every tracked file under the scope.
function scopeFiles(context: PlanInputs, scopePath: string, runs: CheckDeclaration['runs']): TrackedFile[] {
    const prefix = joinScope(scopePath, '');
    return context.session.repository.files.filter(
        (file) => file.path.startsWith(prefix) && (runs !== 'scope' || isOutsideChildren(file.path, context.children)),
    );
}

// The files a project-wide check runs over: the scope's tree, when its files select anything in it.
function scopeCoveredFiles(context: PlanInputs, entry: PlanEntry, scopePath: string): TrackedFile[] {
    const { check, manifest } = entry;
    const { scope } = context;
    const owners = check.files ?? (manifest?.configuration.group === 'language' ? manifest.files : undefined);
    const candidates = scopeFiles(context, scopePath, check.runs);
    const applicationInputs =
        manifest === undefined ? candidates : candidates.filter((file) => !isInGspotFolder(file.path));
    const matches =
        owners === undefined
            ? applicationInputs
            : listCoveredFiles(owners, applicationInputs, {
                  selected: scope.selected,
                  scope: scopePath,
                  view: scope.view,
              });
    if (narrowed(context, entry, withoutIgnored(matches, check, scope).files).length === 0) return [];
    return check.runs === 'scope' ? candidates : candidates.filter((file) => file.kind !== 'binary');
}

// Per-file checks select their owners. Project checks keep all inputs after a declared trigger matches.
function coveredFiles(context: PlanInputs, entry: PlanEntry, scopePath: string): TrackedFile[] {
    const { session, scope } = context;
    const { check, manifest } = entry;
    if (check.runs !== 'files') return scopeCoveredFiles(context, entry, scopePath);
    if (!manifest)
        return session.repository.files.filter((file) => buildPathMatcher(check.files?.paths ?? [])(file.path));
    return listCoveredFiles(check.files ?? manifest.files, session.repository.files, {
        selected: scope.selected,
        scope: scopePath,
        view: scope.view,
    });
}

// Check-specific settings ignores apply to live files and deleted project triggers alike.
function withoutIgnored(
    files: TrackedFile[],
    check: CheckDeclaration,
    scope: ScopeSelection,
): Pick<PlannedCheck, 'files' | 'skip'> {
    const paths = scope.view.ignoresFor(check.name).flatMap((entry) => (entry.rule === undefined ? entry.paths : []));
    const isIgnored = buildPathMatcher(paths);
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
    const isTouched = narrow.has(SETTINGS_FILE) || narrow.values().some((path) => isInGspotFolder(path));
    if (isTouched) return files;
    const inNarrowed = files.filter((file) => narrow.has(file.path));
    if (inNarrowed.length === 0) return [];
    return entry.check.runs === 'files' ? inNarrowed : files;
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
            (manifest === undefined || !isInGspotFolder(path)) &&
            isInScope(path, scopePath) &&
            (check.runs !== 'scope' || isOutsideChildren(path, children)),
    );
    const owners = check.files ?? manifest?.files;
    if (owners === undefined) return paths;
    const missing = paths.map((path): TrackedFile => {
        const raw = { path, size: 0, executable: false, symlink: false };
        const prefix = Buffer.alloc(0);
        return classifyFile(session.root, raw, prefix, { declarations: [], attributes: session.repository.attributes });
    });
    return withoutIgnored(
        listCoveredFiles(owners, missing, { selected: scope.selected, scope: scopePath, view: scope.view }),
        check,
        scope,
    ).files.map((file) => file.path);
}

/**
 * The scopes nested inside a scope, whose files belong to them and not to it.
 *
 * @param session the session.
 * @param scope the scope.
 *
 * @returns the child scope paths.
 */
export function childScopes(session: Session, scope: ScopeSelection): string[] {
    const own = scope.scope.path;
    return session.scopes
        .map((entry) => entry.scope.path)
        .filter((path) => path !== '' && path !== own && isInScope(path, own));
}

/**
 * Whether a general per-file check runs once at the root unless it reads a config file for a scope.
 *
 * @param manifest the manifest that declares the check.
 * @param check the check.
 *
 * @returns true when the check runs once for the repository.
 */
export function runsAtRoot(manifest: Manifest | undefined, check: CheckDeclaration): boolean {
    if (manifest === undefined) return true;
    if (manifest.configuration.group !== 'general' || manifest.files.languages || check.runs === 'scope') return false;
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
 *
 * @param context the scope selected for planning.
 * @param entry the check.
 * @param isRootCheck whether the check runs once for the repository.
 *
 * @returns the selected files and the trigger paths.
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
        triggerPaths.length === 0
            ? coveredFiles(context, entry, scopePath)
            : scopeFiles(context, scopePath, check.runs);
    if (!keepsChildScopes) files = files.filter((file) => isOutsideChildren(file.path, children));
    if (check.runs === 'files' && triggerPaths.length === 0)
        return { ...withoutIgnored(narrowed(context, entry, files), check, scope), triggerPaths };
    const selected = withoutIgnored(files, check, scope);
    return { ...selected, triggerPaths };
}
