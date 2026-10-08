import { join, relative } from 'node:path';
import { memo } from '#cli/platform/memo.ts';
import { findingAt } from '#cli/checks/finding.ts';
import { GspotError } from '#cli/platform/errors.ts';
import { contentDigest } from '#cli/platform/text.ts';
import { scratchEntries } from '#cli/platform/scratch.ts';
import { toPosix, isInside } from '#cli/platform/paths.ts';
import type { Finding } from '#cli/types/parsers/output.ts';
import { copyIntoScratch } from '#cli/execution/copy/files.ts';
import { runCheckTool } from '#cli/execution/command/check.ts';
import type { CheckInput } from '#cli/types/execution/check.ts';
import type { SiteBuild } from '#cli/types/checks/general/site.ts';
import { statSync, lstatSync, readFileSync, realpathSync } from 'node:fs';
import { portableSegments, assertMutationTarget } from '#cli/platform/root/rules.ts';
import { OUTPUT_TAIL_LINES, SHOWN_DIFFERENCES } from '#cli/config/checks/general/site.ts';

const BUILD_MEMO = { create: () => new Map<string, Promise<SiteBuild>>() };

async function runBuild(input: CheckInput, scratch: string): Promise<SiteBuild> {
    const site = input.view.options('site');
    const outputPath = site['build_folder'];
    assertMutationTarget(outputPath);
    const cwd = join(scratch, input.scope);
    const command = site['build_command'];
    const result = await runCheckTool(input, command, { cwd });
    const output = join(scratch, outputPath);
    const built = result.code === 0 ? lstatSync(output, { throwIfNoEntry: false }) : undefined;
    if (built?.isSymbolicLink() === true)
        throw new Error(`Unsafe lifecycle destination: ${toPosix(relative(scratch, output))}`);
    const isBuilt = built?.isDirectory() === true;
    const outputTail = [result.stderr, result.stdout]
        .join('\n')
        .trim()
        .split('\n')
        .slice(-OUTPUT_TAIL_LINES)
        .join(' | ');
    return { cwd, command, output, isBuilt, outputTail };
}

function outputDigests(folder: string): Map<string, string> {
    return new Map(filesUnder(folder).map((path) => [path, contentDigest(readFileSync(join(folder, path)))]));
}

/**
 * Every file under a folder, relative to it, sorted.
 * @param folder the folder.
 * @returns the relative paths.
 */
export function filesUnder(folder: string): string[] {
    if (statSync(folder, { throwIfNoEntry: false }) === undefined) return [];
    const root = realpathSync.native(folder);
    return [...scratchEntries(root)]
        .flatMap((entry) => {
            const absolute = join(entry.parentPath, entry.name);
            const path = toPosix(relative(root, absolute));
            if (!isInside(relative(root, realpathSync.native(absolute))))
                throw new Error(`Source link leaves the repository: ${path}`);
            const stat = statSync(absolute);
            if (stat.isDirectory()) throw new Error(`Unsafe lifecycle directory: ${path}`);
            return stat.isFile() ? [path] : [];
        })
        .toSorted((left, right) => left.localeCompare(right));
}

/**
 * Locate a built file in the original repository's normalized output folder.
 * @param input the policy view owning the build.
 * @param build the build's isolated project folder.
 * @param absolute the built file's absolute path.
 * @returns a confined repository-relative path.
 */
export function repositoryPath(
    input: Pick<CheckInput, 'view'>,
    build: Pick<SiteBuild, 'output'>,
    absolute: string,
): string {
    const path = toPosix(relative(build.output, absolute));
    portableSegments(path);
    return `${input.view.options('site')['build_folder']}/${path}`;
}

/**
 * The build of the scope, run the first time a check asks and shared after that.
 * @param input the check input.
 * @returns the build.
 */
export function cachedBuild(input: CheckInput): Promise<SiteBuild> {
    const key = input.scopeRoot;
    const scopeBuilds = memo(input.reads, BUILD_MEMO);
    const held = scopeBuilds.get(key);
    if (held !== undefined) return held;
    const running = (async () => {
        const resources = input.resources;
        if (resources === undefined)
            throw new Error('The site/build check needs temporary directories that are disposed after the run.');
        resources.defer(() => scopeBuilds.delete(key));
        const folder = await copyIntoScratch(input);
        return runBuild(input, resources.use(folder).path);
    })();
    scopeBuilds.set(key, running);
    return running;
}

/**
 * Requires built output before a dependent check reads it.
 * @param input the check input.
 * @returns the successful build, or a skipped-check error.
 */
export async function requireBuild(input: CheckInput): Promise<SiteBuild> {
    const build = await cachedBuild(input);
    if (!build.isBuilt) throw new GspotError('skip', 'The site did not build.');
    return build;
}

/**
 * One finding when the build command fails or writes no output folder.
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
 * Builds a second time and compares the two outputs file by file.
 * @param input the check input.
 * @returns one finding for each file that differs, appears, or disappears.
 */
export async function buildReproducible(input: CheckInput): Promise<Finding[]> {
    const first = await requireBuild(input);
    const before = outputDigests(first.output);
    using folder = await copyIntoScratch(input);
    const second = await runBuild(input, folder.path);
    if (!second.isBuilt)
        throw new Error(`The second site build failed: ${JSON.stringify(second.command)}: ${second.outputTail}`);
    const after = outputDigests(second.output);
    const differences = [...new Set([...before.keys(), ...after.keys()])].filter(
        (path) => before.get(path) !== after.get(path),
    );
    return differences
        .slice(0, SHOWN_DIFFERENCES)
        .map((path) =>
            findingAt(
                input,
                { file: repositoryPath(input, first, join(first.output, path)), line: 1 },
                'not-reproducible',
                'Two builds of the same tree wrote this file differently. Look for a timestamp, a random value, or an unordered list.',
            ),
        );
}
