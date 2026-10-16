import { isDeepStrictEqual } from 'node:util';
import { parseJsonFile } from '#cli/parsers/json.ts';
import { posix, dirname, relative } from 'node:path';
import { openFiles } from '#cli/system/files/open.ts';
import type { Session } from '#cli/types/planning.ts';
import type { FileEdit } from '#cli/types/ownership.ts';
import { formatHeader } from '#cli/generation/header.ts';
import { listCoveredFiles } from '#cli/repository/coverage.ts';
import { buildPathMatcher } from '#cli/repository/matchers.ts';
import { listRequiredTools } from '#cli/planning/needed-tools.ts';
import { isConfigurationSelected } from '#cli/configurations/select.ts';
import { type ToolFileDeclaration } from '#cli/types/configurations.ts';
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
 * Names a generated target relative to its pointer, including the local-module prefix.
 *
 * @param pointerPath the authored pointer file.
 * @param targetPath the generated target file.
 *
 * @returns a portable relative path understood by configuration loaders.
 */
function deriveRelativeTarget(pointerPath: string, targetPath: string): string {
    const relativePath = convertToPosixPath(relative(dirname(pointerPath), targetPath));
    return relativePath.startsWith('./') || relativePath.startsWith('../') ? relativePath : `./${relativePath}`;
}

/**
 * Emits a body pointer: the body with the target placeholder replaced, under the header.
 *
 * @param pointer the pointer declaration.
 * @param pointerPath the destination that determines the relative target and header.
 * @param targetPath the generated file's path.
 *
 * @returns a header and target-filled body written at the declared pointer path.
 */
function buildBodyPointer(
    pointer: NonNullable<ToolFileDeclaration['pointer']>,
    pointerPath: string,
    targetPath: string,
): GeneratedFile {
    const body = fillTarget(pointer.body ?? '', pointerPath, targetPath);
    const ended = body.endsWith('\n') ? body : `${body}\n`;
    const notes = [`The tool file is ${targetPath}.`];
    if (pointerPath.endsWith('eslint.config.mjs'))
        notes.push('Run gspot install before you use ESLint in your editor.');
    return {
        path: pointerPath,
        content: `${formatHeader(pointerPath, notes)}${ended}`,
        kind: 'pointer',
    };
}

/**
 * Resolve declared pointer paths.
 *
 * @param context files, scopes, and selected configuration.
 * @param toolFile the tool file declaration.
 *
 * @returns root or directory paths.
 */
function listPointerPaths(
    context: Pick<ToolFileInputs, 'files' | 'selection' | 'manifest' | 'scopes'>,
    toolFile: ToolFileDeclaration,
): string[] {
    const { files, selection, manifest } = context;
    const { pointer } = toolFile;
    if (pointer === undefined) return [];
    if (
        pointer.when !== undefined &&
        !isConfigurationSelected(toolFile.per_scope ? [selection] : context.scopes, pointer.when.configuration)
    )
        return [];
    const scope = selection.scope.path;
    if (pointer.folders === undefined) return [toolFile.per_scope ? joinScope(scope, pointer.path) : pointer.path];
    const children = listNestedScopes(
        context.scopes.map((entry) => entry.scope.path),
        scope,
    );
    const matches = buildPathMatcher(pointer.folders);
    const owned = listCoveredFiles(manifest.files, files, {
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
        .filter((replacement) => replacement.redirect === true)
        .flatMap((replacement) =>
            manifest.toolFiles
                .map((file) => ({ file, target: buildScopeTarget(selection.scope.path, file, targets) }))
                .filter(
                    ({ file, target }) =>
                        !file.fragment &&
                        file.tool.includes(tool.name) &&
                        (!file.per_scope || consumed || !paths.has(target)),
                )
                .map(({ file, target }) => {
                    let scope = '';
                    let children: string[] = [];
                    if (file.per_scope) {
                        scope = selection.scope.path;
                        children = listNestedScopes(scopePaths, scope);
                    }
                    let pointerTarget = target;
                    if (file.pointer !== undefined) {
                        const pointerPath = posix.join(scope, file.pointer.path);
                        pointerTarget = paths.has(pointerPath) ? pointerPath : file.pointer.path;
                    }
                    return {
                        file: replacement.file,
                        key: replacement.key,
                        scope,
                        children,
                        target: pointerTarget,
                    };
                }),
        );
}

/**
 * Redirect authored package fields declared by selected manifests to generated tool files.
 *
 * @param session the authored inventory and selected scopes.
 * @param generated the actual tool files emitted for applicable checks.
 *
 * @param targets the final generated destination for each scope and declared target.
 * @returns changes to the declared package fields.
 */
function buildPointerFieldEdits(
    session: Session,
    generated: GeneratedFile[],
    targets: PointerFieldInputs['targets'],
): FileEdit[] {
    const { root, repository, scopes } = session;
    const paths = new Set(generated.map(({ path }) => path));
    const scopePaths = scopes.map(({ scope }) => scope.path);
    const tools = scopes.flatMap((selection) => {
        const required = new Set(
            session.configuredChecks
                .filter((check) => check.scope.scope.path === selection.scope.path || check.check.runs === 'once')
                .flatMap((element) => listRequiredTools(element)),
        );
        return selection.selected.flatMap((manifest) =>
            manifest.tools.map((tool) => ({ selection, manifest, tool, consumed: required.has(tool.name) })),
        );
    });
    const declarations = tools.flatMap((selected) =>
        listPointerFieldTargets({ ...selected, paths, targets, scopePaths }),
    );
    const redirects = new Map(
        declarations.map((row) => [JSON.stringify([row.file, row.key, row.scope, row.target]), row]),
    );
    const packages = new Set([
        'package.json',
        ...repository.files
            .filter((file) => file.kind === 'source' && posix.basename(file.path) === 'package.json')
            .map(({ path }) => path),
    ]);
    if (redirects.size === 0) return [];
    using files = openFiles(root);
    return [...packages].flatMap((path) => {
        const source = files.read(path);
        if (source === undefined) return [];
        const document = parseJsonFile(path, source.bytes.toString('utf8'));
        return [...redirects.values()]
            .filter(
                (row) =>
                    Object.hasOwn(document, row.key) &&
                    isInScope(path, row.scope) &&
                    row.children.every((child) => !isInScope(path, child)) &&
                    (paths.has(row.target) ||
                        isDeepStrictEqual(document[row.key], { extends: deriveRelativeTarget(path, row.target) })),
            )
            .map((row) => ({
                path,
                changes: [
                    {
                        path: [row.key],
                        value: paths.has(row.target) ? { extends: deriveRelativeTarget(path, row.target) } : undefined,
                    },
                ],
            }));
    });
}

// Root and directory pointers use their body or generated formatter settings.
/**
 * Build the declared pointers for one generated tool file.
 * @param context the repository and selected scope.
 * @param toolFile the shipped tool-file declaration.
 * @param target the generated destination path.
 * @returns the pointer files for the tool file.
 */
function buildPointerFiles(context: ToolFileInputs, toolFile: ToolFileDeclaration, target: string): GeneratedFile[] {
    const { pointer } = toolFile;
    if (pointer === undefined) return [];
    return listPointerPaths(context, toolFile).map((path) => buildBodyPointer(pointer, path, target));
}

export { listPointerPaths, buildPointerFiles, buildPointerFieldEdits };
