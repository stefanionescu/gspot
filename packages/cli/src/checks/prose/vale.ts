import { z } from 'zod';
import { hasPackages } from '#cli/tools/vale.ts';
import { toPosix } from '#cli/platform/paths.ts';
import { isAbsolute, join, relative } from 'node:path';
import { readSource } from '#cli/repository/tracked.ts';
import type { SpawnResult } from '#cli/types/platform.ts';
import { routeGroups } from '#cli/checks/prose/grammars.ts';
import { fileBatches } from '#cli/execution/file-batches.ts';
import { runCheckCommand } from '#cli/execution/tool-runner.ts';
import { VALE_CONFIG, VALE_STDIN } from '#cli/configurations/vale.ts';
import type { EngineInput, Finding } from '#cli/types/checks/checks.ts';
import type { ValeAlert, ProseRoute } from '#cli/types/checks/prose.ts';

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
    const groups = routeGroups(input.files.filter((file) => file.nature === 'source'));
    const findings: Finding[] = [];
    for (const group of groups) {
        const alerts = await alertsFor(input, group);
        findings.push(
            ...alerts.map((alert) => ({
                check: input.spec.name,
                file: alert.file,
                line: alert.line,
                column: alert.column,
                rule: alert.check,
                message: alert.message,
                fixable: false,
            })),
        );
    }
    return findings;
}
