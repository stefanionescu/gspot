import { createTwoFilesPatch } from 'diff';

import { BLOCK_ON_DISK_LABEL, DIFF_CONTEXT_LINES, ON_DISK_LABEL } from '#cli/config/generation.ts';
import { GSPOT_PATHS } from '#cli/config/manifests.ts';
import { GSPOT_FOLDER, OCTAL_RADIX } from '#cli/config/parsers.ts';
import { EXECUTABLE_FILE } from '#cli/config/repository/files.ts';
import { OWNER_WRITABLE_FILE } from '#cli/config/repository/setup.ts';
import { listOwnablePaths } from '#cli/generation/pointers.ts';
import { findBlockBody } from '#cli/parsers/formats/managed-blocks.ts';
import { hasManagedKeys, listStrayPaths } from '#cli/repository/writer.ts';
import { isSameContents } from '#cli/system/files/bounded.ts';
import { openFiles } from '#cli/system/files/open.ts';
import { convertToPosixPath } from '#cli/system/paths.ts';
import { compareText } from '#cli/system/text.ts';
import { selectLockfileName } from '#cli/tools/installers/npm/lockfiles.ts';
import { listStaleLockfiles } from '#cli/tools/installers/projects.ts';
import type { StaleFile } from '#cli/types/engine/run.ts';
import type { FileContents, Files } from '#cli/types/system.ts';
import type { GeneratedFile, Generation, Session } from '#cli/types/tools.ts';

function listStaleOutputs(files: Files, generated: Generation): StaleFile[] {
    return generated.files.flatMap((file): StaleFile[] => {
        const onDisk = files.read(file.path);
        if (onDisk === undefined) return [{ path: file.path, kind: 'absent' }];
        const mode = file.executable === true ? EXECUTABLE_FILE : OWNER_WRITABLE_FILE;
        return isSameContents(onDisk, { bytes: Buffer.from(file.content), mode })
            ? []
            : [{ path: file.path, kind: 'changed' }];
    });
}

function listStaleBlocks(files: Files, generated: Generation): StaleFile[] {
    const stale: StaleFile[] = [];
    for (const block of generated.blocks) {
        const text = files.read(block.path)?.bytes.toString('utf8') ?? '';
        const onDisk = findBlockBody(text, { path: block.path });
        const wanted = block.body.trim();
        if (onDisk === undefined) stale.push({ path: block.path, kind: 'absent' });
        else if (onDisk !== wanted) stale.push({ path: block.path, kind: 'changed' });
    }
    return stale;
}

function listStaleManagedKeys(files: Files, generated: Generation): StaleFile[] {
    return generated.managedKeys.flatMap((output): StaleFile[] => {
        const onDisk = files.read(output.path);
        if (onDisk === undefined) return [{ path: output.path, kind: 'absent' }];
        return hasManagedKeys(output, onDisk) ? [] : [{ path: output.path, kind: 'changed' }];
    });
}

function buildOutputDiff(file: GeneratedFile, onDisk: FileContents): string {
    const text = onDisk.bytes.toString('utf8');
    if (text === file.content) {
        const mode = file.executable === true ? EXECUTABLE_FILE : OWNER_WRITABLE_FILE;
        return `old mode ${onDisk.mode.toString(OCTAL_RADIX)}\nnew mode ${mode.toString(OCTAL_RADIX)}\n`;
    }
    return createTwoFilesPatch(
        `a/${convertToPosixPath(file.path)}`,
        `b/${convertToPosixPath(file.path)}`,
        text,
        file.content,
        ON_DISK_LABEL,
        'generated',
        { context: DIFF_CONTEXT_LINES },
    );
}

/**
Build a patch for a changed generated file or managed block when verbose reporting needs it.

@param root the repository root.
@param generated the expected files and blocks.
@param path the changed output path.
*/
function buildGeneratedDiff(root: string, generated: Generation, path: string): string | undefined {
    const onDisk = openFiles(root).read(path);
    if (onDisk === undefined) return undefined;
    const file = generated.files.find((output) => output.path === path);
    if (file !== undefined) return buildOutputDiff(file, onDisk);
    const block = generated.blocks.find((output) => output.path === path);
    if (block === undefined) return undefined;
    const text = onDisk.bytes.toString('utf8');
    const body = findBlockBody(text, { path }) ?? '';
    return createTwoFilesPatch(
        `a/${convertToPosixPath(path)}`,
        `b/${convertToPosixPath(path)}`,
        body,
        block.body.trim(),
        BLOCK_ON_DISK_LABEL,
        'generated',
        { context: DIFF_CONTEXT_LINES },
    );
}

/**
Find changed, absent, or stray generated files. Managed blocks and file edits count too.

@param session the repository to compare.
@param generated the files that this run generates.
@param options controls optional differences.
@param options.verbose includes text and mode differences for changed files.
@returns the stale files in path order.
*/
export function listStaleFiles(
    session: Session,
    generated: Generation,
    options: { verbose?: boolean | undefined } = {},
): StaleFile[] {
    const files = openFiles(session.root);
    const expected = listExpectedPaths(session, generated);
    const lockfiles = listStaleLockfiles(session, generated.files);
    const strays: StaleFile[] = listStrayPaths(session, expected, listOwnablePaths(session)).map((path) => ({
        path,
        kind: 'stray',
    }));
    return [
        ...lockfiles.map(({ path, kind }) => ({ path, kind })),
        ...listStaleOutputs(files, generated),
        ...listStaleBlocks(files, generated),
        ...listStaleManagedKeys(files, generated),
        ...strays,
    ]
        .map((file) => {
            const diff =
                options.verbose === true && file.kind === 'changed'
                    ? buildGeneratedDiff(session.root, generated, file.path)
                    : undefined;
            return diff === undefined ? file : { ...file, diff };
        })
        .toSorted((a, b) => compareText(a.path, b.path));
}

/**
List every managed path, with the lockfiles of the tool projects in use.

@param session the repository and its package manager.
@param generated the files that this run generates.
*/
export function listExpectedPaths(
    session: Pick<Session, 'toolPackageManager' | 'toolsRoot' | 'settings' | 'cache'>,
    generated: Generation,
): Set<string> {
    const paths = new Set([...generated.files, ...generated.blocks, ...generated.managedKeys].map((file) => file.path));
    const { toolPackageManager } = session;
    const project = generated.files.find((file) => file.path === GSPOT_PATHS.npmProject);
    if (toolPackageManager !== undefined && project !== undefined)
        paths.add(`${GSPOT_FOLDER}/${selectLockfileName(toolPackageManager)}`);
    for (const file of generated.files) {
        if (file.path === GSPOT_PATHS.miseProject) paths.add(GSPOT_PATHS.miseLockfile);
        else if (file.path === GSPOT_PATHS.pythonProject) paths.add(GSPOT_PATHS.uvLockfile);
    }
    return paths;
}
