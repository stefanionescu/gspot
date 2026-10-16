import { createTwoFilesPatch } from 'diff';
import { toPosix } from '#cli/system/paths.ts';
import type { StaleFile } from '#cli/types/apply.ts';
import type { Session } from '#cli/types/planning.ts';
import { readOwnershipLog } from '#cli/ownership/log.ts';
import { staleLockfiles } from '#cli/tools/lockfiles.ts';
import { currentBlock } from '#cli/system/managed-blocks.ts';
import type { OwnershipState } from '#cli/types/ownership.ts';
import { hasManagedKeys } from '#cli/ownership/managed-keys.ts';
import { parseToolProject } from '#cli/parsers/tool-project.ts';
import type { Generated } from '#cli/types/generation/files.ts';
import { openSafeFolder } from '#cli/system/safe-folder/open.ts';
import type { NpmClient } from '#cli/types/parsers/dependency-files.ts';
import { RETAINED_PATHS, CONFLICT_MARKERS, DIFF_CONTEXT_LINES } from '#cli/config/apply.ts';
import { UV_LOCKFILE, NPM_TOOL_PROJECT_FILE, PYTHON_TOOL_PROJECT_FILE } from '#cli/config/system/locations.ts';

function patch(path: string, before: string, after: string, beforeName: string): string {
    return createTwoFilesPatch(`a/${toPosix(path)}`, `b/${toPosix(path)}`, before, after, beforeName, 'generated', {
        context: DIFF_CONTEXT_LINES,
    });
}

function staleWholeFiles(root: string, generated: Generated): StaleFile[] {
    using files = openSafeFolder(root);
    return generated.files.flatMap((file): StaleFile[] => {
        const current = files.read(file.path);
        if (current === undefined) return [{ path: file.path, kind: 'missing' }];
        const disk = current.bytes.toString('utf8');
        // A merge left its markers in the file: regeneration repairs the unreadable configuration.
        if (CONFLICT_MARKERS.test(disk)) return [{ path: file.path, kind: 'conflict' }];
        if (disk !== file.content)
            return [
                {
                    path: file.path,
                    kind: 'changed',
                    diff: patch(file.path, disk, file.content, 'on disk'),
                },
            ];
        return [];
    });
}

function staleBlocks(root: string, generated: Generated): StaleFile[] {
    const entries: StaleFile[] = [];
    using files = openSafeFolder(root);
    for (const block of generated.blocks) {
        const text = files.read(block.path)?.bytes.toString('utf8') ?? '';
        const current = currentBlock(text, { path: block.path, style: block.style });
        const wanted = block.block.trim();
        if (current === undefined) entries.push({ path: block.path, kind: 'missing' });
        else if (current !== wanted)
            entries.push({
                path: block.path,
                kind: 'changed',
                diff: patch(block.path, current, wanted, 'managed block on disk'),
            });
    }
    return entries;
}

// Classify merged files with no remaining managed fields as missing or changed.
function staleKeys(root: string, generated: Generated): StaleFile[] {
    using files = openSafeFolder(root);
    return [...generated.fileEdits]
        .filter((output) => !hasManagedKeys(root, output))
        .map((output) => ({ path: output.path, kind: files.read(output.path) === undefined ? 'missing' : 'changed' }));
}

/**
 * Check for recorded files without a selected owner or retention requirement.
 *
 * @param entry the recorded file.
 * @param expectedPaths the files and moves selected now.
 *
 * @returns whether apply restores the original file or removes it.
 */
export function isStray(entry: OwnershipState['files'][number], expectedPaths: ReadonlySet<string>): boolean {
    return entry.written !== undefined && !expectedPaths.has(entry.path) && !RETAINED_PATHS.has(entry.path);
}

/**
 * Find changed, missing, or stray generated files. Include managed blocks and authored file edits.
 *
 * @param session the repository root and actual selected npm client.
 * @param generated the generated files as generated now.
 *
 * @returns the drift entries in path order.
 */
export function findStaleFiles(session: Pick<Session, 'root' | 'npmClient'>, generated: Generated): StaleFile[] {
    const { root } = session;
    const ownership = readOwnershipLog(root);
    const known = expectedPaths(session, generated);
    const lockfiles = staleLockfiles(session, generated.files);
    const strays = ownership.files
        .filter((entry) => isStray(entry, known))
        .map((entry): StaleFile => ({ path: entry.path, kind: 'stray' }));
    return [
        ...lockfiles.flatMap(({ path, kind }) => (kind === undefined ? [] : [{ path, kind }])),
        ...staleWholeFiles(root, generated),
        ...staleBlocks(root, generated),
        ...staleKeys(root, generated),
        ...strays,
    ].toSorted((a, b) => a.path.localeCompare(b.path));
}

/**
 * Every managed destination, including lockfiles owned by applicable tool projects.
 *
 * @param session the actual selected npm client.
 * @param generated the completed generated files.
 *
 * @returns the destination paths.
 */
export function expectedPaths(session: Pick<Session, 'npmClient'>, generated: Generated): Set<string> {
    const paths = new Set([...generated.files, ...generated.blocks, ...generated.fileEdits].map((file) => file.path));
    for (const file of generated.files) {
        if (file.path === NPM_TOOL_PROJECT_FILE)
            paths.add(parseToolProject(file.content, session.npmClient() as NpmClient).lockfilePath);
        if (file.path === PYTHON_TOOL_PROJECT_FILE) paths.add(UV_LOCKFILE);
    }
    return paths;
}
