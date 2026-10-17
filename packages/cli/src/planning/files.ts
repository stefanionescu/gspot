import { buildPathMatcher } from '#cli/repository/matchers.ts';
import type { ScopeSelection } from '#cli/types/settings/values.ts';
import type { TrackedFile } from '#cli/types/repository/inventory.ts';
import { classifyFile, isInGspotFolder } from '#cli/repository/classify.ts';
import { SETTINGS_FILE, TOOL_FILE_PREFIX } from '#cli/config/system/locations.ts';
import { isInScope, joinScope, isOutsideChildren } from '#cli/repository/scopes.ts';
import { type Manifest, type CheckDeclaration } from '#cli/types/configurations.ts';
import { listCoveredFiles as listRepositoryCoveredFiles } from '#cli/repository/coverage.ts';
import type { Session, PlanInputs, PlannedCheck, CheckCandidate } from '#cli/types/planning.ts';

// List every tracked file under the scope.
function listScopeFiles(context: PlanInputs, scopePath: string, runs: CheckDeclaration['runs']): TrackedFile[] {
    const prefix = joinScope(scopePath, '');
    return context.session.repository.files.filter(
        (file) => file.path.startsWith(prefix) && (runs !== 'scope' || isOutsideChildren(file.path, context.children)),
    );
}

// List the files of a project-wide check: the scope tree, when the check files match anything in it.
function listProjectCheckFiles(context: PlanInputs, entry: CheckCandidate, scopePath: string): TrackedFile[] {
    const { check, manifest } = entry;
    const { selection: scope } = context;
    const owners = check.files ?? (manifest?.configuration.group === 'language' ? manifest.files : undefined);
    const candidates = listScopeFiles(context, scopePath, check.runs);
    const applicationInputs =
        manifest === undefined ? candidates : candidates.filter((file) => !isInGspotFolder(file.path));
    const matches =
        owners === undefined
            ? applicationInputs
            : listRepositoryCoveredFiles(owners, applicationInputs, {
                  selected: scope.selected,
                  scope: scopePath,
                  view: scope.view,
              });
    if (filterNarrowedFiles(context, entry, stripIgnoredFiles(matches, check, scope).files).length === 0) return [];
    return check.runs === 'scope' ? candidates : candidates.filter((file) => file.kind !== 'binary');
}

// Per-file checks select their owners. Project checks keep all inputs after a declared trigger matches.
function listCoveredFiles(context: PlanInputs, entry: CheckCandidate, scopePath: string): TrackedFile[] {
    const { session, selection: scope } = context;
    const { check, manifest } = entry;
    if (check.runs !== 'files') return listProjectCheckFiles(context, entry, scopePath);
    if (!manifest)
        return session.repository.files.filter((file) => buildPathMatcher(check.files?.paths ?? [])(file.path));
    return listRepositoryCoveredFiles(check.files ?? manifest.files, session.repository.files, {
        selected: scope.selected,
        scope: scopePath,
        view: scope.view,
    });
}

// Check-specific settings ignores apply to live files and deleted project triggers alike.
function stripIgnoredFiles(
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

// Narrow the files to the selection; a project check keeps everything when the selection touches it.
function filterNarrowedFiles(context: PlanInputs, entry: CheckCandidate, files: TrackedFile[]): TrackedFile[] {
    const { narrow } = context;
    if (!narrow) return files;
    const isTouched = narrow.has(SETTINGS_FILE) || narrow.values().some((path) => isInGspotFolder(path));
    if (isTouched) return files;
    const inNarrowed = files.filter((file) => narrow.has(file.path));
    if (inNarrowed.length === 0) return [];
    return entry.check.runs === 'files' ? inNarrowed : files;
}

// List the paths deleted from the tree that still trigger a project check.
function listDeletedTriggers(context: PlanInputs, entry: CheckCandidate, scopePath: string): string[] {
    const { check, manifest } = entry;
    if (check.runs === 'files' || context.narrow === undefined) return [];
    const { session, children, selection: scope } = context;
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
    return stripIgnoredFiles(
        listRepositoryCoveredFiles(owners, missing, { selected: scope.selected, scope: scopePath, view: scope.view }),
        check,
        scope,
    ).files.map((file) => file.path);
}

/**
 * List the scopes nested inside a scope. Their files belong to them, not to it.
 *
 * @param session the scopes of this run.
 * @param selection the parent selection.
 *
 * @returns the child scope paths.
 */
export function listChildScopes(session: Pick<Session, 'scopes'>, selection: ScopeSelection): string[] {
    const own = selection.scope.path;
    return session.scopes
        .map((entry) => entry.scope.path)
        .filter((path) => path !== '' && path !== own && isInScope(path, own));
}

/**
 * Check whether a general per-file check runs once at the root. A check that reads a scope tool file does not.
 *
 * @param manifest the configuration that declares the check.
 * @param check the declaration to inspect.
 *
 * @returns true when the check runs once for the repository.
 */
export function isRootOnlyCheck(manifest: Manifest | undefined, check: CheckDeclaration): boolean {
    if (manifest === undefined) return true;
    if (manifest.configuration.group !== 'general' || manifest.files.languages || check.runs === 'scope') return false;
    const command = [...(check.command ?? []), ...(check.env === undefined ? [] : Object.values(check.env))];
    return !manifest.toolFiles.some(
        (config) =>
            config.per_scope &&
            !config.fragment &&
            (config.check.includes(check.name) ||
                command.some((part) => part.includes(`{tool_file:${extractToolFileName(config.target)}}`))),
    );
}

/**
 * Select the files and deleted trigger paths of a planned check.
 *
 * @param context the scope to plan.
 * @param entry the check and its manifest.
 *
 * @returns the files and the trigger paths.
 */
export function selectCheckFiles(
    context: PlanInputs,
    entry: CheckCandidate,
): Pick<PlannedCheck, 'files' | 'triggerPaths' | 'skip'> {
    const { selection, children } = context;
    const { check, manifest } = entry;
    const isRootCheck = check.runs === 'once' || check.runs === 'history';
    const scopePath = isRootCheck ? '' : selection.scope.path;
    const triggerPaths = listDeletedTriggers(context, entry, scopePath);
    const keepsChildScopes = check.runs !== 'files' || isRootOnlyCheck(manifest, check);
    let files =
        triggerPaths.length === 0
            ? listCoveredFiles(context, entry, scopePath)
            : listScopeFiles(context, scopePath, check.runs);
    if (!keepsChildScopes) files = files.filter((file) => isOutsideChildren(file.path, children));
    if (check.runs === 'files' && triggerPaths.length === 0)
        return { ...stripIgnoredFiles(filterNarrowedFiles(context, entry, files), check, selection), triggerPaths };
    const selected = stripIgnoredFiles(files, check, selection);
    return { ...selected, triggerPaths };
}

/**
 * Get the name that a tool-file placeholder uses for a tool file.
 * @param target the tool file path.
 * @returns the file name under .gspot/config without its extensions.
 */
export function extractToolFileName(target: string): string {
    const bare = target.startsWith(TOOL_FILE_PREFIX) ? target.slice(TOOL_FILE_PREFIX.length) : target;
    const dot = bare.indexOf('.');
    return dot === -1 ? bare : bare.slice(0, dot);
}
