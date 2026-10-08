// Parse Git index and tree listings, and validate binary object stream framing.
// Dependency lockfile readers provide root pins and format metadata.
import { parse as parseYaml } from 'yaml';
import { parseSyml } from '@yarnpkg/parsers';
import { parse as parseToml } from 'smol-toml';
import { parseJsonc } from '#cli/parsers/public.ts';
import { GspotError } from '#cli/platform/public.ts';
import { decodeUtf8 } from '#cli/platform/contracts.ts';
import { LINE_FEED } from '#cli/config/parsers/source.ts';
import { gitEntrySchema } from '#cli/parsers/schema/git.ts';
import { LOCKFILES } from '#cli/config/parsers/lockfiles.ts';
import type { Lockfile, LockfileName } from '#cli/types/parsers/lockfiles.ts';
import type { GitEntry, GitStream, GitIndexEntry } from '#cli/types/parsers/git.ts';
import type { DependencyMap, PackageInstaller } from '#cli/types/parsers/packages.ts';
import { TREE_ENTRY, BLOB_HEADER, INDEX_ENTRY, UNSUPPORTED_ENTRY } from '#cli/config/parsers/git.ts';

import {
    bunLockfileSchema,
    npmLockfileSchema,
    pnpmLockfileSchema,
    pnpmSpecifiersSchema,
} from '#cli/parsers/schema/lockfiles.ts';

function entryLines(text: string): string[] {
    if (text !== '' && !text.endsWith('\0')) throw new GspotError('selection', ['The Git entry stream is incomplete.']);
    return text.split('\0').filter(Boolean);
}

function parseEntry(match: RegExpExecArray | null): GitEntry {
    const entry = gitEntrySchema.safeParse(match?.groups);
    if (!entry.success) throw new GspotError('selection', [UNSUPPORTED_ENTRY]);
    return entry.data;
}

// Empty transport chunks are harmless; a missing required byte is an incomplete Git response.
async function nextChunk(stream: GitStream): Promise<boolean> {
    while (stream.cursor === stream.chunk.length) {
        const next = await stream.chunks.next();
        if (next.done === true) return false;
        stream.chunk = next.value;
        stream.cursor = 0;
    }
    return true;
}

async function readHeader(stream: GitStream): Promise<string> {
    const pieces: Buffer[] = [];
    while (await nextChunk(stream)) {
        const end = stream.chunk.indexOf(LINE_FEED, stream.cursor);
        pieces.push(stream.chunk.subarray(stream.cursor, end === -1 ? stream.chunk.length : end));
        stream.cursor = end === -1 ? stream.chunk.length : end + 1;
        if (end !== -1) return Buffer.concat(pieces).toString('ascii');
    }
    throw new GspotError('selection', ['The Git object stream is incomplete or invalid.']);
}

async function readBytes(stream: GitStream, size: number): Promise<Buffer> {
    const bytes = Buffer.alloc(size);
    let filled = 0;
    while (filled < size) {
        if (!(await nextChunk(stream)))
            throw new GspotError('selection', ['The Git object stream is incomplete or invalid.']);
        const length = Math.min(size - filled, stream.chunk.length - stream.cursor);
        stream.chunk.copy(bytes, filled, stream.cursor, stream.cursor + length);
        stream.cursor += length;
        filled += length;
    }
    return bytes;
}

function blobSize(header: string, hash: string): number {
    const match = BLOB_HEADER.exec(header);
    const size = Number(match?.[2]);
    if (match?.[1] !== hash || !Number.isSafeInteger(size))
        throw new GspotError('selection', ['The Git object stream is incomplete or invalid.']);
    return size;
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
    return parseIndexRevision(parseIndexEntries(text));
}

/**
 * Project a shared index into immutable revision entries, refusing conflicts.
 * @param entries validated working-tree index entries
 * @returns entries from the resolved index
 */
export function parseIndexRevision(entries: GitIndexEntry[]): GitEntry[] {
    if (entries.some((entry) => entry.stage !== 0)) throw new GspotError('selection', [UNSUPPORTED_ENTRY]);
    return entries.map(({ mode, hash, path }) => ({ mode, hash, path }));
}

/**
 * Validate batch identities and framing while retaining only the current blob.
 * @param chunks raw output chunks in stream order
 * @param objects requested full object IDs in response order
 * @returns each object's exact bytes before reading its successor
 */
export async function* parseGitBlobs(
    chunks: AsyncIterable<Buffer> | Iterable<Buffer>,
    objects: readonly string[],
): AsyncGenerator<readonly [string, Buffer]> {
    const stream: GitStream = {
        chunks: Symbol.asyncIterator in chunks ? chunks[Symbol.asyncIterator]() : chunks[Symbol.iterator](),
        chunk: Buffer.alloc(0),
        cursor: 0,
    };
    for (const hash of objects) {
        const bytes = await readBytes(stream, blobSize(await readHeader(stream), hash));
        const terminator = await readBytes(stream, 1);
        if (!terminator.includes(LINE_FEED))
            throw new GspotError('selection', ['The Git object stream is incomplete or invalid.']);
        yield [hash, bytes];
    }
    if (await nextChunk(stream)) throw new GspotError('selection', ['The Git object stream contains unexpected data.']);
}

/**
 * Parse a supported textual lockfile using its native syntax.
 * @param filename the supported lockfile name
 * @param text the complete lockfile source
 * @returns the parsed value for format-specific validation
 */
export function parseLockfile(filename: LockfileName, text: string): unknown {
    if (filename === 'bun.lock') return parseJsonc(text);
    if (filename === 'package-lock.json') return JSON.parse(text);
    if (filename === 'pnpm-lock.yaml') return parseYaml(text);
    if (filename === 'yarn.lock') return parseSyml(text);
    return parseToml(text);
}

/**
 * Read the exact root development dependencies recorded by npm, Bun, or pnpm.
 * @param name the package manager
 * @param content the complete lockfile source
 * @returns root dependency names and their declared specifiers
 */
export function rootLockfileDependencies(
    name: Exclude<PackageInstaller['name'], 'yarn'>,
    content: string,
): DependencyMap {
    if (name === 'npm' || name === 'bun') {
        const root =
            name === 'npm'
                ? npmLockfileSchema.parse(parseLockfile('package-lock.json', content)).packages['']
                : bunLockfileSchema.parse(parseLockfile('bun.lock', content)).workspaces[''];
        if (root?.devDependencies === undefined) return {};
        return root.devDependencies;
    }
    const pinned = pnpmLockfileSchema.parse(parseLockfile('pnpm-lock.yaml', content)).importers['.']?.devDependencies;
    const entries = pnpmSpecifiersSchema.parse(pinned);
    return Object.fromEntries(Object.entries(entries).map(([key, value]) => [key, value.specifier]));
}

/**
 * Read the declared consumers of one repository lockfile.
 * @param filename the file basename
 * @returns its metadata, or undefined for an unsupported filename
 */
export function lockfileEntry(filename: string): Lockfile | undefined {
    return LOCKFILES.find((entry) => entry.file === filename);
}
