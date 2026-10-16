// Redirect declared shared package fields to their generated tool files.
import { posix } from 'node:path';
import { parseJsonFile } from '#cli/parsers/json.ts';
import { openFiles } from '#cli/system/files/open.ts';
import type { Session } from '#cli/types/planning.ts';
import type { FileEdit } from '#cli/types/ownership.ts';
import { relativeTarget } from '#cli/generation/pointers.ts';
import { requiredToolNames } from '#cli/planning/needed-tools.ts';
import { isInScope, nestedScopes, targetInScope } from '#cli/repository/scopes.ts';
import type { GeneratedFile, PackageRedirectInputs } from '#cli/types/generation/files.ts';

function redirectTargets({ selection, manifest, tool, consumed, paths, scopePaths }: PackageRedirectInputs) {
    return (tool.replace ?? [])
        .filter((replacement) => replacement.redirect === true)
        .flatMap((replacement) =>
            manifest.toolFiles
                .map((file) => ({ file, target: targetInScope(selection.scope.path, file, paths) }))
                .filter(
                    ({ file, target }) =>
                        !file.fragment &&
                        file.tool.includes(tool.name) &&
                        paths.has(target) &&
                        (!file.per_scope || consumed),
                )
                .map(({ file, target }) => {
                    let scope = '';
                    let children: string[] = [];
                    if (file.per_scope) {
                        scope = selection.scope.path;
                        children = nestedScopes(scopePaths, scope);
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
 * @returns changes to the declared package fields.
 */
export function packageRedirects(session: Session, generated: GeneratedFile[]): FileEdit[] {
    const { root, repository, scopes } = session;
    const paths = new Set(generated.map(({ path }) => path));
    const scopePaths = scopes.map(({ scope }) => scope.path);
    const tools = scopes.flatMap((selection) => {
        const required = new Set(
            session.configuredChecks
                .filter((check) => check.scope.scope.path === selection.scope.path || check.check.runs === 'once')
                .flatMap((element) => requiredToolNames(element)),
        );
        return selection.selected.flatMap((manifest) =>
            manifest.tools.map((tool) => ({ selection, manifest, tool, consumed: required.has(tool.name) })),
        );
    });
    const declarations = tools.flatMap((selected) => redirectTargets({ ...selected, paths, scopePaths }));
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
                    row.children.every((child) => !isInScope(path, child)),
            )
            .map((row) => ({
                path,
                changes: [{ path: [row.key], value: { extends: relativeTarget(path, row.target) } }],
            }));
    });
}
