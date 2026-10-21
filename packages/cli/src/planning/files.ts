import ignore from 'ignore';
import type { Session } from '#cli/types/session.ts';
import { listIgnores } from '#cli/settings/scope-view.ts';
import { findCachedText } from '#cli/system/files/reads.ts';
import { TOOL_IGNORE_ARGUMENT } from '#cli/config/planning.ts';
import { buildPathMatcher } from '#cli/repository/matchers.ts';
import type { Scope } from '#cli/types/settings/inheritance.ts';
import { classifyFile } from '#cli/repository/files/classify.ts';
import { isInScope, joinScope } from '#cli/repository/scopes.ts';
import { listCoveredFiles } from '#cli/repository/covered-files.ts';
import { DOT_GSPOT, SETTINGS_FILE } from '#cli/config/gspot-paths.ts';
import type { TrackedFile } from '#cli/types/repository/inventory.ts';
import { extractToolFileName } from '#cli/configurations/declared-tools.ts';
import type { Check, KnownCheck, Configuration } from '#cli/types/configurations.ts';
import type { ToolIgnore, PlannedCheck, PlannedScope } from '#cli/types/planning.ts';

// Read the ignore syntax from the authored or generated ignore file of the check.
function readToolIgnore(session: Session, check: PlannedCheck): ToolIgnore | undefined {
    const argument = check.check.command?.indexOf(TOOL_IGNORE_ARGUMENT) ?? -1;
    const file = argument < 0 ? undefined : check.check.command?.[argument + 1];
    if (file === undefined) return undefined;
    const matcher = ignore().add(findCachedText(session.reads, file) ?? '');
    return { file, matches: matcher.ignores.bind(matcher) };
}

// List every tracked file under the scope.
function listScopeFiles(planned: PlannedScope, scopePath: string, runs: Check['runs']): TrackedFile[] {
    const prefix = joinScope(scopePath, '');
    return planned.session.repository.files.filter(
        (file) =>
            file.path.startsWith(prefix) &&
            (runs !== 'scope' || planned.children.every((child) => !isInScope(file.path, child))),
    );
}

// List the files of a project-wide check: the scope tree, when the check files match anything in it.
function listProjectCheckFiles(planned: PlannedScope, entry: KnownCheck, scopePath: string): TrackedFile[] {
    const { check, configuration } = entry;
    const { selection: scope } = planned;
    const owners = check.files ?? (configuration?.group === 'language' ? configuration.files : undefined);
    const candidates = listScopeFiles(planned, scopePath, check.runs);
    const applicationInputs =
        configuration === undefined ? candidates : candidates.filter((file) => !file.path.startsWith(`${DOT_GSPOT}/`));
    const matches =
        owners === undefined
            ? applicationInputs
            : listCoveredFiles(owners, applicationInputs, {
                  selected: scope.selected,
                  scope: scopePath,
                  view: scope.view,
              });
    if (filterNarrowedFiles(planned, entry, stripIgnoredFiles(matches, check, scope).files).length === 0) return [];
    return check.runs === 'scope' ? candidates : candidates.filter((file) => file.kind !== 'binary');
}

// Per-file checks select their owners. Project checks keep all inputs after a declared trigger matches.
function listCheckFiles(planned: PlannedScope, entry: KnownCheck, scopePath: string): TrackedFile[] {
    const { session, selection: scope } = planned;
    const { check, configuration } = entry;
    if (check.runs !== 'files') return listProjectCheckFiles(planned, entry, scopePath);
    if (!configuration) {
        const isMatch = buildPathMatcher(check.files?.paths ?? []);
        return session.repository.files.filter((file) => isMatch(file.path));
    }
    return listCoveredFiles(check.files ?? configuration.files, session.repository.files, {
        selected: scope.selected,
        scope: scopePath,
        view: scope.view,
    });
}

// Check-specific settings ignores apply to live files and deleted project triggers alike.
function stripIgnoredFiles(files: TrackedFile[], check: Check, scope: Scope): Pick<PlannedCheck, 'files' | 'skip'> {
    const paths = listIgnores(scope.view, check.name).flatMap((entry) =>
        entry.rule === undefined && entry.names === undefined ? entry.paths : [],
    );
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
function filterNarrowedFiles(planned: PlannedScope, entry: KnownCheck, files: TrackedFile[]): TrackedFile[] {
    const { narrowedPaths } = planned;
    if (!narrowedPaths) return files;
    const isTouched =
        narrowedPaths.has(SETTINGS_FILE) || narrowedPaths.values().some((path) => path.startsWith(`${DOT_GSPOT}/`));
    if (isTouched) return files;
    const inNarrowed = files.filter((file) => narrowedPaths.has(file.path));
    if (inNarrowed.length === 0) return [];
    return entry.check.runs === 'files' ? inNarrowed : files;
}

// List the paths deleted from the tree that still trigger a project check.
function listDeletedTriggers(planned: PlannedScope, entry: KnownCheck, scopePath: string): string[] {
    const { check, configuration } = entry;
    if (check.runs === 'files' || planned.narrowedPaths === undefined) return [];
    const { session, children, selection: scope } = planned;
    const readable = new Set(session.repository.files.map((file) => file.path));
    const paths = [...planned.narrowedPaths].filter(
        (path) =>
            !readable.has(path) &&
            (configuration === undefined || !path.startsWith(`${DOT_GSPOT}/`)) &&
            isInScope(path, scopePath) &&
            (check.runs !== 'scope' || children.every((child) => !isInScope(path, child))),
    );
    const owners = check.files ?? configuration?.files;
    if (owners === undefined) return paths;
    const missing = paths.map((path): TrackedFile => {
        const raw = { path, size: 0, executable: false, symlink: false };
        const prefix = Buffer.alloc(0);
        return classifyFile(session.root, raw, prefix, {
            generatedPaths: [],
            attributes: session.repository.attributes,
        });
    });
    return stripIgnoredFiles(
        listCoveredFiles(owners, missing, { selected: scope.selected, scope: scopePath, view: scope.view }),
        check,
        scope,
    ).files.map((file) => file.path);
}

/**
 * List the files that the configurations of a check own, apart from the inputs of a project-wide run.
 *
 * @param selections the scopes.
 * @param check the plan to read.
 *
 * @returns the files that the owners of the check select.
 */
export function listCheckedFiles(selections: Scope[], check: PlannedCheck): TrackedFile[] {
    const owners = check.check.files ?? check.configuration?.files;
    const children = check.check.runs === 'scope' ? listChildScopes(selections, check.selection) : [];
    const files = check.files.filter((file) => children.every((child) => !isInScope(file.path, child)));
    return owners === undefined
        ? []
        : listCoveredFiles(owners, files, {
              selected: check.selection.selected,
              scope: check.selection.scope.path,
              view: check.selection.view,
          });
}

/**
 * Restrict file checks through their declared ignore files.
 *
 * @param session the repository with its file cache.
 * @param check the plan to narrow.
 *
 * @returns the check with its files restricted.
 */
export function stripToolIgnoredFiles(session: Session, check: PlannedCheck): PlannedCheck {
    if (check.skip !== undefined || check.check.runs !== 'files' || check.files.length === 0) return check;
    const toolIgnore = readToolIgnore(session, check);
    if (toolIgnore === undefined) return check;
    const files = check.files.filter((file) => !toolIgnore.matches(file.path));
    return files.length === 0
        ? { ...check, skip: { cause: 'ignore', note: `all selected paths are disabled by ${toolIgnore.file}` } }
        : { ...check, files };
}

/**
 * List the scopes nested inside a scope. Their files belong to them, not to it.
 *
 * @param selections the scopes of this run.
 * @param selection the parent selection.
 *
 * @returns the child scope paths.
 */
export function listChildScopes(selections: Scope[], selection: Scope): string[] {
    const own = selection.scope.path;
    return selections
        .map((entry) => entry.scope.path)
        .filter((path) => path !== '' && path !== own && isInScope(path, own));
}

/**
 * Check whether a general per-file check runs once at the root. A check that reads a scope tool file does not.
 *
 * @param configuration the configuration that declares the check.
 * @param check the declaration to inspect.
 *
 * @returns true when the check runs once for the repository.
 */
export function isRootOnlyCheck(configuration: Configuration | undefined, check: Check): boolean {
    if (configuration === undefined) return true;
    if (configuration.group !== 'general' || configuration.files.languages || check.runs === 'scope') return false;
    const command = [...(check.command ?? []), ...(check.env === undefined ? [] : Object.values(check.env))];
    return !configuration.toolFiles.some(
        (config) =>
            config.per_scope &&
            (config.check.includes(check.name) ||
                command.some((part) => part.includes(`{tool_file:${extractToolFileName(config.file)}}`))),
    );
}

/**
 * Select the files and deleted trigger paths of a planned check.
 *
 * @param planned the scope to plan.
 * @param entry the check and its manifest.
 *
 * @returns the files and the trigger paths.
 */
export function selectCheckFiles(
    planned: PlannedScope,
    entry: KnownCheck,
): Pick<PlannedCheck, 'files' | 'triggerPaths' | 'skip'> {
    const { selection, children } = planned;
    const { check, configuration } = entry;
    const isRootCheck = check.runs === 'once' || check.runs === 'history';
    const scopePath = isRootCheck ? '' : selection.scope.path;
    const triggerPaths = listDeletedTriggers(planned, entry, scopePath);
    const keepsChildScopes = check.runs !== 'files' || isRootOnlyCheck(configuration, check);
    let files =
        triggerPaths.length === 0
            ? listCheckFiles(planned, entry, scopePath)
            : listScopeFiles(planned, scopePath, check.runs);
    if (!keepsChildScopes) files = files.filter((file) => children.every((child) => !isInScope(file.path, child)));
    if (check.runs === 'files')
        return { ...stripIgnoredFiles(filterNarrowedFiles(planned, entry, files), check, selection), triggerPaths };
    const selected = stripIgnoredFiles(files, check, selection);
    return { ...selected, triggerPaths };
}
