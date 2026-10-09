import { join, posix } from 'node:path';
import { findingAt } from '#cli/checks/finding.ts';
import { tsc } from '#cli/checks/language/public.ts';
import { stripVTControlCharacters } from 'node:util';
import { checkInput } from '#cli/execution/contracts.ts';
import type { PlannedCheck } from '#cli/types/planning.ts';
import type { Finding } from '#cli/types/parsers/output.ts';
import type { ToolSession } from '#cli/types/tools/session.ts';
import { runCheckTool } from '#cli/execution/command/public.ts';
import { copyIntoScratch } from '#cli/execution/copy/public.ts';
import { nextSettingsFindings } from '#cli/parsers/tool/public.ts';
import { parseNextBuildFlags } from '#cli/parsers/bash/contracts.ts';
import { toolPin, allChecks } from '#cli/configurations/contracts.ts';
import { parsePackageManifest } from '#cli/parsers/packages/public.ts';
import { readSource, createReadCache } from '#cli/platform/root/public.ts';
import type { CheckInput, CheckResult } from '#cli/types/execution/check.ts';

import {
    CAUSE_MARKS,
    NEXT_CONFIG,
    SHOWN_LINES,
    MARKED_LINES,
    SEGMENT_NAME,
} from '#cli/config/checks/framework/nextjs.ts';

function sourcePaths(input: CheckInput): string[] {
    return input.files.filter((file) => file.kind === 'source').map((file) => file.path);
}

// Next.js puts the cause and its detail above the longer stack trace.
function failureSummary(text: string): string {
    const lines = stripVTControlCharacters(text).trim().split('\n');
    const marked = lines.findIndex((line) => CAUSE_MARKS.some((mark) => line.includes(mark)));
    const shown = marked === -1 ? lines.slice(-SHOWN_LINES) : lines.slice(marked, marked + MARKED_LINES);
    return shown.join(' ').trim();
}

/**
 * One finding for each route segment that holds a page and a route handler.
 * @param input the check input
 * @returns the findings
 */
export function routeSegments(input: CheckInput): Finding[] {
    const kinds = new Map<string, Map<string, string>>();
    for (const path of sourcePaths(input)) {
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
                `${folder} holds both a page and a route handler, and next build refuses that. Move the route handler into its own segment.`,
            ),
        )
        .toArray();
}

/**
 * Reports each next.config option that disables a build check, and each secret-looking key under env.
 * @param input the check input
 * @returns the findings
 */
export function nextConfiguration(input: CheckInput): Finding[] {
    return sourcePaths(input)
        .filter((path) => NEXT_CONFIG.test(path))
        .flatMap((path) => {
            const text = readSource(input.root, path, input.reads).toString('utf8');
            return nextSettingsFindings(path, text).map(({ name, line, kind }) =>
                findingAt(
                    input,
                    { file: path, line },
                    kind,
                    kind === 'checks-off'
                        ? `${name}: true lets next build pass with errors. Remove it.`
                        : `${name} under env is written into the client bundle. Read it on the server.`,
                ),
            );
        });
}

/**
 * Generate Next.js route types and run the shared TypeScript check in the same disposable project.
 * @param session the repository and tool session
 * @param planned the Next.js compiler check
 * @returns the compiler findings and native execution status
 */
export async function nextjsTsc(session: ToolSession, planned: PlannedCheck): Promise<CheckResult> {
    const started = performance.now();
    using scratchFolder = await copyIntoScratch(checkInput(session, planned));
    const root = scratchFolder.path;
    const isolated = { ...session, root, reads: createReadCache(root) };
    // CI prevents package installation; generated Next.js files stay in the compiler's scratch project.
    const generated = await runCheckTool(checkInput(isolated, planned), ['next', 'typegen'], {
        cwd: join(root, planned.scope.scope.path),
        env: { CI: '1' },
    });
    const output = `${generated.stdout}${generated.stderr}`;
    if (generated.code !== 0) throw new Error(`The next typegen command failed: ${failureSummary(output)}`);
    const compiler = allChecks(session.manifests.values()).get('typescript/tsc');
    if (compiler === undefined) throw new Error('The Next.js compiler check requires typescript/tsc.');
    const result = await tsc(isolated, {
        ...planned,
        check: { ...compiler.check, ...planned.check },
        tool: toolPin(session.manifests.values(), 'tsc', compiler.configuration),
    });
    result.duration = performance.now() - started;
    return result.command === undefined
        ? result
        : { ...result, command: result.command.map((part) => part.replaceAll(root, () => session.root)) };
}

/**
 * Builds the selected Next.js app in an isolated project copy.
 * @param input the check input
 * @returns one finding for a build that fails
 */
export async function nextBuild(input: CheckInput): Promise<Finding[]> {
    using scratchFolder = await copyIntoScratch(input);
    const scratch = scratchFolder.path;
    const isolated = { ...input, root: scratch, scopeRoot: join(scratch, input.scope) };
    const cwd = isolated.scopeRoot;
    const manifest = parsePackageManifest(
        readSource(input.root, posix.join(input.scope, 'package.json'), input.reads).toString('utf8'),
    );
    const flags = parseNextBuildFlags(manifest.scripts?.['build'] ?? 'next build');
    const command = ['next', 'build', ...flags];
    const result = await runCheckTool(isolated, command, { cwd, env: { CI: '1' } });
    if (result.code === 0) return [];
    const output = failureSummary(`${result.stdout}${result.stderr}`);
    return [
        findingAt(
            input,
            { file: input.scope === '' ? 'package.json' : `${input.scope}/package.json`, line: 1 },
            'build',
            `next build failed: ${output}`,
        ),
    ];
}
