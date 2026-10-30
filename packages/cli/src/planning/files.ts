import { isUtf8 } from 'node:buffer';
import { readBytes } from '#cli/system/files/reads.ts';
import { BYTES_PER_KILOBYTE } from '#cli/config/units.ts';
import { GSPOT_FOLDER } from '#cli/config/gspot-folder.ts';
import { ROOT_RUNS } from '#cli/config/planning/checks.ts';
import { buildPathMatcher } from '#cli/system/matchers.ts';
import { SETTINGS_FILE } from '#cli/config/settings/file.ts';
import { extractConfigFileName } from '#cli/manifests/tools.ts';
import { getTable, listIgnores } from '#cli/settings/scopes.ts';
import type { Scope } from '#cli/types/settings/inheritance.ts';
import { classifyFile } from '#cli/repository/files/classify.ts';
import type { TrackedFile } from '#cli/types/repository/files.ts';
import type { PlannedCheck, PlannedScope } from '#cli/types/planning.ts';
import type { Check, ScopeCheck, Configuration } from '#cli/types/manifests.ts';
import { listCheckFiles, listCoveredFiles } from '#cli/repository/files/selection.ts';
import { isInScope, joinScope, selectScopePath, listNestedScopes } from '#cli/repository/scopes.ts';
import { ENCODING_CHECK, LARGE_FILES_CHECK, IGNORED_PATHS_MESSAGE } from '#cli/config/planning/files.ts';

function listScopeFiles(planned: PlannedScope, scopePath: string, runs: Check['runs']): TrackedFile[] {
    const prefix = joinScope(scopePath, '');
    return planned.session.repository.files.filter(
        (file) =>
            file.path.startsWith(prefix) &&
            (runs !== 'scope' || planned.children.every((child) => !isInScope(file.path, child))),
    );
}

function listProjectCheckFiles(planned: PlannedScope, scopeCheck: ScopeCheck, scopePath: string): TrackedFile[] {
    const { check, configuration } = scopeCheck;
    const { scope } = planned;
    const owners = check.files ?? (configuration?.group === 'language' ? configuration.files : undefined);
    const scopeFiles = listScopeFiles(planned, scopePath, check.runs);
    const projectFiles =
        configuration === undefined
            ? scopeFiles
            : scopeFiles.filter((file) => !file.path.startsWith(`${GSPOT_FOLDER}/`));
    const matches =
        owners === undefined
            ? projectFiles
            : listCoveredFiles(owners, projectFiles, {
                  configurations: scope.configurations,
                  scopePath,
                  settings: scope.settings,
              });
    if (filterNarrowedFiles(planned, scopeCheck, stripIgnoredFiles(matches, check, scope).files).length === 0)
        return [];
    return [check.runs, check.id].some((value) => ['scope', LARGE_FILES_CHECK, ENCODING_CHECK].includes(value))
        ? scopeFiles
        : scopeFiles.filter((file) => file.kind !== 'binary');
}

function listRunFiles(planned: PlannedScope, scopeCheck: ScopeCheck, scopePath: string): TrackedFile[] {
    const { session, scope } = planned;
    const { check, configuration } = scopeCheck;
    if (check.runs !== 'files') return listProjectCheckFiles(planned, scopeCheck, scopePath);
    if (configuration !== undefined) return listCheckFiles({ scope, files: session.repository.files }, check.id);
    const isMatch = buildPathMatcher(check.files?.paths ?? []);
    return session.repository.files.filter((file) => isMatch(file.path));
}

function stripIgnoredFiles(files: TrackedFile[], check: Check, scope: Scope): Pick<PlannedCheck, 'files' | 'skip'> {
    const paths = listIgnores(scope.settings, check.id).flatMap((ignore) =>
        ignore.rule === undefined ? ignore.paths : [],
    );
    const isIgnored = buildPathMatcher(paths);
    const selected = files.filter((file) => !isIgnored(file.path));
    return {
        files: selected,
        ...(files.length > 0 && selected.length === 0
            ? { skip: { cause: 'ignore' as const, note: IGNORED_PATHS_MESSAGE } }
            : {}),
    };
}

function filterNarrowedFiles(planned: PlannedScope, scopeCheck: ScopeCheck, files: TrackedFile[]): TrackedFile[] {
    const { narrowedPaths } = planned;
    if (!narrowedPaths) return files;
    const isTouched =
        narrowedPaths.has(SETTINGS_FILE) || narrowedPaths.values().some((path) => path.startsWith(`${GSPOT_FOLDER}/`));
    if (isTouched) return files;
    const inNarrowed = files.filter((file) => narrowedPaths.has(file.path));
    if (inNarrowed.length === 0) return [];
    return scopeCheck.check.runs === 'files' ? inNarrowed : files;
}

function listDeletedTriggers(planned: PlannedScope, scopeCheck: ScopeCheck, scopePath: string): string[] {
    const { check, configuration } = scopeCheck;
    if (check.runs === 'files' || planned.narrowedPaths === undefined) return [];
    const { session, children, scope } = planned;
    const readable = new Set(session.repository.files.map((file) => file.path));
    const paths = [...planned.narrowedPaths].filter(
        (path) =>
            !readable.has(path) &&
            (configuration === undefined || !path.startsWith(`${GSPOT_FOLDER}/`)) &&
            isInScope(path, scopePath) &&
            (check.runs !== 'scope' || children.every((child) => !isInScope(path, child))),
    );
    const owners = check.files ?? configuration?.files;
    if (owners === undefined) return paths;
    const missing = paths.map((path): TrackedFile => {
        const listedFile = { path, size: 0, executable: false, isSymlink: false };
        const prefix = Buffer.alloc(0);
        return classifyFile(session.root, listedFile, prefix, {
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
    const files = planned.files.filter((file) => children.every((child) => !isInScope(file.path, child)));
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
Check whether a general per-file check runs once at the root. A check that reads a scope config file does not.

@param configuration the configuration that declares the check.
@param check the check to inspect.
*/
export function isRootOnlyCheck(configuration: Configuration | undefined, check: Check): boolean {
    if (configuration === undefined) return true;
    if (configuration.group !== 'general' || configuration.files.languages || check.runs === 'scope') return false;
    const command = [...(check.command ?? []), ...(check.env === undefined ? [] : Object.values(check.env))];
    return !configuration.configFiles.some(
        (config) =>
            config.per_scope &&
            (config.check.includes(check.id) ||
                command.some((argument) => argument.includes(`{config_file:${extractConfigFileName(config.file)}}`))),
    );
}

function filterReadableFiles(planned: PlannedScope, check: Check, files: TrackedFile[]): TrackedFile[] {
    if (check.id === LARGE_FILES_CHECK) return files;
    const scopes = planned.session.scopes;
    return files.filter((file) => {
        const owner = selectScopePath(file.path, scopes);
        const scope = scopes.find((scope) => scope.path === owner) as Scope;
        if (file.size > getTable(scope.settings, 'repository').max_file_kilobytes * BYTES_PER_KILOBYTE) return false;
        return (
            check.id === ENCODING_CHECK ||
            !file.tags.includes('text') ||
            file.tags.includes('symlink') ||
            isUtf8(readBytes(planned.session.reads, file.path))
        );
    });
}

/**
Select the files and deleted trigger paths of a planned check.

@param planned the scope to plan.
@param scopeCheck the check and its manifest.
*/
export function selectCheckFiles(
    planned: PlannedScope,
    scopeCheck: ScopeCheck,
): Pick<PlannedCheck, 'files' | 'triggerPaths' | 'skip'> {
    const { scope, children } = planned;
    const { check, configuration } = scopeCheck;
    const isRootCheck = (ROOT_RUNS as readonly string[]).includes(check.runs);
    const scopePath = isRootCheck ? '' : scope.path;
    const triggerPaths = listDeletedTriggers(planned, scopeCheck, scopePath);
    const keepsChildScopes = check.runs !== 'files' || isRootOnlyCheck(configuration, check);
    let files =
        triggerPaths.length === 0
            ? listRunFiles(planned, scopeCheck, scopePath)
            : listScopeFiles(planned, scopePath, check.runs);
    files = filterReadableFiles(planned, check, files);
    if (!keepsChildScopes) files = files.filter((file) => children.every((child) => !isInScope(file.path, child)));
    if (check.runs === 'files')
        return { ...stripIgnoredFiles(filterNarrowedFiles(planned, scopeCheck, files), check, scope), triggerPaths };
    const selected = stripIgnoredFiles(files, check, scope);
    if (check.id === ENCODING_CHECK) triggerPaths.push(...planned.session.repository.unreadablePaths);
    return { ...selected, triggerPaths };
}
