// Reads and replaces marked blocks in managed files.
import { GspotError } from '#cli/system/errors.ts';
import { LEADING_NEWLINE } from '#cli/config/text.ts';
import { MARKERS } from '#cli/config/system/managed-blocks.ts';
import type { BlockSpan, BlockContext } from '#cli/types/system/managed-blocks.ts';

/**
 * Locate one complete block. Refuse ambiguous or malformed markers.
 *
 * @param text the file contents.
 * @param context the file path and marker style.
 * @returns the character range of the block, or undefined when the file holds none.
 */
export function findBlockSpan(text: string, context: BlockContext): BlockSpan | undefined {
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
        throw new GspotError(
            'filesystem',
            `${context.path} has incomplete or repeated gspot block markers. Fix the markers, then run gspot apply.`,
        );
    }
    const end = closing + markersForStyle.end.length;
    const newline = LEADING_NEWLINE.exec(text.slice(end));
    if (newline !== null) return { start, end: end + newline[0].length };
    return { start, end };
}

/**
 * Replace a complete block or append it, and keep the text around it.
 *
 * @param existing the file text.
 * @param block the body to install.
 * @param context the file path and marker style.
 * @returns the file text with the block in place.
 */
export function replaceBlock(existing: string, block: string, context: BlockContext): string {
    const { start, end, gap } = MARKERS[context.style];
    const body = `${start}${gap}${block.trim()}${gap}${end}\n`;
    const span = findBlockSpan(existing, context);
    if (span !== undefined) return existing.slice(0, span.start) + body + existing.slice(span.end);
    if (existing === '') return body;
    const separator = existing.endsWith('\n') ? '\n' : '\n\n';
    return existing + separator + body;
}

/**
 * Read the block in a file.
 *
 * @param text the file contents.
 * @param context the file path and marker style.
 * @returns the trimmed block body, or undefined.
 */
export function readBlock(text: string, context: BlockContext): string | undefined {
    const span = findBlockSpan(text, context);
    if (span === undefined) return undefined;
    const { start, end } = MARKERS[context.style];
    const block = text.slice(span.start, span.end).trimEnd();
    return block.slice(start.length, -end.length).trim();
}

/**
 * Keep the text outside a managed block.
 *
 * @param text the file contents.
 * @param context the file path and marker style.
 * @returns the text with the managed block removed.
 */
export function stripBlock(text: string, context: BlockContext): string {
    const span = findBlockSpan(text, context);
    return span === undefined ? text : text.slice(0, span.start) + text.slice(span.end);
}
