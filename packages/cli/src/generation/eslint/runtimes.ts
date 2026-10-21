import { BACKSLASH_BEFORE_MATCH } from '#cli/config/text.ts';
import type { Scope } from '#cli/types/settings/inheritance.ts';
import type { EslintRuntime } from '#cli/types/generation/eslint.ts';
import { GLOB_SPECIAL_CHARACTERS } from '#cli/config/system/paths.ts';
import { MISE_SCRIPT_PATH } from '#cli/config/repository/inventory.ts';
import { joinScope, compareScopeDepth } from '#cli/repository/scopes.ts';
import { splitGlobs, listNestedScopeGlobs } from '#cli/generation/eslint/files.ts';
import { ESLINT_SETTINGS_TABLE } from '#cli/config/generation/eslint/tool-settings.ts';
import { NEXTJS_CONFIGURATION, REACT_NATIVE_CONFIGURATION } from '#cli/config/configurations.ts';
import { COMMONJS_FILES, ESLINT_BROWSER_CONFIGURATIONS } from '#cli/config/generation/eslint/runtimes.ts';

function selectFrameworkRuntime(configurations: string[]): string | undefined {
    if (configurations.includes(REACT_NATIVE_CONFIGURATION)) return 'react-native';
    if (configurations.includes(NEXTJS_CONFIGURATION)) return undefined;
    return ESLINT_BROWSER_CONFIGURATIONS.some((name) => configurations.includes(name)) ? 'browser' : undefined;
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
        const escaped = scope.replaceAll(GLOB_SPECIAL_CHARACTERS, BACKSLASH_BEFORE_MATCH);
        const children = listNestedScopeGlobs(
            scopes.map((entry) => entry.scope.path),
            scope,
        ).map((path) => `!${path}`);
        blocks.push(
            { scope, runtime: 'node', ...splitGlobs([joinScope(escaped, '**/*'), ...children]) },
            { scope, runtime: 'commonjs', ...splitGlobs([joinScope(escaped, COMMONJS_FILES), ...children]) },
        );
        const framework = buildFrameworkRuntime(selection, escaped, children);
        if (framework !== undefined) blocks.push(framework);
        for (const override of selection.view.values[ESLINT_SETTINGS_TABLE]?.override ?? []) {
            if (override.runtime === undefined) continue;
            blocks.push({ scope, runtime: override.runtime, ...splitGlobs([...override.paths, ...children]) });
        }
    }
    return blocks;
}

// The runtime of the framework of a scope covers its code files, apart from CommonJS files, scripts, and child scopes.
function buildFrameworkRuntime(selection: Scope, escaped: string, children: string[]): EslintRuntime | undefined {
    const runtime = selectFrameworkRuntime(selection.view.configurations);
    if (runtime === undefined) return undefined;
    const scripts = [...(selection.view.values.javascript?.script_files ?? []), joinScope(escaped, MISE_SCRIPT_PATH)];
    return {
        scope: selection.scope.path,
        runtime,
        ...splitGlobs([
            joinScope(escaped, '**/*'),
            `!${joinScope(escaped, COMMONJS_FILES)}`,
            ...scripts.map((path) => `!${path}`),
            ...children,
        ]),
    };
}
