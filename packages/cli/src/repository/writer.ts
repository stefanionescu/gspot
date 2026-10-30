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
import { LEADING_NEWLINE } from '#cli/config/parsers/formats.ts';
import { GITIGNORE_FILE } from '#cli/config/repository/files.ts';
import type { Files, FileContents } from '#cli/types/system/files.ts';
import { hasGeneratedHeader } from '#cli/repository/files/classify.ts';
import type { EditableFile } from '#cli/types/parsers/editable-file.ts';
import { AGENTS_FILE, GITATTRIBUTES_FILE } from '#cli/config/files/names.ts';
import { GSPOT_FOLDER, INSTALLED_TOOL_FOLDERS } from '#cli/config/files/gspot.ts';
import { openFiles, walkFiles, deleteEmptyFolders } from '#cli/system/files/open.ts';
import { replaceBlock, findBlockBody, findBlockSpan } from '#cli/parsers/formats/managed-blocks.ts';
import type { WritePlan, ManagedKeys, ReplacementRequest } from '#cli/types/repository/repository.ts';

import {
    TOML_BARE_KEY,
    TOML_EXTENSION,
    EMPTY_JSON_TEXT,
    TRAILING_BLANK_LINE,
} from '#cli/config/repository/repository.ts';

function openManagedKeysFile(path: string, onDisk: FileContents | undefined, keys: ManagedKeys['keys']): EditableFile {
    const text = onDisk === undefined ? undefined : decodeUtf8Text(path, onDisk.bytes);
    if (path.endsWith(TOML_EXTENSION)) {
        const headers = new Set(
            keys
                .filter(({ key, value }) => value !== undefined && key.length > 1)
                .map(({ key }) =>
                    key
                        .slice(0, -1)
                        .map((name) =>
                            typeof name === 'string' && TOML_BARE_KEY.test(name) ? name : JSON.stringify(name),
                        )
                        .join('.'),
                ),
        );
        const contents = text ?? [...headers].map((header) => `[${header}]\n`).join('\n');
        return openTomlFile(path, contents);
    }
    return openJsonFile(path, text ?? EMPTY_JSON_TEXT);
}

/**
Merge the requested keys and leave every other value in place.

@param writer the repository handle.
@param path the destination.
@param keys the keys and requested values.
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
        after: { bytes: Buffer.from(text), mode: onDisk?.mode ?? OWNER_WRITABLE_FILE },
        status: text === before ? 'unchanged' : 'changed',
    };
}

/**
Check that each key holds its value, read with the parser that the write plans use.

@param output the file gspot writes managed keys into.
@param onDisk the file contents on disk.
*/
export function hasManagedKeys(output: ManagedKeys, onDisk: FileContents): boolean {
    const document = openManagedKeysFile(output.path, onDisk, output.keys);
    return output.keys.every((field) => isDeepStrictEqual(document.getValue(field.key), normalizeTables(field.value)));
}

function removeBlock(path: string, onDisk: FileContents): FileContents | undefined {
    const text = decodeUtf8Text(path, onDisk.bytes);
    const span = findBlockSpan(text, { path });
    if (span === undefined) return onDisk;
    const before = text.slice(0, span.start).replace(TRAILING_BLANK_LINE, '$1');
    const after = text.slice(span.end);
    const next = before === '' ? after.replace(LEADING_NEWLINE, '') : before + after;
    return next === '' ? undefined : { bytes: Buffer.from(next), mode: onDisk.mode };
}

function readGeneratedPatterns(files: Files): string[] {
    const attributesFile = files.read(GITATTRIBUTES_FILE);
    if (attributesFile === undefined) return [];
    const block = findBlockBody(attributesFile.bytes.toString('utf8'), { path: GITATTRIBUTES_FILE }) ?? '';
    return parseAttributePatterns(block, '.')
        .filter(({ attributes }) => attributes.includes('linguist-generated'))
        .map(({ pattern }) => pattern);
}

function isOwned(path: string, files: Files, generatedPatterns: string[], ownablePaths: ReadonlySet<string>): boolean {
    if (!isInside(path)) return false;
    if (path.startsWith(`${GSPOT_FOLDER}/`)) return true;
    if (!ownablePaths.has(path)) return false;
    const file = files.readKeepingLinks(path);
    if (file !== undefined && file.isSymlink !== true && hasGeneratedHeader(file.bytes.toString('utf8'))) return true;
    return generatedPatterns.some((pattern) => buildPathMatcher([pattern])(path));
}

/**
Find owned files and managed blocks outside the generation plan.

@param session the repository files.
@param expected the generated destinations that remain.
@param ownablePaths the destinations that the shipped manifests can write.
*/
export function listStrayPaths(
    session: Pick<Session, 'root' | 'repository'>,
    expected: ReadonlySet<string>,
    ownablePaths: ReadonlySet<string>,
): string[] {
    const disk = openFiles(session.root);
    const blockPaths = new Set([AGENTS_FILE, GITIGNORE_FILE, GITATTRIBUTES_FILE]);
    const installations = Object.values(INSTALLED_TOOL_FOLDERS);
    const ownFolder = disk.readStats(GSPOT_FOLDER);
    const ownPaths: string[] = [];
    if (ownFolder !== undefined) {
        walkFiles(disk, GSPOT_FOLDER, (path) => {
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
        if (isOwned(path, disk, generatedPatterns, ownablePaths)) return true;
        if (!blockPaths.has(path)) return false;
        const text = disk.read(path)?.bytes.toString('utf8');
        return text !== undefined && findBlockSpan(text, { path }) !== undefined;
    });
}

/**
Refuse authored bytes that nobody reviewed.

@param writer the repository handle.
@param requests the new bytes and any reviewed file contents of each file.
*/
export function planReplacements(writer: Files, requests: ReplacementRequest[]): WritePlan[] {
    const generatedPatterns = readGeneratedPatterns(writer);
    const ownablePaths = new Set(requests.map(({ path }) => path));
    return requests.map(({ path, next, expected }): WritePlan => {
        const onDisk = writer.read(path);
        if (
            onDisk !== undefined &&
            !isSameContents(onDisk, next) &&
            !isOwned(path, writer, generatedPatterns, ownablePaths) &&
            expected === undefined
        )
            return { path, status: 'preserved' };
        return {
            path,
            after: next,
            status: isSameContents(onDisk, next) ? 'unchanged' : 'changed',
        };
    });
}

/**
Keep the text outside the marked block.

@param writer the repository handle.
@param path the file.
@param body the block text.
*/
export function planBlock(writer: Files, path: string, body: string): WritePlan {
    const onDisk = writer.read(path);
    const text = onDisk === undefined ? '' : decodeUtf8Text(path, onDisk.bytes);
    const nextText = replaceBlock(text, body, { path });
    const next = {
        bytes: Buffer.from(nextText),
        mode: onDisk?.mode ?? OWNER_WRITABLE_FILE,
    };
    return { path, after: next, status: isSameContents(onDisk, next) ? 'unchanged' : 'changed' };
}

/**
Plan the removal of owned files, or of their managed blocks.

@param writer the repository handle.
@param paths the stale generated files.
@returns for each file, any authored text left after the managed block goes.
*/
export function planRemovals(writer: Files, paths: string[]): WritePlan[] {
    const generatedPatterns = readGeneratedPatterns(writer);
    const ownablePaths = new Set(paths);
    return paths.map((path): WritePlan => {
        const onDisk = writer.readKeepingLinks(path);
        if (onDisk === undefined) return { path, status: 'unchanged' };
        if (isOwned(path, writer, generatedPatterns, ownablePaths)) return { path, status: 'changed' };
        const next = removeBlock(path, onDisk);
        return {
            path,
            ...(next === undefined ? {} : { after: next }),
            status: isSameContents(onDisk, next) ? 'unchanged' : 'changed',
        };
    });
}

function writeBatch(writer: Files, plans: WritePlan[]): void {
    for (const { path, after } of plans) {
        if (after === undefined) {
            writer.deleteFile(path);
            deleteEmptyFolders(writer, path);
        } else writer.write(path, after);
    }
}

/**
Refuse the plans when they overwrite a file that gspot did not write; otherwise write or delete each changed file.

@param writer the repository handle.
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
