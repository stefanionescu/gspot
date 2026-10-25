import { escapeGlob, extractExtension } from '#cli/system/paths.ts';
import { listTaggedExtensions } from '#cli/repository/files/classify.ts';
import { buildPathMatcher, includeFolderContents } from '#cli/system/matchers.ts';
import { isInScope, joinScope, listNestedScopes } from '#cli/repository/scopes.ts';

import {
    CODE_LANGUAGES,
    COMPONENT_CONFIGURATIONS,
} from '#cli/config/generation/configurations/language/javascript/eslint/config-file.ts';
import {
    type EslintFiles,
    type PathExpressions,
    type EslintFileGroups,
    type EslintBlockFields,
} from '#cli/types/generation/eslint.ts';

// eslint-disable-next-line gspot/no-trivial-functions -- reason: Callers narrow the type through it.
function isComponentConfiguration(name: string): name is (typeof COMPONENT_CONFIGURATIONS)[number] {
    const names: readonly string[] = COMPONENT_CONFIGURATIONS;
    return names.includes(name);
}

/**
Calculate the exact file sets that base blocks and the blocks of every framework share.

@param groups the file sets to combine.
@returns code patterns and intersections that leave out non-code files.
*/
export function buildFilePatterns(groups: EslintFileGroups): EslintFiles {
    const { scopes, nodeFiles } = groups;
    const source = buildSourcePattern(...CODE_LANGUAGES);
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
    const typescript = buildSourcePattern('typescript');
    const javascript = buildSourcePattern('javascript');
    return {
        code,
        typescript: [typescript],
        typed: [
            typescript,
            ...selected.map(({ pattern, configuration }): EslintFiles['typed'][number] =>
                isComponentConfiguration(configuration) ? [pattern, { component: configuration }] : pattern,
            ),
        ],
        javascript: [javascript, ...node],
        tests: scopes.flatMap(({ scope, tests }) =>
            buildTestFiles(listCodeTestFiles(tests), code).map(([test, pattern]) => [
                test,
                buildScopeGlob(scope),
                pattern,
            ]),
        ),
        scripts: scopes.flatMap(({ scope, scripts }) =>
            scripts.flatMap((script) => code.map((pattern) => [script, buildScopeGlob(scope), pattern])),
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
        return extension === '' || !/^\.[a-z0-9]+$/u.test(extension) || extensions.includes(extension);
    });
}

/**
Select one literal scope with a source pattern.

@param scope the repository-relative project folder.
@param pattern the pattern within that folder.
@returns the escaped scope joined with the pattern.
*/
// eslint-disable-next-line gspot/no-trivial-functions -- reason: The rule in the plugin source does not report it.
export function buildScopeGlob(scope: string, pattern = '**/*'): string {
    return joinScope(escapeGlob(scope), pattern);
}

/**
Build one ESLint brace glob for the source extensions of the languages.

@param languages the inventory language tags.

@returns the repository-relative file pattern.
*/
// eslint-disable-next-line gspot/no-trivial-functions -- reason: 10 calls in 5 files share it.
export function buildSourcePattern(...languages: string[]): string {
    return `**/*.{${listTaggedExtensions(...languages)
        .map((extension) => extension.slice(1))
        .join(',')}}`;
}

/**
Escape detected Node paths for glob selectors within one project scope.

@param paths your repository-relative Node files.
@param scope the folder that owns these sources.

@returns literal file patterns that cannot select neighboring filenames.
*/
export function buildNodePatterns(paths: string[], scope: string): string[] {
    return paths.filter((path) => isInScope(path, scope)).map((path) => escapeGlob(path));
}

/**
Split globs into readable includes and excludes for blocks and runtime tests.

@param patterns your own or generated paths, with a leading ! for an exclusion.

@returns the expanded include and exclude globs.
*/
export function splitGlobs(patterns: string[]): PathExpressions {
    const expanded = includeFolderContents(patterns);
    return {
        includes: expanded.filter((pattern) => !pattern.startsWith('!')),
        excludes: expanded.filter((pattern) => pattern.startsWith('!')).map((pattern) => pattern.slice(1)),
    };
}

/**
Intersect file selectors with root-relative patterns and one literal project scope.

@param files the source selectors.
@param scope the project folder.
@param paths the repository-relative path patterns.
@returns the intersections of the code, project, and your own path selectors.
*/
export function buildScopeFiles(
    files: NonNullable<EslintBlockFields['files']>,
    scope: string,
    paths: (string | string[])[],
): NonNullable<EslintBlockFields['files']> {
    return files.flatMap((file) =>
        paths.map((path) => [
            ...(Array.isArray(file) ? file : [file]),
            buildScopeGlob(scope),
            ...(Array.isArray(path) ? path : [path]),
        ]),
    );
}

/**
Exclude nested scopes with the same literal escaping used for includes.

@param paths the project folders.
@param scope the parent folder.
@returns the child scope globs.
*/
// eslint-disable-next-line gspot/no-trivial-functions -- reason: 7 calls in 4 files share it.
export function listNestedScopeGlobs(paths: string[], scope: string): string[] {
    return listNestedScopes(paths, scope).map((path) => buildScopeGlob(path, '**'));
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
