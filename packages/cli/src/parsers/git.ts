import type { z } from 'zod';
import { posix } from 'node:path';
import { OCTAL_RADIX } from '#cli/config/units.ts';
import { GspotError } from '#cli/system/errors.ts';
import { decodeUtf8 } from '#cli/system/files/reads.ts';
import { LINE_FEED, WHITESPACE_RUN } from '#cli/config/text.ts';
import { gitFileSchema } from '#cli/schemas/parsers/parsers.ts';
import { LEADING_SLASH } from '#cli/config/files/path-patterns.ts';
import type { GitFile, GitStream, GitIndexFile, AttributePattern } from '#cli/types/parsers/parsers.ts';

import {
    TREE_LINE,
    INDEX_LINE,
    SIZE_GROUP,
    BLOB_HEADER,
    PATH_ESCAPES,
    ATTRIBUTE_LINE,
    OCTAL_PATH_BYTE,
    OCTAL_BYTE_WIDTH,
    ATTRIBUTE_FIELDS,
    ANY_FOLDER_PREFIX,
    QUOTED_PATH_CHUNKS,
    FIRST_PRINTABLE_BYTE,
    IGNORED_ATTRIBUTE_LINE,
    FIRST_NON_PRINTABLE_BYTE,
    QUOTED_ATTRIBUTE_PATTERN,
    IGNORED_ATTRIBUTE_PATTERN,
    ATTRIBUTE_ASSIGNMENT_SIDES,
    INVALID_GIT_STREAM_MESSAGE,
    UNSUPPORTED_GIT_FILE_MESSAGE,
} from '#cli/config/parsers/parsers.ts';

async function readNextChunk(stream: GitStream): Promise<Buffer | undefined> {
    while (stream.cursor === stream.chunk.length) {
        const next = await stream.chunks.next();
        if (next.done === true) return undefined;
        stream.chunk = next.value;
        stream.cursor = 0;
    }
    return stream.chunk;
}

async function readBlobLine(stream: GitStream): Promise<string> {
    const pieces: Buffer[] = [];
    while ((await readNextChunk(stream)) !== undefined) {
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
        if ((await readNextChunk(stream)) === undefined) throw new GspotError('git', INVALID_GIT_STREAM_MESSAGE);
        const length = Math.min(size - filled, stream.chunk.length - stream.cursor);
        stream.chunk.copy(bytes, filled, stream.cursor, stream.cursor + length);
        stream.cursor += length;
        filled += length;
    }
    return bytes;
}

function parseBlobSize(header: string, hash: string): number {
    const match = BLOB_HEADER.exec(header);
    const size = Number(match?.[SIZE_GROUP]);
    if (match?.[1] !== hash || !Number.isSafeInteger(size)) throw new GspotError('git', INVALID_GIT_STREAM_MESSAGE);
    return size;
}

function decodeQuotedPattern(pattern: string): string | undefined {
    if (!QUOTED_ATTRIBUTE_PATTERN.test(pattern)) return undefined;
    const bytes: Buffer[] = [];
    const chunks = pattern.slice(1, -1).matchAll(QUOTED_PATH_CHUNKS);
    for (const [chunk] of chunks) {
        if (!chunk.startsWith('\\')) {
            bytes.push(Buffer.from(chunk));
            continue;
        }
        if (OCTAL_PATH_BYTE.test(chunk)) {
            const value = Number.parseInt(chunk.slice(1), OCTAL_RADIX);
            bytes.push(Buffer.from([value]));
            continue;
        }
        const decoded = PATH_ESCAPES[chunk.slice(1)];
        if (decoded === undefined) return undefined;
        bytes.push(Buffer.from(decoded));
    }
    return Buffer.concat(bytes).toString('utf8');
}

function formatUnreadablePath(record: string): string {
    const path = INDEX_LINE.exec(record)?.groups?.['path'] ?? TREE_LINE.exec(record)?.groups?.['path'] ?? record;
    const quoted = [...Buffer.from(path, 'latin1')]
        .map((byte) => {
            const character = String.fromCodePoint(byte);
            if (character === '\\' || character === '"') return `\\${character}`;
            return byte >= FIRST_PRINTABLE_BYTE && byte < FIRST_NON_PRINTABLE_BYTE
                ? character
                : `\\${byte.toString(OCTAL_RADIX).padStart(OCTAL_BYTE_WIDTH, '0')}`;
        })
        .join('');
    return `"${quoted}"`;
}

/**
Validate the fields of an index or tree entry.

@param match the entry matched against its listing format.
@param schema the expected fields and supported file modes.
@returns the validated entry.
*/
export function parseListingLine<T>(match: RegExpExecArray | null, schema: z.ZodType<T>): T {
    const parsed = schema.safeParse(match?.groups);
    if (!parsed.success) throw new GspotError('git', UNSUPPORTED_GIT_FILE_MESSAGE);
    return parsed.data;
}

/**
Read the attribute lines in their file order, and keep quoted paths.

@param text the gitattributes source.
@param folder the repository-relative place of the .gitattributes file.
@returns selectors rooted in that folder and their declared attributes.
*/
export function parseAttributePatterns(text: string, folder: string): AttributePattern[] {
    return text.split('\n').flatMap((line) => {
        const trimmed = line.trim();
        if (IGNORED_ATTRIBUTE_LINE.test(trimmed)) return [];
        const match = ATTRIBUTE_LINE.exec(trimmed);
        if (match === null) return [];
        const quoted = match[1] as string;
        const pattern = quoted.startsWith('"') ? decodeQuotedPattern(quoted) : quoted;
        if (pattern === undefined || IGNORED_ATTRIBUTE_PATTERN.test(pattern)) return [];
        const bare = pattern.replace(LEADING_SLASH, '');
        const local = LEADING_SLASH.test(pattern) || bare.includes('/') ? bare : `${ANY_FOLDER_PREFIX}${bare}`;
        return [
            {
                pattern: posix.join(folder, local),
                attributes: trimmed.slice(match[0].length).split(WHITESPACE_RUN).filter(Boolean),
            },
        ];
    });
}

/**
Read attribute tokens from one selector, clearing entries with the ! prefix.

@param tokens the attribute tokens from one matching pattern.
*/
export function mergeAttributes(tokens: string[]): Record<string, string> {
    const attributes = new Map<string, string>();
    for (const match of tokens) {
        const [name = '', value = 'set'] = match.split('=', ATTRIBUTE_ASSIGNMENT_SIDES);
        if (name.startsWith('!')) attributes.delete(name.slice(1));
        else if (name.startsWith('-')) attributes.set(name.slice(1), 'unset');
        else attributes.set(name, value);
    }
    return Object.fromEntries(attributes);
}

/**
Parse the null-delimited path, name, and value triplets from Git, and keep spaces in paths.

@param text the successful check-attr -z output.
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
Split a Git path listing on null bytes. Separate paths with invalid UTF-8.

@param output the bytes that Git printed.
@param unreadablePaths receives quoted names with octal byte escapes
*/
export function decodeGitPaths(output: Uint8Array, unreadablePaths: string[] = []): string {
    const records: string[] = [];
    for (const record of Buffer.from(output).toString('latin1').split('\0')) {
        if (record === '') continue;
        const bytes = Buffer.from(record, 'latin1');
        const text = decodeUtf8(bytes);
        if (text === undefined) {
            unreadablePaths.push(formatUnreadablePath(record));
        } else {
            records.push(text);
        }
    }
    return records.join('\0');
}

/**
Validate unquoted, null-delimited committed-tree entries.

@param output the complete Git listing.
@param unreadablePaths receives names with invalid UTF-8.
@returns supported modes, full object IDs, and UTF-8 paths.
*/
export function parseTreeFiles(output: Uint8Array, unreadablePaths: string[] = []): GitFile[] {
    const files: GitFile[] = [];
    for (const line of decodeGitPaths(output, unreadablePaths).split('\0')) {
        if (line === '') continue;
        files.push(parseListingLine(TREE_LINE.exec(line), gitFileSchema));
    }
    return files;
}

/**
Turn index entries into revision entries, and refuse conflicts.

@param indexFiles the validated index listing.
*/
export function stripIndexStages(indexFiles: GitIndexFile[]): GitFile[] {
    if (indexFiles.some((indexFile) => indexFile.stage !== 0))
        throw new GspotError('git', UNSUPPORTED_GIT_FILE_MESSAGE);
    return indexFiles.map(({ mode, hash, path }) => ({ mode, hash, path }));
}

/**
Validate the IDs and framing of a batch, and hold only the current blob.

@param chunks the raw output, in stream order.
@param requestedIds the full object IDs, in response order.
@returns the exact bytes of each object, one at a time.
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
        const terminator = await readStreamBytes(stream, 1);
        if (terminator[0] !== LINE_FEED) throw new GspotError('git', INVALID_GIT_STREAM_MESSAGE);
        yield [hash, bytes];
    }
    if ((await readNextChunk(stream)) !== undefined) throw new GspotError('git', INVALID_GIT_STREAM_MESSAGE);
}
