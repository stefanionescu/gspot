// Marker blocks in the agent instruction files, .gitignore, and lefthook.yml; text outside the markers is never read or moved.
import { join } from 'node:path';
import type { BlockStyle } from '#types/emit.ts';
import { existsSync, readFileSync } from 'node:fs';
import { HASH_BLOCK_END, HASH_BLOCK_START, MANAGED_BLOCK_END, MANAGED_BLOCK_START } from '#config/markers.ts';

const GITIGNORE_LINES = [
    '.gspot/node_modules/',
    '.gspot/.venv/',
    '.gspot/ownership.json',
    '.gspot/mutation.lock',
    '.gspot/recovery/',
    '.gspot/cache/',
    '.gspot/report.json',
    '.gspot/report.sarif',
    '.gspot/report.codequality.json',
    '.gspot/vale/styles/Google/',
    '.gspot/vale/styles/Microsoft/',
    '.gspot/vale/styles/write-good/',
    '.gspot/vale/styles/proselint/',
    '.gspot/vale/styles/alex/',
    '.gspot/vale/styles/RedHat/',
    '.gspot/vale/styles/Readability/',
    '.gspot/vale/styles/Harper/',
    '.gspot/vale/styles/.vale-config/',
    '.gspot/vale/styles/config/dictionaries/',
];

function markers(style: BlockStyle): { start: string; end: string } {
    return style === 'markdown'
        ? { start: MANAGED_BLOCK_START, end: MANAGED_BLOCK_END }
        : { start: HASH_BLOCK_START, end: HASH_BLOCK_END };
}

/** Locate one complete block, refusing ambiguous or malformed markers. */
export function blockSpan(text: string, style: BlockStyle): { start: number; end: number } | undefined {
    const markersForStyle = markers(style);
    const start = text.indexOf(markersForStyle.start);
    const closing = text.indexOf(markersForStyle.end);
    if (start === -1 && closing === -1) return undefined;
    if (
        start === -1 ||
        closing < start ||
        text.indexOf(markersForStyle.start, start + markersForStyle.start.length) !== -1 ||
        text.indexOf(markersForStyle.end, closing + markersForStyle.end.length) !== -1
    ) {
        throw new Error('Managed block markers are incomplete or repeated. Preserve the file and resolve its markers.');
    }
    let end = closing + markersForStyle.end.length;
    if (text[end] === '\r' && text[end + 1] === '\n') end += 2;
    else if (text[end] === '\n') end += 1;
    return { start, end };
}

/** Replace a complete block or append it, preserving authored bytes around it. */
export function applyBlock(existing: string, block: string, style: BlockStyle): string {
    const { start, end } = markers(style);
    const gap = style === 'markdown' ? '\n\n' : '\n';
    const body = `${start}${gap}${block.trim()}${gap}${end}\n`;
    const span = blockSpan(existing, style);
    if (span !== undefined) return existing.slice(0, span.start) + body + existing.slice(span.end);
    return existing + (existing === '' ? '' : existing.endsWith('\n') ? '\n' : '\n\n') + body;
}

/**
 * The block currently in a file, or undefined.
 * @param text the file's text
 * @param style markdown or hash markers
 * @returns the block body, trimmed
 */
export function currentBlock(text: string, style: BlockStyle): string | undefined {
    const { start, end } = markers(style);
    const startIndex = text.indexOf(start);
    const endIndex = text.indexOf(end);
    if (startIndex === -1 || endIndex < startIndex) return undefined;
    return text.slice(startIndex + start.length, endIndex).trim();
}

/**
 * The text of a file, or '' when absent.
 * @param root the repository root
 * @param path the file, relative to the root
 * @returns the text
 */
export function fileText(root: string, path: string): string {
    const full = join(root, path);
    return existsSync(full) ? readFileSync(full, 'utf8') : '';
}

/**
 * The .gitignore block: the paths gspot writes that git never tracks.
 * @returns the block body
 */
export function gitignoreBlock(): string {
    return GITIGNORE_LINES.join('\n');
}
