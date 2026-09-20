// The build of a static site: run once for each scope in a session, because every output check reads the same folder.
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { run } from '#cli/platform/spawn.ts';
import type { SiteBuild } from '#types/web.ts';
import type { Finding } from '#types/finding.ts';
import { scratchCopy } from '#cli/run/scratch-copy.ts';
import type { EngineInput, Session } from '#types/run.ts';
import { SkippedCheckError } from '#cli/platform/skipped-check.ts';
import { existsSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';

const BUILD_TIMEOUT_MS = 1_800_000;
const DEFAULT_OUTPUT = 'dist';
const DEFAULT_BUILD = 'npm run build';
const SHOWN_DIFFERENCES = 10;
const builds = new WeakMap<Session, Map<string, Promise<SiteBuild>>>();

function text(input: EngineInput, key: string, otherwise: string): string {
    const found = input.view.tool('site')[key];
    return typeof found === 'string' && found !== '' ? found : otherwise;
}

async function built(input: EngineInput): Promise<SiteBuild> {
    const cwd = join(input.root, input.scope);
    const command = text(input, 'build', DEFAULT_BUILD);
    const result = await run(command.split(' '), { cwd, timeoutMs: BUILD_TIMEOUT_MS });
    const output = join(cwd, text(input, 'output', DEFAULT_OUTPUT));
    const said = [result.stderr, result.stdout].join('\n').trim().split('\n').slice(-SHOWN_DIFFERENCES).join(' | ');
    return { cwd, command, output, isBuilt: result.code === 0 && existsSync(output), said };
}

function digests(folder: string): Map<string, string> {
    return new Map(
        filesUnder(folder).map((path) => [
            path,
            createHash('sha256')
                .update(readFileSync(join(folder, path)))
                .digest('hex'),
        ]),
    );
}

/**
 * Every file under a folder, relative to it, sorted.
 * @param folder the folder
 * @returns the relative paths
 */
export function filesUnder(folder: string): string[] {
    if (!existsSync(folder)) return [];
    return readdirSync(folder, { recursive: true })
        .map(String)
        .filter((entry) => statSync(join(folder, entry)).isFile())
        .toSorted((left, right) => left.localeCompare(right));
}

/**
 * The build of the scope, run the first time a check asks and shared after that.
 * @param input the engine input
 * @returns the build
 */
export function siteBuild(input: EngineInput): Promise<SiteBuild> {
    const key = join(input.root, input.scope);
    const scopeBuilds = builds.get(input.session) ?? new Map<string, Promise<SiteBuild>>();
    builds.set(input.session, scopeBuilds);
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
    const paths = input.session.repository.files.map((file) => file.path);
    const scratch = scratchCopy(input.session, paths);
    try {
        const second = await built({ ...input, root: scratch });
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
    } finally {
        rmSync(scratch, { recursive: true, force: true });
    }
}
