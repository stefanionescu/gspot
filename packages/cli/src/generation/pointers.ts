import { dirname, relative } from 'node:path';
import { headerFor } from '#cli/generation/headers.ts';
import { listCoveredFiles } from '#cli/repository/coverage.ts';
import { buildPathMatcher } from '#cli/repository/matchers.ts';
import { isConfigurationSelected } from '#cli/configurations/select.ts';
import type { ToolFileDeclaration } from '#cli/types/configurations.ts';
import { isInScope, joinScope, listNestedScopes } from '#cli/repository/scopes.ts';
import type { GeneratedFile, ToolFileInputs } from '#cli/types/generation/files.ts';
import { convertToPosixPath, extractParentFolder, includeParentFolders } from '#cli/system/paths.ts';
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
    const target = relativeTarget(pointerPath, targetPath);
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
export function relativeTarget(pointerPath: string, targetPath: string): string {
    const relativePath = convertToPosixPath(relative(dirname(pointerPath), targetPath));
    return relativePath.startsWith('./') || relativePath.startsWith('../') ? relativePath : `./${relativePath}`;
}

/**
 * Emits a body pointer: the body with the target placeholder replaced, under the header.
 *
 * @param pointer the pointer declaration.
 * @param pointerPath the pointer's path.
 * @param targetPath the generated file's path.
 *
 * @returns the generated file.
 */
export function bodyPointer(
    pointer: NonNullable<ToolFileDeclaration['pointer']>,
    pointerPath: string,
    targetPath: string,
): GeneratedFile {
    const body = fillTarget(pointer.body ?? '', pointerPath, targetPath);
    const ended = body.endsWith('\n') ? body : `${body}\n`;
    return {
        path: pointerPath,
        content: `${headerFor(pointerPath)}${ended}`,
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
export function pointerPaths(
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
    if (pointer.directories === undefined) return [toolFile.per_scope ? joinScope(scope, pointer.path) : pointer.path];
    const children = listNestedScopes(
        context.scopes.map((entry) => entry.scope.path),
        scope,
    );
    const matches = buildPathMatcher(pointer.directories);
    const owned = listCoveredFiles(manifest.files, files, {
        selected: selection.selected,
        scope: '',
        view: selection.view,
    }).filter((file) => isInScope(file.path, scope) && children.every((child) => !isInScope(file.path, child)));
    const directories = new Set(
        owned.flatMap(({ path }) =>
            [...includeParentFolders([extractParentFolder(path)])]
                .filter((directory) => directory !== '' && matches(directory))
                .toSorted((left, right) => right.length - left.length)
                .map((directory) => (isInScope(directory, scope) ? directory : scope)),
        ),
    );
    return [...directories].map((directory) => `${directory}/${pointer.path}`);
}
