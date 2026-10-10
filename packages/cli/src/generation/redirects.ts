// Redirect declared shared package fields to their generated tool files.
import { posix } from 'node:path';
import type { Session } from '#cli/types/planning.ts';
import { openRoot } from '#cli/platform/root/public.ts';
import { parseJsonRecord } from '#cli/parsers/public.ts';
import { relativeTarget } from '#cli/generation/documents/contracts.ts';
import type { GeneratedFile, EmittedToolFile } from '#cli/types/generation/files.ts';
import { isInScope, nestedScopes, targetInScope } from '#cli/repository/paths/public.ts';

/**
 * Redirect authored package fields declared by selected manifests to generated tool files.
 * @param session the authored inventory and selected scopes
 * @param generated the actual tool files emitted for applicable checks
 * @returns changes to the declared package fields
 */
export function packageRedirects(session: Session, generated: GeneratedFile[]): EmittedToolFile[] {
    const { root, repository, scopes } = session;
    const paths = new Set(generated.map(({ path }) => path));
    const scopePaths = scopes.map(({ scope }) => scope.path);
    const tools = scopes.flatMap((selection) =>
        selection.selected.flatMap((manifest) => manifest.tools.map((tool) => ({ selection, manifest, tool }))),
    );
    const declarations = tools.flatMap(({ selection, manifest, tool }) =>
        (tool.replace ?? [])
            .filter((replacement) => replacement.redirect === true)
            .flatMap((replacement) =>
                manifest.toolFiles.flatMap((file) => {
                    const target = targetInScope(selection.scope.path, file);
                    if (file.fragment || !file.tool.includes(tool.name) || !paths.has(target)) return [];
                    const scope = file.per_scope ? selection.scope.path : '';
                    return [
                        {
                            file: replacement.file,
                            key: replacement.key,
                            scope,
                            children: file.per_scope ? nestedScopes(scopePaths, scope) : [],
                            target: file.pointer === undefined ? target : posix.join(scope, file.pointer.path),
                        },
                    ];
                }),
            ),
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
    using files = openRoot(root);
    return [...packages].flatMap((path) => {
        const source = files.read(path);
        if (source === undefined) return [];
        const document = parseJsonRecord(source.bytes.toString('utf8'));
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
