import { join, relative } from 'node:path';
import { GspotError } from '#cli/errors.ts';
import { contentDigest } from '#cli/text.ts';
import { memo } from '#cli/system/file-reads.ts';
import { findingAt } from '#cli/checks/finding.ts';
import { listFolderFiles } from '#cli/system/files.ts';
import { toPosix, isInside } from '#cli/system/paths.ts';
import { runCheckTool } from '#cli/execution/command/tool.ts';
import { type SiteBuild } from '#cli/types/checks/framework.ts';
import { openSafeFolder } from '#cli/system/safe-folder/open.ts';
import { portableSegments } from '#cli/system/safe-folder/names.ts';
import { statSync, lstatSync, readFileSync, realpathSync } from 'node:fs';
import { type Finding, type CheckInput } from '#cli/types/execution/check.ts';
import { checkCopyInputs, copyIntoScratch } from '#cli/execution/copy/scratch.ts';
import { OUTPUT_TAIL_LINES, SHOWN_DIFFERENCES } from '#cli/config/checks/framework/site.ts';

const BUILD_MEMO = { create: () => new Map<string, Promise<SiteBuild>>() };

async function runBuild(input: CheckInput, scratch: string): Promise<SiteBuild> {
    const site = input.selection.view.options('site');
    const folderPath = site['build_folder'];
    const cwd = join(scratch, input.selection.scope.path);
    const command = site['build_command'];
    const result = await runCheckTool(input, command, { cwd });
    const folder = join(scratch, folderPath);
    const built = result.code === 0 ? lstatSync(folder, { throwIfNoEntry: false }) : undefined;
    if (built?.isSymbolicLink() === true)
        throw new Error(`The build output folder is a link: ${toPosix(relative(scratch, folder))}`);
    const isBuilt = built?.isDirectory() === true;
    const outputTail = [result.stderr, result.stdout]
        .join('\n')
        .trim()
        .split('\n')
        .slice(-OUTPUT_TAIL_LINES)
        .join(' | ');
    return { cwd, command, folder, isBuilt, outputTail };
}

function buildDigests(folder: string): Map<string, string> {
    return new Map(filesUnder(folder).map((path) => [path, contentDigest(readFileSync(join(folder, path)))]));
}

/**
 * The build of the scope, run the first time a check asks and shared after that.
 * @param input the check input.
 * @returns the build.
 */
function cachedBuild(input: CheckInput): Promise<SiteBuild> {
    const key = join(input.root, input.selection.scope.path);
    const scopeBuilds = memo(input.reads, BUILD_MEMO);
    const held = scopeBuilds.get(key);
    if (held !== undefined) return held;
    const running = (async () => {
        const resources = input.resources;
        resources.defer(() => scopeBuilds.delete(key));
        const folder = await copyIntoScratch(checkCopyInputs(input));
        return runBuild(input, resources.use(folder).path);
    })();
    scopeBuilds.set(key, running);
    return running;
}

/**
 * Every file under a folder, relative to it, sorted.
 * @param folder the folder.
 * @returns the relative paths.
 */
export function filesUnder(folder: string): string[] {
    if (statSync(folder, { throwIfNoEntry: false }) === undefined) return [];
    const root = realpathSync.native(folder);
    return [...listFolderFiles(root)]
        .flatMap((entry) => {
            const absolute = join(entry.parentPath, entry.name);
            const path = toPosix(relative(root, absolute));
            if (!isInside(relative(root, realpathSync.native(absolute))))
                throw new Error(`The build output links outside the build folder: ${path}`);
            const stat = statSync(absolute);
            if (stat.isDirectory()) throw new Error(`The build output entry is a directory link: ${path}`);
            return stat.isFile() ? [path] : [];
        })
        .toSorted((left, right) => left.localeCompare(right));
}

/**
 * Locate a built file in the original repository's normalized build folder.
 * @param input the settings view owning the build.
 * @param build the build's scratch copy.
 * @param absolute the built file's absolute path.
 * @returns a confined repository-relative path.
 */
export function repositoryPath(
    input: Pick<CheckInput, 'selection'>,
    build: Pick<SiteBuild, 'folder'>,
    absolute: string,
): string {
    const path = toPosix(relative(build.folder, absolute));
    portableSegments(path);
    return `${input.selection.view.options('site')['build_folder']}/${path}`;
}

/**
 * Requires built files before a dependent check reads it.
 * @param input the check input.
 * @returns the successful build, or a skipped-check error.
 */
export async function requireBuild(input: CheckInput): Promise<SiteBuild> {
    const build = await cachedBuild(input);
    if (!build.isBuilt) throw new GspotError('skip', 'The site did not build.');
    return build;
}

/**
 * One finding when the build command fails or writes no build folder.
 * @param input the check input.
 * @returns the findings.
 */
export async function siteBuild(input: CheckInput): Promise<Finding[]> {
    const build = await cachedBuild(input);
    if (build.isBuilt) return [];
    return [
        findingAt(
            input,
            { file: '', line: 1 },
            'build',
            `${JSON.stringify(build.command)} did not build the site: ${build.outputTail}`,
        ),
    ];
}

/**
 * Build one scratch copy twice at the same path, with clean build folders, and compare the files.
 * @param input the check input.
 * @returns one finding for each file that differs, appears, or disappears.
 */
export async function buildReproducible(input: CheckInput): Promise<Finding[]> {
    using scratch = await copyIntoScratch(checkCopyInputs(input));
    using files = openSafeFolder(scratch.path, 'system');
    const target = input.selection.view.options('site').build_folder;
    files.removeTree(target);
    const first = await runBuild(input, scratch.path);
    if (!first.isBuilt) throw new GspotError('skip', 'The site did not build.');
    const before = buildDigests(first.folder);
    files.removeTree(target);
    const second = await runBuild(input, scratch.path);
    if (!second.isBuilt)
        throw new Error(`The second site build failed: ${JSON.stringify(second.command)}: ${second.outputTail}`);
    const after = buildDigests(second.folder);
    const differences = [...new Set([...before.keys(), ...after.keys()])].filter(
        (path) => before.get(path) !== after.get(path),
    );
    return differences
        .slice(0, SHOWN_DIFFERENCES)
        .map((path) =>
            findingAt(
                input,
                { file: repositoryPath(input, first, join(first.folder, path)), line: 1 },
                'not-reproducible',
                'Two builds of the same tree wrote this file differently. Look for a timestamp, a random value, or an unordered list.',
            ),
        );
}
