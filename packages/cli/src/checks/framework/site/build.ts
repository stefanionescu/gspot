import { join, relative } from 'node:path';
import { GspotError } from '#cli/system/errors.ts';
import { buildFinding } from '#cli/checks/finding.ts';
import { getCachedValue } from '#cli/system/files/cache.ts';
import { statSync, lstatSync, realpathSync } from 'node:fs';
import { runCheckTool } from '#cli/checks/run/command/tool.ts';
import { type SiteBuild } from '#cli/types/checks/framework.ts';
import { openFiles, walkFiles } from '#cli/system/files/open.ts';
import { isInside, convertToPosixPath } from '#cli/system/paths.ts';
import { OUTPUT_TAIL_LINES } from '#cli/config/checks/framework/site.ts';
import { type Finding, type CheckInput } from '#cli/types/checks/run/check.ts';
import { checkCopyInputs, copyIntoScratch } from '#cli/checks/run/copy/scratch.ts';

const SITE_BUILD_MEMO = { create: () => new Map<string, Promise<SiteBuild>>() };

async function runSiteBuild(input: CheckInput, scratch: string): Promise<SiteBuild> {
    const site = input.scope.view.options('site');
    const folderPath = site['build_folder'];
    const cwd = join(scratch, input.scope.scope.path);
    const command = site['build_command'];
    const result = await runCheckTool(input, command, { cwd });
    const folder = join(scratch, folderPath);
    const built = result.code === 0 ? lstatSync(folder, { throwIfNoEntry: false }) : undefined;
    if (built?.isSymbolicLink() === true)
        throw new Error(`The build output folder is a link: ${convertToPosixPath(relative(scratch, folder))}`);
    const isBuilt = built?.isDirectory() === true;
    const outputTail = [result.stderr, result.stdout]
        .join('\n')
        .trim()
        .split('\n')
        .slice(-OUTPUT_TAIL_LINES)
        .join(' | ');
    return { cwd, command, folder, isBuilt, outputTail };
}

/**
 * The build of the scope, run the first time a check asks and shared after that.
 * @param input the check input.
 * @returns the shared pending or completed site build for this scope.
 */
function getSiteBuild(input: CheckInput): Promise<SiteBuild> {
    const key = join(input.root, input.scope.scope.path);
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
 * Every file under a folder, relative to it, sorted.
 * @param folder the output directory to enumerate without following directory links.
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
 * Locate a built file in the original repository's normalized build folder.
 * @param input the settings view owning the build.
 * @param build the build's scratch copy.
 * @param absolute the file location within the build's scratch copy.
 * @returns a confined repository-relative path.
 */
export function deriveBuiltFilePath(
    input: Pick<CheckInput, 'scope'>,
    build: Pick<SiteBuild, 'folder'>,
    absolute: string,
): string {
    const path = convertToPosixPath(relative(build.folder, absolute));

    return `${input.scope.view.options('site')['build_folder']}/${path}`;
}

/**
 * Requires built files before a dependent check reads it.
 * @param input the check input.
 * @returns the successful build, or a skipped-check error.
 */
export async function getSuccessfulBuild(input: CheckInput): Promise<SiteBuild> {
    const build = await getSiteBuild(input);
    if (!build.isBuilt) throw new GspotError('skip', 'The site did not build.');
    return build;
}

/**
 * One finding when the build command fails or writes no build folder.
 * @param input the site scope, build command, and output-folder settings.
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
