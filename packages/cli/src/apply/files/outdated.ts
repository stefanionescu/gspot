import { createTwoFilesPatch } from 'diff';
import type { Session } from '#cli/types/session.ts';
import { openFiles } from '#cli/system/files/open.ts';
import type { OutdatedFile } from '#cli/types/apply.ts';
import type { Files } from '#cli/types/system/files.ts';
import { GSPOT_PATHS } from '#cli/config/gspot-folder.ts';
import { convertToPosixPath } from '#cli/system/paths.ts';
import { listStrayPaths } from '#cli/apply/write/plans.ts';
import { isSameContents } from '#cli/system/files/entries.ts';
import { hasManagedKeys } from '#cli/apply/write/managed-keys.ts';
import { listStaleLockfiles } from '#cli/install/tool-projects.ts';
import { findBlockBody } from '#cli/parsers/formats/managed-blocks.ts';
import type { GenerationResult } from '#cli/types/generation/files.ts';
import { parseToolPackageJson } from '#cli/install/npm/package-json.ts';
import { assertPackageManager } from '#cli/repository/npm/package-manager.ts';
import { EXECUTABLE_FILE, OWNER_WRITABLE_FILE } from '#cli/config/files/modes.ts';
import { MODE_RADIX, DIFF_CONTEXT_LINES } from '#cli/config/apply/files/outdated.ts';

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

function listOutdatedWholeFiles(files: Files, generated: GenerationResult): OutdatedFile[] {
    return generated.files.flatMap((file): OutdatedFile[] => {
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

function listOutdatedBlocks(files: Files, generated: GenerationResult): OutdatedFile[] {
    const entries: OutdatedFile[] = [];
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

// List the shared files that went missing or lack a managed key.
function listOutdatedManagedKeys(files: Files, generated: GenerationResult): OutdatedFile[] {
    return generated.managedKeys.flatMap((output): OutdatedFile[] => {
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
 * @returns the outdated files in path order.
 */
export function listOutdatedFiles(
    session: Pick<Session, 'root' | 'packageManager' | 'repository'>,
    generated: GenerationResult,
): OutdatedFile[] {
    using files = openFiles(session.root);
    const known = listExpectedPaths(session, generated);
    const lockfiles = listStaleLockfiles(session, generated.files);
    const strays = listStrayPaths(session, known).map((path): OutdatedFile => ({ path, kind: 'stray' }));
    return [
        ...lockfiles.flatMap(({ path, kind }) => (kind === undefined ? [] : [{ path, kind }])),
        ...listOutdatedWholeFiles(files, generated),
        ...listOutdatedBlocks(files, generated),
        ...listOutdatedManagedKeys(files, generated),
        ...strays,
    ].toSorted((a, b) => a.path.localeCompare(b.path));
}

/**
 * List every managed path, with the lockfiles of the tool projects in use.
 *
 * @param session the repository and its package manager.
 * @param generated the files that this run generates.
 * @returns every path that this run writes or keeps.
 */
export function listExpectedPaths(session: Pick<Session, 'packageManager'>, generated: GenerationResult): Set<string> {
    const paths = new Set([...generated.files, ...generated.blocks, ...generated.managedKeys].map((file) => file.path));
    for (const file of generated.files) {
        if (file.path === GSPOT_PATHS.npmProject)
            paths.add(
                parseToolPackageJson(file.content, assertPackageManager(session.packageManager).name).lockfilePath,
            );
        if (file.path === GSPOT_PATHS.pythonProject) paths.add(GSPOT_PATHS.uvLockfile);
    }
    return paths;
}
