import { MARKERS } from '#cli/config/platform/managed-blocks.ts';
import type { BlockSpan, BlockContext } from '#cli/types/platform/managed-blocks.ts';

/**
 * Locate one complete block. Refuse ambiguous or malformed markers.
 * @param text the file text
 * @param context the file path and marker style
 * @returns the block's character range, or undefined when the file holds none
 */
export function blockSpan(text: string, context: BlockContext): BlockSpan | undefined {
    const markersForStyle = MARKERS[context.style];
    const start = text.indexOf(markersForStyle.start);
    const closing = text.indexOf(markersForStyle.end);
    if (start === -1 && closing === -1) return undefined;
    if (
        start === -1 ||
        closing < start ||
        text.includes(markersForStyle.start, start + markersForStyle.start.length) ||
        text.includes(markersForStyle.end, closing + markersForStyle.end.length)
    ) {
        throw new Error(
            `${context.path} has incomplete or repeated gspot block markers. Fix the markers, then run gspot apply.`,
        );
    }
    const end = closing + markersForStyle.end.length;
    const newline = /^\r?\n/u.exec(text.slice(end));
    if (newline !== null) return { start, end: end + newline[0].length };
    return { start, end };
}

/**
 * Replace a complete block or append it, preserving authored bytes around it.
 * @param existing the file text
 * @param block the block body to install
 * @param context the file path and marker style
 * @returns the file text with the block in place
 */
export function applyBlock(existing: string, block: string, context: BlockContext): string {
    const { start, end } = MARKERS[context.style];
    const gap = context.style === 'markdown' ? '\n\n' : '\n';
    const body = `${start}${gap}${block.trim()}${gap}${end}\n`;
    const span = blockSpan(existing, context);
    if (span !== undefined) return existing.slice(0, span.start) + body + existing.slice(span.end);
    if (existing === '') return body;
    const separator = existing.endsWith('\n') ? '\n' : '\n\n';
    return existing + separator + body;
}

/**
 * The block currently in a file, or undefined.
 * @param text the file's text
 * @param context the file path and marker style
 * @returns the block body, trimmed
 */
export function currentBlock(text: string, context: BlockContext): string | undefined {
    const span = blockSpan(text, context);
    if (span === undefined) return undefined;
    const { start, end } = MARKERS[context.style];
    const block = text.slice(span.start, span.end).trimEnd();
    return block.slice(start.length, -end.length).trim();
}
