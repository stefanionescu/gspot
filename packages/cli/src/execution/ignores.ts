// The [[ignore]] filter, the inline gspot-ignore syntax, and the suppression census input.
import { extensionOf } from '#cli/platform/paths.ts';
import { pathMatcher } from '#cli/repository/paths.ts';
import { readSource } from '#cli/repository/tracked.ts';
import type { Finding } from '#cli/types/checks/checks.ts';
import type { IgnoreEntry } from '#cli/types/policy/policy.ts';
import type { SourceComment } from '#cli/types/parsers/parsers.ts';
import type { SourceReads } from '#cli/types/repository/repository.ts';
import { commentText, sourceComments } from '#cli/parsers/comments.ts';
import type { IgnoreUse, InlineIgnore } from '#cli/types/execution/execution.ts';
import { INLINE_IGNORE, REASON_INTRODUCER, COMMENT_STYLE_BY_EXTENSION } from '#cli/config/execution/execution.ts';

function isEntryMatch(entry: IgnoreEntry, finding: Finding): boolean {
    if (entry.check !== finding.check) return false;
    if (entry.rule !== undefined && entry.rule !== finding.rule) return false;
    return entry.paths === undefined || entry.paths.length === 0 || pathMatcher(entry.paths)(finding.file);
}

function existingText(reads: SourceReads, path: string): string {
    try {
        return readSource(reads.root, path, reads).toString('utf8');
    } catch (error) {
        if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return '';
        throw error;
    }
}

function reasonIn(rest: string): string | undefined {
    const at = rest.indexOf(REASON_INTRODUCER);
    if (at === -1) return undefined;
    const reason = rest.slice(at + REASON_INTRODUCER.length).trim();
    return reason === '' ? undefined : reason;
}

function inlineIgnoreOf(style: string, comment: SourceComment): InlineIgnore | undefined {
    const text = commentText(comment.text);
    const match = INLINE_IGNORE[style]?.exec(text);
    const check = match?.[1];
    if (!match || check === undefined) return undefined;
    const reason = reasonIn(text.slice(match.index + match[0].length));
    return { line: comment.line + (comment.standalone ? 1 : 0), check, ...(reason === undefined ? {} : { reason }) };
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
 * @param reads the source bytes shared by this execution
 * @param path the file, relative to the root
 * @returns the ignores found
 */
export async function inlineIgnores(reads: SourceReads, path: string): Promise<InlineIgnore[]> {
    const style = COMMENT_STYLE_BY_EXTENSION[extensionOf(path)];
    if (style === undefined) return [];
    const comments = await sourceComments(path, existingText(reads, path));
    return comments.map((comment) => inlineIgnoreOf(style, comment)).filter((entry) => entry !== undefined);
}

/**
 * Applies inline ignores to findings from the gspot engines. The suppression check owns reason validation.
 * @param reads the source bytes shared by this execution
 * @param findings the findings before ignores
 * @returns the findings kept
 */
export async function applyInlineIgnores(reads: SourceReads, findings: Finding[]): Promise<Finding[]> {
    const byFile = new Map<string, InlineIgnore[]>();
    for (const finding of findings) {
        if (finding.engine === undefined || byFile.has(finding.file)) continue;
        byFile.set(finding.file, await inlineIgnores(reads, finding.file));
    }
    return findings.filter(
        (finding) =>
            finding.engine === undefined ||
            (byFile.get(finding.file) ?? []).every(
                (entry) => !(entry.check === finding.check && entry.line === finding.line),
            ),
    );
}
