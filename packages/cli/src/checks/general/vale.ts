import { parseAlerts } from '#cli/parsers/vale.ts';
import { hasValePackages } from '#cli/tools/vale.ts';
import { readSource } from '#cli/platform/source.ts';
import { findingAt } from '#cli/execution/finding.ts';
import { join, relative, isAbsolute } from 'node:path';
import type { ValeAlert } from '#cli/types/parsers/vale.ts';
import { toPosix, extensionOf } from '#cli/platform/paths.ts';
import { VALE_CONFIG } from '#cli/config/platform/locations.ts';
import { fileBatches } from '#cli/execution/command/batches.ts';
import { PROSE_GRAMMARS } from '#cli/config/generation/prose.ts';
import { SCRIPT_TAG } from '#cli/config/checks/language/bash.ts';
import { runEngineTool } from '#cli/execution/command/runner.ts';
import type { SpawnResult } from '#cli/types/platform/runtime.ts';
import type { TrackedFile } from '#cli/types/repository/inventory.ts';
import type { Finding, EngineInput } from '#cli/types/execution/runtime.ts';
import { VALE_STDIN, SCRIPT_GRAMMAR } from '#cli/config/checks/general/prose.ts';
import type { ProseRoute, ProseRouteGroup } from '#cli/types/checks/general/prose.ts';

// Vale runs with --no-exit, so alerts leave the exit code at 0; any other code means Vale itself failed, and that is never a pass.
function assertValeRan(result: SpawnResult): void {
    if (result.code === 0 && !result.missing) return;
    const lines = `${result.stderr}\n${result.stdout}`.split('\n').filter((line) => line.trim() !== '');
    const reason = lines.find((line) => /(?:^E\d+)|(?:not found)|(?:error)/iu.test(line)) ?? lines[0] ?? 'no output';
    throw new Error(`Vale did not run (exit ${String(result.code)}): ${reason.trim()}`);
}

function valeCommand(input: EngineInput): string[] {
    return ['vale', '--config', join(input.root, VALE_CONFIG), '--output', 'JSON', '--no-exit'];
}

async function pathAlerts(input: EngineInput, routes: ProseRoute[]): Promise<ValeAlert[]> {
    const base = valeCommand(input);
    const alerts: ValeAlert[] = [];
    for (const batch of fileBatches(
        routes.map((route) => route.path),
        base,
        process.platform,
    )) {
        const result = await runEngineTool(input, [...base, ...batch], { cwd: input.root });
        assertValeRan(result);
        alerts.push(...parseAlerts(result.stdout));
    }
    return alerts.map((alert) => ({
        ...alert,
        file: toPosix(isAbsolute(alert.file) ? relative(input.root, alert.file) : alert.file),
    }));
}

async function stdinAlerts(input: EngineInput, route: ProseRoute): Promise<ValeAlert[]> {
    const text = readSource(input.root, route.path, input.reads).toString('utf8');
    const result = await runEngineTool(input, [...valeCommand(input), `--ext=${route.extension}`], {
        cwd: input.root,
        stdin: text,
    });
    assertValeRan(result);
    return parseAlerts(result.stdout).map((alert) => ({
        ...alert,
        file: alert.file.startsWith(VALE_STDIN) ? route.path : alert.file,
    }));
}

/**
 * Runs Vale over the scope's files, by path where Vale has a grammar and through stdin elsewhere. Every alert is a finding.
 * @param input the engine input
 * @returns the findings
 */
export async function vale(input: EngineInput): Promise<Finding[]> {
    if (!hasValePackages(input.root)) throw new Error('The Vale packages are not installed. Run: gspot install');
    const groups = routeGroups(input.files.filter((file) => file.kind === 'source'));
    const findings: Finding[] = [];
    for (const group of groups) {
        const [first] = group;
        const alerts = first.mode === 'path' ? await pathAlerts(input, group) : await stdinAlerts(input, first);
        findings.push(
            ...alerts.map((alert) =>
                findingAt(
                    input,
                    { file: alert.file, line: alert.line, column: alert.column },
                    alert.check,
                    alert.message,
                ),
            ),
        );
    }
    return findings;
}

/**
 * The route for a tracked file, or undefined when Vale has nothing to read in it.
 * @param file the tracked file
 * @returns the route
 */
export function routeFor(file: TrackedFile): ProseRoute | undefined {
    const extension = extensionOf(file.path);
    const grammar =
        PROSE_GRAMMARS[extension] ?? (extension === '' && file.tags.includes(SCRIPT_TAG) ? SCRIPT_GRAMMAR : undefined);
    return grammar === undefined ? undefined : { path: file.path, mode: grammar.mode, extension: grammar.extension };
}

/**
 * The routes grouped by the argument list they share: every path-read file of one extension together, every stdin file alone.
 * @param files the tracked files
 * @returns the groups, path-read first
 */
export function routeGroups(files: TrackedFile[]): ProseRouteGroup[] {
    const routes = files.map((file) => routeFor(file)).filter((route) => route !== undefined);
    const byExtension = new Map<string, ProseRouteGroup>();
    const pathRoutes = routes.filter((entry) => entry.mode === 'path');
    for (const route of pathRoutes) {
        const group = byExtension.get(route.extension);
        if (group === undefined) byExtension.set(route.extension, [route]);
        else group.push(route);
    }
    return [
        ...byExtension.values(),
        ...routes.filter((entry) => entry.mode === 'stdin').map((route): ProseRouteGroup => [route]),
    ];
}
