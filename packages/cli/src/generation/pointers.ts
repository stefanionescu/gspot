import { isDeepStrictEqual } from 'node:util';
import { parseJsonFile } from '#cli/parsers/json.ts';
import { posix, dirname, relative } from 'node:path';
import { openFiles } from '#cli/system/files/open.ts';
import type { Session } from '#cli/types/planning.ts';
import { formatHeader } from '#cli/generation/header.ts';
import type { FileSettings } from '#cli/types/ownership.ts';
import { listCoveredFiles } from '#cli/repository/coverage.ts';
import { buildPathMatcher } from '#cli/repository/matchers.ts';
import { type ToolFileDeclaration } from '#cli/types/configurations.ts';
import { listScopeChecks, listRequiredTools } from '#cli/planning/needed-tools.ts';
import { isInScope, joinScope, listNestedScopes, buildScopeTarget } from '#cli/repository/scopes.ts';
import { convertToPosixPath, extractParentFolder, includeParentFolders } from '#cli/system/paths.ts';
import { type GeneratedFile, type ToolFileInputs, type PointerFieldInputs } from '#cli/types/generation/files.ts';
import { TARGET_PLACEHOLDER, TARGET_JSON_PLACEHOLDER, TARGET_MODULE_PLACEHOLDER } from '#cli/config/configurations.ts';

/**
 * Resolve target placeholders in pointer text.
 *
 * @param value the body text.
 * @param pointerPath the pointer file.
 * @param targetPath the generated tool file.
 *
 * @returns the text with quoted module and JSON paths preserved.
 */
function fillTarget(value: string, pointerPath: string, targetPath: string): string {
    const target = deriveRelativeTarget(pointerPath, targetPath);
    return value.replaceAll(TARGET_PLACEHOLDER, (placeholder) => {
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
 * @param pointerPath the authored pointer file.
 * @param targetPath the generated tool file.
 *
 * @returns a relative path that tool loaders read on every system.
 */
function deriveRelativeTarget(pointerPath: string, targetPath: string): string {
    const relativePath = convertToPosixPath(relative(dirname(pointerPath), targetPath));
    return relativePath.startsWith('./') || relativePath.startsWith('../') ? relativePath : `./${relativePath}`;
}

/**
 * Generate a pointer: the header, then the body with the target placeholder filled.
 *
 * @param pointer the declaration to build.
 * @param pointerPath where the pointer goes.
 * @param targetPath the generated tool file.
 *
 * @returns the pointer file.
 */
function buildBodyPointer(
    pointer: NonNullable<ToolFileDeclaration['pointer']>,
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
 * Resolve declared pointer paths.
 *
 * @param context the repository and the scope.
 * @param toolFile the declaration from the manifest.
 *
 * @returns the root or folder paths.
 */
function listPointerPaths(context: ToolFileInputs, toolFile: ToolFileDeclaration): string[] {
    const { selection, manifest } = context;
    const { scopes, repository } = context.session;
    const { pointer } = toolFile;
    if (pointer === undefined) return [];
    const scope = selection.scope.path;
    if (pointer.folders === undefined) return [toolFile.per_scope ? joinScope(scope, pointer.path) : pointer.path];
    const children = listNestedScopes(
        scopes.map((entry) => entry.scope.path),
        scope,
    );
    const matches = buildPathMatcher(pointer.folders);
    const owned = listCoveredFiles(manifest.files, repository.files, {
        selected: selection.selected,
        scope: '',
        view: selection.view,
    }).filter((file) => isInScope(file.path, scope) && children.every((child) => !isInScope(file.path, child)));
    const folders = new Set(
        owned.flatMap(({ path }) =>
            [...includeParentFolders([extractParentFolder(path)])]
                .filter((folder) => folder !== '' && matches(folder))
                .toSorted((left, right) => right.length - left.length)
                .map((folder) => (isInScope(folder, scope) ? folder : scope)),
        ),
    );
    return [...folders].map((folder) => `${folder}/${pointer.path}`);
}

function listPointerFieldTargets({
    selection,
    manifest,
    tool,
    consumed,
    paths,
    targets,
    scopePaths,
}: PointerFieldInputs) {
    return (tool.replace_key ?? [])
        .filter((replacement) => replacement.pointer === true)
        .flatMap((replacement) =>
            manifest.toolFiles
                .map((file) => ({ file, target: buildScopeTarget(selection.scope.path, file, targets) }))
                .filter(
                    ({ file, target }) =>
                        file.tool.includes(tool.name) && (!file.per_scope || consumed || !paths.has(target)),
                )
                .map(({ file, target }) => {
                    const scope = file.per_scope ? selection.scope.path : '';
                    const children = file.per_scope ? listNestedScopes(scopePaths, scope) : [];
                    const pointerPath = file.pointer === undefined ? target : joinScope(scope, file.pointer.path);
                    const pointerTarget = paths.has(pointerPath) ? pointerPath : (file.pointer?.path ?? target);
                    return {
                        key: replacement.key,
                        scope,
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
 * @param targets the tool file path for each scope and declaration.
 * @returns changes to the declared package fields.
 */
function buildPointerFieldEdits(
    session: Session,
    generated: GeneratedFile[],
    targets: PointerFieldInputs['targets'],
): FileSettings[] {
    const { root, repository, scopes } = session;
    const paths = new Set(generated.map(({ path }) => path));
    const scopePaths = scopes.map(({ scope }) => scope.path);
    const tools = scopes.flatMap((selection) => {
        const required = new Set(listScopeChecks(session, selection).flatMap((check) => listRequiredTools(check)));
        return selection.selected.flatMap((manifest) =>
            manifest.tools.map((tool) => ({ selection, manifest, tool, consumed: required.has(tool.name) })),
        );
    });
    const declarations = tools.flatMap((selected) =>
        listPointerFieldTargets({ ...selected, paths, targets, scopePaths }),
    );
    const pointerFields = new Map(declarations.map((row) => [JSON.stringify([row.key, row.scope, row.target]), row]));
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
        const changes = [...pointerFields.values()]
            .filter(
                (row) =>
                    Object.hasOwn(document, row.key) &&
                    isInScope(path, row.scope) &&
                    row.children.every((child) => !isInScope(path, child)) &&
                    (paths.has(row.target) ||
                        isDeepStrictEqual(document[row.key], { extends: deriveRelativeTarget(path, row.target) })),
            )
            .map((row) => ({
                path: [row.key],
                value: paths.has(row.target) ? { extends: deriveRelativeTarget(path, row.target) } : undefined,
            }));
        return changes.length === 0 ? [] : [{ path, changes }];
    });
}

/**
 * Build the declared pointers for one generated tool file.
 * Root and folder pointers use their body or the generated formatter settings.
 *
 * @param context the repository and the scope.
 * @param toolFile the shipped declaration.
 * @param target the tool file path.
 * @returns the pointer files for the tool file.
 */
function buildPointerFiles(context: ToolFileInputs, toolFile: ToolFileDeclaration, target: string): GeneratedFile[] {
    const { pointer } = toolFile;
    if (pointer === undefined) return [];
    return listPointerPaths(context, toolFile).map((path) => buildBodyPointer(pointer, path, target));
}

export { listPointerPaths, buildPointerFiles, buildPointerFieldEdits };
