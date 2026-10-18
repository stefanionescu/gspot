import { GspotError } from '#cli/system/errors.ts';
import { buildFinding } from '#cli/checks/finding.ts';
import { join, relative, normalize } from 'node:path';
import { getCachedValue } from '#cli/system/files/cache.ts';
import { statSync, lstatSync, realpathSync } from 'node:fs';
import { runCheckTool } from '#cli/checks/run/command/tool.ts';
import { type SiteBuild } from '#cli/types/checks/framework.ts';
import { openFiles, walkFiles } from '#cli/system/files/open.ts';
import { isInside, convertToPosixPath } from '#cli/system/paths.ts';
import { formatOutputTail } from '#cli/checks/run/command/output.ts';
import { type Finding, type CheckInput } from '#cli/types/checks/run/check.ts';
import { checkCopyInputs, copyIntoScratch } from '#cli/checks/run/copy/scratch.ts';

const SITE_BUILD_MEMO = { create: () => new Map<string, Promise<SiteBuild>>() };

async function runSiteBuild(input: CheckInput, scratch: string): Promise<SiteBuild> {
    const site = input.selection.view.options('site');
    const folderPath = site['build_folder'];
    const cwd = join(scratch, input.selection.scope.path);
    const command = site['build_command'];
    const result = await runCheckTool(input, command, { cwd });
    const folder = join(scratch, folderPath);
    const built = result.code === 0 ? lstatSync(folder, { throwIfNoEntry: false }) : undefined;
    if (built?.isSymbolicLink() === true)
        throw new Error(`The build output folder is a link: ${convertToPosixPath(relative(scratch, folder))}`);
    const isBuilt = built?.isDirectory() === true;
    const outputTail = formatOutputTail(result).replaceAll('\n', ' | ');
    return { cwd, command, folder, isBuilt, outputTail };
}

/**
 * Builds the site once per scope and shares the build with later checks.
 * @param input the scope to build.
 * @returns the build, shared by every caller.
 */
function getSiteBuild(input: CheckInput): Promise<SiteBuild> {
    const key = join(input.root, input.selection.scope.path);
    const scopeBuilds = getCachedValue(input.reads, SITE_BUILD_MEMO);
    const held = scopeBuilds.get(key);
    if (held !== undefined) return held;
    const running = (async () => {
        const resources = input.resources;
        resources.defer(() => scopeBuilds.delete(key));
        const folder = await copyIntoScratch(checkCopyInputs(input));
        return runSiteBuild(input, resources.use(folder).path);
    })();
    scopeBuilds.set(key, running);
    return running;
}

/**
 * List every file under a folder as sorted relative paths.
 * @param folder the build output to walk.
 * @returns the relative paths.
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
    return found.toSorted((left, right) => left.localeCompare(right));
}

/**
 * Maps a built file to its repository path.
 * @param input the scope with the build folder setting.
 * @param path the file path inside the build folder.
 * @returns the repository-relative path.
 */
export function deriveBuiltFilePath(input: Pick<CheckInput, 'selection'>, path: string): string {
    return `${input.selection.view.options('site')['build_folder']}/${convertToPosixPath(normalize(path))}`;
}

/**
 * Returns the site build, or skips the check when the build failed.
 * @param input the scope to build.
 * @returns the built site, when the build succeeded.
 */
export async function getSuccessfulBuild(input: CheckInput): Promise<SiteBuild> {
    const build = await getSiteBuild(input);
    if (!build.isBuilt) throw new GspotError('skip', 'The site did not build.');
    return build;
}

/**
 * Reports a build command that fails or writes no build folder.
 * @param input the scope to build.
 * @returns the findings.
 */
export async function checkSiteBuild(input: CheckInput): Promise<Finding[]> {
    const build = await getSiteBuild(input);
    if (build.isBuilt) return [];
    return [
        buildFinding(
            input,
            { file: '', line: 1 },
            'build',
            `${JSON.stringify(build.command)} did not build the site: ${build.outputTail}`,
        ),
    ];
}
