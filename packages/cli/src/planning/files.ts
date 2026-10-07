// Which files a planned check runs over: what it owns, less excluded and child-scope paths, narrowed to a selection.
import { kindOf } from '#cli/repository/kind.ts';
import { tagEntry } from '#cli/repository/tags.ts';
import { isRecord } from '#cli/platform/objects.ts';
import { toolName } from '#cli/configurations/pins.ts';
import { ownedBy } from '#cli/configurations/owners.ts';
import type { ScopeSelection } from '#cli/types/policy/settings.ts';
import type { TrackedFile } from '#cli/types/repository/inventory.ts';
import type { Manifest, CheckSpec } from '#cli/types/configurations.ts';
import { configurationName } from '#cli/configurations/declarations.ts';
import { DOT_GSPOT, POLICY_FILE } from '#cli/config/platform/locations.ts';
import type { Session, PlanEntry, PlanInputs, PlannedCheck } from '#cli/types/planning.ts';
import { isInScope, pathMatcher, isOutsideChildren, isToolProjectPath } from '#cli/repository/selectors.ts';

// Every tracked file under the scope.
function projectFiles(context: PlanInputs, scopePath: string, runs: CheckSpec['runs']): TrackedFile[] {
    const prefix = scopePath === '' ? '' : `${scopePath}/`;
    return context.session.repository.files.filter(
        (file) => file.path.startsWith(prefix) && (runs !== 'scope' || isOutsideChildren(file.path, context.children)),
    );
}

// The files a project-wide check runs over: the scope's tree, when its files select anything in it.
function projectOwned(context: PlanInputs, entry: PlanEntry, scopePath: string): TrackedFile[] {
    const { spec, manifest } = entry;
    const { scope } = context;
    const owners = spec.files ?? (manifest?.configuration.kind === 'language' ? manifest.files : undefined);
    const candidates = projectFiles(context, scopePath, spec.runs);
    const applicationInputs =
        manifest === undefined ? candidates : candidates.filter((file) => !isToolProjectPath(file.path));
    if (owners !== undefined && ownedBy(owners, scope.selected, applicationInputs, scopePath).length === 0) return [];
    return spec.runs === 'scope' ? candidates : candidates.filter((file) => file.kind !== 'binary');
}

// The files a per-file check runs over: its own files, its manifest's, or the paths a policy check names.
function listOwned(context: PlanInputs, entry: PlanEntry, scopePath: string): TrackedFile[] {
    const { session, scope } = context;
    const { spec, manifest } = entry;
    if (!manifest) return session.repository.files.filter((file) => pathMatcher(spec.files?.paths ?? [])(file.path));
    const owners = spec.files ?? manifest.files;
    return ownedBy(owners, scope.selected, session.repository.files, scopePath);
}

// The files the check owns in the scope.
function ownedFor(context: PlanInputs, entry: PlanEntry, scopePath: string): TrackedFile[] {
    if (entry.spec.runs !== 'files') return projectOwned(context, entry, scopePath);
    return listOwned(context, entry, scopePath);
}

// The files less the paths the check's tool excludes, such as tools.semgrep.exclude. Only entries with paths count;
// the Prettier ignore lines go to .prettierignore instead.
function withoutExcluded(files: TrackedFile[], spec: CheckSpec, scope: ScopeSelection): TrackedFile[] {
    const tool = toolName(spec);
    const excluded = tool === undefined ? undefined : scope.view.settings[`tools.${tool}.exclude`];
    const patterns = (Array.isArray(excluded) ? excluded : []).flatMap((entry: unknown) => {
        const paths = isRecord(entry) ? entry['paths'] : undefined;
        return Array.isArray(paths) ? paths.map(String) : [];
    });
    if (patterns.length === 0) return files;
    const isExcluded = pathMatcher(patterns);
    return files.filter((file) => !isExcluded(file.path));
}

// The files narrowed to the selection: a project check keeps everything when the selection touches it.
function narrowed(context: PlanInputs, entry: PlanEntry, files: TrackedFile[]): TrackedFile[] {
    const { narrow } = context;
    if (!narrow) return files;
    const inNarrowed = files.filter((file) => narrow.has(file.path));
    const isTouched = narrow.has(POLICY_FILE) || narrow.values().some((path) => path.startsWith(`${DOT_GSPOT}/`));
    if (inNarrowed.length > 0) return entry.spec.runs === 'files' ? inNarrowed : files;
    if (!isTouched) return [];
    if (entry.spec.runs !== 'files') return files;
    if (entry.manifest === undefined) return [];
    return files;
}

// Selected paths deleted from the tree but still trigger a project check.
function missingTriggers(context: PlanInputs, entry: PlanEntry, scopePath: string): string[] {
    const { spec, manifest } = entry;
    if (spec.runs === 'files' || context.narrow === undefined) return [];
    const { session, children, scope } = context;
    const readable = new Set(session.repository.files.map((file) => file.path));
    const paths = [...context.narrow].filter(
        (path) =>
            !readable.has(path) &&
            (manifest === undefined || !isToolProjectPath(path)) &&
            isInScope(path, scopePath) &&
            (spec.runs !== 'scope' || isOutsideChildren(path, children)),
    );
    const owners = spec.files ?? manifest?.files;
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
    return withoutExcluded(ownedBy(owners, scope.selected, missing, scopePath), spec, scope).map((file) => file.path);
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
 * @param spec the check
 * @returns true when the check runs once for the repository
 */
export function runsAtRoot(manifest: Manifest, spec: CheckSpec): boolean {
    if (manifest.configuration.kind !== 'general' || manifest.files.languages || spec.runs === 'scope') return false;
    const command = [...(spec.command ?? []), ...(spec.env === undefined ? [] : Object.values(spec.env))];
    return !manifest.configs.some(
        (config) =>
            config.scoped &&
            !config.fragment &&
            command.some((part) => part.includes(`{config:${configurationName(config.target)}}`)),
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
): Pick<PlannedCheck, 'files' | 'triggerPaths'> {
    const { scope, children } = context;
    const { spec, manifest } = entry;
    const scopePath = isRootCheck ? '' : scope.scope.path;
    const triggerPaths = missingTriggers(context, entry, scopePath);
    const keepsChildScopes = spec.runs !== 'files' || (manifest !== undefined && runsAtRoot(manifest, spec));
    let files =
        triggerPaths.length === 0 ? ownedFor(context, entry, scopePath) : projectFiles(context, scopePath, spec.runs);
    if (!keepsChildScopes && manifest !== undefined)
        files = files.filter((file) => isOutsideChildren(file.path, children));
    const selected = withoutExcluded(files, spec, scope);
    return { files: triggerPaths.length === 0 ? narrowed(context, entry, selected) : selected, triggerPaths };
}
