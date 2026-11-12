import { posix } from 'node:path';

import type { z } from 'zod';

import {
    ANY_FOLDER_PREFIX,
    ATTRIBUTE_ASSIGNMENT_SIDES,
    ATTRIBUTE_FIELDS,
    ATTRIBUTE_LINE,
    BLOB_HEADER,
    FIRST_NON_PRINTABLE_BYTE,
    FIRST_PRINTABLE_BYTE,
    IGNORED_ATTRIBUTE_LINE,
    IGNORED_ATTRIBUTE_PATTERN,
    INDEX_LINE,
    INVALID_GIT_STREAM_MESSAGE,
    LINE_FEED,
    OCTAL_BYTE_WIDTH,
    OCTAL_PATH_BYTE,
    PATH_ESCAPES,
    QUOTED_ATTRIBUTE_PATTERN,
    QUOTED_PATH_CHUNKS,
    SIZE_GROUP,
    TREE_LINE,
    UNSUPPORTED_GIT_FILE_MESSAGE,
} from '#cli/config/repository/git.ts';
import { LEADING_SLASH, OCTAL_RADIX, WHITESPACE_RUN } from '#cli/config/system.ts';
import { gitFileSchema } from '#cli/schemas/repository.ts';
import { GspotError } from '#cli/system/errors.ts';
import { decodeUtf8 } from '#cli/system/files/reads.ts';
import { formatNameList } from '#cli/system/text.ts';
import type { AttributePattern, GitFile, GitIndexFile, GitStream } from '#cli/types/repository.ts';

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

function buildAttributePattern(match: RegExpExecArray, line: string, folder: string): AttributePattern[] {
    const quoted = match[1] as string;
    const pattern = quoted.startsWith('"') ? decodeQuotedPattern(quoted) : quoted;
    if (pattern === undefined || IGNORED_ATTRIBUTE_PATTERN.test(pattern)) return [];
    const bare = pattern.replace(LEADING_SLASH, '');
    const local = LEADING_SLASH.test(pattern) || bare.includes('/') ? bare : `${ANY_FOLDER_PREFIX}${bare}`;
    return [
        {
            pattern: posix.join(folder, local),
            attributes: line.slice(match[0].length).split(WHITESPACE_RUN).filter(Boolean),
        },
    ];
}

export function parseListingLine<T>(match: RegExpExecArray | null, schema: z.ZodType<T>): T {
    const parsed = schema.safeParse(match?.groups);
    if (!parsed.success) throw new GspotError('git', UNSUPPORTED_GIT_FILE_MESSAGE);
    return parsed.data;
}

export function parseAttributePatterns(text: string, folder: string): AttributePattern[] {
    return text.split('\n').flatMap((line) => {
        const trimmed = line.trim();
        if (IGNORED_ATTRIBUTE_LINE.test(trimmed)) return [];
        const match = ATTRIBUTE_LINE.exec(trimmed);
        return match === null ? [] : buildAttributePattern(match, trimmed, folder);
    });
}

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

export function decodeGitPaths(output: Uint8Array, unreadablePaths: string[]): string {
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

export function parseTreeFiles(output: Uint8Array, unreadablePaths: string[]): GitFile[] {
    const files: GitFile[] = [];
    for (const line of decodeGitPaths(output, unreadablePaths).split('\0')) {
        if (line === '') continue;
        files.push(parseListingLine(TREE_LINE.exec(line), gitFileSchema));
    }
    return files;
}

export function stripIndexStages(indexFiles: GitIndexFile[]): GitFile[] {
    const conflicted = [...new Set(indexFiles.filter(({ stage }) => stage !== 0).map(({ path }) => path))];
    if (conflicted.length > 0)
        throw new GspotError(
            'git',
            `${formatNameList(conflicted)} ${conflicted.length === 1 ? 'has' : 'have'} unresolved merge conflicts. Resolve them with git add or git rm, then check again.`,
        );
    return indexFiles.map(({ mode, hash, path }) => ({ mode, hash, path }));
}

/**
Validate the IDs and framing of a batch, and hold only the current blob.
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
