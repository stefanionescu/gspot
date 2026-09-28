import type { BlockSpan, BlockStyle } from '#cli/types/lifecycle/lifecycle.ts';

import {
    HASH_BLOCK_END,
    HASH_BLOCK_START,
    MANAGED_BLOCK_END,
    MANAGED_BLOCK_START,
} from '#cli/config/lifecycle/lifecycle.ts';

const MARKERS: Record<BlockStyle, { start: string; end: string }> = {
    markdown: { start: MANAGED_BLOCK_START, end: MANAGED_BLOCK_END },
    hash: { start: HASH_BLOCK_START, end: HASH_BLOCK_END },
};

/**
 * Locate one complete block. Refuse ambiguous or malformed markers.
 * @param text the file text
 * @param style the marker style of the file format
 * @returns the block's character range, or undefined when the file holds none
 */
export function blockSpan(text: string, style: BlockStyle): BlockSpan | undefined {
    const markersForStyle = MARKERS[style];
    const start = text.indexOf(markersForStyle.start);
    const closing = text.indexOf(markersForStyle.end);
    if (start === -1 && closing === -1) return undefined;
    if (
        start === -1 ||
        closing < start ||
        text.includes(markersForStyle.start, start + markersForStyle.start.length) ||
        text.includes(markersForStyle.end, closing + markersForStyle.end.length)
    ) {
        throw new Error('Managed block markers are incomplete or repeated. Preserve the file and resolve its markers.');
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
 * @param style the marker style of the file format
 * @returns the file text with the block in place
 */
export function applyBlock(existing: string, block: string, style: BlockStyle): string {
    const { start, end } = MARKERS[style];
    const gap = style === 'markdown' ? '\n\n' : '\n';
    const body = `${start}${gap}${block.trim()}${gap}${end}\n`;
    const span = blockSpan(existing, style);
    if (span !== undefined) return existing.slice(0, span.start) + body + existing.slice(span.end);
    if (existing === '') return body;
    const separator = existing.endsWith('\n') ? '\n' : '\n\n';
    return existing + separator + body;
}

/**
 * The block currently in a file, or undefined.
 * @param text the file's text
 * @param style markdown or hash markers
 * @returns the block body, trimmed
 */
export function currentBlock(text: string, style: BlockStyle): string | undefined {
    const { start, end } = MARKERS[style];
    const startIndex = text.indexOf(start);
    const endIndex = text.indexOf(end);
    if (startIndex === -1 || endIndex < startIndex) return undefined;
    return text.slice(startIndex + start.length, endIndex).trim();
}
