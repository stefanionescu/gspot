import { remember } from '#cli/system/cache.ts';
import { CheckStop } from '#cli/system/errors.ts';
import { getTable } from '#cli/settings/tables.ts';
import { join, relative, normalize } from 'node:path';
import { compareText } from '#cli/system/text/order.ts';
import { convertToPosixPath } from '#cli/system/paths.ts';
import { quoteCommand } from '#cli/system/text/quoting.ts';
import { statSync, lstatSync, realpathSync } from 'node:fs';
import { createCheckCopy } from '#cli/engine/copies/files.ts';
import type { PlannedCheck } from '#cli/types/engine/plan.ts';
import { findContainedPath } from '#cli/system/files/reads.ts';
import { runCheckTool } from '#cli/engine/run/tool-runs/tool.ts';
import { openFiles, walkFiles } from '#cli/system/files/open.ts';
import type { SiteBuild } from '#cli/types/configurations/framework.ts';
import { formatOutputTail } from '#cli/engine/run/tool-runs/failures.ts';
import { detectPackageManager } from '#cli/repository/projects/package-manager.ts';
import type { CheckCode, CheckFinding, CheckSession } from '#cli/types/engine/run.ts';
import { BUILD_RULE, BUILD_SCRIPT, UNBUILT_SITE_NOTE } from '#cli/config/configurations/site.ts';

const SITE_BUILDS = Symbol('site builds');

const BUILT_FILES = Symbol('built files');

// The build script runs with the package manager of the repository when the settings name no command.
function detectBuildCommand(repository: CheckSession['repository']): string[] {
    const sources = repository.files.filter((file) => file.kind === 'source').map((file) => file.path);
    return [detectPackageManager(repository.root, sources).name, ...BUILD_SCRIPT];
}

async function runSiteBuild(session: CheckSession, planned: PlannedCheck, copyRoot: string): Promise<SiteBuild> {
    const site = getTable(planned.scope.settings, 'site');
    const folderPath = site.build_folder;
    const cwd = join(copyRoot, planned.scope.path);
    const command = site.build_command ?? detectBuildCommand(session.repository);
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
    return { root: copyRoot, cwd, command, folder, built: isBuilt, failure };
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

async function checkSiteBuild(session: CheckSession, planned: PlannedCheck): Promise<CheckFinding[]> {
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

export function convertToBuildPath(planned: PlannedCheck, file: string): string {
    return `${getTable(planned.scope.settings, 'site').build_folder}/${convertToPosixPath(normalize(file))}`;
}

export function listBuiltFiles(folder: string): string[] {
    const root = realpathSync.native(folder);
    const files = openFiles(root);
    const found: string[] = [];
    walkFiles(files, '', (path) => {
        const absolute = join(root, path);
        if (lstatSync(absolute).isDirectory()) return true;
        if (findContainedPath(root, path) === undefined)
            throw new CheckStop('error', `The build output links outside the build folder: ${path}`);
        const stat = statSync(absolute);
        if (stat.isDirectory()) throw new CheckStop('error', `The build output entry is a directory link: ${path}`);
        if (stat.isFile()) found.push(path);
        return false;
    });
    return found.toSorted((left, right) => compareText(left, right));
}

/**
Read the site build of this run, which the first caller runs, with the files it wrote, and skip the check when the
build failed.
*/
export async function readSuccessfulBuild(
    session: CheckSession,
    planned: PlannedCheck,
): Promise<SiteBuild & { files: string[] }> {
    const build = await readSiteBuild(session, planned);
    if (!build.built) throw new CheckStop('skipped', UNBUILT_SITE_NOTE);
    const files = remember(session.cache, BUILT_FILES, build.folder, () => listBuiltFiles(build.folder));
    return { ...build, files };
}

export const SITE_BUILD_CHECKS: Readonly<Record<string, CheckCode>> = {
    'site/build': { check: checkSiteBuild },
};
