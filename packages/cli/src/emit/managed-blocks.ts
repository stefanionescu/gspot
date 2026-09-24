import { PRIVATE_PATHS } from '#cli/platform/paths.ts';
import type { Manifest } from '#cli/configurations/read-manifests.ts';
// Marker blocks in the agent instruction files, .gitignore, and lefthook.yml; text outside the markers is never read or moved.

import { configurationManifests } from '#cli/configurations/read-manifests.ts';

const MANAGED_BLOCK_START = '<!-- >>> gspot managed >>> -->';
const MANAGED_BLOCK_END = '<!-- <<< gspot managed <<< -->';

const HASH_BLOCK_START = '# >>> gspot managed >>>';
const HASH_BLOCK_END = '# <<< gspot managed <<<';

/**
 * Locate one complete block, refusing ambiguous or malformed markers.
 * @param text
 * @param style
 */
export function blockSpan(text: string, style: BlockStyle): { start: number; end: number } | undefined {
    const markersForStyle =
        style === 'markdown'
            ? { start: MANAGED_BLOCK_START, end: MANAGED_BLOCK_END }
            : { start: HASH_BLOCK_START, end: HASH_BLOCK_END };
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
    let end = closing + markersForStyle.end.length;
    if (text[end] === '\r' && text[end + 1] === '\n') end += 2;
    else if (text[end] === '\n') end += 1;
    return { start, end };
}

/**
 * Replace a complete block or append it, preserving authored bytes around it.
 * @param existing
 * @param block
 * @param style
 */
export function applyBlock(existing: string, block: string, style: BlockStyle): string {
    const { start, end } =
        style === 'markdown'
            ? { start: MANAGED_BLOCK_START, end: MANAGED_BLOCK_END }
            : { start: HASH_BLOCK_START, end: HASH_BLOCK_END };
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
    const { start, end } =
        style === 'markdown'
            ? { start: MANAGED_BLOCK_START, end: MANAGED_BLOCK_END }
            : { start: HASH_BLOCK_START, end: HASH_BLOCK_END };
    const startIndex = text.indexOf(start);
    const endIndex = text.indexOf(end);
    if (startIndex === -1 || endIndex < startIndex) return undefined;
    return text.slice(startIndex + start.length, endIndex).trim();
}

/**
 * The .gitignore block: the paths gspot writes that git never tracks.
 * @param manifests
 * @returns the block body
 */
export function gitignoreBlock(
    manifests: Iterable<Pick<Manifest, 'untracked'>> = configurationManifests().values(),
): string {
    return [...new Set([...PRIVATE_PATHS, ...[...manifests].flatMap((manifest) => manifest.untracked)])].join('\n');
}

export type BlockStyle = 'markdown' | 'hash';
