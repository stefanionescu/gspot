import { listIgnores } from '#cli/settings/scopes.ts';
import type { ScopeSettings } from '#cli/types/settings.ts';
import type { IgnoreSection } from '#cli/types/configurations/general.ts';

/**
Convert one gitignore pattern to the glob that config files use.

@param pattern the gitignore pattern, which may start with ! or /.
@returns the glob, rooted at the repository unless the pattern names a bare file or folder name.
*/
export function convertToGlob(pattern: string): string {
    const negative = pattern.startsWith('!') ? '!' : '';
    let path = negative === '' ? pattern : pattern.slice(1);
    const isAnchored = path.startsWith('/');
    if (isAnchored) path = path.slice(1);
    const isFolder = path.endsWith('/');
    const bare = isFolder ? path.slice(0, -1) : path;
    const prefix = isAnchored || bare.includes('/') ? '' : '**/';
    return `${negative}${prefix}${bare}${isFolder ? '/**' : ''}`;
}

/**
List the path ignores of one check, each with its written reason.

@param scopeSettings the merged settings and ignores of the scope.
@param checkId the ID whose path ignores apply.
*/
export function listCheckIgnoreSections(scopeSettings: ScopeSettings, checkId: string): IgnoreSection[] {
    return listIgnores(scopeSettings, checkId)
        .filter((ignore) => ignore.rule === undefined)
        .map(({ reason, paths }): IgnoreSection => ({ key: 'settings', title: reason, patterns: paths ?? [] }));
}

/**
Keep each pattern in its first section.

@param sections the ordered sections.
*/
export function keepFirstPatterns(sections: IgnoreSection[]): IgnoreSection[] {
    const seen = new Set<string>();
    return sections.map((section) => ({
        ...section,
        patterns: section.patterns.filter((pattern) => {
            if (seen.has(pattern)) return false;
            seen.add(pattern);
            return true;
        }),
    }));
}

/**
Convert the sections to the globs that config files use.

@param sections the ordered exclusion groups and their written reasons.
@returns the globs, each once.
*/
export function convertToGlobs(sections: IgnoreSection[]): string[] {
    const patterns = sections.flatMap((section) => [
        ...section.patterns.filter((pattern) => !pattern.startsWith('!')),
        ...section.patterns.filter((pattern) => pattern.startsWith('!')),
    ]);
    return [...new Set(patterns.map((pattern) => convertToGlob(pattern)))];
}
