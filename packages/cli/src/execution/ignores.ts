import type { Finding } from '#cli/checks/result.ts';
import { extensionOf } from '#cli/platform/paths.ts';
// The [[ignore]] filter, the inline gspot-ignore syntax, and the suppression census input.
import { readSource } from '#cli/repository/tracked.ts';
import type { IgnoreEntry } from '#cli/policy/normalize.ts';
import { pathMatcher } from '#cli/repository/paths.ts';
import type { SourceObservations } from '#cli/repository/tracked.ts';

// The comment forms of an inline ignore. `marker` finds the comment and captures the check id; the
// reason is what follows `--` in the rest of the comment.
const INLINE_IGNORE: Record<string, RegExp> = {
    slash: /\/\/ ?gspot-ignore +([a-z0-9/-]+)/u,
    hash: /# ?gspot-ignore +([a-z0-9/-]+)/u,
    dash: /-- ?gspot-ignore +([a-z0-9/-]+)/u,
    html: /<!-- ?gspot-ignore +([a-z0-9/-]+)/u,
};

const REASON_INTRODUCER = '--';
const HTML_COMMENT_CLOSE = '-->';

function isEntryMatch(entry: IgnoreEntry, finding: Finding): boolean {
    if (entry.check !== finding.check) return false;
    if (entry.rule !== undefined && entry.rule !== finding.rule) return false;
    return entry.paths === undefined || entry.paths.length === 0 || pathMatcher(entry.paths)(finding.file);
}

function existingText(observations: SourceObservations, path: string): string {
    try {
        return readSource(observations.root, path, observations).toString('utf8');
    } catch (error) {
        if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return '';
        throw error;
    }
}

function reasonIn(rest: string): string | undefined {
    const close = rest.indexOf(HTML_COMMENT_CLOSE);
    const body = close === -1 ? rest : rest.slice(0, close);
    const at = body.indexOf(REASON_INTRODUCER);
    if (at === -1) return undefined;
    const reason = body.slice(at + REASON_INTRODUCER.length).trim();
    return reason === '' ? undefined : reason;
}

function targetLine(style: string, line: string, index: number): number {
    const isStandalone = (COMMENT_OPENERS[style] ?? []).some((opener) => line.trim().startsWith(opener));
    return index + (isStandalone ? 2 : 1);
}

function inlineIgnoreOf(style: string, line: string, index: number): InlineIgnore | undefined {
    const match = INLINE_IGNORE[style]?.exec(line);
    const check = match?.[1];
    if (!match || check === undefined) return undefined;
    const reason = reasonIn(line.slice(match.index + match[0].length));
    return { line: targetLine(style, line, index), check, ...(reason === undefined ? {} : { reason }) };
}

export const COMMENT_STYLE_BY_EXTENSION: Record<string, keyof typeof INLINE_IGNORE> = {
    '.ts': 'slash',
    '.tsx': 'slash',
    '.js': 'slash',
    '.mjs': 'slash',
    '.cjs': 'slash',
    '.jsx': 'slash',
    '.swift': 'slash',
    '.css': 'slash',
    '.scss': 'slash',
    '.py': 'hash',
    '.sh': 'hash',
    '.bash': 'hash',
    '.zsh': 'hash',
    '.toml': 'hash',
    '.yml': 'hash',
    '.yaml': 'hash',
    '.rb': 'hash',
    '.sql': 'dash',
    '.pgsql': 'dash',
    '.psql': 'dash',
    '.md': 'html',
    '.html': 'html',
    '.htm': 'html',
};

export const COMMENT_OPENERS: Record<string, string[]> = {
    slash: ['//', '/*'],
    hash: ['#'],
    dash: ['--'],
    html: ['<!--'],
};

/**
 * Splits findings into kept and ignored, counting how many each entry matched.
 * @param findings the findings of one check
 * @param entries the [[ignore]] entries for that check
 * @returns the findings kept and the match count per entry
 */
export function applyIgnores(findings: Finding[], entries: IgnoreEntry[]): { kept: Finding[]; uses: IgnoreUse[] } {
    const uses: IgnoreUse[] = entries.map((entry) => ({ entry, matched: 0 }));
    const kept: Finding[] = [];
    for (const finding of findings) {
        const use = uses.find((candidate) => isEntryMatch(candidate.entry, finding));
        if (use) use.matched += 1;
        else kept.push(finding);
    }
    return { kept, uses };
}

/**
 * Inline gspot-ignore comments in one file, with the line each applies to (the same line, or the next when the comment stands alone).
 * @param observations the source bytes shared by this execution
 * @param path the file, relative to the root
 * @returns the ignores found
 */
export function inlineIgnores(observations: SourceObservations, path: string): InlineIgnore[] {
    const style = COMMENT_STYLE_BY_EXTENSION[extensionOf(path)];
    if (style === undefined) return [];
    const lines = existingText(observations, path).split('\n');
    return lines.map((line, index) => inlineIgnoreOf(style, line, index)).filter((entry) => entry !== undefined);
}

/**
 * Applies inline ignores to findings from the gspot engines. The suppression check owns reason validation.
 * @param observations the source bytes shared by this execution
 * @param findings the findings before ignores
 * @returns the findings kept
 */
export function applyInlineIgnores(observations: SourceObservations, findings: Finding[]): Finding[] {
    const byFile = new Map<string, InlineIgnore[]>();
    const inlineFor = (file: string): InlineIgnore[] => {
        const known = byFile.get(file);
        if (known) return known;
        const found = inlineIgnores(observations, file);
        byFile.set(file, found);
        return found;
    };
    return findings.filter(
        (finding) =>
            finding.engine === undefined ||
            inlineFor(finding.file).every((entry) => !(entry.check === finding.check && entry.line === finding.line)),
    );
}

export type IgnoreUse = { entry: IgnoreEntry; matched: number };

export type InlineIgnore = { line: number; check: string; reason?: string };
