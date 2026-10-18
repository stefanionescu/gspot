import { z } from 'zod';
import { GspotError } from '#cli/system/errors.ts';
import { buildFinding } from '#cli/checks/finding.ts';
import { hasValePackages } from '#cli/install/vale.ts';
import type { SchemaShape } from '#cli/types/shapes.ts';
import { parseReport } from '#cli/parsers/output/json.ts';
import { readCachedBytes } from '#cli/system/files/reads.ts';
import { runCheckTool } from '#cli/checks/run/command/tool.ts';
import { join, dirname, relative, isAbsolute } from 'node:path';
import { SCRIPT_TAG } from '#cli/config/repository/inventory.ts';
import { type SpawnResult } from '#cli/types/system/processes.ts';
import { VALE_ERROR_LINE } from '#cli/config/checks/general/prose.ts';
import { VALE_TOOL_FILE_PATH } from '#cli/config/system/locations.ts';
import { VALE_TOOL, VALE_ARGUMENTS } from '#cli/config/tools/vale.ts';
import { type TrackedFile } from '#cli/types/repository/inventory.ts';
import { splitFileArguments } from '#cli/checks/run/command/batches.ts';
import { extractExtension, convertToPosixPath } from '#cli/system/paths.ts';
import { type Finding, type CheckInput } from '#cli/types/checks/run/check.ts';
import { PROSE_GRAMMARS, SCRIPT_GRAMMAR } from '#cli/config/generation/vale.ts';
import { type ValeAlert, type ProseRoute, type ProseRouteGroup } from '#cli/types/checks/general.ts';

/**
 * Parses the Vale JSON output into alerts.
 * @param stdout what Vale printed.
 * @returns the alerts of every file.
 */
function parseValeAlerts(stdout: string): ValeAlert[] {
    return Object.entries(parseReport('Vale', stdout, valeReportSchema)).flatMap(([file, alerts]) =>
        alerts.map((alert) => ({
            file: convertToPosixPath(file),
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

function buildValeCommand(input: CheckInput): string[] {
    return [VALE_TOOL, '--config', join(input.root, VALE_TOOL_FILE_PATH), ...VALE_ARGUMENTS];
}

async function runValeOnPaths(input: CheckInput, routes: ProseRoute[]): Promise<ValeAlert[]> {
    const base = buildValeCommand(input);
    const alerts: ValeAlert[] = [];
    for (const batch of splitFileArguments(
        routes.map((route) => join(input.root, route.path)),
        base,
        process.platform,
    )) {
        const result = await runCheckTool(input, [...base, ...batch], {
            cwd: dirname(join(input.root, VALE_TOOL_FILE_PATH)),
        });
        assertValeRan(result);
        alerts.push(...parseValeAlerts(result.stdout));
    }
    return alerts.map((alert) => ({
        ...alert,
        file: convertToPosixPath(
            relative(
                input.root,
                isAbsolute(alert.file) ? alert.file : join(input.root, dirname(VALE_TOOL_FILE_PATH), alert.file),
            ),
        ),
    }));
}

async function runValeOnStdin(input: CheckInput, route: ProseRoute): Promise<ValeAlert[]> {
    const text = readCachedBytes(input.reads, route.path).toString('utf8');
    const result = await runCheckTool(
        input,
        [
            ...buildValeCommand(input),
            `--ext=${route.extension}`,
            `--path=${join(input.root, route.path)}${route.extension}`,
        ],
        {
            cwd: dirname(join(input.root, VALE_TOOL_FILE_PATH)),
            stdin: text,
        },
    );
    assertValeRan(result);
    return parseValeAlerts(result.stdout).map((alert) => ({
        ...alert,
        file: route.path,
    }));
}

/**
 * Selects how Vale reads a file, or undefined when Vale has nothing to read in it.
 * @param file a tracked source.
 * @returns the grammar and input mode, or undefined.
 */
function selectRoute(file: TrackedFile): ProseRoute | undefined {
    const extension = extractExtension(file.path);
    const grammars: Readonly<Record<string, Omit<ProseRoute, 'path'>>> = PROSE_GRAMMARS;
    const grammar =
        grammars[extension] ?? (extension === '' && file.tags.includes(SCRIPT_TAG) ? SCRIPT_GRAMMAR : undefined);
    return grammar === undefined ? undefined : { path: file.path, mode: grammar.mode, extension: grammar.extension };
}

/**
 * Groups routes by shared arguments: path-read files by extension, and each stdin file alone.
 * @param files the scope sources.
 * @returns the groups, path-read first.
 */
function groupRoutes(files: TrackedFile[]): ProseRouteGroup[] {
    const routes = files.map((file) => selectRoute(file)).filter((route) => route !== undefined);
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
 * Runs Vale on the scope files, by path where Vale has a grammar and through stdin elsewhere.
 * @param input the scope to check.
 * @returns the findings.
 */
export async function checkVale(input: CheckInput): Promise<Finding[]> {
    if (!hasValePackages(input.installedRoot, input.settingsFile.settings.level))
        throw new GspotError('tool', 'The Vale packages are not installed. Run: gspot install');
    const groups = groupRoutes(input.files.filter((file) => file.kind === 'source'));
    const findings: Finding[] = [];
    for (const group of groups) {
        const [first] = group;
        const alerts = first.mode === 'path' ? await runValeOnPaths(input, group) : await runValeOnStdin(input, first);
        findings.push(
            ...alerts.map((alert) =>
                buildFinding(
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
