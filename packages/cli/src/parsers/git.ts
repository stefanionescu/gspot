// Parse Git index and tree listings, and validate binary object stream framing.
import { decodeUtf8 } from '#cli/platform/text.ts';
import { GspotError } from '#cli/platform/errors.ts';
import { gitEntrySchema } from '#cli/parsers/schema/git.ts';
import type { GitEntry, GitFrame, GitIndexEntry } from '#cli/types/parsers/git.ts';

import {
    LINE_FEED,
    TREE_ENTRY,
    BLOB_HEADER,
    INDEX_ENTRY,
    FRAME_NEWLINES,
    UNSUPPORTED_ENTRY,
} from '#cli/config/parsers/git.ts';

function parseFrame(output: Buffer, cursor: number, hash: string): GitFrame {
    const end = output.indexOf(LINE_FEED, cursor);
    const header = output.subarray(cursor, end).toString('ascii');
    const match = BLOB_HEADER.exec(header);
    const size = Number(match?.[2]);
    if (
        end < cursor ||
        match?.[1] !== hash ||
        !Number.isSafeInteger(size) ||
        end + size + 1 >= output.length ||
        output[end + size + 1] !== LINE_FEED
    )
        throw new GspotError('selection', ['The Git object stream is incomplete or invalid.']);
    return { end, size };
}

function entryLines(text: string): string[] {
    if (text !== '' && !text.endsWith('\0')) throw new GspotError('selection', ['The Git entry stream is incomplete.']);
    return text.split('\0').filter(Boolean);
}

function parseEntry(match: RegExpExecArray | null): GitEntry {
    const entry = gitEntrySchema.safeParse(match?.groups);
    if (!entry.success) throw new GspotError('selection', [UNSUPPORTED_ENTRY]);
    return entry.data;
}

/**
 * Parse an unquoted index listing, retaining merge stages for working-tree inventory.
 * @param text the complete NUL-delimited listing
 * @returns supported modes, full object IDs, stages, and paths
 */
export function parseIndexEntries(text: string): GitIndexEntry[] {
    return entryLines(text).map((line) => {
        const match = INDEX_ENTRY.exec(line);
        const entry = parseEntry(match);
        return { ...entry, stage: Number(match?.groups?.['stage']) };
    });
}

/**
 * Validate unquoted, NUL-delimited index or committed-tree entries.
 * @param output the complete Git listing
 * @param kind the index or committed-tree format
 * @returns supported modes, full object IDs, and UTF-8 paths
 */
export function parseGitEntries(output: Uint8Array, kind: 'index' | 'commit'): GitEntry[] {
    const text = decodeUtf8(output);
    if (text === undefined) throw new GspotError('selection', ['Revision paths must be valid UTF-8.']);
    if (kind === 'commit') return entryLines(text).map((line) => parseEntry(TREE_ENTRY.exec(line)));
    const entries = parseIndexEntries(text);
    if (entries.some((entry) => entry.stage !== 0)) throw new GspotError('selection', [UNSUPPORTED_ENTRY]);
    return entries.map(({ mode, hash, path }) => ({ mode, hash, path }));
}

/**
 * Validate every identity, byte count, and delimiter in a Git batch response.
 * @param output the complete binary response
 * @param objects requested full object IDs in response order
 * @returns the exact bytes of each requested blob
 */
export function parseGitBlobs(output: Buffer, objects: readonly string[]): Map<string, Buffer> {
    const blobs = new Map<string, Buffer>();
    let cursor = 0;
    for (const hash of objects) {
        const { end, size } = parseFrame(output, cursor, hash);
        blobs.set(hash, output.subarray(end + 1, end + size + 1));
        cursor = end + size + FRAME_NEWLINES;
    }
    if (cursor !== output.length)
        throw new GspotError('selection', ['The Git object stream contains unexpected data.']);
    return blobs;
}
