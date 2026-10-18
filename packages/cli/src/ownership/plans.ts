import { join } from 'node:path';
import { lstatSync } from 'node:fs';
import { isInside } from '#cli/system/paths.ts';
import { AGENTS_FILE } from '#cli/config/rules.ts';
import type { Session } from '#cli/types/planning.ts';
import { decodeUtf8 } from '#cli/system/files/reads.ts';
import { parseAttributePatterns } from '#cli/parsers/git.ts';
import { isSameContents } from '#cli/system/files/entries.ts';
import { buildPathMatcher } from '#cli/repository/matchers.ts';
import { planKeyChanges } from '#cli/ownership/managed-keys.ts';
import { openFiles, walkFiles } from '#cli/system/files/open.ts';
import { OWNER_WRITABLE_FILE } from '#cli/config/system/modes.ts';
import type { Files, FileContents } from '#cli/types/system/files.ts';
import type { BlockStyle } from '#cli/types/system/managed-blocks.ts';
import { isInGspotFolder, hasGeneratedHeader } from '#cli/repository/classify.ts';
import { GITIGNORE_FILE, GITATTRIBUTES_FILE } from '#cli/config/repository/tracked.ts';
import { readBlock, replaceBlock, findBlockSpan } from '#cli/system/managed-blocks.ts';
import type { Writer, FileEdit, WritePlan, ReplacementRequest } from '#cli/types/ownership.ts';
import { DOT_GSPOT, STATE_PATH, INSTALLED_TOOL_FOLDERS } from '#cli/config/system/locations.ts';

/**
 * Remove only the marked block and its separating blank line.
 * @param path the block file.
 * @param current its bytes on disk.
 * @returns the remaining file contents, or undefined when nothing remains.
 */
function removeBlock(path: string, current: FileContents): FileContents | undefined {
    const text = decodeUtf8(current.bytes);
    if (text === undefined) throw new Error(`${path} is not UTF-8 text`);
    const span = findBlockSpan(text, { path, style: path.endsWith('.md') ? 'markdown' : 'hash' });
    if (span === undefined) return current;
    const before = text.slice(0, span.start).replace(/(\r?\n)\r?\n$/u, '$1');
    const after = text.slice(span.end);
    // A block at the top of the file leaves the blank line that separated it from your text.
    const next = before === '' ? after.replace(/^\r?\n/u, '') : before + after;
    return next === '' ? undefined : { bytes: Buffer.from(next), mode: current.mode };
}

/**
 * Determine ownership from the gspot folder, file notice, or managed Git attributes.
 * @param path the repository-relative file.
 * @param disk the repository reader.
 * @returns whether gspot owns the whole file.
 */
export function isOwned(path: string, disk: Files): boolean {
    if (!isInside(path)) return false;
    if (isInGspotFolder(path)) return true;
    const file = disk.readKeepingLinks(path);
    if (file !== undefined && file.isLink !== true && hasGeneratedHeader(file.bytes.toString('utf8'))) return true;
    const attributesFile = disk.read(GITATTRIBUTES_FILE);
    if (attributesFile === undefined) return false;
    const block = readBlock(attributesFile.bytes.toString('utf8'), { path: GITATTRIBUTES_FILE, style: 'hash' }) ?? '';
    return parseAttributePatterns(block, '.').some(
        ({ pattern, attributes }) => attributes.includes('linguist-generated') && buildPathMatcher([pattern])(path),
    );
}

/**
 * Find owned files and managed blocks outside the generation plan.
 * @param session the repository files.
 * @param expected the generated destinations that remain.
 * @returns the obsolete generated paths.
 */
export function listStrayPaths(
    session: Pick<Session, 'root' | 'repository' | 'settingsFile'>,
    expected: ReadonlySet<string>,
): string[] {
    using disk = openFiles(session.root);
    const blockPaths = new Set([AGENTS_FILE, GITIGNORE_FILE, GITATTRIBUTES_FILE]);
    const installations = [STATE_PATH, ...Object.values(INSTALLED_TOOL_FOLDERS)];
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
 * Replace owned or reviewed bytes, and keep other authored files.
 * @param writer the locked repository handle.
 * @param request the new bytes and any reviewed file contents.
 * @returns the write plan, with an unchanged, changed, or preserved status.
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
 * Replace or append the marked block, and keep the text outside it.
 * @param writer the locked repository handle.
 * @param path the file.
 * @param body the block text.
 * @param style markdown or hash markers.
 * @returns the block write plan.
 */
export function planBlock(writer: Writer, path: string, body: string, style: BlockStyle): WritePlan {
    const current = writer.files.read(path);
    const text = current === undefined ? '' : decodeUtf8(current.bytes);
    if (text === undefined) throw new Error(`${path} is not UTF-8 text`);
    const nextText = replaceBlock(text, body, { path, style });
    const next = {
        bytes: Buffer.from(nextText),
        mode: current?.mode ?? OWNER_WRITABLE_FILE,
    };
    return { path, before: current, after: next, status: isSameContents(current, next) ? 'unchanged' : 'changed' };
}

/**
 * Merge the managed keys into a shared file.
 * @param writer the locked repository handle.
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
 * Remove an owned file or its managed block, and keep the authored text.
 * @param writer the locked repository handle.
 * @param path the stale generated file.
 * @returns the old bytes, and any authored text left after the managed block goes.
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
