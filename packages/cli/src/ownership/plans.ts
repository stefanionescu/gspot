import { join } from 'node:path';
import { lstatSync } from 'node:fs';
import { isInside } from '#cli/system/paths.ts';
import { AGENTS_FILE } from '#cli/config/rules.ts';
import type { Session } from '#cli/types/planning.ts';
import { decodeUtf8 } from '#cli/system/files/reads.ts';
import { pathMatcher } from '#cli/repository/selectors.ts';
import { parseAttributePatterns } from '#cli/parsers/git.ts';
import { isSameContents } from '#cli/system/files/entries.ts';
import { planKeyChanges } from '#cli/ownership/managed-keys.ts';
import { hasGeneratedHeader } from '#cli/repository/classify.ts';
import { openFiles, walkFiles } from '#cli/system/files/open.ts';
import { OWNER_WRITABLE_FILE } from '#cli/config/system/modes.ts';
import type { Files, FileCopy } from '#cli/types/system/files.ts';
import type { BlockStyle } from '#cli/types/system/managed-blocks.ts';
import { GITIGNORE_FILE, GITATTRIBUTES_FILE } from '#cli/config/repository/tracked.ts';
import { readBlock, replaceBlock, findBlockSpan } from '#cli/system/managed-blocks.ts';
import type { Writer, FileEdit, WritePlan, ReplacementRequest } from '#cli/types/ownership.ts';
import { DOT_GSPOT, STATE_DIRECTORY, INSTALLED_TOOL_FOLDERS } from '#cli/config/system/locations.ts';

/**
 * Remove only the marked block and its separating blank line.
 * @param path the block file.
 * @param current its current bytes.
 * @returns the remaining copy, or absence when nothing remains.
 */
function removeBlock(path: string, current: FileCopy): FileCopy | undefined {
    const text = decodeUtf8(current.bytes);
    if (text === undefined) throw new Error(`${path} is not UTF-8 text`);
    const span = findBlockSpan(text, { path, style: path.endsWith('.md') ? 'markdown' : 'hash' });
    if (span === undefined) return current;
    const before = text.slice(0, span.start).replace(/(\r?\n)\r?\n$/u, '$1');
    const next = before + text.slice(span.end);
    return next === '' ? undefined : { bytes: Buffer.from(next), mode: current.mode };
}

/**
 * Determine ownership from the gspot folder, file notice, or managed Git attributes.
 * @param path the repository-relative path.
 * @param disk the repository reader.
 * @returns whether gspot owns the whole file.
 */
export function isOwned(path: string, disk: Files): boolean {
    if (!isInside(path)) return false;
    if (path.startsWith(`${DOT_GSPOT}/`)) return true;
    const file = disk.readKeepingLinks(path);
    if (file !== undefined && file.isLink !== true && hasGeneratedHeader(file.bytes.toString('utf8'))) return true;
    const attributesFile = disk.read(GITATTRIBUTES_FILE);
    if (attributesFile === undefined) return false;
    const block = readBlock(attributesFile.bytes.toString('utf8'), { path: GITATTRIBUTES_FILE, style: 'hash' }) ?? '';
    return parseAttributePatterns(block, '.').some(
        ({ pattern, attributes }) => attributes.includes('linguist-generated') && pathMatcher([pattern])(path),
    );
}

/**
 * Find owned files and managed blocks outside the generation plan.
 * @param session the current file inventory and declared instruction files.
 * @param expected the generated destinations that remain.
 * @returns the obsolete generated paths.
 */
export function listStrayPaths(
    session: Pick<Session, 'root' | 'repository' | 'settingsFile'>,
    expected: ReadonlySet<string>,
): string[] {
    using disk = openFiles(session.root);
    const blockPaths = new Set([
        AGENTS_FILE,
        GITIGNORE_FILE,
        GITATTRIBUTES_FILE,
        ...session.settingsFile.settings.rules.instruction_files,
    ]);
    const installations = [STATE_DIRECTORY, ...Object.values(INSTALLED_TOOL_FOLDERS)];
    const ownFolder = disk.stat(DOT_GSPOT);
    const ownPaths: string[] = [];
    if (ownFolder !== undefined) {
        walkFiles(disk, DOT_GSPOT, (path) => {
            if (installations.some((folder) => path === folder || path.startsWith(`${folder}/`))) return false;
            if (lstatSync(join(session.root, path)).isDirectory()) return true;
            ownPaths.push(path);
            return false;
        });
    }
    const candidates = new Set([
        ...ownPaths,
        ...session.repository.files.filter(({ kind }) => kind === 'generated').map(({ path }) => path),
        ...blockPaths,
    ]);
    return [...candidates].filter((path) => {
        if (installations.some((folder) => path === folder || path.startsWith(`${folder}/`))) return false;
        if (expected.has(path)) return false;
        if (isOwned(path, disk)) return true;
        if (!blockPaths.has(path)) return false;
        const text = disk.read(path)?.bytes.toString('utf8');
        return (
            text !== undefined &&
            findBlockSpan(text, { path, style: path.endsWith('.md') ? 'markdown' : 'hash' }) !== undefined
        );
    });
}

/**
 * Replace owned or explicitly reviewed bytes and preserve other authored files.
 * @param writer the locked file writer.
 * @param request the next bytes and any reviewed copy.
 * @returns the replacement plan.
 */
export function planReplacement(writer: Writer, request: ReplacementRequest): WritePlan {
    const { path, next, expected } = request;
    const current = next.isLink === true ? writer.files.readKeepingLinks(path) : writer.files.read(path);
    if (
        current !== undefined &&
        !isSameContents(current, next) &&
        !isOwned(path, writer.files) &&
        request.canReplace !== true
    )
        return { path, before: current, status: 'preserved' };
    return {
        path,
        before: expected ?? current,
        after: next,
        status: isSameContents(current, next) ? 'unchanged' : 'changed',
    };
}

/**
 * Replace or append the marked block while retaining text outside it.
 * @param writer the locked file writer.
 * @param path the file path.
 * @param body the block text.
 * @param style the marker style.
 * @returns the block write plan.
 */
export function planBlock(writer: Writer, path: string, body: string, style: BlockStyle): WritePlan {
    const current = writer.files.read(path);
    const text = current === undefined ? '' : decodeUtf8(current.bytes);
    if (text === undefined) throw new Error(`${path} is not UTF-8 text`);
    const next = {
        bytes: Buffer.from(replaceBlock(text, body, { path, style })),
        mode: current?.mode ?? OWNER_WRITABLE_FILE,
    };
    return { path, before: current, after: next, status: isSameContents(current, next) ? 'unchanged' : 'changed' };
}

/**
 * Merge the keys gspot currently manages into a shared file.
 * @param writer the locked file writer.
 * @param path the destination.
 * @param changes the keys and requested values.
 * @returns the key write plan.
 */
export function planManagedKeys(writer: Writer, path: string, changes: FileEdit['changes']): WritePlan {
    const current = writer.files.read(path);
    const plan = planKeyChanges({ path, changes, current });
    return { path, before: current, after: plan.next, status: plan.status };
}

/**
 * Remove the exact copy the caller reviewed.
 * @param path the destination.
 * @param expected the reviewed copy.
 * @returns the removal plan.
 */
export function planDeletion(path: string, expected: FileCopy): WritePlan {
    return { path, before: expected, status: 'changed' };
}

/**
 * Remove an owned file or its managed block while retaining authored text.
 * @param writer the locked file writer.
 * @param path the obsolete generated destination.
 * @returns the removal plan.
 */
export function planRemoval(writer: Writer, path: string): WritePlan {
    const current = writer.files.readKeepingLinks(path);
    if (current === undefined) return { path, before: current, status: 'unchanged' };
    if (isOwned(path, writer.files)) return { path, before: current, status: 'changed' };
    const next = removeBlock(path, current);
    return {
        path,
        before: current,
        ...(next === undefined ? {} : { after: next }),
        status: isSameContents(current, next) ? 'unchanged' : 'changed',
    };
}
