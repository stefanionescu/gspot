import { z } from 'zod';
import { findingAt } from '#cli/checks/finding.ts';
import { hasValePackages } from '#cli/install/vale.ts';
import { readSource } from '#cli/system/files/reads.ts';
import type { SchemaShape } from '#cli/types/objects.ts';
import { toPosix, extensionOf } from '#cli/system/paths.ts';
import { VALE_CONFIG } from '#cli/config/system/locations.ts';
import { runCheckTool } from '#cli/execution/command/tool.ts';
import { fileBatches } from '#cli/execution/command/batches.ts';
import { join, dirname, relative, isAbsolute } from 'node:path';
import { SCRIPT_TAG } from '#cli/config/repository/inventory.ts';
import { type SpawnResult } from '#cli/types/system/processes.ts';
import { VALE_ERROR_LINE } from '#cli/config/checks/general/prose.ts';
import { VALE_TOOL, VALE_ARGUMENTS } from '#cli/config/tools/vale.ts';
import { type TrackedFile } from '#cli/types/repository/inventory.ts';
import { type Finding, type CheckInput } from '#cli/types/execution/check.ts';
import { PROSE_GRAMMARS, SCRIPT_GRAMMAR } from '#cli/config/generation/prose.ts';
import { type ValeAlert, type ProseRoute, type ProseRouteGroup } from '#cli/types/checks/general.ts';

/**
 * Validate Vale JSON before converting alerts to source locations.
 * @param stdout the output.
 * @returns the alerts.
 */
function valeAlerts(stdout: string): ValeAlert[] {
    return Object.entries(valeReportSchema.parse(JSON.parse(stdout))).flatMap(([file, alerts]) =>
        alerts.map((alert) => ({
            file: toPosix(file),
            line: alert.Line,
            column: alert.Span[0],
            check: alert.Check,
            message: alert.Message,
        })),
    );
}

const valeReportSchema = z.record(
    z.string().min(1),
    z.array(
        z.object({
            Line: z.number().int().positive(),
            Span: z.tuple([z.number().int().positive(), z.number().int().positive()]),
            Check: z.string().min(1),
            Message: z.string().min(1),
        } satisfies SchemaShape<
            Record<string, { Line: number; Span: [number, number]; Check: string; Message: string }[]>[string][number]
        >),
    ),
) satisfies z.ZodType<Record<string, { Line: number; Span: [number, number]; Check: string; Message: string }[]>>;

// Vale runs with --no-exit, so alerts leave the exit code at 0. Any other code means Vale itself failed, which never counts as a pass.
function assertValeRan(result: SpawnResult): void {
    if (result.code === 0 && !result.missing) return;
    const lines = `${result.stderr}\n${result.stdout}`.split('\n').filter((line) => line.trim() !== '');
    const reason = lines.find((line) => VALE_ERROR_LINE.test(line)) ?? lines[0] ?? 'no output';
    throw new Error(`Vale did not run (exit ${String(result.code)}): ${reason.trim()}`);
}

function valeCommand(input: CheckInput): string[] {
    return [VALE_TOOL, '--config', join(input.root, VALE_CONFIG), ...VALE_ARGUMENTS];
}

async function pathAlerts(input: CheckInput, routes: ProseRoute[]): Promise<ValeAlert[]> {
    const base = valeCommand(input);
    const alerts: ValeAlert[] = [];
    for (const batch of fileBatches(
        routes.map((route) => join(input.root, route.path)),
        base,
        process.platform,
    )) {
        const result = await runCheckTool(input, [...base, ...batch], { cwd: dirname(join(input.root, VALE_CONFIG)) });
        assertValeRan(result);
        alerts.push(...valeAlerts(result.stdout));
    }
    return alerts.map((alert) => ({
        ...alert,
        file: toPosix(
            relative(
                input.root,
                isAbsolute(alert.file) ? alert.file : join(input.root, dirname(VALE_CONFIG), alert.file),
            ),
        ),
    }));
}

async function stdinAlerts(input: CheckInput, route: ProseRoute): Promise<ValeAlert[]> {
    const text = readSource(input.root, route.path, input.reads).toString('utf8');
    const result = await runCheckTool(
        input,
        [...valeCommand(input), `--ext=${route.extension}`, `--path=${join(input.root, route.path)}${route.extension}`],
        {
            cwd: dirname(join(input.root, VALE_CONFIG)),
            stdin: text,
        },
    );
    assertValeRan(result);
    return valeAlerts(result.stdout).map((alert) => ({
        ...alert,
        file: route.path,
    }));
}

/**
 * The route for a tracked file, or undefined when Vale has nothing to read in it.
 * @param file the tracked file.
 * @returns the route.
 */
function routeFor(file: TrackedFile): ProseRoute | undefined {
    const extension = extensionOf(file.path);
    const grammars: Readonly<Record<string, Omit<ProseRoute, 'path'>>> = PROSE_GRAMMARS;
    const grammar =
        grammars[extension] ?? (extension === '' && file.tags.includes(SCRIPT_TAG) ? SCRIPT_GRAMMAR : undefined);
    return grammar === undefined ? undefined : { path: file.path, mode: grammar.mode, extension: grammar.extension };
}

/**
 * The routes grouped by the argument list they share: every path-read file of one extension together, every stdin file alone.
 * @param files the tracked files.
 * @returns the groups, path-read first.
 */
function routeGroups(files: TrackedFile[]): ProseRouteGroup[] {
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

/**
 * Runs Vale over the scope's files, by path where Vale has a grammar and through stdin elsewhere. Report every alert as a finding.
 * @param input the check input.
 * @returns the findings.
 */
export async function vale(input: CheckInput): Promise<Finding[]> {
    if (!hasValePackages(input.installedRoot, input.settingsFile.settings.level))
        throw new Error('The Vale packages are not installed. Run: gspot install');
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
