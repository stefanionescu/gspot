import { listTaggedExtensions } from '#cli/repository/files/tags.ts';
import { isInScope, joinScopeGlob } from '#cli/repository/scopes.ts';
import { listCodePatterns } from '#cli/configurations/language/javascript/sources.ts';
import { escapeGlob, buildPathMatcher, includeFolderContents } from '#cli/system/patterns.ts';
import { CODE_LANGUAGES, COMPONENT_CONFIGURATIONS } from '#cli/config/configurations/javascript/projects.ts';

import type {
    EslintFiles,
    PathExpressions,
    EslintFileGroups,
    EslintBlockFields,
} from '#cli/types/configurations/javascript.ts';

/**
Build the glob of the files of these languages.

@returns a plain extension for one extension, because picomatch reads a one-item brace as literal text.
*/
export function buildExtensionGlob(...languages: string[]): string {
    const extensions = listTaggedExtensions(...languages).map((extension) => extension.slice(1));
    return extensions.length === 1 ? `**/*.${String(extensions[0])}` : `**/*.{${extensions.join(',')}}`;
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
            buildTestFiles(listCodePatterns(tests), code).map(([test, pattern]) => [
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
