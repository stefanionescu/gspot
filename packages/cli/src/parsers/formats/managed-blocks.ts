import { GspotError } from '#cli/system/errors.ts';
import { MARKERS, LEADING_NEWLINE } from '#cli/config/parsers/formats/managed-blocks.ts';
import type { BlockSpan, BlockFile } from '#cli/types/parsers/formats/managed-blocks.ts';

/**
 * Locate one complete block. Refuse ambiguous or malformed markers.
 *
 * @param text the file contents.
 * @param file the file path and marker style.
 * @returns the character range of the block, or undefined when the file holds none.
 */
export function findBlockSpan(text: string, file: BlockFile): BlockSpan | undefined {
    const markersForStyle = MARKERS[file.style];
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
            `${file.path} has incomplete or repeated gspot block markers. Fix the markers, then run gspot apply.`,
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
 * @param text the file text.
 * @param block the body to install.
 * @param file the file path and marker style.
 * @returns the file text with the block in place.
 */
export function replaceBlock(text: string, block: string, file: BlockFile): string {
    const { start, end, gap } = MARKERS[file.style];
    const body = `${start}${gap}${block.trim()}${gap}${end}\n`;
    const span = findBlockSpan(text, file);
    if (span !== undefined) return text.slice(0, span.start) + body + text.slice(span.end);
    if (text === '') return body;
    const separator = text.endsWith('\n') ? '\n' : '\n\n';
    return text + separator + body;
}

/**
 * Find the gspot block in the text of a file, between its markers.
 *
 * @param text the file contents.
 * @param file the file path and marker style.
 * @returns the trimmed block body, or undefined.
 */
export function findBlockBody(text: string, file: BlockFile): string | undefined {
    const span = findBlockSpan(text, file);
    if (span === undefined) return undefined;
    const { start, end } = MARKERS[file.style];
    const block = text.slice(span.start, span.end).trimEnd();
    return block.slice(start.length, -end.length).trim();
}

/**
 * Keep the text outside a managed block.
 *
 * @param text the file contents.
 * @param file the file path and marker style.
 * @returns the text with the managed block removed.
 */
// eslint-disable-next-line gspot/no-trivial-functions -- reason: 4 calls in 3 files share it.
export function stripBlock(text: string, file: BlockFile): string {
    const span = findBlockSpan(text, file);
    return span === undefined ? text : text.slice(0, span.start) + text.slice(span.end);
}
