import { memo } from '#cli/platform/memo.ts';
import { decodeHTMLAttribute } from 'entities';
import { join, posix, relative } from 'node:path';
import { findingAt } from '#cli/checks/finding.ts';
import { getAttributes } from '#cli/parsers/html.ts';
import { GspotError } from '#cli/platform/public.ts';
import { scratchEntries } from '#cli/platform/scratch.ts';
import type { Finding } from '#cli/types/parsers/output.ts';
import type { WebManifest } from '#cli/types/parsers/site.ts';
import { runCheckTool } from '#cli/execution/command/public.ts';
import { copyIntoScratch } from '#cli/execution/copy/public.ts';
import { webManifestSchema } from '#cli/parsers/schema/site.ts';
import type { CheckInput } from '#cli/types/execution/check.ts';
import { FULL_PERCENTAGE } from '#cli/config/platform/runtime.ts';
import { visitParsedSources } from '#cli/parsers/source/public.ts';
import type { SiteBuild } from '#cli/types/checks/general/site.ts';
import { statSync, lstatSync, readFileSync, realpathSync } from 'node:fs';
import { openRoot, readText, readSource } from '#cli/platform/root/public.ts';
import { portableSegments, assertMutationTarget } from '#cli/platform/root/contracts.ts';
import { toPosix, isInside, directoryOf, contentDigest } from '#cli/platform/contracts.ts';
import { ASSET_FOLDER, TEXT_SUFFIXES, OUTPUT_TAIL_LINES, SHOWN_DIFFERENCES } from '#cli/config/checks/general/site.ts';

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

// What svgo says about one file: it cannot read it, it makes it smaller, or nothing.
async function svgFinding(input: CheckInput, path: string): Promise<Finding[]> {
    const original = readSource(input.root, path, input.reads).toString('utf8');
    const result = await runCheckTool(input, ['svgo', '--input', '-', '--output', '-'], {
        cwd: input.root,
        stdin: original,
    });
    if (result.code !== 0) throw new Error(`SVGO could not optimize ${path}: ${result.stderr.trim()}`);
    const originalBytes = Buffer.byteLength(original);
    const saved = originalBytes - Buffer.byteLength(result.stdout);
    const minimum = input.view.options('tools.svgo')['min_saving_percent'];
    const exceeds = saved * FULL_PERCENTAGE > originalBytes * minimum;
    return exceeds
        ? [
              findingAt(
                  input,
                  { file: path, line: 1 },
                  'unoptimized',
                  `svgo makes this file ${String(saved)} bytes smaller.`,
              ),
          ]
        : [];
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
 * Builds one isolated source snapshot twice at the same path, with clean output, and compares the files.
 * @param input the check input.
 * @returns one finding for each file that differs, appears, or disappears.
 */
export async function buildReproducible(input: CheckInput): Promise<Finding[]> {
    using folder = await copyIntoScratch(input);
    using files = openRoot(folder.path, 'native');
    const output = input.view.options('site').build_folder;
    assertMutationTarget(output);
    files.removeTree(output);
    const first = await runBuild(input, folder.path);
    if (!first.isBuilt) throw new GspotError('skip', 'The site did not build.');
    const before = outputDigests(first.output);
    files.removeTree(output);
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

/**
 * Every selected asset that no local text or tracked outside reference names.
 * @param input the check input
 * @returns the findings
 */
export function deadAssets(input: CheckInput): Finding[] {
    const files = input.files;
    const local = new Set(files.map((file) => file.path));
    const paths = new Set([
        ...local,
        ...input.index
            .filter((entry) => entry.stage === 0 && (entry.mode === '100644' || entry.mode === '100755'))
            .map((entry) => entry.path),
    ]);
    const texts = paths
        .values()
        .filter((path) => TEXT_SUFFIXES.has(posix.extname(path)))
        .flatMap((path) => {
            const text = readText(input.root, path, input.reads);
            return text === undefined ? [] : [{ path, text }];
        })
        .toArray();
    return files
        .filter((file) => ASSET_FOLDER.test(file.path) && !TEXT_SUFFIXES.has(posix.extname(file.path)))
        .filter((file) => {
            const name = posix.basename(file.path);
            return texts.every(
                ({ path, text }) =>
                    !text.includes(local.has(path) ? name : posix.relative(directoryOf(path), file.path)),
            );
        })
        .map((file) =>
            findingAt(
                input,
                { file: file.path, line: 1 },
                'dead-asset',
                'No page, stylesheet or script names this file.',
            ),
        );
}

/**
 * SVG reductions above the configured saving percentage, measured in UTF-8 bytes.
 * @param input the check input
 * @returns the findings
 */
export async function svgo(input: CheckInput): Promise<Finding[]> {
    const paths = input.files
        .filter((file) => file.kind === 'source' && file.path.endsWith('.svg'))
        .map((file) => file.path);
    const findings: Finding[] = [];
    for (const path of paths) findings.push(...(await svgFinding(input, path)));
    return findings;
}

/**
 * The web manifest parses, names the app, and every icon it lists exists.
 * @param input the check input
 * @returns the findings
 */
export async function webManifest(input: CheckInput): Promise<Finding[]> {
    const targets = new Set(input.files.filter((file) => file.path.endsWith('.webmanifest')).map((file) => file.path));
    const files = input.files
        .filter((file) => /\.html?$/u.test(file.path))
        .map((file) => ({ path: file.path, grammar: 'html' as const }));
    await visitParsedSources({ ...input, files }, (source) => {
        for (const element of source.rootNode.descendantsOfType('element')) {
            const attributes = getAttributes(element);
            const rel = attributes.find((attribute) => attribute.element === 'link' && attribute.name === 'rel');
            if (rel?.value.toLowerCase().split(/\s+/u).includes('manifest') !== true) continue;
            const href = attributes.find((attribute) => attribute.name === 'href');
            if (href === undefined) continue;
            const origin = new URL(source.path, 'https://example.invalid/');
            const target = URL.parse(decodeHTMLAttribute(href.value), origin.href);
            if (target?.origin === origin.origin) targets.add(decodeURIComponent(target.pathname).slice(1));
        }
    });
    const manifests = input.files.filter((file) => targets.has(file.path));
    return manifests.flatMap((file): Finding[] => {
        const text = readSource(input.root, file.path, input.reads).toString('utf8');
        let parsed: WebManifest;
        try {
            parsed = webManifestSchema.parse(JSON.parse(text));
        } catch (error) {
            return [
                findingAt(
                    input,
                    { file: file.path, line: 1 },
                    'parse',
                    error instanceof Error ? error.message : 'The manifest is not JSON.',
                ),
            ];
        }
        const folder = directoryOf(file.path);
        const unnamed =
            typeof parsed.name === 'string' && parsed.name !== ''
                ? []
                : [findingAt(input, { file: file.path, line: 1 }, 'missing-name', 'The manifest has no name.')];
        const icons = (parsed.icons ?? []).flatMap((icon) => (icon.src === undefined ? [] : [icon.src]));
        const missing = icons
            .filter(
                (src) =>
                    !src.startsWith('http') &&
                    statSync(join(input.root, folder, src.replace(/^\//u, '')), { throwIfNoEntry: false }) ===
                        undefined,
            )
            .map((src) => findingAt(input, { file: file.path, line: 1 }, 'icon', `The icon ${src} does not exist.`));
        return [...unnamed, ...missing];
    });
}
