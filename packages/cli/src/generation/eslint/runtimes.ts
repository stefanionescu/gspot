import { escapeGlob } from '#cli/repository/matchers.ts';
import type { ScopeSelection } from '#cli/types/settings/values.ts';
import { splitGlobSelectors } from '#cli/generation/eslint/files.ts';
import { joinScope, listNestedScopes } from '#cli/repository/scopes.ts';
import type { EslintContext, EslintRuntimeBlock } from '#cli/types/generation/eslint.ts';

import {
    COMMONJS_FILES,
    MISE_SCRIPT_PATH,
    NEXTJS_CONFIGURATION,
    ESLINT_SETTINGS_TABLE,
    REACT_NATIVE_CONFIGURATION,
    ESLINT_BROWSER_CONFIGURATIONS,
} from '#cli/config/generation/eslint.ts';

function selectFrameworkRuntime(configurations: string[]): string | undefined {
    if (configurations.includes(REACT_NATIVE_CONFIGURATION)) return 'react-native';
    if (configurations.includes(NEXTJS_CONFIGURATION)) return undefined;
    return ESLINT_BROWSER_CONFIGURATIONS.some((name) => configurations.includes(name)) ? 'browser' : undefined;
}

/**
 * Select your own script paths and mise task files in the selected scope.
 *
 * @param context the selected project.
 * @param context.selection the selected project scope.
 *
 * @returns repository-relative paths whose files use script rules.
 */
export function listScriptPaths({ selection }: Pick<EslintContext, 'selection'>): string[] {
    const scripts = selection.view.roles['scripts'];
    return [...scripts, joinScope(escapeGlob(selection.scope.path), MISE_SCRIPT_PATH)];
}

/**
 * Resolve one runtime per file from scoped framework defaults and your own runtime declarations.
 * More specific scopes and your later selectors take precedence. Build scripts retain Node.js
 * unless your own runtime explicitly selects them.
 *
 * @param scopes the selected configurations and settings of every project scope.
 *
 * @returns runtime declarations in increasing precedence order.
 */
export function buildRuntimeBlocks(scopes: ScopeSelection[]): EslintRuntimeBlock[] {
    const blocks: EslintRuntimeBlock[] = [];
    for (const selection of scopes.toSorted((left, right) => left.scope.path.length - right.scope.path.length)) {
        const scope = selection.scope.path;
        const children = listNestedScopes(
            scopes.map((entry) => entry.scope.path),
            scope,
        ).map((path) => `!${escapeGlob(path)}/**`);
        const prefix = joinScope(escapeGlob(scope), '');
        const tool = selection.view.values[ESLINT_SETTINGS_TABLE];
        blocks.push(
            { scope, runtime: 'node', ...splitGlobSelectors([`${prefix}**/*`, ...children]) },
            { scope, runtime: 'commonjs', ...splitGlobSelectors([`${prefix}${COMMONJS_FILES}`, ...children]) },
        );
        const runtime = selectFrameworkRuntime(selection.view.configurations);
        if (runtime !== undefined) {
            const scripts = listScriptPaths({ selection });
            blocks.push({
                scope,
                runtime,
                ...splitGlobSelectors([
                    `${prefix}**/*`,
                    `!${prefix}${COMMONJS_FILES}`,
                    ...scripts.map((path) => `!${path}`),
                    ...children,
                ]),
            });
        }
        for (const override of tool?.override ?? []) {
            if (override.runtime === undefined) continue;
            blocks.push({ scope, runtime: override.runtime, ...splitGlobSelectors([...override.paths, ...children]) });
        }
    }
    return blocks;
}
