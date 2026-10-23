import { BACKSLASH_BEFORE_MATCH } from '#cli/config/text.ts';
import { MISE_SCRIPT_PATH } from '#cli/config/files/names.ts';
import type { Scope } from '#cli/types/settings/inheritance.ts';
import type { EslintRuntime } from '#cli/types/generation/eslint.ts';
import { joinScope, compareScopeDepth } from '#cli/repository/scopes.ts';
import { NEXTJS_CONFIGURATION } from '#cli/config/configurations/names.ts';
import { GLOB_SPECIAL_CHARACTERS } from '#cli/config/files/path-patterns.ts';
import { splitGlobs, listNestedScopeGlobs } from '#cli/generation/configurations/language/javascript/eslint/files.ts';

import {
    COMMONJS_FILES,
    ESLINT_BROWSER_CONFIGURATIONS,
} from '#cli/config/generation/configurations/language/javascript/eslint/runtimes.ts';
import {
    ESLINT_SETTINGS_TABLE,
    REACT_NATIVE_CONFIGURATION,
} from '#cli/config/generation/configurations/language/javascript/eslint/config-file.ts';

function selectFrameworkRuntime(configurations: string[]): string | undefined {
    if (configurations.includes(REACT_NATIVE_CONFIGURATION)) return 'react-native';
    if (configurations.includes(NEXTJS_CONFIGURATION)) return undefined;
    return ESLINT_BROWSER_CONFIGURATIONS.some((name) => configurations.includes(name)) ? 'browser' : undefined;
}

/**
 * Resolve one runtime per file from scoped framework defaults and your own runtime settings. More specific scopes and
 * your later selectors win. Build scripts keep Node.js unless your own runtime names them.
 *
 * @param scopes every project scope.
 * @returns the runtimes, lowest priority first.
 */
export function buildRuntimes(scopes: Scope[]): EslintRuntime[] {
    const blocks: EslintRuntime[] = [];
    for (const scope of scopes.toSorted((left, right) => compareScopeDepth(left.folder.path, right.folder.path))) {
        const scopePath = scope.folder.path;
        const escaped = scopePath.replaceAll(GLOB_SPECIAL_CHARACTERS, BACKSLASH_BEFORE_MATCH);
        const children = listNestedScopeGlobs(
            scopes.map((each) => each.folder.path),
            scopePath,
        ).map((path) => `!${path}`);
        blocks.push(
            { scope: scopePath, runtime: 'node', ...splitGlobs([joinScope(escaped, '**/*'), ...children]) },
            { scope: scopePath, runtime: 'commonjs', ...splitGlobs([joinScope(escaped, COMMONJS_FILES), ...children]) },
        );
        const framework = buildFrameworkRuntime(scope, escaped, children);
        if (framework !== undefined) blocks.push(framework);
        for (const override of scope.settings.values[ESLINT_SETTINGS_TABLE]?.override ?? []) {
            if (override.runtime === undefined) continue;
            blocks.push({
                scope: scopePath,
                runtime: override.runtime,
                ...splitGlobs([...override.paths, ...children]),
            });
        }
    }
    return blocks;
}

function buildFrameworkRuntime(scope: Scope, escaped: string, children: string[]): EslintRuntime | undefined {
    const runtime = selectFrameworkRuntime(scope.settings.configurations);
    if (runtime === undefined) return undefined;
    const scripts = [...(scope.settings.values.javascript?.script_files ?? []), joinScope(escaped, MISE_SCRIPT_PATH)];
    return {
        scope: scope.folder.path,
        runtime,
        ...splitGlobs([
            joinScope(escaped, '**/*'),
            `!${joinScope(escaped, COMMONJS_FILES)}`,
            ...scripts.map((path) => `!${path}`),
            ...children,
        ]),
    };
}
