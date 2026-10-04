import { join, posix } from 'node:path';
import { readSource } from '#cli/platform/source.ts';
import { stripVTControlCharacters } from 'node:util';
import { findingAt } from '#cli/execution/finding.ts';
import { nextSettingsProblems } from '#cli/parsers/nextjs.ts';
import { parsePackageManifest } from '#cli/parsers/packages.ts';
import { runEngineTool } from '#cli/execution/command/runner.ts';
import { scratchCopy } from '#cli/execution/snapshot/workspace.ts';
import type { Finding, EngineInput } from '#cli/types/execution/runtime.ts';

import {
    PAIRS,
    TSC_LINE,
    CAUSE_MARKS,
    NEXT_CONFIG,
    SHOWN_LINES,
    MARKED_LINES,
    SEGMENT_NAME,
} from '#cli/config/checks/framework/nextjs.ts';

function paths(input: EngineInput): string[] {
    return input.files.filter((file) => file.kind === 'source').map((file) => file.path);
}

// Next.js puts the cause and its detail above the longer stack trace.
function lastLines(text: string): string {
    const lines = stripVTControlCharacters(text).trim().split('\n');
    const marked = lines.findIndex((line) => CAUSE_MARKS.some((mark) => line.includes(mark)));
    const shown = marked === -1 ? lines.slice(-SHOWN_LINES) : lines.slice(marked, marked + MARKED_LINES);
    return shown.join(' ').trim();
}

// next typegen writes next-env.d.ts and the route types, which a fresh clone lacks and tsc needs.
// CI=1 stops Next.js installing missing packages; generated files stay in the scratch copy.
async function typegen(input: EngineInput): Promise<void> {
    const cwd = join(input.root, input.scope);
    const result = await runEngineTool(input, ['next', 'typegen'], {
        cwd,
        env: { CI: '1' },
    });
    const said = `${result.stdout}${result.stderr}`;
    if (result.code !== 0) throw new Error(`The next typegen command failed: ${lastLines(said)}`);
}

function typeFinding(input: EngineInput, line: string): Finding[] {
    const groups = TSC_LINE.exec(line)?.groups;
    if (groups === undefined) return [];
    const file = groups['file'];
    if (file === undefined) return [];
    const rule = groups['rule'];
    if (rule === undefined) return [];
    const text = groups['text'];
    if (text === undefined) return [];
    return [
        findingAt(
            input,
            {
                file: input.scope === '' ? file : `${input.scope}/${file}`,
                line: Number(groups['line']),
                column: Number(groups['column']),
            },
            rule,
            text,
        ),
    ];
}

/**
 * One finding for each route segment that holds a page and a route handler.
 * @param input the engine input
 * @returns the findings
 */
export function routeSegments(input: EngineInput): Finding[] {
    const kinds = new Map<string, Map<string, string>>();
    for (const path of paths(input)) {
        const groups = SEGMENT_NAME.exec(posix.basename(path))?.groups;
        if (groups === undefined || !`/${path}`.includes('/app/')) continue;
        const folder = path.slice(0, path.lastIndexOf('/'));
        const held = kinds.get(folder) ?? new Map<string, string>();
        held.set(groups['kind'] ?? '', path);
        kinds.set(folder, held);
    }
    return kinds
        .entries()
        .filter(([, held]) => held.has('page') && held.has('route'))
        .map(([folder, held]) =>
            findingAt(
                input,
                { file: held.get('route') ?? folder, line: 1 },
                'route-segment',
                `${folder} holds a page and a route handler, and the framework serves one address from one of them.`,
            ),
        )
        .toArray();
}

/**
 * The framework configuration turns no build check off, and puts no secret into the client environment.
 * @param input the engine input
 * @returns the findings
 */
export function nextOptions(input: EngineInput): Finding[] {
    return paths(input)
        .filter((path) => NEXT_CONFIG.test(path))
        .flatMap((path) => {
            const text = readSource(input.root, path, input.reads).toString('utf8');
            return nextSettingsProblems(path, text).map(({ name, line, kind }) =>
                findingAt(
                    input,
                    { file: path, line },
                    kind,
                    kind === 'checks-off'
                        ? `${name} lets a build pass with findings the gate stops.`
                        : `${name} under env is written into the client bundle. Read it on the server.`,
                ),
            );
        });
}

/**
 * Packages that ship together sit on one version in every package.json.
 * @param input the engine input
 * @returns the findings
 */
export function versionPairs(input: EngineInput): Finding[] {
    const manifests = paths(input).filter((path) => path === 'package.json' || path.endsWith('/package.json'));
    return manifests.flatMap((path) => {
        const parsed = parsePackageManifest(readSource(input.root, path, input.reads).toString('utf8'));
        const versions = { ...parsed.devDependencies, ...parsed.dependencies };
        return PAIRS.filter(
            ([left, right]) =>
                versions[left] !== undefined && versions[right] !== undefined && versions[left] !== versions[right],
        ).map(([left, right]) =>
            findingAt(
                input,
                { file: path, line: 1 },
                'version-pair',
                `${left} is ${versions[left] ?? ''} and ${right} is ${versions[right] ?? ''}. They ship together, so they sit on one version.`,
            ),
        );
    });
}

/**
 * Has Next.js write its types, then runs the type check of the scope.
 * @param input the engine input
 * @returns one finding for each type error
 */
export async function types(input: EngineInput): Promise<Finding[]> {
    using scratchFolder = await scratchCopy(
        input.root,
        input.files.map((file) => file.path),
        input.scopeEntries.map((scope) => scope.path),
    );
    const scratch = scratchFolder.path;
    const isolated = { ...input, root: scratch, scopeRoot: join(scratch, input.scope) };
    await typegen(isolated);
    const cwd = join(scratch, input.scope);
    const command = ['tsc', '--noEmit', '-p', 'tsconfig.json', '--pretty', 'false'];
    const result = await runEngineTool(isolated, command, { cwd });
    const found = result.stdout.split('\n').flatMap((line) => typeFinding(input, line));
    const said = `${result.stdout}\n${result.stderr}`;
    if (result.code !== 0 && found.length === 0) throw new Error(`The tsc command failed: ${lastLines(said)}`);
    return found;
}

/**
 * Builds the app, for a repository that set tools.next.build_on_push.
 * @param input the engine input
 * @returns one finding for a build that fails
 */
export async function build(input: EngineInput): Promise<Finding[]> {
    using scratchFolder = await scratchCopy(
        input.root,
        input.files.map((file) => file.path),
        input.scopeEntries.map((scope) => scope.path),
    );
    const scratch = scratchFolder.path;
    const isolated = { ...input, root: scratch, scopeRoot: join(scratch, input.scope) };
    const cwd = join(scratch, input.scope);
    const flags = (input.view.options('tools.next')['build_flags'] as string[] | undefined) ?? [];
    const command = ['next', 'build', ...flags];
    const result = await runEngineTool(isolated, command, { cwd, env: { CI: '1' } });
    if (result.code === 0) return [];
    const said = lastLines(`${result.stdout}${result.stderr}`);
    return [
        findingAt(
            input,
            { file: input.scope === '' ? 'package.json' : `${input.scope}/package.json`, line: 1 },
            'build',
            `next build failed: ${said}`,
        ),
    ];
}
