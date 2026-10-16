// Parses Git index, tree, and blob output.
import { z } from 'zod';
import { posix } from 'node:path';
import { LINE_FEED } from '#cli/config/text.ts';
import { GspotError } from '#cli/system/errors.ts';
import { decodeUtf8 } from '#cli/system/files/reads.ts';
import type { SchemaShape } from '#cli/types/objects.ts';
import { ANY_FOLDER_PREFIX } from '#cli/config/system/paths.ts';
import { GIT_ENTRY_MODES } from '#cli/config/repository/revisions.ts';
import type { GitEntry, GitStream, AttributeRule, GitIndexEntry } from '#cli/types/parsers/git.ts';

import {
    TREE_ENTRY,
    BLOB_HEADER,
    INDEX_ENTRY,
    BINARY_MACRO,
    LEADING_SLASH,
    ATTRIBUTE_LINE,
    ATTRIBUTE_FIELDS,
    BINARY_ATTRIBUTES,
    UNSUPPORTED_ENTRY,
} from '#cli/config/parsers/git.ts';

// Validate the fields captured from an index or committed-tree entry.

const gitEntrySchema = z.object({
    mode: z.enum(GIT_ENTRY_MODES),
    hash: z.string(),
    path: z.string(),
} satisfies SchemaShape<GitEntry>);

function splitEntries(text: string): string[] {
    return text.split('\0').filter(Boolean);
}

function parseEntry(match: RegExpExecArray | null): GitEntry {
    const entry = gitEntrySchema.safeParse(match?.groups);
    if (!entry.success) throw new GspotError('git', UNSUPPORTED_ENTRY);
    return entry.data;
}

// Ignore empty transport chunks. A missing required byte marks an incomplete Git response.
async function readNextChunk(stream: GitStream): Promise<boolean> {
    while (stream.cursor === stream.chunk.length) {
        const next = await stream.chunks.next();
        if (next.done === true) return false;
        stream.chunk = next.value;
        stream.cursor = 0;
    }
    return true;
}

async function readBlobLine(stream: GitStream): Promise<string> {
    const pieces: Buffer[] = [];
    while (await readNextChunk(stream)) {
        const end = stream.chunk.indexOf(LINE_FEED, stream.cursor);
        pieces.push(stream.chunk.subarray(stream.cursor, end === -1 ? stream.chunk.length : end));
        stream.cursor = end === -1 ? stream.chunk.length : end + 1;
        if (end !== -1) return Buffer.concat(pieces).toString('ascii');
    }
    throw new GspotError('git', 'The Git object stream is incomplete or invalid.');
}

async function readBytes(stream: GitStream, size: number): Promise<Buffer> {
    const bytes = Buffer.alloc(size);
    let filled = 0;
    while (filled < size) {
        if (!(await readNextChunk(stream)))
            throw new GspotError('git', 'The Git object stream is incomplete or invalid.');
        const length = Math.min(size - filled, stream.chunk.length - stream.cursor);
        stream.chunk.copy(bytes, filled, stream.cursor, stream.cursor + length);
        stream.cursor += length;
        filled += length;
    }
    return bytes;
}

function parseBlobSize(header: string, hash: string): number {
    const match = BLOB_HEADER.exec(header);
    const size = Number(match?.[2]);
    if (match?.[1] !== hash || !Number.isSafeInteger(size))
        throw new GspotError('git', 'The Git object stream is incomplete or invalid.');
    return size;
}

/**
 * Read attribute declarations in their file order, preserving quoted paths.
 * @param text the gitattributes source.
 * @param folder the repository-relative folder containing the declarations.
 * @returns selectors rooted in that folder and their declared attributes.
 */
export function parseAttributePatterns(text: string, folder: string): AttributeRule[] {
    // eslint-disable-next-line complexity -- reason: Git attribute records need complete field validation and one parser position; splitting it repeats record state.
    return text.split('\n').flatMap((line) => {
        const trimmed = line.trim();
        if (trimmed.startsWith('#')) return [];
        const match = ATTRIBUTE_LINE.exec(trimmed);
        if (match === null) return [];
        const raw = match[1] ?? '';
        const pattern = raw.startsWith('"') ? (JSON.parse(raw) as string) : raw;
        if (pattern.endsWith('/') || pattern.startsWith('!')) return [];
        const bare = pattern.replace(LEADING_SLASH, '');
        const local = LEADING_SLASH.test(pattern) || bare.includes('/') ? bare : `${ANY_FOLDER_PREFIX}${bare}`;
        return [
            {
                pattern: posix.join(folder, local),
                attributes: trimmed.slice(match[0].length).split(/\s+/u).filter(Boolean),
            },
        ];
    });
}

/**
 * Apply declarations over inherited attributes, clearing unspecified entries with the ! prefix.
 * @param declarations the attribute tokens from one matching pattern.
 * @param previous the attributes inherited from earlier declarations.
 * @returns the final attributes without mutating the inherited table.
 */
export function mergeAttributes(declarations: string[], previous: Record<string, string>): Record<string, string> {
    const attributes = { ...previous };
    for (const match of declarations) {
        const [name = '', value] = match.split('=');
        if (name.startsWith('!')) Reflect.deleteProperty(attributes, name.slice(1));
        else if (name.startsWith('-')) attributes[name.slice(1)] = 'unset';
        else attributes[name] = value ?? 'set';
        if (match === BINARY_MACRO) Object.assign(attributes, BINARY_ATTRIBUTES);
    }
    return attributes;
}

/**
 * Parse Git's null-delimited path, name, and value triplets without splitting spaces in paths.
 * @param text the successful check-attr -z output.
 * @returns the final attributes per path.
 */
export function parsePathAttributes(text: string): Map<string, Record<string, string>> {
    const fields = text.split('\0');
    const attributes = new Map<string, Record<string, string>>();
    for (let index = 0; index + ATTRIBUTE_FIELDS <= fields.length; index += ATTRIBUTE_FIELDS) {
        const [path, name, value] = fields.slice(index, index + ATTRIBUTE_FIELDS) as [string, string, string];
        let table = attributes.get(path);
        if (table === undefined) table = {};
        table[name] = value;
        attributes.set(path, table);
    }
    return attributes;
}

/**
 * Parse an unquoted index listing, retaining merge stages for working-tree inventory.
 * @param text the complete null-delimited listing.
 * @returns supported modes, full object IDs, stages, and paths.
 */
export function parseIndexEntries(text: string): GitIndexEntry[] {
    return splitEntries(text).map((line) => {
        const match = INDEX_ENTRY.exec(line);
        const entry = parseEntry(match);
        return { ...entry, stage: Number(match?.groups?.['stage']) };
    });
}

/**
 * Validate unquoted, null-delimited committed-tree entries.
 * @param output the complete Git listing.
 * @returns supported modes, full object IDs, and UTF-8 paths.
 */
export function parseTreeEntries(output: Uint8Array): GitEntry[] {
    const text = decodeUtf8(output);
    if (text === undefined) throw new GspotError('git', 'Revision paths must be valid UTF-8.');
    return splitEntries(text).map((line) => parseEntry(TREE_ENTRY.exec(line)));
}

/**
 * Project a shared index into immutable revision entries, refusing conflicts.
 * @param entries validated working-tree index entries.
 * @returns entries from the resolved index.
 */
export function stripIndexStages(entries: GitIndexEntry[]): GitEntry[] {
    if (entries.some((entry) => entry.stage !== 0)) throw new GspotError('git', UNSUPPORTED_ENTRY);
    return entries.map(({ mode, hash, path }) => ({ mode, hash, path }));
}

/**
 * Validate batch identities and framing while retaining only the current blob.
 * @param chunks raw output chunks in stream order.
 * @param requestedIds requested full object IDs in response order.
 * @returns each object's exact bytes before reading its successor.
 */
export async function* parseGitBlobs(
    chunks: AsyncIterable<Buffer>,
    requestedIds: readonly string[],
): AsyncGenerator<readonly [string, Buffer]> {
    const stream: GitStream = {
        chunks: chunks[Symbol.asyncIterator](),
        chunk: Buffer.alloc(0),
        cursor: 0,
    };
    for (const hash of requestedIds) {
        const bytes = await readBytes(stream, parseBlobSize(await readBlobLine(stream), hash));
        await readBytes(stream, 1);
        yield [hash, bytes];
    }
}
