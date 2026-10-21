import { compareScopeDepth } from '#cli/repository/scopes.ts';
import type { Scope } from '#cli/types/settings/inheritance.ts';
import type { EslintRuntime } from '#cli/types/generation/eslint.ts';
import { MISE_SCRIPT_PATH } from '#cli/config/repository/inventory.ts';
import { ESLINT_SETTINGS_TABLE } from '#cli/config/generation/eslint/tool-settings.ts';
import { NEXTJS_CONFIGURATION, REACT_NATIVE_CONFIGURATION } from '#cli/config/configurations.ts';
import { splitGlobs, buildScopeGlob, listNestedScopeGlobs } from '#cli/generation/eslint/files.ts';
import { COMMONJS_FILES, ESLINT_BROWSER_CONFIGURATIONS } from '#cli/config/generation/eslint/runtimes.ts';

function selectFrameworkRuntime(configurations: string[]): string | undefined {
    if (configurations.includes(REACT_NATIVE_CONFIGURATION)) return 'react-native';
    if (configurations.includes(NEXTJS_CONFIGURATION)) return undefined;
    return ESLINT_BROWSER_CONFIGURATIONS.some((name) => configurations.includes(name)) ? 'browser' : undefined;
}

/**
 * List your own script paths and the mise task files in the scope.
 *
 * @param selection the project scope.
 *
 * @returns repository-relative paths whose files use script rules.
 */
export function listScriptPaths(selection: Scope): string[] {
    const scripts = selection.view.values.javascript?.script_files ?? [];
    return [...scripts, buildScopeGlob(selection.scope.path, MISE_SCRIPT_PATH)];
}

/**
 * Resolve one runtime per file from scoped framework defaults and your own runtime declarations.
 * More specific scopes and your later selectors win. Build scripts keep Node.js
 * unless your own runtime names them.
 *
 * @param scopes every project selection.
 *
 * @returns the runtime declarations, lowest priority first.
 */
export function buildRuntimes(scopes: Scope[]): EslintRuntime[] {
    const blocks: EslintRuntime[] = [];
    for (const selection of scopes.toSorted((left, right) => compareScopeDepth(left.scope.path, right.scope.path))) {
        const scope = selection.scope.path;
        const children = listNestedScopeGlobs(
            scopes.map((entry) => entry.scope.path),
            scope,
        ).map((path) => `!${path}`);
        const tool = selection.view.values[ESLINT_SETTINGS_TABLE];
        blocks.push(
            { scope, runtime: 'node', ...splitGlobs([buildScopeGlob(scope, '**/*'), ...children]) },
            { scope, runtime: 'commonjs', ...splitGlobs([buildScopeGlob(scope, COMMONJS_FILES), ...children]) },
        );
        const runtime = selectFrameworkRuntime(selection.view.configurations);
        if (runtime !== undefined) {
            const scripts = listScriptPaths(selection);
            blocks.push({
                scope,
                runtime,
                ...splitGlobs([
                    buildScopeGlob(scope, '**/*'),
                    `!${buildScopeGlob(scope, COMMONJS_FILES)}`,
                    ...scripts.map((path) => `!${path}`),
                    ...children,
                ]),
            });
        }
        for (const override of tool?.override ?? []) {
            if (override.runtime === undefined) continue;
            blocks.push({ scope, runtime: override.runtime, ...splitGlobs([...override.paths, ...children]) });
        }
    }
    return blocks;
}
