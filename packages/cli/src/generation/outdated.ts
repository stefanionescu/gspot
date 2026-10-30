import { createTwoFilesPatch } from 'diff';
import { compareText } from '#cli/system/text.ts';
import { OCTAL_RADIX } from '#cli/config/units.ts';
import type { Session } from '#cli/types/session.ts';
import { openFiles } from '#cli/system/files/open.ts';
import type { Files } from '#cli/types/system/files.ts';
import { convertToPosixPath } from '#cli/system/paths.ts';
import { isSameContents } from '#cli/system/files/bounded.ts';
import { listStaleLockfiles } from '#cli/installers/projects.ts';
import { selectLockfileName } from '#cli/installers/npm/lockfiles.ts';
import { GSPOT_PATHS, GSPOT_FOLDER } from '#cli/config/files/gspot.ts';
import { findBlockBody } from '#cli/parsers/formats/managed-blocks.ts';
import { listStrayPaths, hasManagedKeys } from '#cli/repository/writer.ts';
import { listOwnablePaths } from '#cli/generation/config-files/link-files.ts';
import { EXECUTABLE_FILE, OWNER_WRITABLE_FILE } from '#cli/config/files/modes.ts';
import { type Generation, type OutdatedFile } from '#cli/types/generation/files.ts';
import { ON_DISK_LABEL, DIFF_CONTEXT_LINES, BLOCK_ON_DISK_LABEL } from '#cli/config/generation/generation.ts';

function listOutdatedOutputs(files: Files, generated: Generation): OutdatedFile[] {
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
                        ? `old mode ${onDisk.mode.toString(OCTAL_RADIX)}\nnew mode ${mode.toString(OCTAL_RADIX)}\n`
                        : createTwoFilesPatch(
                              `a/${convertToPosixPath(file.path)}`,
                              `b/${convertToPosixPath(file.path)}`,
                              disk,
                              file.content,
                              ON_DISK_LABEL,
                              'generated',
                              { context: DIFF_CONTEXT_LINES },
                          ),
            },
        ];
    });
}

function listOutdatedBlocks(files: Files, generated: Generation): OutdatedFile[] {
    const outdated: OutdatedFile[] = [];
    for (const block of generated.blocks) {
        const text = files.read(block.path)?.bytes.toString('utf8') ?? '';
        const onDisk = findBlockBody(text, { path: block.path });
        const wanted = block.body.trim();
        if (onDisk === undefined) outdated.push({ path: block.path, kind: 'missing' });
        else if (onDisk !== wanted)
            outdated.push({
                path: block.path,
                kind: 'changed',
                diff: createTwoFilesPatch(
                    `a/${convertToPosixPath(block.path)}`,
                    `b/${convertToPosixPath(block.path)}`,
                    onDisk,
                    wanted,
                    BLOCK_ON_DISK_LABEL,
                    'generated',
                    { context: DIFF_CONTEXT_LINES },
                ),
            });
    }
    return outdated;
}

function listOutdatedManagedKeys(files: Files, generated: Generation): OutdatedFile[] {
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
export async function listOutdatedFiles(session: Session, generated: Generation): Promise<OutdatedFile[]> {
    const files = openFiles(session.root);
    const expected = listExpectedPaths(session, generated);
    const lockfiles = await listStaleLockfiles(session, generated.files);
    const strays = listStrayPaths(session, expected, listOwnablePaths(session)).map(
        (path): OutdatedFile => ({
            path,
            kind: 'stray',
        }),
    );
    return [
        ...lockfiles.map(({ path, kind }) => ({ path, kind })),
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
*/
export function listExpectedPaths(
    session: Pick<Session, 'packageManager' | 'toolsRoot' | 'timeoutSeconds' | 'cache'>,
    generated: Generation,
): Set<string> {
    const paths = new Set([...generated.files, ...generated.blocks, ...generated.managedKeys].map((file) => file.path));
    const { packageManager } = session;
    const project = generated.files.find((file) => file.path === GSPOT_PATHS.npmProject);
    if (packageManager !== undefined && project !== undefined) {
        const name = packageManager.name === 'yarn' ? 'npm' : packageManager.name;
        paths.add(`${GSPOT_FOLDER}/${selectLockfileName(name)}`);
    }
    for (const file of generated.files) {
        if (file.path === GSPOT_PATHS.miseProject) paths.add(GSPOT_PATHS.miseLockfile);
        else if (file.path === GSPOT_PATHS.pythonProject) paths.add(GSPOT_PATHS.uvLockfile);
    }
    return paths;
}
