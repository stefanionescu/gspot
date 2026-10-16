import { createTwoFilesPatch } from 'diff';
import { toPosix } from '#cli/system/paths.ts';
import type { StaleFile } from '#cli/types/apply.ts';
import type { Session } from '#cli/types/planning.ts';
import { listStrayPaths } from '#cli/ownership/plans.ts';
import { staleLockfiles } from '#cli/tools/lockfiles.ts';
import { DIFF_CONTEXT_LINES } from '#cli/config/apply.ts';
import { openSafeFolder } from '#cli/system/files/open.ts';
import { currentBlock } from '#cli/system/managed-blocks.ts';
import { hasManagedKeys } from '#cli/ownership/managed-keys.ts';
import { parseToolProject } from '#cli/parsers/tool-project.ts';
import type { Generated } from '#cli/types/generation/files.ts';
import type { SafeFolder } from '#cli/types/system/safe-folder.ts';
import type { NpmClient } from '#cli/types/parsers/dependency-files.ts';

import {
    UV_LOCKFILE,
    VERSION_PIN_FILE,
    NPM_TOOL_PROJECT_FILE,
    PYTHON_TOOL_PROJECT_FILE,
} from '#cli/config/system/locations.ts';

function patch(path: string, before: string, after: string, beforeName: string): string {
    return createTwoFilesPatch(`a/${toPosix(path)}`, `b/${toPosix(path)}`, before, after, beforeName, 'generated', {
        context: DIFF_CONTEXT_LINES,
    });
}

function staleWholeFiles(files: SafeFolder, generated: Generated): StaleFile[] {
    return generated.files.flatMap((file): StaleFile[] => {
        const current = files.read(file.path);
        if (current === undefined) return [{ path: file.path, kind: 'missing' }];
        const disk = current.bytes.toString('utf8');
        // A merge left its markers in the file: regeneration repairs the unreadable configuration.
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

function staleBlocks(files: SafeFolder, generated: Generated): StaleFile[] {
    const entries: StaleFile[] = [];
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
function staleKeys(files: SafeFolder, generated: Generated): StaleFile[] {
    return generated.fileEdits.flatMap((output): StaleFile[] => {
        const current = files.read(output.path);
        if (current === undefined) return [{ path: output.path, kind: 'missing' }];
        return hasManagedKeys(output, current) ? [] : [{ path: output.path, kind: 'changed' }];
    });
}

/**
 * Find changed, missing, or stray generated files. Include managed blocks and authored file edits.
 *
 * @param session the repository root and actual selected npm client.
 * @param generated the generated files as generated now.
 *
 * @returns the drift entries in path order.
 */
export function findStaleFiles(
    session: Pick<Session, 'root' | 'npmClient' | 'repository' | 'settingsFile'>,
    generated: Generated,
): StaleFile[] {
    using files = openSafeFolder(session.root);
    const known = expectedPaths(session, generated);
    const lockfiles = staleLockfiles(session, generated.files);
    const strays = listStrayPaths(session, known).map((path): StaleFile => ({ path, kind: 'stray' }));
    return [
        ...lockfiles.flatMap(({ path, kind }) => (kind === undefined ? [] : [{ path, kind }])),
        ...staleWholeFiles(files, generated),
        ...staleBlocks(files, generated),
        ...staleKeys(files, generated),
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
    const paths = new Set([
        VERSION_PIN_FILE,
        ...[...generated.files, ...generated.blocks, ...generated.fileEdits].map((file) => file.path),
    ]);
    for (const file of generated.files) {
        if (file.path === NPM_TOOL_PROJECT_FILE)
            paths.add(parseToolProject(file.content, session.npmClient() as NpmClient).lockfilePath);
        if (file.path === PYTHON_TOOL_PROJECT_FILE) paths.add(UV_LOCKFILE);
    }
    return paths;
}
