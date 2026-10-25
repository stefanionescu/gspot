import { join, relative } from 'node:path';
import { getTable } from '#cli/settings/scopes.ts';
import { GspotError } from '#cli/system/errors.ts';
import type { Session } from '#cli/types/session.ts';
import { buildFinding } from '#cli/checks/finding.ts';
import { type Finding } from '#cli/types/runs/check.ts';
import { runCheckTool } from '#cli/runs/command/tool.ts';
import { createCheckCopy } from '#cli/runs/copy/files.ts';
import type { PlannedCheck } from '#cli/types/planning.ts';
import { getCachedValue } from '#cli/system/files/cache.ts';
import { statSync, lstatSync, realpathSync } from 'node:fs';
import { formatOutputTail } from '#cli/runs/command/output.ts';
import { openFiles, walkFiles } from '#cli/system/files/open.ts';
import { compareText, quoteArgument } from '#cli/system/text.ts';
import { isInside, convertToPosixPath } from '#cli/system/paths.ts';
import { type SiteBuild } from '#cli/types/checks/framework/site.ts';

const SITE_BUILDS = { create: () => new Map<string, Promise<SiteBuild>>() };

async function runSiteBuild(session: Session, planned: PlannedCheck, copyRoot: string): Promise<SiteBuild> {
    const site = getTable(planned.scope.settings, 'site');
    const folderPath = site['build_folder'];
    const cwd = join(copyRoot, planned.scope.folder.path);
    const command = site['build_command'];
    const result = await runCheckTool(session, planned, command, { cwd });
    const folder = join(copyRoot, folderPath);
    const built = result.code === 0 ? lstatSync(folder, { throwIfNoEntry: false }) : undefined;
    if (built?.isSymbolicLink() === true)
        throw new Error(`The build output folder is a link: ${convertToPosixPath(relative(copyRoot, folder))}`);
    const isBuilt = built?.isDirectory() === true;
    const failure = result.code === 0 ? `It wrote no ${folderPath} folder.` : formatOutputTail(result);
    return { cwd, command, folder, isBuilt, failure };
}

function getSiteBuild(session: Session, planned: PlannedCheck): Promise<SiteBuild> {
    const key = join(session.root, planned.scope.folder.path);
    const scopeBuilds = getCachedValue(session.reads, SITE_BUILDS);
    const held = scopeBuilds.get(key);
    if (held !== undefined) return held;
    const running = (async () => {
        session.resources.defer(() => scopeBuilds.delete(key));
        const folder = await createCheckCopy(session, planned);
        return runSiteBuild(session, planned, session.resources.use(folder).path);
    })();
    scopeBuilds.set(key, running);
    return running;
}

/**
List every file under a folder as sorted relative paths.

@param folder the build output to walk.
@returns the relative paths.
*/
export function listBuiltFiles(folder: string): string[] {
    const root = realpathSync.native(folder);
    using files = openFiles(root);
    const found: string[] = [];
    walkFiles(files, '', (path) => {
        const absolute = join(root, path);
        if (lstatSync(absolute).isDirectory()) return true;
        if (!isInside(relative(root, realpathSync.native(absolute))))
            throw new Error(`The build output links outside the build folder: ${path}`);
        const stat = statSync(absolute);
        if (stat.isDirectory()) throw new Error(`The build output entry is a directory link: ${path}`);
        if (stat.isFile()) found.push(path);
        return false;
    });
    return found.toSorted((left, right) => compareText(left, right));
}

/**
Returns the site build, or skips the check when the build failed.

@param session the repository and its tools.
@param planned the scope to build.
@returns the built site, when the build succeeded.
*/
export async function getSuccessfulBuild(session: Session, planned: PlannedCheck): Promise<SiteBuild> {
    const build = await getSiteBuild(session, planned);
    if (!build.isBuilt) throw new GspotError('skip', 'The site did not build.');
    return build;
}

/**
Reports a build command that fails or writes no build folder.

@param session the repository and its tools.
@param planned the scope to build.
@returns the findings.
*/
export async function checkSiteBuild(session: Session, planned: PlannedCheck): Promise<Finding[]> {
    const build = await getSiteBuild(session, planned);
    if (build.isBuilt) return [];
    return [
        buildFinding(
            planned,
            { file: '', line: 1 },
            'build',
            `${build.command.map((argument) => quoteArgument(argument)).join(' ')} did not build the site.\n${build.failure}`,
        ),
    ];
}
