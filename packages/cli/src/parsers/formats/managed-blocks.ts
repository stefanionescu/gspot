import { posix } from 'node:path';

import { BLOCK_STYLES, GITATTRIBUTES_FILE, LEADING_NEWLINE, MARKERS } from '#cli/config/parsers/formats.ts';
import { GspotError } from '#cli/system/errors.ts';
import type { TextRange } from '#cli/types/system.ts';

function addBlock(text: string, body: string, placement: { isFirst: boolean; newline: string }): string {
    const { isFirst, newline } = placement;
    if (text === '') return body;
    if (isFirst) return body + newline + text;
    return text + (text.endsWith('\n') ? newline : newline + newline) + body;
}

function selectMarkers(path: string): (typeof MARKERS)[keyof typeof MARKERS] {
    const name = posix.basename(path);
    return MARKERS[Object.hasOwn(BLOCK_STYLES, name) ? BLOCK_STYLES[name as keyof typeof BLOCK_STYLES] : 'hash'];
}

export function findBlockSpan(text: string, path: string): TextRange | undefined {
    const markersForStyle = selectMarkers(path);
    const start = text.indexOf(markersForStyle.start);
    const closing = text.indexOf(markersForStyle.end);
    if (start === -1 && closing === -1) return undefined;
    if (
        [
            start === -1,
            closing < start,
            text.includes(markersForStyle.start, start + markersForStyle.start.length),
            text.includes(markersForStyle.end, closing + markersForStyle.end.length),
        ].some(Boolean)
    ) {
        throw new GspotError(
            'filesystem',
            `${path} has incomplete or repeated gspot block markers. Fix the markers, then run gspot install.`,
        );
    }
    const end = closing + markersForStyle.end.length;
    const newline = LEADING_NEWLINE.exec(text.slice(end));
    return { start, end: newline === null ? end : end + newline[0].length };
}

/**
Replace a complete block or add it, and keep the text around it. A new block goes first in `.gitattributes`, because a
later line wins there, so the rules that the repository already has keep winning over the catch-all in the block.
*/
export function replaceBlock(text: string, block: string, path: string): string {
    const { start, end, gap } = selectMarkers(path);
    const span = findBlockSpan(text, path);
    const authored = span === undefined ? text : text.slice(0, span.start) + text.slice(span.end);
    const newline = authored.includes('\r\n') && !authored.replaceAll('\r\n', '').includes('\n') ? '\r\n' : '\n';
    const body = `${start}${gap}${block.trim()}${gap}${end}\n`.replaceAll('\r\n', '\n').replaceAll('\n', () => newline);
    if (span !== undefined) return text.slice(0, span.start) + body + text.slice(span.end);
    return addBlock(text, body, { isFirst: posix.basename(path) === GITATTRIBUTES_FILE, newline });
}

export function findBlockBody(text: string, path: string): string | undefined {
    const span = findBlockSpan(text, path);
    if (span === undefined) return undefined;
    const { start, end } = selectMarkers(path);
    const block = text.slice(span.start, span.end).trimEnd();
    return block.slice(start.length, -end.length).trim();
}

export function stripBlock(text: string, path: string): string {
    const span = findBlockSpan(text, path);
    return span === undefined ? text : text.slice(0, span.start) + text.slice(span.end);
}
