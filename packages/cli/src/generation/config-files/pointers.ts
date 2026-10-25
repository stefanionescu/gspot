import { isDeepStrictEqual } from 'node:util';
import type { Session } from '#cli/types/session.ts';
import { posix, dirname, relative } from 'node:path';
import { openFiles } from '#cli/system/files/open.ts';
import type { ManagedKeys } from '#cli/types/write.ts';
import { formatHeader } from '#cli/generation/header.ts';
import { buildPathMatcher } from '#cli/system/matchers.ts';
import { parseJsonFile } from '#cli/parsers/formats/json.ts';
import type { ConfigFile } from '#cli/types/configurations.ts';
import { readConfigurations } from '#cli/configurations/manifests.ts';
import { listCoveredFiles } from '#cli/repository/files/selection.ts';
import { PACKAGE_JSON } from '#cli/config/parsers/projects/dependencies.ts';
import { listCheckTools, listConfiguredChecks } from '#cli/planning/tools.ts';
import { getConfigFileTarget } from '#cli/generation/config-files/selection.ts';
import { isInScope, joinScope, listNestedScopes } from '#cli/repository/scopes.ts';
import { convertToPosixPath, extractParentFolder, includeParentFolders } from '#cli/system/paths.ts';
import type { GeneratedFile, ConfigFileOwner, PlannedPointerField } from '#cli/types/generation/files.ts';
import { TARGET_PLACEHOLDER, TARGET_MODULE_PLACEHOLDER } from '#cli/config/generation/config-files/pointers.ts';

function fillTarget(body: string, pointerPath: string, targetPath: string): string {
    const target = buildRelativeTarget(pointerPath, targetPath);
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
Build the path from the folder of a file to a target, which starts with ./ or ../ so that a module import or an extends
field reads it as relative.

@param filePath the file that names the target, from the repository root.
@param targetPath the target, from the repository root.
@returns the relative path.
*/
// eslint-disable-next-line gspot/no-trivial-functions -- reason: 4 calls in 2 files share it.
export function buildRelativeTarget(filePath: string, targetPath: string): string {
    const relativePath = convertToPosixPath(relative(dirname(filePath), targetPath));
    return relativePath.startsWith('./') || relativePath.startsWith('../') ? relativePath : `./${relativePath}`;
}

function buildPointerFile(
    pointer: NonNullable<ConfigFile['pointer']>,
    pointerPath: string,
    targetPath: string,
): GeneratedFile {
    const body = fillTarget(pointer.body, pointerPath, targetPath);
    const notes = [`The config file is ${targetPath}.`, ...(pointer.note === undefined ? [] : [pointer.note])];
    return {
        path: pointerPath,
        content: `${formatHeader(pointerPath, notes)}${body}`,
    };
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
    const scopePath = scope.folder.path;
    if (pointer.folders === undefined)
        return [configFile.per_scope ? joinScope(scopePath, pointer.path) : pointer.path];
    const children = listNestedScopes(
        scopes.map((each) => each.folder.path),
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
                .toSorted((left, right) => right.length - left.length)
                .map((folder) => (isInScope(folder, scopePath) ? folder : scopePath)),
        ),
    );
    return [...folders].map((folder) => `${folder}/${pointer.path}`);
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
                .map((file) => ({ file, target: getConfigFileTarget(scope.folder.path, file, configFiles) }))
                .filter(
                    ({ file, target }) =>
                        file.tool.includes(tool.name) && (!file.per_scope || consumed || !paths.has(target)),
                )
                .map(({ file, target }) => {
                    const scopePath = file.per_scope ? scope.folder.path : '';
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

/**
Point the package fields that manifests declare at the generated config files.

@param session the repository files and scopes.
@param generated the config files that this run generates.
@param configFiles the config file path for each scope and config file.
@returns changes to the declared package fields.
*/
export function buildPointerFieldEdits(
    session: Session,
    generated: GeneratedFile[],
    configFiles: PlannedPointerField['configFiles'],
): ManagedKeys[] {
    const { root, repository, scopes } = session;
    const paths = new Set(generated.map(({ path }) => path));
    const scopePaths = scopes.map(({ folder }) => folder.path);
    const tools = scopes.flatMap((scope) => {
        const required = new Set(listConfiguredChecks(session, scope).flatMap((check) => listCheckTools(check)));
        return readConfigurations()
            .values()
            .flatMap((configuration) =>
                configuration.tools.map((tool) => ({ scope, configuration, tool, consumed: required.has(tool.name) })),
            )
            .toArray();
    });
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
    using files = openFiles(root);
    const edits: ManagedKeys[] = [];
    for (const path of packages) {
        const source = files.read(path);
        if (source === undefined) continue;
        const document = parseJsonFile(path, source.bytes.toString('utf8'));
        const keys = pointerFields
            .values()
            .filter(
                (row) =>
                    Object.hasOwn(document, row.key) &&
                    isInScope(path, row.scope) &&
                    row.children.every((child) => !isInScope(path, child)) &&
                    (paths.has(row.target) ||
                        isDeepStrictEqual(document[row.key], { extends: buildRelativeTarget(path, row.target) })),
            )
            .map((row) => ({
                key: [row.key],
                value: paths.has(row.target) ? { extends: buildRelativeTarget(path, row.target) } : undefined,
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
@returns the pointer files for the config file.
*/
export function buildPointerFiles(owner: ConfigFileOwner, configFile: ConfigFile, target: string): GeneratedFile[] {
    const { pointer } = configFile;
    return pointer === undefined
        ? []
        : listPointerPaths(owner, configFile).map((path) => buildPointerFile(pointer, path, target));
}
