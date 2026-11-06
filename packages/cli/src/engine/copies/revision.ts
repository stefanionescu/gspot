import { copyFileSync, lstatSync, mkdirSync, realpathSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, posix, relative } from 'node:path';
import { setImmediate } from 'node:timers/promises';

import {
    DECLARATION_CONFIG_EXTENSIONS,
    DEPENDENCY_FILES,
    DEPENDENCY_REVISION_NOTE,
    GIT_ALTERNATES_PATH,
    GIT_CHECKOUT_ARGUMENTS,
    GIT_EMPTY_INDEX_ARGUMENTS,
    GIT_HASH_ARGUMENTS,
    GIT_HASH_FORMAT_ARGUMENTS,
    GIT_INIT_ARGUMENTS,
    GIT_PATH_ARGUMENTS,
    GIT_RAW_ATTRIBUTES_PATH,
    GIT_SET_HEAD_ARGUMENTS,
    GIT_SHALLOW_PATH,
    GIT_UPDATE_INDEX_ARGUMENTS,
    GIT_VERIFY_HEAD_ARGUMENTS,
    RAW_BLOB_ATTRIBUTES,
} from '#cli/config/engine.ts';
import { PACKAGE_JSON, PACKAGE_SWIFT, PYPROJECT_TOML } from '#cli/config/parsers.ts';
import { GIT_TOP_LEVEL_ARGUMENTS, GIT_WRITE_TREE_ARGUMENTS, TRAILING_NEWLINE } from '#cli/config/repository/git.ts';
import { LOCKFILES } from '#cli/config/repository/javascript.ts';
import { NODE_MODULES, PYTHON_ENVIRONMENT_FOLDER } from '#cli/config/system.ts';
import { copyDependencies, readDeclarationDependencies, readIgnoredPaths } from '#cli/engine/copies/dependencies.ts';
import { createCopyFolder } from '#cli/engine/copies/folders.ts';
import { copyValePackages } from '#cli/engine/copies/vale.ts';
import { readGitText, runGit } from '#cli/repository/git/run.ts';
import { listPackageFiles } from '#cli/repository/javascript/workspaces.ts';
import { listRevisionFiles } from '#cli/repository/revisions/files.ts';
import { GspotError } from '#cli/system/errors.ts';
import { openFiles } from '#cli/system/files/open.ts';
import { extractExtension } from '#cli/system/paths.ts';
import type { RevisionCopy, RevisionDependencies } from '#cli/types/engine/tool-runs.ts';
import type { GitFile, Revision } from '#cli/types/repository.ts';
import type { Files } from '#cli/types/system.ts';

function listDependencyFolders(installed: Files, projects: string[]): string[] {
    return projects.flatMap((path) => {
        const folder = dirname(path);
        if (basename(path) !== PACKAGE_JSON) return [];
        return installed.findStats(posix.join(folder, NODE_MODULES)) === undefined ? [] : [folder];
    });
}

async function listUnchangedDependencies(
    root: string,
    installed: Files,
    indexFiles: GitFile[],
    cancelSignal?: AbortSignal,
): Promise<Set<string>> {
    const present = indexFiles.filter(
        ({ path }) => statSync(join(root, path), { throwIfNoEntry: false })?.isFile() === true,
    );
    for (const indexFile of present) installed.readCanonicalPath(indexFile.path);
    const hashed = await runGit(root, GIT_HASH_ARGUMENTS, {
        stdin: present.map((indexFile) => JSON.stringify(indexFile.path) + '\n').join(''),
        cancelSignal,
    });
    if (hashed.code !== 0)
        throw new GspotError(
            'git',
            `Git cannot hash the working-tree dependency files: ${hashed.stderr.trim()}. Repair the repository before checking this revision.`,
        );
    const hashes = hashed.stdout.trim().split('\n');
    return new Set(present.filter((indexFile, index) => hashes[index] === indexFile.hash).map(({ path }) => path));
}

function listUntrackedInstalls(copyRoot: string, folders: string[]): string[] {
    return folders
        .map((folder) => posix.join(folder, NODE_MODULES))
        .filter((path) => lstatSync(join(copyRoot, path), { throwIfNoEntry: false }) === undefined);
}

async function selectRevisionDependencies(
    root: string,
    copyRoot: string,
    { indexFiles, paths }: { indexFiles: GitFile[]; paths: string[] | undefined },
    cancelSignal?: AbortSignal,
): Promise<RevisionDependencies> {
    const installed = openFiles(root);
    const dependencyFiles = indexFiles.filter((indexFile) => {
        const name = basename(indexFile.path);
        const lockfile = LOCKFILES.find((each) => each.file === name);
        return DEPENDENCY_FILES.has(name) || name === PACKAGE_SWIFT || (lockfile !== undefined && 'copied' in lockfile);
    });
    const projects = dependencyFiles.map(({ path }) => path).filter((path) => DEPENDENCY_FILES.has(basename(path)));
    const folders = listDependencyFolders(installed, projects);
    const environments = projects
        .filter(
            (path) =>
                basename(path) === PYPROJECT_TOML &&
                installed.findStats(posix.join(dirname(path), PYTHON_ENVIRONMENT_FOLDER)) !== undefined,
        )
        .map((path) => dirname(path));
    const unchangedPaths = await listUnchangedDependencies(
        root,
        installed,
        indexFiles.filter(
            (file) => dependencyFiles.includes(file) || DECLARATION_CONFIG_EXTENSIONS.has(extractExtension(file.path)),
        ),
        cancelSignal,
    );
    const declarations = await readDeclarationDependencies(root, { indexFiles, unchangedPaths, paths }, cancelSignal);
    const artifacts = await readIgnoredPaths(
        root,
        listPackageFiles(
            root,
            projects.filter((path) => basename(path) === PACKAGE_JSON),
        ),
        cancelSignal,
    );
    const tracked = new Set(indexFiles.map(({ path }) => path));
    const untrackedArtifacts = artifacts.filter((path) => !tracked.has(path));
    const copied = [...folders, ...declarations.copies, ...untrackedArtifacts];
    const hasDependencyDrift =
        declarations.mismatched ||
        (copied.length + environments.length > 0 && dependencyFiles.some(({ path }) => !unchangedPaths.has(path)));
    const note = hasDependencyDrift ? { dependencyNote: DEPENDENCY_REVISION_NOTE } : {};
    if (copied.length === 0) return { dependencies: [], ...note };
    const dependencies: string[] = [
        ...declarations.copies,
        ...untrackedArtifacts,
        ...listUntrackedInstalls(copyRoot, folders),
    ];
    return { dependencies, ...note };
}

async function initializeRevisionCopy(
    toplevel: string,
    copyRoot: string,
    source: Revision,
    cancelSignal: AbortSignal | undefined,
): Promise<void> {
    const [formatLine, gitStoreLine, shallowLine, head] = await Promise.all([
        readGitText(toplevel, GIT_HASH_FORMAT_ARGUMENTS, { cancelSignal }),
        readGitText(toplevel, [...GIT_PATH_ARGUMENTS, 'objects'], { cancelSignal }),
        readGitText(toplevel, [...GIT_PATH_ARGUMENTS, 'shallow'], { cancelSignal }),
        runGit(toplevel, GIT_VERIFY_HEAD_ARGUMENTS, { cancelSignal }),
    ]);
    await readGitText(copyRoot, [...GIT_INIT_ARGUMENTS, `--object-format=${formatLine.trim()}`, copyRoot], {
        cancelSignal,
    });
    writeFileSync(join(copyRoot, GIT_ALTERNATES_PATH), `${gitStoreLine.trim()}\n`);
    const shallow = shallowLine.trim();
    if (statSync(shallow, { throwIfNoEntry: false }) !== undefined)
        copyFileSync(shallow, join(copyRoot, GIT_SHALLOW_PATH));
    if (source.kind === 'index' && head.code === 0)
        await readGitText(copyRoot, [...GIT_SET_HEAD_ARGUMENTS, head.stdout.trim()], { cancelSignal });
    if (source.kind === 'commit')
        await readGitText(copyRoot, [...GIT_SET_HEAD_ARGUMENTS, source.hash], { cancelSignal });
}

// The attributes last only for this checkout, because checks of the copy read the ones that the revision sets.
async function checkOutRawFiles(copyRoot: string, cancelSignal: AbortSignal | undefined): Promise<void> {
    const attributes = join(copyRoot, GIT_RAW_ATTRIBUTES_PATH);
    mkdirSync(dirname(attributes), { recursive: true });
    writeFileSync(attributes, RAW_BLOB_ATTRIBUTES);
    await readGitText(copyRoot, GIT_CHECKOUT_ARGUMENTS, { cancelSignal });
    rmSync(attributes);
}

/**
Writes a Git revision into a private copy and leaves the authored files alone. The copy has its own Git directory, so
Git commands use the copied revision.

@param source the revision to copy. The paths that the run checks, when the source names them, limit the ignored
declaration files that the copy reads to the tsconfig files whose folder holds one of them.
@param cancelSignal stops the copy.
*/
export async function copyRevision(root: string, source: Revision, cancelSignal?: AbortSignal): Promise<RevisionCopy> {
    const toplevelLine = await readGitText(root, GIT_TOP_LEVEL_ARGUMENTS, { cancelSignal });
    const toplevel = toplevelLine.replace(TRAILING_NEWLINE, '');
    const folder = relative(realpathSync(toplevel), realpathSync(root));
    const unreadablePaths: string[] = [];
    const indexFiles = await listRevisionFiles(toplevel, source, cancelSignal, unreadablePaths);
    const index = indexFiles.map((indexFile) => `${indexFile.mode} ${indexFile.hash} 0\t${indexFile.path}\0`).join('');
    const copy = createCopyFolder(toplevel);
    try {
        await initializeRevisionCopy(toplevel, copy.path, source, cancelSignal);
        await readGitText(copy.path, GIT_EMPTY_INDEX_ARGUMENTS, { cancelSignal });
        await readGitText(copy.path, GIT_UPDATE_INDEX_ARGUMENTS, { cancelSignal, stdin: index });
        const treeLine = await readGitText(copy.path, GIT_WRITE_TREE_ARGUMENTS, { cancelSignal });
        const tree = treeLine.replace(TRAILING_NEWLINE, '');
        await checkOutRawFiles(copy.path, cancelSignal);
        copyValePackages(toplevel, copy.path);
        const selected = await selectRevisionDependencies(
            toplevel,
            copy.path,
            { indexFiles, paths: source.paths },
            cancelSignal,
        );
        await copyDependencies({
            root: toplevel,
            target: copy.path,
            dependencies: selected.dependencies,
            cancelSignal,
        });
        await setImmediate();
        cancelSignal?.throwIfAborted();
        return {
            ...copy,
            unreadablePaths,
            root: join(copy.path, folder),
            tree,
            ...(selected.dependencyNote !== undefined && { dependencyNote: selected.dependencyNote }),
        };
    } catch (error) {
        copy[Symbol.dispose]();
        throw error;
    }
}
