// Parses .gitattributes text and the index, tree, and blob output of Git.
import { posix } from 'node:path';
import { LINE_FEED } from '#cli/config/text.ts';
import { GspotError } from '#cli/system/errors.ts';
import { decodeUtf8 } from '#cli/system/files/reads.ts';
import { gitEntrySchema } from '#cli/schemas/parsers/git.ts';
import { LEADING_SLASH } from '#cli/config/files/path-patterns.ts';
import type { GitEntry, GitStream, GitIndexEntry, AttributePattern } from '#cli/types/parsers/git.ts';

import {
    TREE_ENTRY,
    BLOB_HEADER,
    INDEX_ENTRY,
    BINARY_MACRO,
    PATH_ESCAPES,
    ATTRIBUTE_LINE,
    OCTAL_PATH_BYTE,
    ATTRIBUTE_FIELDS,
    ANY_FOLDER_PREFIX,
    QUOTED_PATH_PARTS,
    BINARY_ATTRIBUTES,
    UNSUPPORTED_ENTRY,
    IGNORED_ATTRIBUTE_LINE,
    QUOTED_ATTRIBUTE_PATTERN,
    IGNORED_ATTRIBUTE_PATTERN,
    INVALID_GIT_STREAM_MESSAGE,
} from '#cli/config/parsers/git.ts';

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
    throw new GspotError('git', INVALID_GIT_STREAM_MESSAGE);
}

async function readStreamBytes(stream: GitStream, size: number): Promise<Buffer> {
    const bytes = Buffer.alloc(size);
    let filled = 0;
    while (filled < size) {
        if (!(await readNextChunk(stream))) throw new GspotError('git', INVALID_GIT_STREAM_MESSAGE);
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
    if (match?.[1] !== hash || !Number.isSafeInteger(size)) throw new GspotError('git', INVALID_GIT_STREAM_MESSAGE);
    return size;
}

// Octal escapes name bytes, so decode UTF-8 only after joining them with the literal text.
function decodeQuotedPattern(pattern: string): string | undefined {
    if (!QUOTED_ATTRIBUTE_PATTERN.test(pattern)) return undefined;
    const bytes: Buffer[] = [];
    for (const [part] of pattern.slice(1, -1).matchAll(QUOTED_PATH_PARTS)) {
        if (!part.startsWith('\\')) {
            bytes.push(Buffer.from(part));
            continue;
        }
        if (OCTAL_PATH_BYTE.test(part)) {
            bytes.push(Buffer.from([Number.parseInt(part.slice(1), 8)]));
            continue;
        }
        const decoded = PATH_ESCAPES[part.slice(1)];
        if (decoded === undefined) return undefined;
        bytes.push(Buffer.from(decoded));
    }
    return Buffer.concat(bytes).toString('utf8');
}

/**
 * Read the attribute lines in their file order, and keep quoted paths.
 *
 * @param text the gitattributes source.
 * @param folder the repository-relative place of the .gitattributes file.
 * @returns selectors rooted in that folder and their declared attributes.
 */
export function parseAttributePatterns(text: string, folder: string): AttributePattern[] {
    return text.split('\n').flatMap((line) => {
        const trimmed = line.trim();
        if (IGNORED_ATTRIBUTE_LINE.test(trimmed)) return [];
        const match = ATTRIBUTE_LINE.exec(trimmed);
        if (match === null) return [];
        const raw = match[1] as string;
        const pattern = raw.startsWith('"') ? decodeQuotedPattern(raw) : raw;
        if (pattern === undefined || IGNORED_ATTRIBUTE_PATTERN.test(pattern)) return [];
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
 * Apply attribute tokens over inherited attributes, clearing unspecified entries with the ! prefix.
 *
 * @param tokens the attribute tokens from one matching pattern.
 * @param previous the attributes inherited from earlier lines.
 * @returns the new attributes. The inherited table stays unchanged.
 */
export function mergeAttributes(tokens: string[], previous: Record<string, string>): Record<string, string> {
    const attributes = { ...previous };
    for (const match of tokens) {
        const [name = '', value] = match.split('=');
        if (name.startsWith('!')) Reflect.deleteProperty(attributes, name.slice(1));
        else if (name.startsWith('-')) attributes[name.slice(1)] = 'unset';
        else attributes[name] = value ?? 'set';
        if (match === BINARY_MACRO) Object.assign(attributes, BINARY_ATTRIBUTES);
    }
    return attributes;
}

/**
 * Parse the null-delimited path, name, and value triplets from Git, and keep spaces in paths.
 *
 * @param text the successful check-attr -z output.
 * @returns the final attributes per path.
 */
export function parsePathAttributes(text: string): Map<string, Record<string, string>> {
    const fields = text.split('\0');
    const attributes = new Map<string, Record<string, string>>();
    for (let index = 0; index + ATTRIBUTE_FIELDS <= fields.length; index += ATTRIBUTE_FIELDS) {
        const [path, name, value] = fields.slice(index, index + ATTRIBUTE_FIELDS) as [string, string, string];
        const table = { ...attributes.get(path), [name]: value };
        attributes.set(path, table);
    }
    return attributes;
}

/**
 * Parse an unquoted index listing, retaining merge stages for working-tree inventory.
 *
 * @param text the complete null-delimited listing.
 * @returns the index entries with their stages.
 */
export function parseIndexEntries(text: string): GitIndexEntry[] {
    return text
        .split('\0')
        .filter(Boolean)
        .map((line) => {
            const match = INDEX_ENTRY.exec(line);
            const entry = parseEntry(match);
            return { ...entry, stage: Number(match?.groups?.['stage']) };
        });
}

/**
 * Validate unquoted, null-delimited committed-tree entries.
 *
 * @param output the complete Git listing.
 * @returns supported modes, full object IDs, and UTF-8 paths.
 */
export function parseTreeEntries(output: Uint8Array): GitEntry[] {
    const text = decodeUtf8(output);
    if (text === undefined) throw new GspotError('git', 'Git listed a path that is not valid UTF-8.');
    return text
        .split('\0')
        .filter(Boolean)
        .map((line) => parseEntry(TREE_ENTRY.exec(line)));
}

/**
 * Turn index entries into revision entries, and refuse conflicts.
 *
 * @param entries the validated index listing.
 * @returns entries from the resolved index.
 */
export function stripIndexStages(entries: GitIndexEntry[]): GitEntry[] {
    if (entries.some((entry) => entry.stage !== 0)) throw new GspotError('git', UNSUPPORTED_ENTRY);
    return entries.map(({ mode, hash, path }) => ({ mode, hash, path }));
}

/**
 * Validate the IDs and framing of a batch, and hold only the current blob.
 *
 * @param chunks the raw output, in stream order.
 * @param requestedIds the full object IDs, in response order.
 * @returns the exact bytes of each object, one at a time.
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
        const bytes = await readStreamBytes(stream, parseBlobSize(await readBlobLine(stream), hash));
        await readStreamBytes(stream, 1);
        yield [hash, bytes];
    }
    for (let next = await stream.chunks.next(); next.done !== true; next = await stream.chunks.next()) {
        // The standard output stream must end before the Git process completion can settle.
    }
}
