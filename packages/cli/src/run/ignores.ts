import type { SourceObservations } from '#cli/types/repository.ts';
import type { Finding } from '#cli/types/reports.ts';
import { extensionOf } from '#cli/platform/paths.ts';
import type { IgnoreEntry } from '#cli/types/policy.ts';
// The [[ignore]] filter, the inline gspot-ignore syntax, and the suppression census input.
import { readSource } from '#cli/repository/tracked.ts';
import { pathMatcher } from '#cli/configurations/claims.ts';
import type { IgnoreUse, InlineIgnore } from '#cli/types/execution.ts';

import {
    COMMENT_OPENERS,
    COMMENT_STYLE_BY_EXTENSION,
    HTML_COMMENT_CLOSE,
    INLINE_IGNORE,
    REASON_INTRODUCER,
} from '#cli/emit/markers.ts';

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
