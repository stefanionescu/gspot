// The [[ignore]] filter, the inline gspot-ignore syntax, and the suppression census input.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { COMMENT_STYLE_BY_EXTENSION, INLINE_IGNORE } from '#config/markers.ts';
import { extensionOf } from '#cli/platform/paths.ts';
import { pathMatcher } from '#cli/presets/claims.ts';
import type { IgnoreEntry } from '#types/config.ts';
import type { Finding } from '#types/finding.ts';

export type IgnoreUse = { entry: IgnoreEntry; matched: number };

export type InlineIgnore = { line: number; check: string; reason?: string };

/** Splits findings into kept and ignored, counting how many each entry matched. */
export function applyIgnores(findings: Finding[], entries: IgnoreEntry[]): { kept: Finding[]; uses: IgnoreUse[] } {
    const uses: IgnoreUse[] = entries.map((entry) => ({ entry, matched: 0 }));
    const kept: Finding[] = [];
    for (const finding of findings) {
        let ignored = false;
        for (const use of uses) {
            const { entry } = use;
            if (entry.check !== finding.check) continue;
            if (entry.rule !== undefined && entry.rule !== finding.rule) continue;
            if (
                entry.finding !== undefined &&
                !finding.message.includes(entry.finding) &&
                entry.finding !== finding.rule
            )
                continue;
            if (entry.paths !== undefined && entry.paths.length > 0 && !pathMatcher(entry.paths)(finding.file))
                continue;
            use.matched += 1;
            ignored = true;
            break;
        }
        if (!ignored) kept.push(finding);
    }
    return { kept, uses };
}

/** Rules an [[ignore]] with no paths turns off for a check, rendered into the tool's own disable list. */
export function rulesTurnedOff(entries: IgnoreEntry[], check: string): string[] {
    return entries
        .filter(
            (entry) =>
                entry.check === check &&
                entry.rule !== undefined &&
                (entry.paths === undefined || entry.paths.length === 0),
        )
        .map((entry) => entry.rule!);
}

/** Inline gspot-ignore comments in one file, with the line each applies to (the same line, or the next when the comment stands alone). */
export function inlineIgnores(root: string, path: string): InlineIgnore[] {
    const style = COMMENT_STYLE_BY_EXTENSION[extensionOf(path)];
    if (!style) return [];
    const pattern = INLINE_IGNORE[style]!;
    let text: string;
    try {
        text = readFileSync(join(root, path), 'utf8');
    } catch {
        return [];
    }
    const found: InlineIgnore[] = [];
    const lines = text.split('\n');
    lines.forEach((line, index) => {
        const match = line.match(pattern);
        if (!match) return;
        const standalone = line
            .trim()
            .startsWith(style === 'slash' ? '//' : style === 'hash' ? '#' : style === 'dash' ? '--' : '<!--');
        const reason = match[2]?.trim();
        found.push({ line: standalone ? index + 2 : index + 1, check: match[1]!, ...(reason ? { reason } : {}) });
    });
    return found;
}

/** Applies inline ignores to findings from gspot's own engines. A suppression without a reason becomes a finding itself. */
export function applyInlineIgnores(root: string, findings: Finding[]): Finding[] {
    const byFile = new Map<string, InlineIgnore[]>();
    const out: Finding[] = [];
    for (const finding of findings) {
        if (
            !finding.check.startsWith('structure/') &&
            !finding.check.startsWith('naming/') &&
            !finding.check.startsWith('integrity/') &&
            !finding.check.startsWith('prose/')
        ) {
            out.push(finding);
            continue;
        }
        let inline = byFile.get(finding.file);
        if (!inline) {
            inline = inlineIgnores(root, finding.file);
            byFile.set(finding.file, inline);
        }
        const hit = inline.find((entry) => entry.check === finding.check && entry.line === finding.line);
        if (!hit) out.push(finding);
    }
    for (const [file, inline] of byFile) {
        for (const entry of inline) {
            if (entry.reason === undefined)
                out.push({
                    check: 'integrity/suppressions',
                    file,
                    line: entry.line,
                    rule: 'gspot-ignore',
                    message: `This gspot-ignore for ${entry.check} has no reason.`,
                    help: 'Write the reason after two dashes: gspot-ignore <check> -- why this line is fine.',
                    fixable: false,
                });
        }
    }
    return out;
}
