import { isDeepStrictEqual } from 'node:util';
import type { Session } from '#cli/types/session.ts';
import { posix, dirname, relative } from 'node:path';
import { openFiles } from '#cli/system/files/open.ts';
import { listCheckTools } from '#cli/planning/tools.ts';
import { formatHeader } from '#cli/generation/header.ts';
import { GSPOT_FOLDER } from '#cli/config/gspot-folder.ts';
import { buildPathMatcher } from '#cli/system/matchers.ts';
import { parseJsonFile } from '#cli/parsers/formats/json.ts';
import type { ConfigFile } from '#cli/types/configurations.ts';
import type { ManagedKeys } from '#cli/types/repository/writer.ts';
import { readConfigurations } from '#cli/configurations/manifests.ts';
import { listCoveredFiles } from '#cli/repository/files/selection.ts';
import { PACKAGE_JSON } from '#cli/config/parsers/projects/dependencies.ts';
import { GITHUB_WORKFLOW, GITLAB_WORKFLOW } from '#cli/config/generation/ci.ts';
import { getConfigFileTarget } from '#cli/generation/config-files/selection.ts';
import { isInScope, joinScope, listNestedScopes } from '#cli/repository/scopes.ts';
import { convertToPosixPath, extractParentFolder, includeParentFolders } from '#cli/system/paths.ts';
import type { GeneratedFile, ConfigFileOwner, PlannedPointerField } from '#cli/types/generation/files.ts';
import { TARGET_PLACEHOLDER, TARGET_MODULE_PLACEHOLDER } from '#cli/config/generation/config-files/pointers.ts';

function fillTarget(body: string, pointerPath: string, targetPath: string): string {
    const relativePath = convertToPosixPath(relative(dirname(pointerPath), targetPath));
    const target = relativePath.startsWith('./') || relativePath.startsWith('../') ? relativePath : `./${relativePath}`;
    return body.replaceAll(TARGET_PLACEHOLDER, (placeholder) => {
        if (placeholder === TARGET_MODULE_PLACEHOLDER) {
            return JSON.stringify(
                target
                    .split('/')
                    .map((segment) => encodeURIComponent(segment))
                    .join('/'),
            );
        }
        return JSON.stringify(target);
    });
}

/**
List the paths where a config file puts its pointer: one path, or one in each folder that holds files of the
configuration and matches pointer.folders.

@param owner the repository and the scope.
@param configFile the config file from the manifest.
@returns each path where the pointer goes, from the repository root.
*/
export function listPointerPaths(owner: ConfigFileOwner, configFile: ConfigFile): string[] {
    const { scope, configuration } = owner;
    const { scopes, repository } = owner.session;
    const { pointer } = configFile;
    if (pointer === undefined) return [];
    const scopePath = scope.path;
    if (pointer.folders === undefined)
        return [configFile.per_scope ? joinScope(scopePath, pointer.path) : pointer.path];
    const children = listNestedScopes(
        scopes.map((each) => each.path),
        scopePath,
    );
    const isMatch = buildPathMatcher(pointer.folders);
    const owned = listCoveredFiles(configuration.files, repository.files, {
        configurations: scope.configurations,
        scopePath: '',
        settings: scope.settings,
    }).filter((file) => isInScope(file.path, scopePath) && children.every((child) => !isInScope(file.path, child)));
    const folders = new Set(
        owned.flatMap(({ path }) =>
            [...includeParentFolders([extractParentFolder(path)])]
                .filter((folder) => folder !== '' && isMatch(folder))
                .toSorted((left, right) => left.length - right.length)
                .slice(0, 1)
                .map((folder) => (isInScope(folder, scopePath) ? folder : scopePath)),
        ),
    );
    return [...folders].map((folder) => `${folder}/${pointer.path}`);
}

/**
List every path outside .gspot/ that gspot can write. Include manifest targets and pointers at each scope root and pointer folder, and both CI workflow paths.

@param session the scopes and the configurations.
@returns the paths, from the repository root.
*/
export function listOwnablePaths(session: Session): Set<string> {
    const configFiles = session.scopes.flatMap((scope) =>
        readConfigurations()
            .values()
            .flatMap((configuration) =>
                configuration.configFiles.map((configFile) => ({
                    owner: { session, scope, configuration },
                    configFile,
                })),
            )
            .toArray(),
    );
    const paths = configFiles.flatMap(({ owner, configFile }) => [
        ...(configFile.source === undefined || configFile.target.startsWith(`${GSPOT_FOLDER}/`)
            ? []
            : [configFile.per_scope ? joinScope(owner.scope.path, configFile.target) : configFile.target]),
        ...listPointerPaths(owner, configFile),
    ]);
    return new Set([GITHUB_WORKFLOW, GITLAB_WORKFLOW, ...paths]);
}

function listPointerFieldTargets({
    scope,
    configuration,
    tool,
    consumed,
    paths,
    configFiles,
    scopePaths,
}: PlannedPointerField) {
    return (tool.replace_key ?? [])
        .filter((replacement) => replacement.pointer === true)
        .flatMap((replacement) =>
            configuration.configFiles
                .map((file) => ({ file, target: getConfigFileTarget(scope.path, file, configFiles) }))
                .filter(
                    ({ file, target }) =>
                        file.tool.includes(tool.name) && (!file.per_scope || consumed || !paths.has(target)),
                )
                .map(({ file, target }) => {
                    const scopePath = file.per_scope ? scope.path : '';
                    const children = file.per_scope ? listNestedScopes(scopePaths, scopePath) : [];
                    const pointerPath = file.pointer === undefined ? target : joinScope(scopePath, file.pointer.path);
                    return {
                        key: replacement.key,
                        scope: scopePath,
                        children,
                        target: pointerPath,
                    };
                }),
        );
}

function listPointerTools(session: Session) {
    return session.scopes.flatMap((scope) => {
        const required = new Set(
            session.configuredChecks
                .filter((planned) => planned.scope.path === scope.path || planned.check.runs === 'once')
                .flatMap((check) => listCheckTools(check)),
        );
        return readConfigurations()
            .values()
            .flatMap((configuration) =>
                configuration.tools.map((tool) => ({ scope, configuration, tool, consumed: required.has(tool.name) })),
            )
            .toArray();
    });
}

/**
Point the package fields that manifests declare at the generated config files.

@param session the repository files and scopes.
@param generated the config files that this run generates.
@param configFiles the config file path for each scope and config file.
*/
export function buildPointerFieldEdits(
    session: Session,
    generated: GeneratedFile[],
    configFiles: PlannedPointerField['configFiles'],
): ManagedKeys[] {
    const { root, repository, scopes } = session;
    const paths = new Set(generated.map(({ path }) => path));
    const scopePaths = scopes.map(({ path }) => path);
    const tools = listPointerTools(session);
    const pointerTargets = tools.flatMap((selected) =>
        listPointerFieldTargets({ ...selected, paths, configFiles, scopePaths }),
    );
    const pointerFields = new Map(pointerTargets.map((row) => [JSON.stringify([row.key, row.scope, row.target]), row]));
    if (pointerFields.size === 0) return [];
    const packages = new Set([
        PACKAGE_JSON,
        ...repository.files
            .filter((file) => file.kind === 'source' && posix.basename(file.path) === PACKAGE_JSON)
            .map(({ path }) => path),
    ]);
    const files = openFiles(root);
    const edits: ManagedKeys[] = [];
    for (const path of packages) {
        const source = files.read(path);
        if (source === undefined) continue;
        const document = parseJsonFile(path, source.bytes.toString('utf8'));
        const keys = pointerFields
            .values()
            .map((row) => {
                const relativePath = convertToPosixPath(relative(dirname(path), row.target));
                return {
                    ...row,
                    extends:
                        relativePath.startsWith('./') || relativePath.startsWith('../')
                            ? relativePath
                            : `./${relativePath}`,
                };
            })
            .filter(
                (row) =>
                    Object.hasOwn(document, row.key) &&
                    isInScope(path, row.scope) &&
                    row.children.every((child) => !isInScope(path, child)) &&
                    (paths.has(row.target) || isDeepStrictEqual(document[row.key], { extends: row.extends })),
            )
            .map((row) => ({
                key: [row.key],
                value: paths.has(row.target) ? { extends: row.extends } : undefined,
            }))
            .toArray();
        if (keys.length > 0) edits.push({ path, keys });
    }
    return edits;
}

/**
Build the pointers of one generated config file.

@param owner the repository and the scope.
@param configFile the shipped config file.
@param target the config file path.
*/
export function buildPointerFiles(owner: ConfigFileOwner, configFile: ConfigFile, target: string): GeneratedFile[] {
    const { pointer } = configFile;
    return pointer === undefined
        ? []
        : listPointerPaths(owner, configFile).map((path) => ({
              path,
              content: `${formatHeader(path, pointer.note === undefined ? [] : [pointer.note])}${fillTarget(pointer.body, path, target)}`,
          }));
}
