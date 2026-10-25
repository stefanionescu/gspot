import { join } from 'node:path';
import { lstatSync } from 'node:fs';
import { isDeepStrictEqual } from 'node:util';
import { isInside } from '#cli/system/paths.ts';
import { GspotError } from '#cli/system/errors.ts';
import type { Session } from '#cli/types/session.ts';
import { normalizeTables } from '#cli/system/tables.ts';
import { buildPathMatcher } from '#cli/system/matchers.ts';
import { openJsonFile } from '#cli/parsers/formats/json.ts';
import { openTomlFile } from '#cli/parsers/formats/toml.ts';
import { decodeUtf8Text } from '#cli/system/files/reads.ts';
import { parseAttributePatterns } from '#cli/parsers/git.ts';
import { isSameContents } from '#cli/system/files/bounded.ts';
import { OWNER_WRITABLE_FILE } from '#cli/config/files/modes.ts';
import type { Files, FileContents } from '#cli/types/system/files.ts';
import { hasGeneratedHeader } from '#cli/repository/files/classify.ts';
import type { EditableFile } from '#cli/types/parsers/editable-file.ts';
import { GITIGNORE_FILE } from '#cli/config/repository/files/tracked.ts';
import { AGENTS_FILE, GITATTRIBUTES_FILE } from '#cli/config/files/names.ts';
import type { BlockStyle } from '#cli/types/parsers/formats/managed-blocks.ts';
import { openFiles, walkFiles, removeEmptyFolders } from '#cli/system/files/open.ts';
import type { WritePlan, ManagedKeys, ReplacementRequest } from '#cli/types/write.ts';
import { TOML_EXTENSION, EMPTY_JSON_TEXT, WRITER_LOCK_FILE } from '#cli/config/write.ts';
import { DOT_GSPOT, GSPOT_PATHS, INSTALLED_TOOL_FOLDERS } from '#cli/config/gspot-folder.ts';
import { replaceBlock, findBlockBody, findBlockSpan } from '#cli/parsers/formats/managed-blocks.ts';

function openManagedKeysFile(path: string, onDisk: FileContents | undefined, keys: ManagedKeys['keys']): EditableFile {
    const text = onDisk === undefined ? undefined : decodeUtf8Text(path, onDisk.bytes);
    if (path.endsWith(TOML_EXTENSION)) {
        const headers = new Set(
            keys
                .filter(({ key, value }) => value !== undefined && key.length > 1)
                .map(({ key }) =>
                    key
                        .slice(0, -1)
                        .map((name) => JSON.stringify(name))
                        .join('.'),
                ),
        );
        const contents = text ?? [...headers].map((header) => `[${header}]\n`).join('\n');
        return openTomlFile(path, contents);
    }
    return openJsonFile(path, text ?? EMPTY_JSON_TEXT);
}

/**
Plan the managed keys of a shared file: merge the requested keys, and leave every other value in place.

@param writer the locked repository handle.
@param path the destination.
@param keys the keys and requested values.
@returns the key write plan.
*/
export function planManagedKeys(writer: Files, path: string, keys: ManagedKeys['keys']): WritePlan {
    const onDisk = writer.read(path);
    const document = openManagedKeysFile(path, onDisk, keys);
    const before = onDisk === undefined ? '' : document.getText();
    for (const field of keys) document.set(field.key, field.value);
    const updated = document.getText();
    const text = path.endsWith(TOML_EXTENSION) && !updated.endsWith('\n') ? `${updated}\n` : updated;
    return {
        path,
        before: onDisk,
        after: { bytes: Buffer.from(text), mode: onDisk?.mode ?? OWNER_WRITABLE_FILE },
        status: text === before ? 'unchanged' : 'changed',
    };
}

/**
Check whether a file holds every managed key with its value. It reads the file with the parser that the write plans
use.

@param output the file gspot writes managed keys into.
@param output.path where the file sits.
@param output.keys the keys and the values they must hold.
@param onDisk the file contents on disk.
@returns whether every key holds its value.
*/
export function hasManagedKeys(output: ManagedKeys, onDisk: FileContents): boolean {
    const document = openManagedKeysFile(output.path, onDisk, output.keys);
    return output.keys.every((field) => isDeepStrictEqual(document.getValue(field.key), normalizeTables(field.value)));
}

function removeBlock(path: string, onDisk: FileContents): FileContents | undefined {
    const text = decodeUtf8Text(path, onDisk.bytes);
    const span = findBlockSpan(text, { path, style: getBlockStyle(path) });
    if (span === undefined) return onDisk;
    const before = text.slice(0, span.start).replace(/(\r?\n)\r?\n$/u, '$1');
    const after = text.slice(span.end);
    const next = before === '' ? after.replace(/^\r?\n/u, '') : before + after;
    return next === '' ? undefined : { bytes: Buffer.from(next), mode: onDisk.mode };
}

function readGeneratedPatterns(disk: Files): string[] {
    const attributesFile = disk.read(GITATTRIBUTES_FILE);
    if (attributesFile === undefined) return [];
    const block =
        findBlockBody(attributesFile.bytes.toString('utf8'), { path: GITATTRIBUTES_FILE, style: 'hash' }) ?? '';
    return parseAttributePatterns(block, '.')
        .filter(({ attributes }) => attributes.includes('linguist-generated'))
        .map(({ pattern }) => pattern);
}

function isOwned(path: string, disk: Files, generatedPatterns: string[]): boolean {
    if (!isInside(path)) return false;
    if (path.startsWith(`${DOT_GSPOT}/`)) return true;
    const file = disk.readKeepingLinks(path);
    if (file !== undefined && file.isLink !== true && hasGeneratedHeader(file.bytes.toString('utf8'))) return true;
    return generatedPatterns.some((pattern) => buildPathMatcher([pattern])(path));
}

/**
Find owned files and managed blocks outside the generation plan.

@param session the repository files.
@param expected the generated destinations that remain.
@returns the stray generated paths.
*/
export function listStrayPaths(session: Pick<Session, 'root' | 'repository'>, expected: ReadonlySet<string>): string[] {
    using disk = openFiles(session.root);
    const blockPaths = new Set([AGENTS_FILE, GITIGNORE_FILE, GITATTRIBUTES_FILE]);
    const installations = [GSPOT_PATHS.state, ...Object.values(INSTALLED_TOOL_FOLDERS)];
    const ownFolder = disk.readStats(DOT_GSPOT);
    const ownPaths: string[] = [];
    if (ownFolder !== undefined) {
        walkFiles(disk, DOT_GSPOT, (path) => {
            if (installations.some((folder) => path === folder || path.startsWith(`${folder}/`))) return false;
            if (lstatSync(join(session.root, path)).isDirectory()) return true;
            ownPaths.push(path);
            return false;
        });
    }
    const generatedPatterns = readGeneratedPatterns(disk);
    const writtenPaths = new Set([
        ...ownPaths,
        ...session.repository.files.filter(({ kind }) => kind === 'generated').map(({ path }) => path),
        ...blockPaths,
    ]);
    return [...writtenPaths].filter((path) => {
        if (installations.some((folder) => path === folder || path.startsWith(`${folder}/`))) return false;
        if (expected.has(path)) return false;
        if (isOwned(path, disk, generatedPatterns)) return true;
        if (!blockPaths.has(path)) return false;
        const text = disk.read(path)?.bytes.toString('utf8');
        return text !== undefined && findBlockSpan(text, { path, style: getBlockStyle(path) }) !== undefined;
    });
}

/**
Plan replacements: refuse authored bytes that nobody reviewed.

@param writer the locked repository handle.
@param requests the new bytes and any reviewed file contents of each file.
@returns one write plan for each request, with an unchanged, changed, or preserved status.
*/
export function planReplacements(writer: Files, requests: ReplacementRequest[]): WritePlan[] {
    const generatedPatterns = readGeneratedPatterns(writer);
    return requests.map(({ path, next, expected }): WritePlan => {
        const onDisk = next.isLink === true ? writer.readKeepingLinks(path) : writer.read(path);
        if (
            onDisk !== undefined &&
            !isSameContents(onDisk, next) &&
            !isOwned(path, writer, generatedPatterns) &&
            expected === undefined
        )
            return { path, before: onDisk, status: 'preserved' };
        return {
            path,
            before: expected ?? onDisk,
            after: next,
            status: isSameContents(onDisk, next) ? 'unchanged' : 'changed',
        };
    });
}

/**
Plan the marked block, and keep the text outside it.

@param writer the locked repository handle.
@param path the file.
@param body the block text.
@param style markdown or hash markers.
@returns the block write plan.
*/
export function planBlock(writer: Files, path: string, body: string, style: BlockStyle): WritePlan {
    const onDisk = writer.read(path);
    const text = onDisk === undefined ? '' : decodeUtf8Text(path, onDisk.bytes);
    const nextText = replaceBlock(text, body, { path, style });
    const next = {
        bytes: Buffer.from(nextText),
        mode: onDisk?.mode ?? OWNER_WRITABLE_FILE,
    };
    return { path, before: onDisk, after: next, status: isSameContents(onDisk, next) ? 'unchanged' : 'changed' };
}

/**
Plan the removal of owned files, or of their managed blocks.

@param writer the locked repository handle.
@param paths the stale generated files.
@returns for each file, the old bytes, and any authored text left after the managed block goes.
*/
export function planRemovals(writer: Files, paths: string[]): WritePlan[] {
    const generatedPatterns = readGeneratedPatterns(writer);
    return paths.map((path): WritePlan => {
        const onDisk = writer.readKeepingLinks(path);
        if (onDisk === undefined) return { path, before: onDisk, status: 'unchanged' };
        if (isOwned(path, writer, generatedPatterns)) return { path, before: onDisk, status: 'changed' };
        const next = removeBlock(path, onDisk);
        return {
            path,
            before: onDisk,
            ...(next === undefined ? {} : { after: next }),
            status: isSameContents(onDisk, next) ? 'unchanged' : 'changed',
        };
    });
}

// eslint-disable-next-line gspot/no-trivial-functions -- reason: The rule in the plugin source does not report it.
function getBlockStyle(path: string): BlockStyle {
    return path.endsWith('.md') ? 'markdown' : 'hash';
}

function writeBatch(writer: Files, plans: WritePlan[]): void {
    for (const { path, before, after } of plans) {
        if (after === undefined) {
            if (before !== undefined) {
                writer.deleteFile(path, before);
                removeEmptyFolders(writer, path);
            }
        } else if (!isSameContents(before, after)) writer.write(path, after, before);
    }
}

/**
Take the repository writer lock until disposal.

@param repositoryRoot the boundary for confined writes and the writer lock.
@returns the locked file writer.
*/
export function openWriter(repositoryRoot: string): Files {
    using resources = new DisposableStack();
    const files = resources.use(openFiles(repositoryRoot));
    files.createLock(WRITER_LOCK_FILE);
    resources.move();
    return files;
}

/**
Refuse the plans when they overwrite a file that gspot did not write; otherwise write or delete each changed file.

@param writer the locked repository handle.
@param plans one write or removal for each file.
*/
export function writePlans(writer: Files, plans: WritePlan[]): void {
    const conflicts = plans.filter((plan) => plan.status === 'preserved').map((plan) => plan.path);
    if (conflicts.length > 0)
        throw new GspotError(
            'writing',
            `gspot did not overwrite these files: ${conflicts.join(', ')}. Move them aside, then run the command again.`,
        );
    writeBatch(
        writer,
        plans.filter((plan) => plan.status === 'changed'),
    );
}
