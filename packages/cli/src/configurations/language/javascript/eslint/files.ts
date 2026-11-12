import { isDeepStrictEqual } from 'node:util';

import { CODE_LANGUAGES } from '#cli/config/configurations/eslint/blocks.ts';
import { COMPONENT_CONFIGURATIONS } from '#cli/config/configurations/javascript.ts';
import { MISE_TASKS_GLOB } from '#cli/config/configurations/structure.ts';
import { EXTENSION_PATTERN } from '#cli/config/manifests.ts';
import { JAVASCRIPT_CONFIGURATION } from '#cli/config/settings/detected.ts';
import { listTaggedExtensions } from '#cli/repository/files/classify.ts';
import { compareScopeDepth, joinScopeGlob, listNestedScopes } from '#cli/repository/scopes.ts';
import { findParentScope } from '#cli/settings/scopes.ts';
import { buildPathMatcher, includeFolderContents } from '#cli/system/matchers.ts';
import { escapeGlob, extractExtension, isInScope } from '#cli/system/paths.ts';
import type {
    EslintBlockFields,
    EslintFileGroups,
    EslintFiles,
    PathExpressions,
    ScopeOverride,
} from '#cli/types/configurations/javascript.ts';
import type { Scope } from '#cli/types/settings.ts';

/**
Build the glob of the files of these languages.

@returns a plain extension for one extension, because picomatch reads a one-item brace as literal text.
*/
export function buildExtensionGlob(...languages: string[]): string {
    const extensions = listTaggedExtensions(...languages).map((extension) => extension.slice(1));
    return extensions.length === 1 ? `**/*.${String(extensions[0])}` : `**/*.{${extensions.join(',')}}`;
}

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

export function listJavascriptScopes(scopes: Scope[]): Scope[] {
    return scopes.filter(({ settings }) => settings.configurations.includes(JAVASCRIPT_CONFIGURATION));
}

export function listScriptFiles(scope: Pick<Scope, 'path' | 'settings'>): string[] {
    return [...(scope.settings.tables.javascript?.script_files ?? []), joinScopeGlob(scope.path, MISE_TASKS_GLOB)];
}

export function buildFilePatterns(groups: EslintFileGroups): EslintFiles {
    const { scopes, nodeFiles } = groups;
    const source = buildExtensionGlob(...CODE_LANGUAGES);
    const codeExtensions = listTaggedExtensions(...CODE_LANGUAGES);
    const selected = groups.components.flatMap(({ name, tools }) =>
        tools
            .flatMap(({ eslint }) => eslint?.extensions ?? [])
            .filter((extension) => !codeExtensions.includes(extension))
            .map((extension) => ({ pattern: `**/*${extension}`, configuration: name })),
    );
    const components = selected.map(({ pattern }) => pattern);
    const isCovered = buildPathMatcher([source, ...components]);
    const node = nodeFiles.filter((path) => !isCovered(path)).map((path) => escapeGlob(path));
    const code = [source, ...components, ...node];
    const typescript = buildExtensionGlob('typescript');
    const javascript = buildExtensionGlob('javascript');
    return {
        code,
        typescript: [typescript],
        typed: [
            typescript,
            ...selected.map(({ pattern, configuration }): EslintFiles['typed'][number] =>
                (COMPONENT_CONFIGURATIONS as readonly string[]).includes(configuration)
                    ? [pattern, { component: configuration as (typeof COMPONENT_CONFIGURATIONS)[number] }]
                    : pattern,
            ),
        ],
        javascript: [javascript, ...node],
        tests: scopes.flatMap(({ scopePath, tests }) =>
            buildTestFiles(listCodeTestFiles(tests), code).map(([test, pattern]) => [
                test,
                joinScopeGlob(scopePath, '**/*'),
                pattern,
            ]),
        ),
        scripts: scopes.flatMap(({ scopePath, scripts }) =>
            scripts.flatMap((script) => code.map((pattern) => [script, joinScopeGlob(scopePath, '**/*'), pattern])),
        ),
    };
}

export function listCodeTestFiles(testFiles: string[]): string[] {
    const extensions = listTaggedExtensions(...CODE_LANGUAGES, ...COMPONENT_CONFIGURATIONS, 'astro');
    return testFiles.filter((pattern) => {
        const extension = extractExtension(pattern);
        return extension === '' || !EXTENSION_PATTERN.test(extension) || extensions.includes(extension);
    });
}

export function buildNodePatterns(paths: string[], scopePath: string): string[] {
    return paths.filter((path) => isInScope(path, scopePath)).map((path) => escapeGlob(path));
}

export function splitGlobs(patterns: string[]): PathExpressions {
    const included = includeFolderContents(patterns);
    return {
        includes: included.filter((pattern) => !pattern.startsWith('!')),
        excludes: included.filter((pattern) => pattern.startsWith('!')).map((pattern) => pattern.slice(1)),
    };
}

export function buildScopeFiles(
    files: NonNullable<EslintBlockFields['files']>,
    scopePath: string,
    paths: Array<string | string[]>,
): NonNullable<EslintBlockFields['files']> {
    return files.flatMap((file) =>
        paths.map((path) => [
            ...(Array.isArray(file) ? file : [file]),
            joinScopeGlob(scopePath, '**/*'),
            ...(Array.isArray(path) ? path : [path]),
        ]),
    );
}

export function buildTestFiles(tests: string[], code: string[]): Array<[string, string]> {
    return tests.flatMap((test) => code.map((pattern): [string, string] => [test, pattern]));
}
