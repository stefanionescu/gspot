import { join } from 'node:path';
import { lstatSync } from 'node:fs';
import { isInside } from '#cli/system/paths.ts';
import type { Session } from '#cli/types/session.ts';
import { decodeUtf8Text } from '#cli/system/files/reads.ts';
import { parseAttributePatterns } from '#cli/parsers/git.ts';
import { isSameContents } from '#cli/system/files/entries.ts';
import { OWNER_WRITABLE_FILE } from '#cli/config/files/modes.ts';
import { openFiles, walkFiles } from '#cli/system/files/open.ts';
import { buildPathMatcher } from '#cli/repository/files/matchers.ts';
import type { Files, FileContents } from '#cli/types/system/files.ts';
import { hasGeneratedHeader } from '#cli/repository/files/classify.ts';
import { GITIGNORE_FILE } from '#cli/config/repository/files/tracked.ts';
import { AGENTS_FILE, GITATTRIBUTES_FILE } from '#cli/config/files/names.ts';
import type { BlockStyle } from '#cli/types/parsers/formats/managed-blocks.ts';
import type { Writer, WritePlan, ReplacementRequest } from '#cli/types/apply.ts';
import { DOT_GSPOT, GSPOT_PATHS, INSTALLED_TOOL_FOLDERS } from '#cli/config/gspot-folder.ts';
import { replaceBlock, findBlockBody, findBlockSpan } from '#cli/parsers/formats/managed-blocks.ts';

/**
 * Remove only the marked block and its separating blank line.
 *
 * @param path the block file.
 * @param current its bytes on disk.
 * @returns the remaining file contents, or undefined when nothing remains.
 */
function removeBlock(path: string, current: FileContents): FileContents | undefined {
    const text = decodeUtf8Text(path, current.bytes);
    const span = findBlockSpan(text, { path, style: path.endsWith('.md') ? 'markdown' : 'hash' });
    if (span === undefined) return current;
    const before = text.slice(0, span.start).replace(/(\r?\n)\r?\n$/u, '$1');
    const after = text.slice(span.end);
    // When the block opened the file, drop the blank line that followed it too.
    const next = before === '' ? after.replace(/^\r?\n/u, '') : before + after;
    return next === '' ? undefined : { bytes: Buffer.from(next), mode: current.mode };
}

/**
 * Check whether gspot owns the whole file: it sits in .gspot, starts with the gspot header, or matches a
 * linguist-generated pattern in the managed block of .gitattributes.
 *
 * @param path the repository-relative file.
 * @param disk the repository reader.
 * @returns whether gspot owns the whole file.
 */
function isOwned(path: string, disk: Files): boolean {
    if (!isInside(path)) return false;
    if (path.startsWith(`${DOT_GSPOT}/`)) return true;
    const file = disk.readKeepingLinks(path);
    if (file !== undefined && file.isLink !== true && hasGeneratedHeader(file.bytes.toString('utf8'))) return true;
    const attributesFile = disk.read(GITATTRIBUTES_FILE);
    if (attributesFile === undefined) return false;
    const block =
        findBlockBody(attributesFile.bytes.toString('utf8'), { path: GITATTRIBUTES_FILE, style: 'hash' }) ?? '';
    return parseAttributePatterns(block, '.').some(
        ({ pattern, attributes }) => attributes.includes('linguist-generated') && buildPathMatcher([pattern])(path),
    );
}

/**
 * Find owned files and managed blocks outside the generation plan.
 *
 * @param session the repository files.
 * @param expected the generated destinations that remain.
 * @returns the stray generated paths.
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
    const writtenPaths = new Set([
        ...ownPaths,
        ...session.repository.files.filter(({ kind }) => kind === 'generated').map(({ path }) => path),
        ...blockPaths,
    ]);
    return [...writtenPaths].filter((path) => {
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
 * Plan a replacement: refuse authored bytes that nobody reviewed.
 *
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
        expected === undefined
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
 * Plan the marked block, and keep the text outside it.
 *
 * @param writer the locked repository handle.
 * @param path the file.
 * @param body the block text.
 * @param style markdown or hash markers.
 * @returns the block write plan.
 */
export function planBlock(writer: Writer, path: string, body: string, style: BlockStyle): WritePlan {
    const current = writer.files.read(path);
    const text = current === undefined ? '' : decodeUtf8Text(path, current.bytes);
    const nextText = replaceBlock(text, body, { path, style });
    const next = {
        bytes: Buffer.from(nextText),
        mode: current?.mode ?? OWNER_WRITABLE_FILE,
    };
    return { path, before: current, after: next, status: isSameContents(current, next) ? 'unchanged' : 'changed' };
}

/**
 * Plan the removal of an owned file, or of its managed block.
 *
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
