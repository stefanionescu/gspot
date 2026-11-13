import { isAnchoredPattern } from '#cli/repository/files/gitignore.ts';
import { listIgnores } from '#cli/settings/tables.ts';
import type { IgnoreSection, PlannedConfig } from '#cli/types/configurations/shared.ts';
import type { ScopeSettings } from '#cli/types/settings.ts';

export function convertToGlob(pattern: string): string {
    const negative = pattern.startsWith('!') ? '!' : '';
    let path = negative === '' ? pattern : pattern.slice(1);
    const isAnchored = path.startsWith('/');
    if (isAnchored) path = path.slice(1);
    const isFolder = path.endsWith('/');
    const bare = isFolder ? path.slice(0, -1) : path;
    const prefix = isAnchored || isAnchoredPattern(path) ? '' : '**/';
    return `${negative}${prefix}${bare}${isFolder ? '/**' : ''}`;
}

export function listCheckIgnoreSections(scopeSettings: ScopeSettings, checkId: string): IgnoreSection[] {
    return listIgnores(scopeSettings, checkId)
        .filter((ignore) => ignore.rule === undefined)
        .map(({ reason, paths }): IgnoreSection => ({ key: 'settings', title: reason, patterns: paths ?? [] }));
}

export function listPlannedIgnoreSections(planned: PlannedConfig, checkId: string): IgnoreSection[] {
    return [...planned.ignoreSections, ...listCheckIgnoreSections(planned.scope.settings, checkId)];
}

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

export function convertToGlobs(sections: IgnoreSection[]): string[] {
    const patterns = sections.flatMap((section) => [
        ...section.patterns.filter((pattern) => !pattern.startsWith('!')),
        ...section.patterns.filter((pattern) => pattern.startsWith('!')),
    ]);
    return [...new Set(patterns.map((pattern) => convertToGlob(pattern)))];
}

/**
Write the title of an ignore section as comment lines, one for each line of the title.
*/
export function commentSectionTitle(title: string, indent: string): string[] {
    return title
        .replaceAll('\r\n', '\n')
        .replaceAll('\r', '\n')
        .split('\n')
        .map((line) => `${indent}# ${line}`);
}
