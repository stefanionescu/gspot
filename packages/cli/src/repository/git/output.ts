import type { z } from 'zod';

import {
    BLOB_HEADER,
    CONFLICT_END,
    CONFLICT_SEPARATOR,
    CONFLICT_START,
    FIRST_NON_PRINTABLE_BYTE,
    FIRST_PRINTABLE_BYTE,
    INDEX_LINE,
    INVALID_GIT_STREAM_MESSAGE,
    LINE_FEED,
    OCTAL_BYTE_WIDTH,
    SIZE_GROUP,
    TREE_LINE,
    UNSUPPORTED_GIT_FILE_MESSAGE,
} from '#cli/config/repository/git.ts';
import { OCTAL_RADIX } from '#cli/config/system.ts';
import { GspotError } from '#cli/system/errors.ts';
import { decodeUtf8 } from '#cli/system/files/reads.ts';
import { formatNameList } from '#cli/system/text/messages.ts';
import type { GitFile, GitIndexFile, GitStream } from '#cli/types/repository.ts';

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

export function parseListingLine<T>(match: RegExpExecArray | null, schema: z.ZodType<T>): T {
    const parsed = schema.safeParse(match?.groups);
    if (!parsed.success) throw new GspotError('git', UNSUPPORTED_GIT_FILE_MESSAGE);
    return parsed.data;
}

/**
Decode one record of a Git listing, which holds its bytes as Latin-1. A record with invalid UTF-8 gives no text, and
`unreadablePaths` takes its name when the caller passes that list.
*/
export function decodeGitPath(record: string, unreadablePaths?: string[]): string | undefined {
    const text = decodeUtf8(Buffer.from(record, 'latin1'));
    if (text === undefined) unreadablePaths?.push(formatUnreadablePath(record));
    return text;
}

/**
Decode the records of a null-separated Git listing. A record with invalid UTF-8 is left out, and `unreadablePaths`
takes its name when the caller passes that list.
*/
export function decodeGitPaths(output: Uint8Array, unreadablePaths?: string[]): string[] {
    return Buffer.from(output)
        .toString('latin1')
        .split('\0')
        .filter((record) => record !== '')
        .map((record) => decodeGitPath(record, unreadablePaths))
        .filter((text) => text !== undefined);
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

/**
List the merge-conflict marker lines of a text. A `=======` line counts only between a `<<<<<<<` line and a later
`>>>>>>>` line, because Markdown and reStructuredText underline a seven-letter title with it. Line numbers start at 1.
*/
export function listConflictMarkerLines(text: string): number[] {
    const markers: number[] = [];
    let separators: number[] | undefined;
    for (const [index, line] of text.split('\n').entries()) {
        if (CONFLICT_START.test(line)) {
            markers.push(index + 1);
            separators = [];
        } else if (CONFLICT_END.test(line)) {
            markers.push(...(separators ?? []), index + 1);
            separators = undefined;
        } else if (CONFLICT_SEPARATOR.test(line)) separators?.push(index + 1);
    }
    return markers;
}
