import { escapeGlob } from '#cli/system/paths.ts';
import { MISE_TASKS_GLOB } from '#cli/config/files/names.ts';
import type { Scope } from '#cli/types/settings/inheritance.ts';
import type { EslintRuntime } from '#cli/types/generation/eslint.ts';
import { joinScope, isInScope, compareScopeDepth } from '#cli/repository/scopes.ts';
import { splitGlobs } from '#cli/generation/configurations/language/javascript/eslint/files.ts';
import { NEXTJS_CONFIGURATION, REACT_NATIVE_CONFIGURATION } from '#cli/config/manifests/names.ts';
import { ESLINT_SETTINGS_TABLE } from '#cli/config/generation/configurations/language/javascript/eslint/config-file.ts';

import {
    COMMONJS_FILES,
    ESLINT_BROWSER_CONFIGURATIONS,
} from '#cli/config/generation/configurations/language/javascript/eslint/runtimes.ts';

function selectFrameworkRuntime(configurations: string[]): string | undefined {
    if (configurations.includes(REACT_NATIVE_CONFIGURATION)) return 'react-native';
    if (configurations.includes(NEXTJS_CONFIGURATION)) return undefined;
    return ESLINT_BROWSER_CONFIGURATIONS.some((name) => configurations.includes(name)) ? 'browser' : undefined;
}

function isRuntimeRoot(scopePath: string, scopes: Scope[]): boolean {
    return (
        scopePath === '' ||
        scopes.some(
            (ancestor) =>
                ancestor.path !== scopePath &&
                isInScope(scopePath, ancestor.path) &&
                (selectFrameworkRuntime(ancestor.settings.configurations) !== undefined ||
                    (ancestor.settings.tables[ESLINT_SETTINGS_TABLE]?.override ?? []).some(
                        (override) => override.runtime !== undefined,
                    )),
        )
    );
}

/**
Resolve one runtime per file from scoped framework defaults and your own runtime settings. More specific scopes and
your later selectors win. Build scripts keep Node.js unless your own runtime names them.

@param scopes every project scope.
@returns the runtimes, lowest priority first.
*/
export function buildRuntimes(scopes: Scope[]): EslintRuntime[] {
    const blocks: EslintRuntime[] = [];
    const orderedScopes = scopes.toSorted((left, right) => compareScopeDepth(left.path, right.path));
    for (const scope of orderedScopes) {
        const scopePath = scope.path;
        const escaped = escapeGlob(scopePath);
        if (isRuntimeRoot(scopePath, scopes))
            blocks.push(
                { scope: scopePath, runtime: 'node', ...splitGlobs([joinScope(escaped, '**/*')]) },
                { scope: scopePath, runtime: 'commonjs', ...splitGlobs([joinScope(escaped, COMMONJS_FILES)]) },
            );
        const framework = buildFrameworkRuntime(scope, escaped);
        if (framework !== undefined) blocks.push(framework);
        blocks.push(
            ...(scope.settings.tables[ESLINT_SETTINGS_TABLE]?.override ?? []).flatMap((override) =>
                override.runtime === undefined
                    ? []
                    : { scope: scopePath, runtime: override.runtime, ...splitGlobs(override.paths) },
            ),
        );
    }
    return blocks;
}

function buildFrameworkRuntime(scope: Scope, escaped: string): EslintRuntime | undefined {
    const runtime = selectFrameworkRuntime(scope.settings.configurations);
    if (runtime === undefined) return undefined;
    const scripts = [...(scope.settings.tables.javascript?.script_files ?? []), joinScope(escaped, MISE_TASKS_GLOB)];
    return {
        scope: scope.path,
        runtime,
        ...splitGlobs([
            joinScope(escaped, '**/*'),
            `!${joinScope(escaped, COMMONJS_FILES)}`,
            ...scripts.map((path) => `!${path}`),
        ]),
    };
}
