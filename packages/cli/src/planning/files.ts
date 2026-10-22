import ignore from 'ignore';
import type { Session } from '#cli/types/session.ts';
import { findCachedText } from '#cli/system/files/reads.ts';
import { listIgnores } from '#cli/settings/scope-settings.ts';
import { TOOL_IGNORE_ARGUMENT } from '#cli/config/planning.ts';
import { buildPathMatcher } from '#cli/repository/matchers.ts';
import type { Scope } from '#cli/types/settings/inheritance.ts';
import { classifyFile } from '#cli/repository/files/classify.ts';
import { isInScope, joinScope } from '#cli/repository/scopes.ts';
import { listCoveredFiles } from '#cli/repository/covered-files.ts';
import { DOT_GSPOT, SETTINGS_FILE } from '#cli/config/gspot-paths.ts';
import type { TrackedFile } from '#cli/types/repository/inventory.ts';
import { extractConfigFileName } from '#cli/configurations/declared-tools.ts';
import type { Check, KnownCheck, Configuration } from '#cli/types/configurations.ts';
import type { ToolIgnore, PlannedCheck, PlannedScope } from '#cli/types/planning.ts';

// Read the ignore syntax from your own ignore file of the check, or from the generated one.
function readToolIgnore(session: Session, check: PlannedCheck): ToolIgnore | undefined {
    const argument = check.check.command?.indexOf(TOOL_IGNORE_ARGUMENT) ?? -1;
    const file = argument < 0 ? undefined : check.check.command?.[argument + 1];
    if (file === undefined) return undefined;
    const matcher = ignore().add(findCachedText(session.reads, file) ?? '');
    return { file, matches: matcher.ignores.bind(matcher) };
}

// A scope check leaves out the files of child scopes.
function listScopeFiles(planned: PlannedScope, scopePath: string, runs: Check['runs']): TrackedFile[] {
    const prefix = joinScope(scopePath, '');
    return planned.session.repository.files.filter(
        (file) =>
            file.path.startsWith(prefix) &&
            (runs !== 'scope' || planned.children.every((child) => !isInScope(file.path, child))),
    );
}

// List the files of a project-wide check: the scope tree, when the check files match anything in it.
function listProjectCheckFiles(planned: PlannedScope, known: KnownCheck, scopePath: string): TrackedFile[] {
    const { check, configuration } = known;
    const { scope } = planned;
    const owners = check.files ?? (configuration?.group === 'language' ? configuration.files : undefined);
    const scopeFiles = listScopeFiles(planned, scopePath, check.runs);
    const projectFiles =
        configuration === undefined ? scopeFiles : scopeFiles.filter((file) => !file.path.startsWith(`${DOT_GSPOT}/`));
    const matches =
        owners === undefined
            ? projectFiles
            : listCoveredFiles(owners, projectFiles, {
                  configurations: scope.configurations,
                  scopePath,
                  settings: scope.settings,
              });
    if (filterNarrowedFiles(planned, known, stripIgnoredFiles(matches, check, scope).files).length === 0) return [];
    return check.runs === 'scope' ? scopeFiles : scopeFiles.filter((file) => file.kind !== 'binary');
}

// A per-file check reads the files that its owners cover. A project check reads every file of the scope once one of its
// files matches.
function listCheckFiles(planned: PlannedScope, known: KnownCheck, scopePath: string): TrackedFile[] {
    const { session, scope } = planned;
    const { check, configuration } = known;
    if (check.runs !== 'files') return listProjectCheckFiles(planned, known, scopePath);
    if (!configuration) {
        const isMatch = buildPathMatcher(check.files?.paths ?? []);
        return session.repository.files.filter((file) => isMatch(file.path));
    }
    return listCoveredFiles(check.files ?? configuration.files, session.repository.files, {
        configurations: scope.configurations,
        scopePath,
        settings: scope.settings,
    });
}

// Drop the paths that an [[ignore]] of the check names, for tracked files and deleted trigger paths alike, and skip the
// check when none remain.
function stripIgnoredFiles(files: TrackedFile[], check: Check, scope: Scope): Pick<PlannedCheck, 'files' | 'skip'> {
    const paths = listIgnores(scope.settings, check.id).flatMap((entry) =>
        entry.rule === undefined && entry.names === undefined ? entry.paths : [],
    );
    const isIgnored = buildPathMatcher(paths);
    const selected = files.filter((file) => !isIgnored(file.path));
    return {
        files: selected,
        ...(files.length > 0 && selected.length === 0
            ? { skip: { cause: 'ignore' as const, note: 'every selected path is ignored in gspot.toml' } }
            : {}),
    };
}

// Keep the narrowed paths. A project check keeps every file when the selection touches one of its files, and every
// check keeps every file when gspot.toml or .gspot changed.
function filterNarrowedFiles(planned: PlannedScope, known: KnownCheck, files: TrackedFile[]): TrackedFile[] {
    const { narrowedPaths } = planned;
    if (!narrowedPaths) return files;
    const isTouched =
        narrowedPaths.has(SETTINGS_FILE) || narrowedPaths.values().some((path) => path.startsWith(`${DOT_GSPOT}/`));
    if (isTouched) return files;
    const inNarrowed = files.filter((file) => narrowedPaths.has(file.path));
    if (inNarrowed.length === 0) return [];
    return known.check.runs === 'files' ? inNarrowed : files;
}

// List the paths deleted from the tree that still trigger a project check.
function listDeletedTriggers(planned: PlannedScope, known: KnownCheck, scopePath: string): string[] {
    const { check, configuration } = known;
    if (check.runs === 'files' || planned.narrowedPaths === undefined) return [];
    const { session, children, scope } = planned;
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
        listCoveredFiles(owners, missing, {
            configurations: scope.configurations,
            scopePath,
            settings: scope.settings,
        }),
        check,
        scope,
    ).files.map((file) => file.path);
}

/**
 * List the files that the configurations of a check own, apart from the files of a project-wide run.
 *
 * @param scopes every scope of the session; a scope-wide run leaves out the files of its child scopes.
 * @param check the plan to read.
 * @returns the files that the owners of the check select.
 */
export function listCheckedFiles(scopes: Scope[], check: PlannedCheck): TrackedFile[] {
    const owners = check.check.files ?? check.configuration?.files;
    const children = check.check.runs === 'scope' ? listChildScopes(scopes, check.scope) : [];
    const files = check.files.filter((file) => children.every((child) => !isInScope(file.path, child)));
    return owners === undefined
        ? []
        : listCoveredFiles(owners, files, {
              configurations: check.scope.configurations,
              scopePath: check.scope.folder.path,
              settings: check.scope.settings,
          });
}

/**
 * Drop the files of a per-file check that its --ignore-path file ignores, and skip the check when no file remains.
 *
 * @param session the repository with its file cache.
 * @param check the plan to narrow.
 * @returns the check with fewer files, or skipped.
 */
export function stripToolIgnoredFiles(session: Session, check: PlannedCheck): PlannedCheck {
    if (check.skip !== undefined || check.check.runs !== 'files' || check.files.length === 0) return check;
    const toolIgnore = readToolIgnore(session, check);
    if (toolIgnore === undefined) return check;
    const files = check.files.filter((file) => !toolIgnore.matches(file.path));
    return files.length === 0
        ? { ...check, skip: { cause: 'ignore', note: `every selected path is ignored by ${toolIgnore.file}` } }
        : { ...check, files };
}

/**
 * List the scopes nested inside a scope. Their files belong to them, not to it.
 *
 * @param scopes the scopes of this run.
 * @param scope the parent scope.
 * @returns the child scope paths.
 */
export function listChildScopes(scopes: Scope[], scope: Scope): string[] {
    const own = scope.folder.path;
    return scopes
        .map((entry) => entry.folder.path)
        .filter((path) => path !== '' && path !== own && isInScope(path, own));
}

/**
 * Check whether a general per-file check runs once at the root. A check that reads a scope config file does not.
 *
 * @param configuration the configuration that declares the check.
 * @param check the check to inspect.
 * @returns true when the check runs once for the repository.
 */
export function isRootOnlyCheck(configuration: Configuration | undefined, check: Check): boolean {
    if (configuration === undefined) return true;
    if (configuration.group !== 'general' || configuration.files.languages || check.runs === 'scope') return false;
    const command = [...(check.command ?? []), ...(check.env === undefined ? [] : Object.values(check.env))];
    return !configuration.configFiles.some(
        (config) =>
            config.per_scope &&
            (config.check.includes(check.id) ||
                command.some((part) => part.includes(`{config_file:${extractConfigFileName(config.file)}}`))),
    );
}

/**
 * Select the files and deleted trigger paths of a planned check.
 *
 * @param planned the scope to plan.
 * @param known the check and its manifest.
 *
 * @returns the files and the trigger paths.
 */
export function selectCheckFiles(
    planned: PlannedScope,
    known: KnownCheck,
): Pick<PlannedCheck, 'files' | 'triggerPaths' | 'skip'> {
    const { scope, children } = planned;
    const { check, configuration } = known;
    const isRootCheck = check.runs === 'once' || check.runs === 'history';
    const scopePath = isRootCheck ? '' : scope.folder.path;
    const triggerPaths = listDeletedTriggers(planned, known, scopePath);
    const keepsChildScopes = check.runs !== 'files' || isRootOnlyCheck(configuration, check);
    let files =
        triggerPaths.length === 0
            ? listCheckFiles(planned, known, scopePath)
            : listScopeFiles(planned, scopePath, check.runs);
    if (!keepsChildScopes) files = files.filter((file) => children.every((child) => !isInScope(file.path, child)));
    if (check.runs === 'files')
        return { ...stripIgnoredFiles(filterNarrowedFiles(planned, known, files), check, scope), triggerPaths };
    const selected = stripIgnoredFiles(files, check, scope);
    return { ...selected, triggerPaths };
}
