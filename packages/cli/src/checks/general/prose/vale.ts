import { z } from 'zod';
import { hasPackages } from '#cli/tools/vale.ts';
import { findingAt } from '#cli/execution/finding.ts';
import { join, relative, isAbsolute } from 'node:path';
import { readSource } from '#cli/repository/sources.ts';
import type { SpawnResult } from '#cli/types/platform.ts';
import { SCRIPT_GRAMMAR } from '#cli/config/checks/docs.ts';
import { SCRIPT_TAG } from '#cli/config/checks/structure.ts';
import { fileBatches } from '#cli/execution/tool/batches.ts';
import { toPosix, extensionOf } from '#cli/platform/paths.ts';
import { runCheckCommand } from '#cli/execution/tool/runner.ts';
import type { TrackedFile } from '#cli/types/repository/repository.ts';
import { VALE_STDIN, VALE_CONFIG, PROSE_GRAMMARS } from '#cli/config/kits.ts';
import type { Finding, ValeAlert, ProseRoute, EngineInput } from '#cli/types/checks.ts';

const alertsSchema = z.record(
    z.string().min(1),
    z.array(
        z.object({
            Line: z.number().int().positive(),
            Span: z.tuple([z.number().int().positive(), z.number().int().positive()]),
            Check: z.string().min(1),
            Message: z.string().min(1),
        }),
    ),
);

// Vale runs with --no-exit, so alerts leave the exit code at 0; any other code means Vale itself failed, and that is never a pass.
function assertValeRan(result: SpawnResult): void {
    if (result.code === 0 && !result.missing) return;
    const lines = `${result.stderr}\n${result.stdout}`.split('\n').filter((line) => line.trim() !== '');
    const reason = lines.find((line) => /(?:^E\d+)|(?:not found)|(?:error)/iu.test(line)) ?? lines[0] ?? 'no output';
    throw new Error(`Vale did not run (exit ${String(result.code)}): ${reason.trim()}`);
}

async function alertsFor(input: EngineInput, group: ProseRoute[]): Promise<ValeAlert[]> {
    const [first] = group;
    if (first === undefined) return [];
    const root = input.root;
    const base = ['vale', '--config', join(root, VALE_CONFIG), '--output', 'JSON', '--no-exit'];
    if (first.mode === 'path') {
        const alerts: ValeAlert[] = [];
        for (const batch of fileBatches(
            group.map((route) => route.path),
            base,
            process.platform,
        )) {
            const result = await runCheckCommand(input, [...base, ...batch], { cwd: root });
            assertValeRan(result);
            alerts.push(...parseAlerts(result.stdout));
        }
        return alerts.map((alert) => ({
            ...alert,
            file: toPosix(isAbsolute(alert.file) ? relative(root, alert.file) : alert.file),
        }));
    }
    const text = readSource(root, first.path).toString('utf8');
    const result = await runCheckCommand(input, [...base, `--ext=${first.extension}`], { cwd: root, stdin: text });
    assertValeRan(result);
    return parseAlerts(result.stdout).map((alert) => ({
        ...alert,
        file: alert.file.startsWith(VALE_STDIN) ? first.path : alert.file,
    }));
}

/**
 * Validates native Vale JSON before converting alerts to source locations.
 * @param stdout the output
 * @returns the alerts
 */
export function parseAlerts(stdout: string): ValeAlert[] {
    return Object.entries(alertsSchema.parse(JSON.parse(stdout))).flatMap(([file, alerts]) =>
        alerts.map((alert) => ({
            file: toPosix(file),
            line: alert.Line,
            column: alert.Span[0],
            check: alert.Check,
            message: alert.Message,
        })),
    );
}

/**
 * Runs Vale over the scope's files, by path where Vale has a grammar and through stdin elsewhere. Every alert is a finding.
 * @param input the engine input
 * @returns the findings
 */
export async function valeFindings(input: EngineInput): Promise<Finding[]> {
    if (!hasPackages(input.root))
        throw new Error('The Vale packages are not synced; run gspot apply with the network on.');
    const groups = routeGroups(input.files.filter((file) => file.kind === 'source'));
    const findings: Finding[] = [];
    for (const group of groups) {
        const alerts = await alertsFor(input, group);
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
export function routeGroups(files: TrackedFile[]): ProseRoute[][] {
    const routes = files.map((file) => routeFor(file)).filter((route) => route !== undefined);
    const byPath = new Map<string, ProseRoute[]>();
    const pathRoutes = routes.filter((entry) => entry.mode === 'path');
    for (const route of pathRoutes) {
        const group = byPath.get(route.extension) ?? [];
        group.push(route);
        byPath.set(route.extension, group);
    }
    return [...byPath.values(), ...routes.filter((entry) => entry.mode === 'stdin').map((route) => [route])];
}
