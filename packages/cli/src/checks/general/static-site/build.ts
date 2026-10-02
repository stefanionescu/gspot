import { statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { toPosix } from '#cli/platform/paths.ts';
import { GspotError } from '#cli/platform/errors.ts';
import { contentDigest } from '#cli/platform/text.ts';
import { findingAt } from '#cli/execution/finding.ts';
import { readSource } from '#cli/repository/sources.ts';
import { commandArguments } from '#cli/platform/quoting.ts';
import { mutationTarget } from '#cli/platform/safe-paths.ts';
import { scratchCopy } from '#cli/execution/tool/workspace.ts';
import { runCheckCommand } from '#cli/execution/tool/runner.ts';
import { openRoot, walkRoot } from '#cli/platform/filesystem.ts';
import type { SiteBuild } from '#cli/types/checks/general/static-site.ts';
import type { Finding, EngineInput } from '#cli/types/execution/execution.ts';
import { DEFAULT_BUILD, SHOWN_DIFFERENCES, DEFAULT_BUILD_OUTPUT } from '#cli/config/checks/general/static-site.ts';

const builds = new WeakMap<object, Map<string, Promise<SiteBuild>>>();

async function built(input: EngineInput): Promise<SiteBuild> {
    const site = input.view.tool('site');
    const outputPath =
        typeof site['output'] === 'string' && site['output'] !== '' ? site['output'] : DEFAULT_BUILD_OUTPUT;
    mutationTarget(outputPath);
    if (input.resources === undefined) throw new Error('Site builds require run-owned temporary resources.');
    const folder = await scratchCopy(
        input.root,
        input.files.map((file) => file.path),
        input.scopeEntries.map((scope) => scope.path),
    );
    // The run keeps the build for the checks that read it after this one.
    const scratch = input.resources.use(folder).path;
    const cwd = join(scratch, input.scope);
    const command = typeof site['build'] === 'string' && site['build'] !== '' ? site['build'] : DEFAULT_BUILD;
    const result = await runCheckCommand(input, commandArguments(command), { cwd });
    const output = join(cwd, outputPath);
    using files = openRoot(scratch);
    const isBuilt: boolean =
        result.code === 0 && files.stat(toPosix(relative(scratch, output)))?.isDirectory() === true;
    const said = [result.stderr, result.stdout].join('\n').trim().split('\n').slice(-SHOWN_DIFFERENCES).join(' | ');
    return { cwd, command, output, isBuilt, said };
}

/**
 * Every file under a folder, relative to it, sorted.
 * @param folder the folder
 * @returns the relative paths
 */
export function filesUnder(folder: string): string[] {
    if (statSync(folder, { throwIfNoEntry: false }) === undefined) return [];
    using files = openRoot(folder, 'native');
    const found: string[] = [];
    walkRoot(files, '', (path) => {
        const entry = statSync(files.source(path));
        if (entry.isFile()) found.push(path);
        return entry.isDirectory();
    });
    return found.toSorted((left, right) => left.localeCompare(right));
}

/**
 * The build of the scope, run the first time a check asks and shared after that.
 * @param input the engine input
 * @returns the build
 */
export function siteBuild(input: EngineInput): Promise<SiteBuild> {
    const key = join(input.root, input.scope);
    const scopeBuilds = builds.get(input.reads) ?? new Map<string, Promise<SiteBuild>>();
    builds.set(input.reads, scopeBuilds);
    const running = scopeBuilds.get(key) ?? built(input);
    scopeBuilds.set(key, running);
    return running;
}

/**
 * Requires built output before a dependent check reads it.
 * @param input the engine input
 * @returns the successful build, or a skipped-check error
 */
export async function requireSiteBuild(input: EngineInput): Promise<SiteBuild> {
    const build = await siteBuild(input);
    if (!build.isBuilt) throw new GspotError('skipped', 'The site did not build.');
    return build;
}

/**
 * One finding when the build command fails or writes no output folder.
 * @param input the engine input
 * @returns the findings
 */
export async function siteBuilds(input: EngineInput): Promise<Finding[]> {
    const build = await siteBuild(input);
    if (build.isBuilt) return [];
    return [findingAt(input, { file: '', line: 1 }, 'build', `${build.command} did not build the site: ${build.said}`)];
}

/**
 * Builds a second time and compares the two outputs file by file.
 * @param input the engine input
 * @returns one finding for each file that differs, appears, or disappears
 */
export async function buildReproducible(input: EngineInput): Promise<Finding[]> {
    const first = await requireSiteBuild(input);
    const before = new Map(
        filesUnder(first.output).map((path) => [path, contentDigest(readSource(first.output, path))]),
    );
    const second = await built(input);
    if (!second.isBuilt) throw new Error(`The second site build failed: ${second.command}: ${second.said}`);
    const after = new Map(
        filesUnder(second.output).map((path) => [path, contentDigest(readSource(second.output, path))]),
    );
    const differences = [...new Set([...before.keys(), ...after.keys()])].filter(
        (path) => before.get(path) !== after.get(path),
    );
    return differences
        .slice(0, SHOWN_DIFFERENCES)
        .map((path) =>
            findingAt(
                input,
                { file: path, line: 1 },
                'not-reproducible',
                'Two builds of the same tree wrote this file differently. Look for a timestamp, a random value, or an unordered list.',
            ),
        );
}
