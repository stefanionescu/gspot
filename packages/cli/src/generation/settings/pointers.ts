// A pointer, such as eslint.config.mjs, sits where a tool or editor looks by default, and loads the real
// tool file in .gspot.
import { isDeepStrictEqual } from 'node:util';
import { parseJsonFile } from '#cli/parsers/json.ts';
import type { Session } from '#cli/types/session.ts';
import { posix, dirname, relative } from 'node:path';
import { openFiles } from '#cli/system/files/open.ts';
import { formatHeader } from '#cli/generation/header.ts';
import type { ManagedKeys } from '#cli/types/ownership.ts';
import type { ToolFile } from '#cli/types/configurations.ts';
import { buildPathMatcher } from '#cli/repository/matchers.ts';
import { listCoveredFiles } from '#cli/repository/covered-files.ts';
import { getToolFileTarget } from '#cli/generation/settings/needed.ts';
import { listScopeChecks, listNeededTools } from '#cli/planning/needed-tools.ts';
import { isInScope, joinScope, listNestedScopes } from '#cli/repository/scopes.ts';
import { convertToPosixPath, extractParentFolder, includeParentFolders } from '#cli/system/paths.ts';
import type { GeneratedFile, ToolFileOwner, PlannedPointerField } from '#cli/types/generation/files.ts';
import { TARGET_PLACEHOLDER, TARGET_JSON_PLACEHOLDER, TARGET_MODULE_PLACEHOLDER } from '#cli/config/placeholders.ts';

/**
 * Resolve target placeholders in pointer text.
 *
 * @param body the body text.
 * @param pointerPath the pointer file.
 * @param targetPath the generated tool file.
 *
 * @returns the text with quoted module and JSON paths preserved.
 */
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
        return placeholder === TARGET_JSON_PLACEHOLDER ? JSON.stringify(target) : target;
    });
}

/**
 * Name the tool file relative to its pointer, with the local-module prefix.
 *
 * @param pointerPath the path of the pointer file.
 * @param targetPath the generated tool file.
 * @returns a relative path that tool loaders read on every system.
 */
function buildRelativeTarget(pointerPath: string, targetPath: string): string {
    const relativePath = convertToPosixPath(relative(dirname(pointerPath), targetPath));
    return relativePath.startsWith('./') || relativePath.startsWith('../') ? relativePath : `./${relativePath}`;
}

/**
 * Build a pointer: the header, then the body with the target placeholder filled.
 *
 * @param pointer the pointer that the manifest declares.
 * @param pointerPath where the pointer goes.
 * @param targetPath the generated tool file.
 * @returns the path and text of the pointer.
 */
function buildPointerFile(
    pointer: NonNullable<ToolFile['pointer']>,
    pointerPath: string,
    targetPath: string,
): GeneratedFile {
    const body = fillTarget(pointer.body, pointerPath, targetPath);
    const ended = body.endsWith('\n') ? body : `${body}\n`;
    const notes = [`The tool file is ${targetPath}.`, ...(pointer.note === undefined ? [] : [pointer.note])];
    return {
        path: pointerPath,
        content: `${formatHeader(pointerPath, notes)}${ended}`,
    };
}

/**
 * List the paths where a tool file puts its pointer: one path, or one in each folder that holds files of the
 * configuration and matches pointer.folders.
 *
 * @param owner the repository and the scope.
 * @param toolFile the tool file from the manifest.
 * @returns each path where the pointer goes, from the repository root.
 */
export function listPointerPaths(owner: ToolFileOwner, toolFile: ToolFile): string[] {
    const { scope, configuration } = owner;
    const { scopes, repository } = owner.session;
    const { pointer } = toolFile;
    if (pointer === undefined) return [];
    const scopePath = scope.folder.path;
    if (pointer.folders === undefined) return [toolFile.per_scope ? joinScope(scopePath, pointer.path) : pointer.path];
    const children = listNestedScopes(
        scopes.map((entry) => entry.folder.path),
        scopePath,
    );
    const matches = buildPathMatcher(pointer.folders);
    const owned = listCoveredFiles(configuration.files, repository.files, {
        configurations: scope.configurations,
        scopePath: '',
        settings: scope.settings,
    }).filter((file) => isInScope(file.path, scopePath) && children.every((child) => !isInScope(file.path, child)));
    const folders = new Set(
        owned.flatMap(({ path }) =>
            [...includeParentFolders([extractParentFolder(path)])]
                .filter((folder) => folder !== '' && matches(folder))
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
    targets,
    scopePaths,
}: PlannedPointerField) {
    return (tool.replace_key ?? [])
        .filter((replacement) => replacement.pointer === true)
        .flatMap((replacement) =>
            configuration.toolFiles
                .map((file) => ({ file, target: getToolFileTarget(scope.folder.path, file, targets) }))
                .filter(
                    ({ file, target }) =>
                        file.tool.includes(tool.name) && (!file.per_scope || consumed || !paths.has(target)),
                )
                .map(({ file, target }) => {
                    const scopePath = file.per_scope ? scope.folder.path : '';
                    const children = file.per_scope ? listNestedScopes(scopePaths, scopePath) : [];
                    const pointerPath = file.pointer === undefined ? target : joinScope(scopePath, file.pointer.path);
                    const pointerTarget = paths.has(pointerPath) ? pointerPath : (file.pointer?.path ?? target);
                    return {
                        key: replacement.key,
                        scope: scopePath,
                        children,
                        target: pointerTarget,
                    };
                }),
        );
}

/**
 * Point the package fields that manifests declare at the generated tool files.
 *
 * @param session the repository files and scopes.
 * @param generated the tool files that this run generates.
 * @param targets the tool file path for each scope and tool file.
 * @returns changes to the declared package fields.
 */
export function buildPointerFieldEdits(
    session: Session,
    generated: GeneratedFile[],
    targets: PlannedPointerField['targets'],
): ManagedKeys[] {
    const { root, repository, scopes } = session;
    const paths = new Set(generated.map(({ path }) => path));
    const scopePaths = scopes.map(({ folder }) => folder.path);
    const tools = scopes.flatMap((scope) => {
        const required = new Set(listScopeChecks(session, scope).flatMap((check) => listNeededTools(check)));
        return scope.configurations.flatMap((configuration) =>
            configuration.tools.map((tool) => ({ scope, configuration, tool, consumed: required.has(tool.name) })),
        );
    });
    const pointerTargets = tools.flatMap((selected) =>
        listPointerFieldTargets({ ...selected, paths, targets, scopePaths }),
    );
    const pointerFields = new Map(pointerTargets.map((row) => [JSON.stringify([row.key, row.scope, row.target]), row]));
    if (pointerFields.size === 0) return [];
    const packages = new Set([
        'package.json',
        ...repository.files
            .filter((file) => file.kind === 'source' && posix.basename(file.path) === 'package.json')
            .map(({ path }) => path),
    ]);
    using files = openFiles(root);
    return [...packages].flatMap((path) => {
        const source = files.read(path);
        if (source === undefined) return [];
        const document = parseJsonFile(path, source.bytes.toString('utf8'));
        const keys = [...pointerFields.values()]
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
            }));
        return keys.length === 0 ? [] : [{ path, keys }];
    });
}

/**
 * Build the pointers of one generated tool file.
 *
 * @param owner the repository and the scope.
 * @param toolFile the shipped tool file.
 * @param target the tool file path.
 * @returns the pointer files for the tool file.
 */
export function buildPointerFiles(owner: ToolFileOwner, toolFile: ToolFile, target: string): GeneratedFile[] {
    const { pointer } = toolFile;
    if (pointer === undefined) return [];
    return listPointerPaths(owner, toolFile).map((path) => buildPointerFile(pointer, path, target));
}
