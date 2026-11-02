import { isDeepStrictEqual } from 'node:util';
import type { Scope } from '#cli/types/settings.ts';
import { findParentScope } from '#cli/settings/scopes.ts';
import { EXTENSION_PATTERN } from '#cli/config/manifests.ts';
import { escapeGlob, extractExtension } from '#cli/system/paths.ts';
import { CODE_LANGUAGES } from '#cli/config/configurations/blocks.ts';
import { listTaggedExtensions } from '#cli/repository/files/classify.ts';
import { buildPathMatcher, includeFolderContents } from '#cli/system/matchers.ts';
import { COMPONENT_CONFIGURATIONS } from '#cli/config/configurations/javascript.ts';
import { isInScope, joinScope, listNestedScopes, compareScopeDepth } from '#cli/repository/scopes.ts';

import type {
    EslintFiles,
    ScopeOverride,
    PathExpressions,
    EslintFileGroups,
    EslintBlockFields,
} from '#cli/types/configurations/language.ts';

/**
Build the glob of the files of these languages.

@param languages the file tags whose extensions the glob matches.
@returns a plain extension for one extension, because picomatch reads a one-item brace as literal text.
*/
export function buildExtensionGlob(...languages: string[]): string {
    const extensions = listTaggedExtensions(...languages).map((extension) => extension.slice(1));
    return extensions.length === 1 ? `**/*.${String(extensions[0])}` : `**/*.{${extensions.join(',')}}`;
}

/**
Build the blocks of each scope whose value differs from its parent, deepest last, so a nested scope overrides its
parent.

@param scopes the projects.
@param override what a scope holds, and the blocks that its value gives.
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
            ignores: listNestedScopes(
                changes.map((change) => change.scope.path),
                scope.path,
            ).map((path) => joinScope(escapeGlob(path), '**')),
        }),
    );
}

/**
Calculate the exact file sets that base blocks and the blocks of every framework share.

@param groups the file sets to combine.
@returns code patterns and intersections that leave out non-code files.
*/
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
    const node = buildNodePatterns(
        nodeFiles.filter((path) => !isCovered(path)),
        '',
    );
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
        tests: scopes.flatMap(({ scope, tests }) =>
            buildTestFiles(listCodeTestFiles(tests), code).map(([test, pattern]) => [
                test,
                joinScope(escapeGlob(scope), '**/*'),
                pattern,
            ]),
        ),
        scripts: scopes.flatMap(({ scope, scripts }) =>
            scripts.flatMap((script) => code.map((pattern) => [script, joinScope(escapeGlob(scope), '**/*'), pattern])),
        ),
    };
}

/**
Keep test patterns that can select source files supported by ESLint.

@param testFiles the cross-language test patterns.
@returns the patterns with no extension or with a supported source extension.
*/
export function listCodeTestFiles(testFiles: string[]): string[] {
    const extensions = listTaggedExtensions(...CODE_LANGUAGES, ...COMPONENT_CONFIGURATIONS, 'astro');
    return testFiles.filter((pattern) => {
        const extension = extractExtension(pattern);
        return extension === '' || !EXTENSION_PATTERN.test(extension) || extensions.includes(extension);
    });
}

/**
Escape detected Node paths for glob selectors within one project scope.

@param paths your repository-relative Node files.
@param scopePath the folder that owns these sources.
@returns literal file patterns that cannot select neighboring filenames.
*/
export function buildNodePatterns(paths: string[], scopePath: string): string[] {
    return paths.filter((path) => isInScope(path, scopePath)).map((path) => escapeGlob(path));
}

/**
Split globs into includes and excludes.

@param patterns your own or generated paths, with a leading ! for an exclusion.
*/
export function splitGlobs(patterns: string[]): PathExpressions {
    const included = includeFolderContents(patterns);
    return {
        includes: included.filter((pattern) => !pattern.startsWith('!')),
        excludes: included.filter((pattern) => pattern.startsWith('!')).map((pattern) => pattern.slice(1)),
    };
}

/**
Intersect file selectors with root-relative patterns and one literal project scope.

@param files the source selectors.
@param scopePath the project folder.
@param paths the repository-relative path patterns.
*/
export function buildScopeFiles(
    files: NonNullable<EslintBlockFields['files']>,
    scopePath: string,
    paths: (string | string[])[],
): NonNullable<EslintBlockFields['files']> {
    return files.flatMap((file) =>
        paths.map((path) => [
            ...(Array.isArray(file) ? file : [file]),
            joinScope(escapeGlob(scopePath), '**/*'),
            ...(Array.isArray(path) ? path : [path]),
        ]),
    );
}

/**
Intersect each authored test selector with the generated code selectors.

@param tests the test selectors.
@param code the code selectors.
@returns one intersection per test and code selector.
*/
export function buildTestFiles(tests: string[], code: string[]): [string, string][] {
    return tests.flatMap((test) => code.map((pattern): [string, string] => [test, pattern]));
}
