import { isUtf8 } from 'node:buffer';
import { posix } from 'node:path';

import { BYTES_PER_KILOBYTE, FILES_PLACEHOLDER, IGNORED_PATHS_MESSAGE, ROOT_RUNS } from '#cli/config/engine.ts';
import { SETTINGS_FILE, SYMLINK_MODE } from '#cli/config/repository/files.ts';
import { isGspotPath } from '#cli/repository/files/classify.ts';
import { listCoveredFiles, listCoveredPaths } from '#cli/repository/files/selection.ts';
import { isOutsideChildScopes, joinScope, listNestedScopes, selectScope } from '#cli/repository/scopes.ts';
import { getTable, listIgnores } from '#cli/settings/scopes.ts';
import { readBytes } from '#cli/system/files/reads.ts';
import { buildPathMatcher } from '#cli/system/matchers.ts';
import { isInScope } from '#cli/system/paths.ts';
import type { PlanInventory, PlannedCheck, PlannedScope } from '#cli/types/engine/plan.ts';
import type { Check, Configuration } from '#cli/types/manifests.ts';
import type { TrackedFile } from '#cli/types/repository.ts';
import type { Scope } from '#cli/types/settings.ts';
import type { ScopeCheck } from '#cli/types/tools.ts';

function listScopeFiles(planned: PlannedScope, scopePath: string, runs: Check['runs']): TrackedFile[] {
    const { inventory, session, children } = planned;
    let files = inventory.scopeFiles.get(scopePath);
    if (files === undefined) {
        const prefix = joinScope(scopePath, '');
        files = session.repository.files.filter((file) => file.path.startsWith(prefix));
        inventory.scopeFiles.set(scopePath, files);
    }
    if (runs !== 'scope') return files;
    let own = inventory.ownFiles.get(scopePath);
    if (own === undefined) {
        own = files.filter((file) => isOutsideChildScopes(file.path, children));
        inventory.ownFiles.set(scopePath, own);
    }
    return own;
}

function listTestedFiles(planned: PlannedScope, scopePath: string, runs: Check['runs']): TrackedFile[] {
    const { narrowedFiles } = planned.inventory;
    if (narrowedFiles === undefined) return listScopeFiles(planned, scopePath, runs);
    return narrowedFiles.filter(
        (file) =>
            isInScope(file.path, scopePath) && (runs !== 'scope' || isOutsideChildScopes(file.path, planned.children)),
    );
}

function listProjectMatches(
    planned: PlannedScope,
    { check, configuration }: ScopeCheck,
    { scopeFiles, scopePath }: { scopeFiles: TrackedFile[]; scopePath: string },
): TrackedFile[] {
    const { scope } = planned;
    const owners = check.files ?? (configuration?.group === 'language' ? configuration.files : undefined);
    const projectFiles =
        configuration === undefined ? scopeFiles : scopeFiles.filter((file) => !isGspotPath(file.path));
    return owners === undefined
        ? projectFiles
        : listCoveredFiles(owners, projectFiles, {
              configurations: scope.configurations,
              scopePath,
              settings: scope.settings,
          });
}

function listProjectCheckFiles(planned: PlannedScope, scopeCheck: ScopeCheck, scopePath: string): TrackedFile[] {
    const { check } = scopeCheck;
    const testedFiles = listTestedFiles(planned, scopePath, check.runs);
    const matches = listProjectMatches(planned, scopeCheck, { scopeFiles: testedFiles, scopePath });
    const { files } = stripIgnoredFiles(matches, check, planned.scope);
    if (listNarrowedFiles(planned, scopeCheck, files).length === 0) return [];
    const scopeFiles = listScopeFiles(planned, scopePath, check.runs);
    return check.runs === 'scope' || check.binary_files === true
        ? scopeFiles
        : scopeFiles.filter((file) => file.kind !== 'binary');
}

function listRunFiles(planned: PlannedScope, scopeCheck: ScopeCheck, scopePath: string): TrackedFile[] {
    const { scope } = planned;
    const { check, configuration } = scopeCheck;
    if (check.runs !== 'files') return listProjectCheckFiles(planned, scopeCheck, scopePath);
    const testedFiles = listTestedFiles(planned, scopePath, check.runs);
    if (configuration !== undefined) return listCheckFiles({ scope, files: testedFiles }, check.id);
    const isMatch = buildPathMatcher(check.files?.paths ?? []);
    return testedFiles.filter((file) => isMatch(file.path));
}

function stripIgnoredFiles<File extends Pick<TrackedFile, 'path'>>(
    files: File[],
    check: Check,
    scope: Scope,
): { files: File[]; skip?: PlannedCheck['skip'] } {
    const paths = listIgnores(scope.settings, check.id).flatMap((ignore) =>
        ignore.rule === undefined ? (ignore.paths ?? []) : [],
    );
    const isIgnored = buildPathMatcher(paths);
    const selected = files.filter((file) => !isIgnored(file.path));
    return {
        files: selected,
        ...(files.length > 0 &&
            selected.length === 0 && { skip: { cause: 'ignore' as const, note: IGNORED_PATHS_MESSAGE } }),
    };
}

function listNarrowedFiles(planned: PlannedScope, scopeCheck: ScopeCheck, files: TrackedFile[]): TrackedFile[] {
    const { narrowedPaths, inventory } = planned;
    if (narrowedPaths === undefined || inventory.narrowedFiles === undefined) return files;
    const inNarrowed = files.filter((file) => narrowedPaths.has(file.path));
    if (inNarrowed.length === 0) return [];
    return scopeCheck.check.runs === 'files' ? inNarrowed : files;
}

function listDeletedTriggers(planned: PlannedScope, scopeCheck: ScopeCheck, scopePath: string): string[] {
    const { check, configuration } = scopeCheck;
    if (check.runs === 'files' || planned.narrowedPaths === undefined) return [];
    const { inventory, children, scope } = planned;
    const paths = [...planned.narrowedPaths].filter(
        (path) =>
            !inventory.trackedPaths.has(path) &&
            (configuration === undefined || !isGspotPath(path)) &&
            isInScope(path, scopePath) &&
            (check.runs !== 'scope' || isOutsideChildScopes(path, children)),
    );
    const owners = check.files ?? (configuration?.group === 'language' ? configuration.files : undefined);
    if (owners === undefined) return paths;
    const covered = listCoveredPaths(owners, paths, {
        configurations: scope.configurations,
        scopePath,
        settings: scope.settings,
    });
    return stripIgnoredFiles(
        covered.map((path) => ({ path })),
        check,
        scope,
    ).files.map((file) => file.path);
}

function listReadableFiles(planned: PlannedScope, check: Check, files: TrackedFile[]): TrackedFile[] {
    if (check.binary_files === true) return files;
    return files.filter((file) => {
        if (
            check.large_files !== true &&
            file.size >
                getTable(selectScope(file.path, planned.session.scopes).settings, 'repository').max_file_kilobytes *
                    BYTES_PER_KILOBYTE
        )
            return false;
        if (!file.tags.includes('text') || file.tags.includes('symlink')) return true;
        file.isUtf8 ??= isUtf8(readBytes(planned.session.cache, file.path));
        return file.isUtf8;
    });
}

function listToolFiles(
    planned: PlannedScope,
    scopeCheck: ScopeCheck,
    { files, scopePath }: { files: TrackedFile[]; scopePath: string },
): TrackedFile[] {
    const { check } = scopeCheck;
    const hasFileList = check.command?.some((argument) => FILES_PLACEHOLDER.test(argument)) === true;
    let selected = files;
    if (check.runs === 'files') selected = listNarrowedFiles(planned, scopeCheck, files);
    else if (hasFileList) selected = listProjectMatches(planned, scopeCheck, { scopeFiles: files, scopePath });
    const readable = listReadableFiles(planned, check, selected);
    return check.command === undefined ? readable : readable.filter((file) => !file.tags.includes('symlink'));
}

function addNarrowedLinks(
    { narrowedPaths, session }: PlannedScope,
    check: Check,
    selection: Pick<PlannedCheck, 'files' | 'triggerPaths' | 'skip'>,
): Pick<PlannedCheck, 'files' | 'triggerPaths' | 'skip' | 'narrowedLinks'> {
    if (narrowedPaths === undefined || check.symlink_files !== true) return selection;
    const narrowedLinks = session.repository.index
        .filter(({ path, mode }) => mode === SYMLINK_MODE && narrowedPaths.has(path))
        .map(({ path }) => path);
    return { ...selection, triggerPaths: [...selection.triggerPaths, ...narrowedLinks], narrowedLinks };
}

/**
Index the tracked files once per plan: their paths, the tracked files among the narrowed paths, and the files under
each scope folder. A change to gspot.toml or to a gspot file leaves the narrowed files out, so every check plans its
whole scope, because such a change can change what every check reads.

@param files the tracked files of the session.
@param narrowedPaths the paths that the run narrows to, if any.
*/
export function buildPlanInventory(
    files: TrackedFile[],
    narrowedPaths: ReadonlySet<string> | undefined,
): PlanInventory {
    const isNarrowed =
        narrowedPaths !== undefined &&
        !narrowedPaths.has(SETTINGS_FILE) &&
        narrowedPaths.values().every((path) => !isGspotPath(path));
    return {
        trackedPaths: new Set(files.map(({ path }) => path)),
        narrowedFiles: isNarrowed ? files.filter((file) => narrowedPaths.has(file.path)) : undefined,
        scopeFiles: new Map(),
        ownFiles: new Map(),
    };
}

/**
Get the name that a config-file placeholder uses for a config file.

@param file the path that the manifest names.
@returns the file name without its folder and extensions.
*/
export function extractConfigName(file: string): string {
    const name = posix.basename(file);
    const dot = name.indexOf('.');
    return dot === -1 ? name : name.slice(0, dot);
}

/**
List the files that the configurations of a check own, apart from the files of a project-wide run.

@param scopes every scope of the session; a scope-wide run leaves out the files of its child scopes.
@param planned the plan to read.
*/
export function listCheckedFiles(scopes: Scope[], planned: PlannedCheck): TrackedFile[] {
    const owners = planned.check.files ?? planned.configuration?.files;
    const children =
        planned.check.runs === 'scope'
            ? listNestedScopes(
                  scopes.map(({ path }) => path),
                  planned.scope.path,
              )
            : [];
    const files = planned.files.filter((file) => isOutsideChildScopes(file.path, children));
    return owners === undefined ||
        [owners.extensions, owners.filenames, owners.paths, owners.tags, owners.languages].every((values) =>
            Array.isArray(values) ? values.length === 0 : !values,
        )
        ? files
        : listCoveredFiles(owners, files, {
              configurations: planned.scope.configurations,
              scopePath: planned.scope.path,
              settings: planned.scope.settings,
          });
}

/**
Check whether a check runs once for the whole repository.

@param check the check to inspect.
*/
export function isRepositoryRun(check: Pick<Check, 'runs'>): boolean {
    return (ROOT_RUNS as readonly string[]).includes(check.runs);
}

/**
Check whether a general per-file check runs once at the root. A check that reads a scope config file does not.

@param configuration the configuration that declares the check.
@param check the check to inspect.
*/
export function isRootOnlyCheck(configuration: Configuration | undefined, check: Check): boolean {
    if (configuration === undefined) return true;
    if (configuration.group !== 'general' || configuration.files.languages || check.runs === 'scope') return false;
    const command = [...(check.command ?? []), ...(check.env === undefined ? [] : Object.values(check.env))];
    return configuration.configs.every(
        (config) =>
            !(
                config.per_scope &&
                (config.check.includes(check.id) ||
                    command.some((argument) => argument.includes(`{config_file:${extractConfigName(config.file)}}`)))
            ),
    );
}

/**
Select the files and deleted trigger paths of a planned check. A check that runs once or per scope plans every file of
its scope, apart from a check whose command takes `{files}`: that tool reads only the files that the check covers.

@param planned the scope to plan.
@param scopeCheck the check and its manifest.
*/
export function selectCheckFiles(
    planned: PlannedScope,
    scopeCheck: ScopeCheck,
): Pick<PlannedCheck, 'files' | 'triggerPaths' | 'skip' | 'narrowedLinks'> {
    const { scope, children } = planned;
    const { check, configuration } = scopeCheck;
    const scopePath = isRepositoryRun(check) ? '' : scope.path;
    const triggerPaths = listDeletedTriggers(planned, scopeCheck, scopePath);
    const isKeepingChildScopes = check.runs !== 'files' || isRootOnlyCheck(configuration, check);
    let files =
        triggerPaths.length === 0
            ? listRunFiles(planned, scopeCheck, scopePath)
            : listScopeFiles(planned, scopePath, check.runs);
    files = listToolFiles(planned, scopeCheck, { files, scopePath });
    if (!isKeepingChildScopes) files = files.filter((file) => isOutsideChildScopes(file.path, children));
    const unreadablePaths = check.binary_files === true ? planned.session.repository.unreadablePaths : [];
    return addNarrowedLinks(planned, check, {
        ...stripIgnoredFiles(files, check, scope),
        triggerPaths: [...triggerPaths, ...unreadablePaths],
    });
}

/**
List the files that a check of the selected configurations covers.

@param planned the scope and its candidate files.
@param checkId the declaration whose coverage to apply.
*/
export function listCheckFiles(planned: Pick<PlannedCheck, 'scope' | 'files'>, checkId: string): TrackedFile[] {
    return planned.scope.configurations.flatMap((configuration) =>
        configuration.checks
            .filter((check) => check.id === checkId)
            .flatMap((check) =>
                listCoveredFiles(check.files ?? configuration.files, planned.files, {
                    configurations: planned.scope.configurations,
                    scopePath: planned.scope.path,
                    settings: planned.scope.settings,
                }),
            ),
    );
}
