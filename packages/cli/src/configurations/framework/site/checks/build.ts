import { remember } from '#cli/system/cache.ts';
import { CheckStop } from '#cli/system/errors.ts';
import { getTable } from '#cli/settings/scopes.ts';
import { join, relative, normalize } from 'node:path';
import { statSync, lstatSync, realpathSync } from 'node:fs';
import { runCheckTool } from '#cli/engine/tool-runs/tool.ts';
import type { CheckSession } from '#cli/types/engine/run.ts';
import { createCheckCopy } from '#cli/engine/copies/files.ts';
import type { PlannedCheck } from '#cli/types/engine/plan.ts';
import { compareText, quoteCommand } from '#cli/system/text.ts';
import { openFiles, walkFiles } from '#cli/system/files/open.ts';
import { formatOutputTail } from '#cli/engine/tool-runs/output.ts';
import type { CheckFinding } from '#cli/types/engine/tool-runs.ts';
import { isInside, convertToPosixPath } from '#cli/system/paths.ts';
import type { SiteBuild } from '#cli/types/configurations/language.ts';
import { BUILD_RULE, UNBUILT_SITE_NOTE } from '#cli/config/configurations/framework.ts';

const SITE_BUILDS = Symbol('site builds');

async function runSiteBuild(session: CheckSession, planned: PlannedCheck, copyRoot: string): Promise<SiteBuild> {
    const site = getTable(planned.scope.settings, 'site');
    const folderPath = site['build_folder'];
    const cwd = join(copyRoot, planned.scope.path);
    const command = site['build_command'];
    const result = await runCheckTool(session, planned, command, { cwd });
    const folder = join(copyRoot, folderPath);
    const built = result.code === 0 ? lstatSync(folder, { throwIfNoEntry: false }) : undefined;
    if (built?.isSymbolicLink() === true)
        throw new CheckStop(
            'error',
            `The build output folder is a link: ${convertToPosixPath(relative(copyRoot, folder))}`,
        );
    const isBuilt = built?.isDirectory() === true;
    const failure = result.code === 0 ? `It wrote no ${folderPath} folder.` : formatOutputTail(result);
    return { cwd, command, folder, built: isBuilt, failure };
}

function readSiteBuild(session: CheckSession, planned: PlannedCheck): Promise<SiteBuild> {
    return remember(session.cache, SITE_BUILDS, join(session.root, planned.scope.path), async () => {
        // A build can read tracked files at the repository root, such as the README, from outside its scope.
        const rootFiles = session.repository.index
            .map((indexFile) => indexFile.path)
            .filter((path) => !path.includes('/'));
        const folder = await createCheckCopy(session, planned, rootFiles);
        session.resources.push(folder);
        return runSiteBuild(session, planned, folder.path);
    });
}

/**
Build the repository path of a file in the build output.

@param planned the scope of the site.
@param file the path relative to the build folder.
*/
// eslint-disable-next-line gspot/no-trivial-functions -- reason: Every site check reports its build files through this path.
export function toBuildPath(planned: PlannedCheck, file: string): string {
    return `${getTable(planned.scope.settings, 'site').build_folder}/${convertToPosixPath(normalize(file))}`;
}

/**
List every file under a folder as sorted relative paths.

@param folder the build output to walk.
*/
export function listBuiltFiles(folder: string): string[] {
    const root = realpathSync.native(folder);
    const files = openFiles(root);
    const found: string[] = [];
    walkFiles(files, '', (path) => {
        const absolute = join(root, path);
        if (lstatSync(absolute).isDirectory()) return true;
        if (!isInside(relative(root, realpathSync.native(absolute))))
            throw new CheckStop('error', `The build output links outside the build folder: ${path}`);
        const stat = statSync(absolute);
        if (stat.isDirectory()) throw new CheckStop('error', `The build output entry is a directory link: ${path}`);
        if (stat.isFile()) found.push(path);
        return false;
    });
    return found.toSorted((left, right) => compareText(left, right));
}

/**
Read the site build of this run, which the first caller runs, and skip the check when the build failed.

@param session the repository and its tools.
@param planned the scope to build.
*/
export async function readSuccessfulBuild(session: CheckSession, planned: PlannedCheck): Promise<SiteBuild> {
    const build = await readSiteBuild(session, planned);
    if (!build.built) throw new CheckStop('skipped', UNBUILT_SITE_NOTE);
    return build;
}

/**
Reports a build command that fails or writes no build folder.

@param session the repository and its tools.
@param planned the scope to build.
*/
export async function checkSiteBuild(session: CheckSession, planned: PlannedCheck): Promise<CheckFinding[]> {
    const build = await readSiteBuild(session, planned);
    if (build.built) return [];
    return [
        {
            file: '',
            line: 1,
            rule: BUILD_RULE,
            message: `${quoteCommand(build.command)} did not build the site.\n${build.failure}`,
        },
    ];
}
