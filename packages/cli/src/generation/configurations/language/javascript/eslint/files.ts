import { isInScope, joinScope } from '#cli/repository/scopes.ts';
import { EXTENSION_PATTERN } from '#cli/config/manifests/tool.ts';
import { escapeGlob, extractExtension } from '#cli/system/paths.ts';
import { listTaggedExtensions } from '#cli/repository/files/classify.ts';
import { buildPathMatcher, includeFolderContents } from '#cli/system/matchers.ts';

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

/**
Calculate the exact file sets that base blocks and the blocks of every framework share.

@param groups the file sets to combine.
@returns code patterns and intersections that leave out non-code files.
*/
export function buildFilePatterns(groups: EslintFileGroups): EslintFiles {
    const { scopes, nodeFiles } = groups;
    const source = `**/*.{${listTaggedExtensions(...CODE_LANGUAGES)
        .map((extension) => extension.slice(1))
        .join(',')}}`;
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
    const typescript = `**/*.{${listTaggedExtensions('typescript')
        .map((extension) => extension.slice(1))
        .join(',')}}`;
    const javascript = `**/*.{${listTaggedExtensions('javascript')
        .map((extension) => extension.slice(1))
        .join(',')}}`;
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
