import { chmodSync, constants, copyFileSync, mkdirSync, statSync } from 'node:fs';
import { dirname, join, posix } from 'node:path';
import { setImmediate } from 'node:timers/promises';

import { COPY_ROOT_FILES, DEPENDENCY_FILES, FILES_BETWEEN_PAUSES } from '#cli/config/engine.ts';
import { GSPOT_FOLDER } from '#cli/config/parsers.ts';
import { NODE_MODULES, PERMISSION_BITS } from '#cli/config/system.ts';
import { copyDependencies } from '#cli/engine/copies/dependencies.ts';
import { createCopyFolder } from '#cli/engine/copies/folders.ts';
import { listUnreadFiles } from '#cli/engine/files.ts';
import { listWorkspaceSources } from '#cli/repository/javascript/workspaces.ts';
import { openFiles } from '#cli/system/files/open.ts';
import { splitSystemPath } from '#cli/system/files/reads.ts';
import { isInScope } from '#cli/system/paths.ts';
import type { PlannedCheck } from '#cli/types/engine/plan.ts';
import type { CopyPaths, CopyPlan } from '#cli/types/engine/tool-runs.ts';
import type { Files, TemporaryFolder } from '#cli/types/system.ts';
import type { Session } from '#cli/types/tools.ts';

function writeCopyFile(files: Files, copyRoot: string, file: string): void {
    const target = join(copyRoot, ...splitSystemPath(file));
    mkdirSync(dirname(target), { recursive: true });
    const source = files.readCanonicalPath(file);
    copyFileSync(source, target, constants.COPYFILE_FICLONE);
    chmodSync(target, statSync(source).mode & PERMISSION_BITS);
}

function selectCopyPaths(root: string, paths: string[], scopes: string[]): CopyPaths {
    const projects = paths.flatMap((path) =>
        DEPENDENCY_FILES.has(posix.basename(path)) && posix.basename(posix.dirname(path)) !== GSPOT_FOLDER
            ? [posix.dirname(path)]
            : [],
    );
    const dependencies = [
        ...new Set([GSPOT_FOLDER, ...scopes, ...projects].map((project) => posix.join(project, NODE_MODULES))),
    ].filter((path) => statSync(join(root, path), { throwIfNoEntry: false }) !== undefined);
    return {
        paths: [...new Set([...paths, ...COPY_ROOT_FILES])].filter(
            (path) => statSync(join(root, path), { throwIfNoEntry: false }) !== undefined,
        ),
        dependencies,
    };
}

async function writeCopyFiles(plan: CopyPlan): Promise<void> {
    const files = openFiles(plan.root);
    let written = 0;
    for (const file of plan.files) {
        if (written % FILES_BETWEEN_PAUSES === 0) await setImmediate();
        written += 1;
        plan.cancelSignal?.throwIfAborted();
        if (plan.dependencies.every((dependency) => !isInScope(file, dependency)))
            writeCopyFile(files, plan.target, file);
    }
}

/**
Copy the files of a planned check, with the tracked files of its folder that no tool reads, such as a large video that
a build imports.
*/
export async function createCheckCopy(
    session: Session,
    planned: PlannedCheck,
    includedPaths: string[] = [],
): Promise<TemporaryFolder> {
    const { paths, dependencies } = selectCopyPaths(
        session.root,
        [
            ...planned.files.map((file) => file.path),
            ...listUnreadFiles(session, planned).map((file) => file.path),
            ...listWorkspaceSources(session.cache, planned.scope.path, session.repository.files),
            ...includedPaths,
        ],
        session.repository.scopeFolders.map((scope) => scope.path),
    );
    return createCopy(session, paths, dependencies);
}

/**
Copies source files and dependency trees into a private folder inside the repository. Linked packages share the
repository root with the copy, so Astro resolves their paths outside the copied source tree.
*/
export async function createCopy(
    session: Pick<Session, 'root' | 'cancelSignal'>,
    paths: string[],
    dependencies: string[] = [],
): Promise<TemporaryFolder> {
    const folder = createCopyFolder(session.root);
    try {
        const plan = {
            root: session.root,
            target: folder.path,
            files: new Set(paths),
            dependencies,
            cancelSignal: session.cancelSignal,
        };
        await writeCopyFiles(plan);
        await copyDependencies(plan);
        return folder;
    } catch (error) {
        folder[Symbol.dispose]();
        throw error;
    }
}
