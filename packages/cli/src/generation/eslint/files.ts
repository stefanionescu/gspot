import { joinScope, isInScope } from '#cli/repository/scopes.ts';
import { listTaggedExtensions } from '#cli/repository/classify.ts';
import type { PathExpressions } from '#cli/types/repository/inventory.ts';
import { CODE_LANGUAGES, COMPONENT_CONFIGURATIONS } from '#cli/config/generation/eslint.ts';
import { escapeGlob, buildPathMatcher, includeFolderContents } from '#cli/repository/matchers.ts';
import type { EslintFiles, EslintFileInputs, EslintSettingsBlock } from '#cli/types/generation/eslint.ts';

/**
 * Calculate the exact file sets shared by base blocks and every framework fragment.
 *
 * @param input selected components, detected Node files, and your own test or script patterns.
 *
 * @returns code patterns and intersections that exclude non-code files.
 */
export function buildFilePatterns(input: EslintFileInputs): EslintFiles {
    const { tests, scripts, nodeFiles } = input;
    const source = buildSourcePattern(...CODE_LANGUAGES);
    const matchesSource = buildPathMatcher([source]);
    const selected = input.components.flatMap(({ configuration, tools }) =>
        tools
            .flatMap(({ eslint }) => eslint?.extensions ?? [])
            .filter((extension) => !matchesSource(`component${extension}`))
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
                configuration === COMPONENT_CONFIGURATIONS[0] || configuration === COMPONENT_CONFIGURATIONS[1]
                    ? [pattern, { component: configuration }]
                    : pattern,
            ),
        ],
        javascript: [javascript, ...node],
        tests: tests.flatMap((test) => code.map((pattern) => [test, pattern])),
        scripts: scripts.flatMap((script) => code.map((pattern) => [script, pattern])),
    };
}

/**
 * One ESLint brace glob for the source extensions the inventory assigns to the requested languages.
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
 * @param paths your repository-relative Node file paths.
 * @param scope the scope that owns these source files.
 *
 * @returns literal file patterns that cannot select neighboring filenames.
 */
export function buildNodePatterns(paths: string[], scope: string): string[] {
    return paths.filter((path) => isInScope(path, scope)).map((path) => escapeGlob(path));
}

/**
 * Preserve readable include and exclude globs for blocks and runtime predicates.
 *
 * @param patterns your own or generated paths, with a leading ! for an exclusion.
 *
 * @returns expanded globs with their inclusion polarity.
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
 * @param files the selected source files.
 * @param scope the selected project scope.
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
            joinScope(escapeGlob(scope), '**/*'),
            ...(Array.isArray(path) ? path : [path]),
        ]),
    );
}
