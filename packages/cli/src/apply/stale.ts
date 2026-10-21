import { createTwoFilesPatch } from 'diff';
import type { StaleFile } from '#cli/types/apply.ts';
import type { Session } from '#cli/types/session.ts';
import { openFiles } from '#cli/system/files/open.ts';
import type { Files } from '#cli/types/system/files.ts';
import { listStrayPaths } from '#cli/ownership/plans.ts';
import { DIFF_CONTEXT_LINES } from '#cli/config/apply.ts';
import { convertToPosixPath } from '#cli/system/paths.ts';
import { isSameContents } from '#cli/system/files/entries.ts';
import { findBlockBody } from '#cli/parsers/managed-blocks.ts';
import { hasManagedKeys } from '#cli/ownership/file-settings.ts';
import { listStaleLockfiles } from '#cli/install/tool-projects.ts';
import type { GenerationResult } from '#cli/types/generation/files.ts';
import { parseToolPackageJson } from '#cli/install/npm/tool-project.ts';
import { assertPackageManager } from '#cli/repository/npm/package-manager.ts';
import { MODE_RADIX, EXECUTABLE_FILE, OWNER_WRITABLE_FILE } from '#cli/config/system/modes.ts';
import { UV_LOCKFILE, NPM_TOOL_PROJECT_FILE, PYTHON_TOOL_PROJECT_FILE } from '#cli/config/gspot-paths.ts';

function buildDiff(path: string, before: string, after: string, beforeName: string): string {
    return createTwoFilesPatch(
        `a/${convertToPosixPath(path)}`,
        `b/${convertToPosixPath(path)}`,
        before,
        after,
        beforeName,
        'generated',
        {
            context: DIFF_CONTEXT_LINES,
        },
    );
}

function listStaleWholeFiles(files: Files, generated: GenerationResult): StaleFile[] {
    return generated.files.flatMap((file): StaleFile[] => {
        const current = files.read(file.path);
        if (current === undefined) return [{ path: file.path, kind: 'missing' }];
        const mode = file.executable === true ? EXECUTABLE_FILE : OWNER_WRITABLE_FILE;
        if (isSameContents(current, { bytes: Buffer.from(file.content), mode })) return [];
        const disk = current.bytes.toString('utf8');
        return [
            {
                path: file.path,
                kind: 'changed',
                diff:
                    disk === file.content
                        ? `old mode ${current.mode.toString(MODE_RADIX)}\nnew mode ${mode.toString(MODE_RADIX)}\n`
                        : buildDiff(file.path, disk, file.content, 'on disk'),
            },
        ];
    });
}

function listStaleBlocks(files: Files, generated: GenerationResult): StaleFile[] {
    const entries: StaleFile[] = [];
    for (const block of generated.blocks) {
        const text = files.read(block.path)?.bytes.toString('utf8') ?? '';
        const current = findBlockBody(text, { path: block.path, style: block.style });
        const wanted = block.block.trim();
        if (current === undefined) entries.push({ path: block.path, kind: 'missing' });
        else if (current !== wanted)
            entries.push({
                path: block.path,
                kind: 'changed',
                diff: buildDiff(block.path, current, wanted, 'managed block on disk'),
            });
    }
    return entries;
}

// Classify merged files with no remaining managed fields as missing or changed.
function listStaleManagedKeys(files: Files, generated: GenerationResult): StaleFile[] {
    return generated.managedKeys.flatMap((output): StaleFile[] => {
        const current = files.read(output.path);
        if (current === undefined) return [{ path: output.path, kind: 'missing' }];
        return hasManagedKeys(output, current) ? [] : [{ path: output.path, kind: 'changed' }];
    });
}

/**
 * Find changed, missing, or stray generated files. Managed blocks and file edits count too.
 *
 * @param session the repository to compare.
 * @param generated the files that this run generates.
 *
 * @returns the stale files in path order.
 */
export function listStaleFiles(
    session: Pick<Session, 'root' | 'packageManager' | 'repository'>,
    generated: GenerationResult,
): StaleFile[] {
    using files = openFiles(session.root);
    const known = listExpectedPaths(session, generated);
    const lockfiles = listStaleLockfiles(session, generated.files);
    const strays = listStrayPaths(session, known).map((path): StaleFile => ({ path, kind: 'stray' }));
    return [
        ...lockfiles.flatMap(({ path, kind }) => (kind === undefined ? [] : [{ path, kind }])),
        ...listStaleWholeFiles(files, generated),
        ...listStaleBlocks(files, generated),
        ...listStaleManagedKeys(files, generated),
        ...strays,
    ].toSorted((a, b) => a.path.localeCompare(b.path));
}

/**
 * List every managed path, with the lockfiles of the tool projects in use.
 *
 * @param session the repository and its package manager.
 * @param generated the files that this run generates.
 *
 * @returns every path that this run writes or keeps.
 */
export function listExpectedPaths(session: Pick<Session, 'packageManager'>, generated: GenerationResult): Set<string> {
    const paths = new Set([...generated.files, ...generated.blocks, ...generated.managedKeys].map((file) => file.path));
    for (const file of generated.files) {
        if (file.path === NPM_TOOL_PROJECT_FILE)
            paths.add(
                parseToolPackageJson(file.content, assertPackageManager(session.packageManager).name).lockfilePath,
            );
        if (file.path === PYTHON_TOOL_PROJECT_FILE) paths.add(UV_LOCKFILE);
    }
    return paths;
}
