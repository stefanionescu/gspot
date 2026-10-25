import { createTwoFilesPatch } from 'diff';
import { compareText } from '#cli/system/text.ts';
import type { Session } from '#cli/types/session.ts';
import { openFiles } from '#cli/system/files/open.ts';
import type { Files } from '#cli/types/system/files.ts';
import { convertToPosixPath } from '#cli/system/paths.ts';
import { isSameContents } from '#cli/system/files/bounded.ts';
import { listStrayPaths, hasManagedKeys } from '#cli/write.ts';
import { listStaleLockfiles } from '#cli/installers/projects.ts';
import { DOT_GSPOT, GSPOT_PATHS } from '#cli/config/gspot-folder.ts';
import { selectLockfileName } from '#cli/installers/npm/lockfiles.ts';
import { findBlockBody } from '#cli/parsers/formats/managed-blocks.ts';
import { EXECUTABLE_FILE, OWNER_WRITABLE_FILE } from '#cli/config/files/modes.ts';
import { selectToolPackageManager } from '#cli/repository/npm/package-manager.ts';
import { MODE_RADIX, DIFF_CONTEXT_LINES } from '#cli/config/generation/outdated.ts';
import { type OutdatedFile, type GenerationResult } from '#cli/types/generation/files.ts';

/**
Build a source diff with the shared Git context.

@param path the changed repository path.
@param before the previous text.
@param after the next text.
@param names labels for the previous and next text.
@returns the unified diff.
*/
// eslint-disable-next-line gspot/no-trivial-functions -- reason: 2 calls in this file share it.
export function buildDiff(path: string, before: string, after: string, names: [string, string]): string {
    return createTwoFilesPatch(
        `a/${convertToPosixPath(path)}`,
        `b/${convertToPosixPath(path)}`,
        before,
        after,
        ...names,
        {
            context: DIFF_CONTEXT_LINES,
        },
    );
}

function listOutdatedOutputs(files: Files, generated: GenerationResult): OutdatedFile[] {
    return generated.files.flatMap((file): OutdatedFile[] => {
        const onDisk = files.read(file.path);
        if (onDisk === undefined) return [{ path: file.path, kind: 'missing' }];
        const mode = file.executable === true ? EXECUTABLE_FILE : OWNER_WRITABLE_FILE;
        if (isSameContents(onDisk, { bytes: Buffer.from(file.content), mode })) return [];
        const disk = onDisk.bytes.toString('utf8');
        return [
            {
                path: file.path,
                kind: 'changed',
                diff:
                    disk === file.content
                        ? `old mode ${onDisk.mode.toString(MODE_RADIX)}\nnew mode ${mode.toString(MODE_RADIX)}\n`
                        : buildDiff(file.path, disk, file.content, ['on disk', 'generated']),
            },
        ];
    });
}

function listOutdatedBlocks(files: Files, generated: GenerationResult): OutdatedFile[] {
    const outdated: OutdatedFile[] = [];
    for (const block of generated.blocks) {
        const text = files.read(block.path)?.bytes.toString('utf8') ?? '';
        const onDisk = findBlockBody(text, { path: block.path, style: block.style });
        const wanted = block.block.trim();
        if (onDisk === undefined) outdated.push({ path: block.path, kind: 'missing' });
        else if (onDisk !== wanted)
            outdated.push({
                path: block.path,
                kind: 'changed',
                diff: buildDiff(block.path, onDisk, wanted, ['managed block on disk', 'generated']),
            });
    }
    return outdated;
}

function listOutdatedManagedKeys(files: Files, generated: GenerationResult): OutdatedFile[] {
    return generated.managedKeys.flatMap((output): OutdatedFile[] => {
        const onDisk = files.read(output.path);
        if (onDisk === undefined) return [{ path: output.path, kind: 'missing' }];
        return hasManagedKeys(output, onDisk) ? [] : [{ path: output.path, kind: 'changed' }];
    });
}

/**
Find changed, missing, or stray generated files. Managed blocks and file edits count too.

@param session the repository to compare.
@param generated the files that this run generates.
@returns the outdated files in path order.
*/
export async function listOutdatedFiles(
    session: Pick<
        Session,
        'root' | 'packageManager' | 'repository' | 'installedRoot' | 'reads' | 'timeoutSeconds' | 'toolConfigurations'
    >,
    generated: GenerationResult,
): Promise<OutdatedFile[]> {
    using files = openFiles(session.root);
    const expected = listExpectedPaths(session, generated);
    const lockfiles = await listStaleLockfiles(session, generated.files);
    const strays = listStrayPaths(session, expected).map((path): OutdatedFile => ({ path, kind: 'stray' }));
    return [
        ...lockfiles.flatMap(({ path, kind }) => (kind === undefined ? [] : [{ path, kind }])),
        ...listOutdatedOutputs(files, generated),
        ...listOutdatedBlocks(files, generated),
        ...listOutdatedManagedKeys(files, generated),
        ...strays,
    ].toSorted((a, b) => compareText(a.path, b.path));
}

/**
List every managed path, with the lockfiles of the tool projects in use.

@param session the repository and its package manager.
@param generated the files that this run generates.
@returns every path that this run writes or keeps.
*/
export function listExpectedPaths(
    session: Pick<Session, 'packageManager' | 'installedRoot' | 'timeoutSeconds' | 'reads'>,
    generated: GenerationResult,
): Set<string> {
    const paths = new Set([...generated.files, ...generated.blocks, ...generated.managedKeys].map((file) => file.path));
    const { packageManager, installedRoot, timeoutSeconds, reads } = session;
    const project = generated.files.find((file) => file.path === GSPOT_PATHS.npmProject);
    if (packageManager !== undefined && project !== undefined) {
        const name = selectToolPackageManager(installedRoot, packageManager, timeoutSeconds, reads);
        paths.add(`${DOT_GSPOT}/${selectLockfileName(name)}`);
    }
    for (const file of generated.files) {
        if (file.path === GSPOT_PATHS.miseProject) paths.add(GSPOT_PATHS.miseLockfile);
        if (file.path === GSPOT_PATHS.pythonProject) paths.add(GSPOT_PATHS.uvLockfile);
    }
    return paths;
}
