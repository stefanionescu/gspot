import { createHash } from 'node:crypto';
import { join, relative } from 'node:path';
import { rmSync, statSync } from 'node:fs';
import type { Finding } from '#cli/checks/result.ts';
import type { EngineInput } from '#cli/checks/input.ts';
import { readSource } from '#cli/repository/tracked.ts';
import { SkippedCheckError } from '#cli/checks/result.ts';
import { commandArguments } from '#cli/platform/arguments.ts';
import { scratchCopy } from '#cli/execution/file-workspace.ts';
import { runCheckCommand } from '#cli/execution/tool-runner.ts';
import { mutationTarget, openConfinedRoot } from '#cli/platform/filesystem.ts';

/** The output of one isolated static-site build. */
export type SiteBuild = {
    cwd: string;
    command: string;
    output: string;
    isBuilt: boolean;
    said: string;
};

const DEFAULT_OUTPUT = 'dist';
const DEFAULT_BUILD = 'npm run build';
const SHOWN_DIFFERENCES = 10;
const builds = new WeakMap<object, Map<string, Promise<SiteBuild>>>();

function text(input: EngineInput, key: string, otherwise: string): string {
    const found = input.view.tool('site')[key];
    return typeof found === 'string' && found !== '' ? found : otherwise;
}

async function built(input: EngineInput): Promise<SiteBuild> {
    const outputPath = text(input, 'output', DEFAULT_OUTPUT);
    mutationTarget(outputPath);
    if (input.resources === undefined) throw new Error('Site builds require run-owned temporary resources.');
    const scratch = scratchCopy(
        input.root,
        input.files.map((file) => file.path),
        input.scopeEntries.map((scope) => scope.path),
    );
    input.resources.defer(() => {
        rmSync(scratch, { recursive: true, force: true });
    });
    const cwd = join(scratch, input.scope);
    const command = text(input, 'build', DEFAULT_BUILD);
    const result = await runCheckCommand(input, commandArguments(command), { cwd });
    const output = join(cwd, outputPath);
    const files = openConfinedRoot(scratch);
    let isBuilt: boolean;
    try {
        isBuilt =
            result.code === 0 && files.stat(relative(scratch, output).replaceAll('\\', '/'))?.isDirectory() === true;
    } finally {
        files.close();
    }
    const said = [result.stderr, result.stdout].join('\n').trim().split('\n').slice(-SHOWN_DIFFERENCES).join(' | ');
    return { cwd, command, output, isBuilt, said };
}

function digests(folder: string): Map<string, string> {
    return new Map(
        filesUnder(folder).map((path) => [path, createHash('sha256').update(readSource(folder, path)).digest('hex')]),
    );
}

/**
 * Every file under a folder, relative to it, sorted.
 * @param folder the folder
 * @returns the relative paths
 */
export function filesUnder(folder: string): string[] {
    if (!(statSync(folder, { throwIfNoEntry: false }) !== undefined)) return [];
    const files = openConfinedRoot(folder, 'native');
    const found: string[] = [];
    const directories = [''];
    try {
        for (let directory = directories.pop(); directory !== undefined; directory = directories.pop()) {
            for (const entry of files.list(directory === '' ? undefined : directory)) {
                const path = directory === '' ? entry : `${directory}/${entry}`;
                const stat = statSync(files.source(path));
                if (stat.isDirectory()) directories.push(path);
                else if (stat.isFile()) found.push(path);
            }
        }
        return found.toSorted((left, right) => left.localeCompare(right));
    } finally {
        files.close();
    }
}

/**
 * The build of the scope, run the first time a check asks and shared after that.
 * @param input the engine input
 * @returns the build
 */
export function siteBuild(input: EngineInput): Promise<SiteBuild> {
    const key = join(input.root, input.scope);
    const scopeBuilds = builds.get(input.observations) ?? new Map<string, Promise<SiteBuild>>();
    builds.set(input.observations, scopeBuilds);
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
    if (!build.isBuilt) throw new SkippedCheckError('The site did not build.');
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
    return [
        {
            check: input.spec.name,
            file: '',
            line: 1,
            rule: 'build',
            message: `${build.command} did not build the site: ${build.said}`,
            fixable: false,
        },
    ];
}

/**
 * Builds a second time and compares the two outputs file by file.
 * @param input the engine input
 * @returns one finding for each file that differs, appears or disappears
 */
export async function buildReproducible(input: EngineInput): Promise<Finding[]> {
    const first = await requireSiteBuild(input);
    const before = digests(first.output);
    const second = await built(input);
    if (!second.isBuilt) throw new Error(`The second site build failed: ${second.command}: ${second.said}`);
    const after = digests(second.output);
    const differences = [...new Set([...before.keys(), ...after.keys()])].filter(
        (path) => before.get(path) !== after.get(path),
    );
    return differences.slice(0, SHOWN_DIFFERENCES).map((path) => ({
        check: input.spec.name,
        file: path,
        line: 1,
        rule: 'not-reproducible',
        message:
            'Two builds of the same tree wrote this file differently. Look for a timestamp, a random value, or an unordered list.',
        fixable: false,
    }));
}
