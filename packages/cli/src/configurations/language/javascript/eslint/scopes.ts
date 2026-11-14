import { isDeepStrictEqual } from 'node:util';
import type { Scope } from '#cli/types/settings.ts';
import { findParentScope } from '#cli/settings/scopes.ts';
import type { ScopeOverride } from '#cli/types/configurations/javascript.ts';
import { joinScopeGlob, listNestedScopes, compareScopeDepth } from '#cli/repository/scopes.ts';

export function listNestedScopeGlobs(paths: readonly string[], scopePath: string): string[] {
    return listNestedScopes(paths, scopePath).map((path) => joinScopeGlob(path, '**'));
}

/**
Build the blocks of each scope whose value differs from its parent, deepest last, so a nested scope overrides its
parent.
*/
export function buildScopeOverrideBlocks<Value, Block>(
    scopes: Scope[],
    override: ScopeOverride<Value, Block>,
): Block[] {
    const { read, build, base } = override;
    const changes = scopes
        .toSorted((left, right) => compareScopeDepth(left.path, right.path))
        .map((scope) => ({ scope, parent: findParentScope(scopes, scope.path), value: read(scope) }))
        .filter(({ parent, value }) => {
            const inherited = parent ?? base;
            return !isDeepStrictEqual(value, inherited && read(inherited));
        });
    return changes.flatMap(({ scope, parent, value }) =>
        build({
            scope,
            parent,
            value,
            ignores: listNestedScopeGlobs(
                changes.map((change) => change.scope.path),
                scope.path,
            ),
        }),
    );
}
