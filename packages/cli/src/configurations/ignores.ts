import { listIgnores } from '#cli/settings/scopes.ts';
import type { IgnoreSection } from '#cli/types/configurations/general.ts';
import type { CheckResult, CheckSession } from '#cli/types/engine/run.ts';
import type { ScopeSettings } from '#cli/types/settings.ts';

/**
Keep the findings in the files that the repository lists, for a tool that walks the disk past what Git tracks.
*/
export function keepListedFindings(session: CheckSession, result: CheckResult): CheckResult {
    const listed = new Set(session.repository.files.map(({ path }) => path));
    return { ...result, findings: result.findings.filter(({ file }) => listed.has(file)) };
}

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

export function listCheckIgnoreSections(scopeSettings: ScopeSettings, checkId: string): IgnoreSection[] {
    return listIgnores(scopeSettings, checkId)
        .filter((ignore) => ignore.rule === undefined)
        .map(({ reason, paths }): IgnoreSection => ({ key: 'settings', title: reason, patterns: paths ?? [] }));
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
