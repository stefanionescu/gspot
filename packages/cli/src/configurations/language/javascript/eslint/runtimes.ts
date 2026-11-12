import { REACT_NATIVE_CONFIGURATION } from '#cli/config/configurations/framework.ts';
import {
    COMMONJS_FILES,
    COMMONJS_PACKAGE_TYPE,
    ESLINT_BROWSER_CONFIGURATIONS,
    ESLINT_SETTINGS_TABLE,
    TYPELESS_JAVASCRIPT_FILES,
} from '#cli/config/configurations/javascript.ts';
import { NEXTJS_CONFIGURATION } from '#cli/config/configurations/nextjs.ts';
import { listScriptFiles, splitGlobs } from '#cli/configurations/language/javascript/eslint/files.ts';
import { findNearestPackageJson } from '#cli/repository/dependencies.ts';
import { compareScopeDepth, joinScope } from '#cli/repository/scopes.ts';
import { escapeGlob, isInScope } from '#cli/system/paths.ts';
import type { EslintRuntime } from '#cli/types/configurations/javascript.ts';
import type { DependencyFile } from '#cli/types/parsers.ts';
import type { Scope } from '#cli/types/settings.ts';

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

function buildFrameworkRuntime(scope: Scope, escaped: string): EslintRuntime | undefined {
    const runtime = selectFrameworkRuntime(scope.settings.configurations);
    if (runtime === undefined) return undefined;
    return {
        scopePath: scope.path,
        runtime,
        ...splitGlobs([
            joinScope(escaped, '**/*'),
            `!${joinScope(escaped, COMMONJS_FILES)}`,
            ...listScriptFiles(scope).map((path) => `!${path}`),
        ]),
    };
}

function buildPackageRuntime(scope: Scope, escaped: string, packageType: string | undefined): EslintRuntime[] {
    if (packageType === undefined || scope.settings.configurations.includes(NEXTJS_CONFIGURATION)) return [];
    const isCommonjs = packageType === COMMONJS_PACKAGE_TYPE;
    return isCommonjs || scope.path !== ''
        ? [
              {
                  scopePath: scope.path,
                  runtime: isCommonjs ? COMMONJS_PACKAGE_TYPE : 'node',
                  ...splitGlobs([joinScope(escaped, TYPELESS_JAVASCRIPT_FILES)]),
              },
          ]
        : [];
}

/**
Resolve one runtime per file from the package type, scoped framework defaults, and your own runtime settings. More
specific scopes and your later selectors win. Build scripts keep Node.js unless your own runtime names them.
*/
export function buildRuntimes(scopes: Scope[], dependencyFiles: DependencyFile[]): EslintRuntime[] {
    const blocks: EslintRuntime[] = [];
    const orderedScopes = scopes.toSorted((left, right) => compareScopeDepth(left.path, right.path));
    for (const scope of orderedScopes) {
        const scopePath = scope.path;
        const escaped = escapeGlob(scopePath);
        if (isRuntimeRoot(scopePath, scopes))
            blocks.push(
                { scopePath, runtime: 'node', ...splitGlobs([joinScope(escaped, '**/*')]) },
                { scopePath, runtime: 'commonjs', ...splitGlobs([joinScope(escaped, COMMONJS_FILES)]) },
            );
        const found = findNearestPackageJson(dependencyFiles, scopePath);
        const packageType = found === undefined ? undefined : (found.moduleType ?? COMMONJS_PACKAGE_TYPE);
        blocks.push(...buildPackageRuntime(scope, escaped, packageType));
        const framework = buildFrameworkRuntime(scope, escaped);
        if (framework !== undefined) blocks.push(framework);
        blocks.push(
            ...(scope.settings.tables[ESLINT_SETTINGS_TABLE]?.override ?? []).flatMap((override) =>
                override.runtime === undefined
                    ? []
                    : { scopePath, runtime: override.runtime, ...splitGlobs(override.paths) },
            ),
        );
    }
    return blocks;
}
