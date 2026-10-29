import { posix } from 'node:path';
import { GspotError } from '#cli/system/errors.ts';
import type { TextRange } from '#cli/types/text.ts';
import { MARKERS, BLOCK_STYLES, LEADING_NEWLINE } from '#cli/config/parsers/formats/managed-blocks.ts';

/**
Locate one complete block. Refuse ambiguous or malformed markers.

@param text the file contents.
@param file the managed file.
@param file.path the repository-relative path.
@returns undefined when the file holds none.
*/
export function findBlockSpan(text: string, file: { path: string }): TextRange | undefined {
    const name = posix.basename(file.path);
    const markersForStyle =
        MARKERS[Object.hasOwn(BLOCK_STYLES, name) ? BLOCK_STYLES[name as keyof typeof BLOCK_STYLES] : 'hash'];
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
            `${file.path} has incomplete or repeated gspot block markers. Fix the markers, then run gspot apply.`,
        );
    }
    const end = closing + markersForStyle.end.length;
    const newline = LEADING_NEWLINE.exec(text.slice(end));
    return { start, end: newline === null ? end : end + newline[0].length };
}

/**
Replace a complete block or append it, and keep the text around it.

@param text the file text.
@param block the body to install.
@param file the managed file.
@param file.path the repository-relative path.
*/
export function replaceBlock(text: string, block: string, file: { path: string }): string {
    const name = posix.basename(file.path);
    const { start, end, gap } =
        MARKERS[Object.hasOwn(BLOCK_STYLES, name) ? BLOCK_STYLES[name as keyof typeof BLOCK_STYLES] : 'hash'];
    const span = findBlockSpan(text, file);
    const authored = span === undefined ? text : text.slice(0, span.start) + text.slice(span.end);
    const newline = authored.includes('\r\n') && !authored.replaceAll('\r\n', '').includes('\n') ? '\r\n' : '\n';
    const body = `${start}${gap}${block.trim()}${gap}${end}\n`.replaceAll('\r\n', '\n').replaceAll('\n', newline);
    if (span !== undefined) return text.slice(0, span.start) + body + text.slice(span.end);
    if (text === '') return body;
    const separator = text.endsWith('\n') ? newline : newline + newline;
    return text + separator + body;
}

/**
Find the gspot block in the text of a file, between its markers.

@param text the file contents.
@param file the managed file.
@param file.path the repository-relative path.
*/
export function findBlockBody(text: string, file: { path: string }): string | undefined {
    const span = findBlockSpan(text, file);
    if (span === undefined) return undefined;
    const name = posix.basename(file.path);
    const { start, end } =
        MARKERS[Object.hasOwn(BLOCK_STYLES, name) ? BLOCK_STYLES[name as keyof typeof BLOCK_STYLES] : 'hash'];
    const block = text.slice(span.start, span.end).trimEnd();
    return block.slice(start.length, -end.length).trim();
}

/**
Keep the text outside a managed block.

@param text the file contents.
@param file the managed file.
@param file.path the repository-relative path.
@returns the text with the managed block removed.
*/
// eslint-disable-next-line gspot/no-trivial-functions -- reason: 4 calls in 3 files share it.
export function stripBlock(text: string, file: { path: string }): string {
    const span = findBlockSpan(text, file);
    return span === undefined ? text : text.slice(0, span.start) + text.slice(span.end);
}
