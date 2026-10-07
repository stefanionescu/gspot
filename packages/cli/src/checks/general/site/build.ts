import { statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { memo } from '#cli/platform/memo.ts';
import { toPosix } from '#cli/platform/paths.ts';
import { findingAt } from '#cli/checks/finding.ts';
import { GspotError } from '#cli/platform/errors.ts';
import { readSource } from '#cli/platform/source.ts';
import { contentDigest } from '#cli/platform/text.ts';
import { parseCommand } from '#cli/parsers/command.ts';
import type { Finding } from '#cli/types/parsers/output.ts';
import { copyIntoScratch } from '#cli/execution/copy/files.ts';
import { openRoot, walkRoot } from '#cli/platform/root/open.ts';
import type { EngineInput } from '#cli/types/execution/check.ts';
import { runEngineTool } from '#cli/execution/command/runner.ts';
import type { SiteBuild } from '#cli/types/checks/general/site.ts';
import { portableSegments, assertMutationTarget } from '#cli/platform/root/rules.ts';
import { OUTPUT_TAIL_LINES, SHOWN_DIFFERENCES } from '#cli/config/checks/general/site.ts';

const BUILD_MEMO = { create: () => new Map<string, Promise<SiteBuild>>() };

async function runBuild(input: EngineInput, scratch: string): Promise<SiteBuild> {
    const site = input.view.options('site');
    const outputPath = site['output'] as string;
    assertMutationTarget(outputPath);
    const cwd = join(scratch, input.scope);
    const command = site['build'] as string;
    const result = await runEngineTool(input, parseCommand(command), { cwd });
    const output = join(cwd, outputPath);
    using files = openRoot(scratch);
    const isBuilt: boolean =
        result.code === 0 && files.stat(toPosix(relative(scratch, output)))?.isDirectory() === true;
    const outputTail = [result.stderr, result.stdout]
        .join('\n')
        .trim()
        .split('\n')
        .slice(-OUTPUT_TAIL_LINES)
        .join(' | ');
    return { cwd, command, output, isBuilt, outputTail };
}

function outputDigests(folder: string): Map<string, string> {
    return new Map(filesUnder(folder).map((path) => [path, contentDigest(readSource(folder, path))]));
}

/**
 * Every file under a folder, relative to it, sorted.
 * @param folder the folder.
 * @returns the relative paths.
 */
export function filesUnder(folder: string): string[] {
    if (statSync(folder, { throwIfNoEntry: false }) === undefined) return [];
    using files = openRoot(folder, 'native');
    const found: string[] = [];
    walkRoot(files, '', (path) => {
        const entry = statSync(files.realPath(path));
        if (entry.isFile()) found.push(path);
        return entry.isDirectory();
    });
    return found.toSorted((left, right) => left.localeCompare(right));
}

/**
 * Locate a built file in the original repository. Keep its project scope and output folder.
 * @param input the scope owning the build.
 * @param build the build's isolated project folder.
 * @param absolute the built file's absolute path.
 * @returns a confined repository-relative path.
 */
export function repositoryPath(
    input: Pick<EngineInput, 'scope'>,
    build: Pick<SiteBuild, 'cwd'>,
    absolute: string,
): string {
    const path = toPosix(relative(build.cwd, absolute));
    portableSegments(path);
    return input.scope === '' ? path : `${input.scope}/${path}`;
}

/**
 * The build of the scope, run the first time a check asks and shared after that.
 * @param input the engine input.
 * @returns the build.
 */
export function cachedBuild(input: EngineInput): Promise<SiteBuild> {
    const key = input.scopeRoot;
    const scopeBuilds = memo(input.reads, BUILD_MEMO);
    const held = scopeBuilds.get(key);
    if (held !== undefined) return held;
    const running = (async () => {
        const resources = input.resources;
        if (resources === undefined)
            throw new Error('The site/build check needs temporary directories that are disposed after the run.');
        resources.defer(() => scopeBuilds.delete(key));
        const folder = await copyIntoScratch(
            input.root,
            input.files.map((file) => file.path),
            input.scopeEntries.map((scope) => scope.path),
        );
        return runBuild(input, resources.use(folder).path);
    })();
    scopeBuilds.set(key, running);
    return running;
}

/**
 * Requires built output before a dependent check reads it.
 * @param input the engine input.
 * @returns the successful build, or a skipped-check error.
 */
export async function requireBuild(input: EngineInput): Promise<SiteBuild> {
    const build = await cachedBuild(input);
    if (!build.isBuilt) throw new GspotError('skip', 'The site did not build.');
    return build;
}

/**
 * One finding when the build command fails or writes no output folder.
 * @param input the engine input.
 * @returns the findings.
 */
export async function siteBuild(input: EngineInput): Promise<Finding[]> {
    const build = await cachedBuild(input);
    if (build.isBuilt) return [];
    return [
        findingAt(
            input,
            { file: '', line: 1 },
            'build',
            `${build.command} did not build the site: ${build.outputTail}`,
        ),
    ];
}

/**
 * Builds a second time and compares the two outputs file by file.
 * @param input the engine input.
 * @returns one finding for each file that differs, appears, or disappears.
 */
export async function buildReproducible(input: EngineInput): Promise<Finding[]> {
    const first = await requireBuild(input);
    const before = outputDigests(first.output);
    using folder = await copyIntoScratch(
        input.root,
        input.files.map((file) => file.path),
        input.scopeEntries.map((scope) => scope.path),
    );
    const second = await runBuild(input, folder.path);
    if (!second.isBuilt) throw new Error(`The second site build failed: ${second.command}: ${second.outputTail}`);
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
