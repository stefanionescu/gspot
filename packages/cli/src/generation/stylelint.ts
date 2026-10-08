import { posix } from 'node:path';
import { openRoot } from '#cli/platform/root/open.ts';
import { parseJsonRecord } from '#cli/parsers/json.ts';
import { relativeTarget } from '#cli/generation/pointers.ts';
import type { ScopeSelection } from '#cli/types/policy/settings.ts';
import type { TrackedFile } from '#cli/types/repository/inventory.ts';
import { isInScope, nestedScopes } from '#cli/repository/selectors.ts';
import type { GeneratedFile, EmittedToolFile } from '#cli/types/generation/files.ts';

/**
 * Redirects authored package Stylelint fields to the nearest applicable generated pointer.
 * @param root the repository root.
 * @param inventory authored files that may contain package settings.
 * @param scopes resolved scopes that bound configuration ownership.
 * @param generated the files emitted for checks applicable at the selected level.
 * @returns the managed package fields.
 */
export function stylelintChanges(
    root: string,
    inventory: TrackedFile[],
    scopes: ScopeSelection[],
    generated: GeneratedFile[],
): EmittedToolFile[] {
    using files = openRoot(root);
    const scopePaths = scopes.map((selection) => selection.scope.path);
    const pointers = generated
        .filter((file) => file.kind === 'pointer' && posix.basename(file.path) === '.stylelintrc.json')
        .toSorted((left, right) => right.path.length - left.path.length)
        .map((file) => {
            const directory = posix.dirname(file.path);
            const scope = directory === '.' ? '' : directory;
            return { path: file.path, scope, children: nestedScopes(scopePaths, scope) };
        });
    const packages = new Set([
        'package.json',
        ...inventory
            .filter((file) => file.kind === 'source' && posix.basename(file.path) === 'package.json')
            .map((file) => file.path),
    ]);
    const changes: EmittedToolFile[] = [];
    for (const path of packages) {
        const pointer = pointers.find(
            (entry) => isInScope(path, entry.scope) && entry.children.every((child) => !isInScope(path, child)),
        );
        if (pointer === undefined) continue;
        const source = files.read(path);
        if (source === undefined) continue;
        const document = parseJsonRecord(source.bytes.toString('utf8'));
        if (!Object.hasOwn(document, 'stylelint')) continue;
        const target = relativeTarget(path, pointer.path);
        changes.push({ path, changes: [{ path: ['stylelint'], value: { extends: target } }] });
    }
    return changes;
}
