// The [[ignore]] filter, the inline gspot-ignore syntax, and the suppression census input.
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import type { Finding } from '#cli/output/finding.ts';
import type { IgnoreEntry } from '#cli/policy/types.ts';
import { extensionOf } from '#cli/platform/paths.ts';
import { pathMatcher } from '#cli/presets/claims.ts';
import type { IgnoreUse, InlineIgnore } from '#cli/run/types.ts';

import {
    COMMENT_OPENERS,
    COMMENT_STYLE_BY_EXTENSION,
    HTML_COMMENT_CLOSE,
    INLINE_IGNORE,
    REASON_INTRODUCER,
} from '#cli/emit/markers-definitions.ts';

function isEntryMatch(entry: IgnoreEntry, finding: Finding): boolean {
    if (entry.check !== finding.check) return false;
    if (entry.rule !== undefined && entry.rule !== finding.rule) return false;
    return entry.paths === undefined || entry.paths.length === 0 || pathMatcher(entry.paths)(finding.file);
}

function existingText(root: string, path: string): string {
    try {
        return readFileSync(join(root, path), 'utf8');
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
 * @param root the repository root
 * @param path the file, relative to the root
 * @returns the ignores found
 */
export function inlineIgnores(root: string, path: string): InlineIgnore[] {
    const style = COMMENT_STYLE_BY_EXTENSION[extensionOf(path)];
    if (style === undefined) return [];
    const lines = existingText(root, path).split('\n');
    return lines.map((line, index) => inlineIgnoreOf(style, line, index)).filter((entry) => entry !== undefined);
}

/**
 * Applies inline ignores to findings from the gspot engines. The suppression check owns reason validation.
 * @param root the repository root
 * @param findings the findings before ignores
 * @returns the findings kept
 */
export function applyInlineIgnores(root: string, findings: Finding[]): Finding[] {
    const byFile = new Map<string, InlineIgnore[]>();
    const inlineFor = (file: string): InlineIgnore[] => {
        const known = byFile.get(file);
        if (known) return known;
        const found = inlineIgnores(root, file);
        byFile.set(file, found);
        return found;
    };
    const kept = findings.filter(
        (finding) =>
            finding.engine === undefined ||
            inlineFor(finding.file).every((entry) => !(entry.check === finding.check && entry.line === finding.line)),
    );
    return kept;
}
