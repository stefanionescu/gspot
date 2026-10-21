import { listTaggedExtensions } from '#cli/repository/classify.ts';
import type { PathExpressions } from '#cli/types/repository/inventory.ts';
import { joinScope, isInScope, listNestedScopes } from '#cli/repository/scopes.ts';
import { CODE_LANGUAGES, COMPONENT_CONFIGURATIONS } from '#cli/config/generation/eslint.ts';
import { escapeGlob, buildPathMatcher, includeFolderContents } from '#cli/repository/matchers.ts';
import type { EslintFiles, EslintFileInputs, EslintSettingsBlock } from '#cli/types/generation/eslint.ts';

// Component selectors carry the parser discriminator for the declared component configurations.
function isComponentConfiguration(name: string): name is (typeof COMPONENT_CONFIGURATIONS)[number] {
    const names: readonly string[] = COMPONENT_CONFIGURATIONS;
    return names.includes(name);
}

/**
 * Calculate the exact file sets that base blocks and every framework fragment share.
 *
 * @param input the file sets to combine.
 *
 * @returns code patterns and intersections that leave out non-code files.
 */
export function buildFilePatterns(input: EslintFileInputs): EslintFiles {
    const { scopes, nodeFiles } = input;
    const source = buildSourcePattern(...CODE_LANGUAGES);
    const codeExtensions = listTaggedExtensions(...CODE_LANGUAGES);
    const selected = input.components.flatMap(({ configuration, tools }) =>
        tools
            .flatMap(({ eslint }) => eslint?.extensions ?? [])
            .filter((extension) => !codeExtensions.includes(extension))
            .map((extension) => ({ pattern: `**/*${extension}`, configuration: configuration.name })),
    );
    const components = selected.map(({ pattern }) => pattern);
    const covered = buildPathMatcher([source, ...components]);
    const node = buildNodePatterns(
        nodeFiles.filter((path) => !covered(path)),
        '',
    );
    const code = [source, ...components, ...node];
    const typescript = buildSourcePattern('typescript');
    const javascript = buildSourcePattern('javascript');
    return {
        code,
        typescriptSource: [typescript],
        typescript: [
            typescript,
            ...selected.map(({ pattern, configuration }): EslintFiles['typescript'][number] =>
                isComponentConfiguration(configuration) ? [pattern, { component: configuration }] : pattern,
            ),
        ],
        javascript: [javascript, ...node],
        tests: scopes.flatMap(({ scope, tests }) =>
            buildTestFiles(tests, code).map(([test, pattern]) => [test, buildScopeGlob(scope, '**/*'), pattern]),
        ),
        scripts: scopes.flatMap(({ scope, scripts }) =>
            scripts.flatMap((script) => code.map((pattern) => [script, buildScopeGlob(scope, '**/*'), pattern])),
        ),
    };
}

/**
 * Build one ESLint brace glob for the source extensions of the languages.
 *
 * @param languages the inventory language tags.
 *
 * @returns the repository-relative file pattern.
 */
export function buildSourcePattern(...languages: string[]): string {
    return `**/*.{${listTaggedExtensions(...languages)
        .map((extension) => extension.slice(1))
        .join(',')}}`;
}

/**
 * Escape detected Node paths for glob selectors within one project scope.
 *
 * @param paths your repository-relative Node files.
 * @param scope the folder that owns these sources.
 *
 * @returns literal file patterns that cannot select neighboring filenames.
 */
export function buildNodePatterns(paths: string[], scope: string): string[] {
    return paths.filter((path) => isInScope(path, scope)).map((path) => escapeGlob(path));
}

/**
 * Split globs into readable includes and excludes for blocks and runtime tests.
 *
 * @param patterns your own or generated paths, with a leading ! for an exclusion.
 *
 * @returns the expanded include and exclude globs.
 */
export function splitGlobSelectors(patterns: string[]): PathExpressions {
    const expanded = includeFolderContents(patterns);
    return {
        includes: expanded.filter((pattern) => !pattern.startsWith('!')),
        excludes: expanded.filter((pattern) => pattern.startsWith('!')).map((pattern) => pattern.slice(1)),
    };
}

/**
 * Intersect file selectors with root-relative patterns and one literal project scope.
 *
 * @param files the source selectors.
 * @param scope the project folder.
 * @param paths the repository-relative path patterns.
 *
 * @returns the intersections of code, project, and authored path selectors.
 */
export function buildScopeFiles(
    files: NonNullable<EslintSettingsBlock['files']>,
    scope: string,
    paths: (string | string[])[],
): NonNullable<EslintSettingsBlock['files']> {
    return files.flatMap((file) =>
        paths.map((path) => [
            ...(Array.isArray(file) ? file : [file]),
            buildScopeGlob(scope, '**/*'),
            ...(Array.isArray(path) ? path : [path]),
        ]),
    );
}

/**
 * Build a glob inside one literal repository scope.
 *
 * @param scope the project folder.
 * @param pattern the relative selector.
 * @returns the selector with a literal scope prefix.
 */
export function buildScopeGlob(scope: string, pattern: string): string {
    return joinScope(escapeGlob(scope), pattern);
}

/**
 * Exclude nested scopes with the same literal escaping used for includes.
 *
 * @param paths the project folders.
 * @param scope the parent folder.
 * @returns the child scope globs.
 */
export function listNestedScopeGlobs(paths: string[], scope: string): string[] {
    return listNestedScopes(paths, scope).map((path) => buildScopeGlob(path, '**'));
}

/**
 * Intersect each authored test selector with the generated code selectors.
 *
 * @param tests the test selectors.
 * @param code the code selectors.
 * @returns one intersection per test and code selector.
 */
export function buildTestFiles(tests: string[], code: string[]): [string, string][] {
    return tests.flatMap((test) => code.map((pattern): [string, string] => [test, pattern]));
}
