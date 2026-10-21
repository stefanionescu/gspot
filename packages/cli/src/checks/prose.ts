import { parseReport } from '#cli/parsers/json.ts';
import { GspotError } from '#cli/system/errors.ts';
import { buildFinding } from '#cli/runs/finding.ts';
import { hasValePackages } from '#cli/install/vale.ts';
import { type Finding } from '#cli/types/runs/check.ts';
import { runCheckTool } from '#cli/runs/command/tool.ts';
import { readCachedText } from '#cli/system/files/reads.ts';
import { VALE_ERROR_LINE } from '#cli/config/checks/prose.ts';
import { valeReportSchema } from '#cli/schemas/checks/prose.ts';
import { join, dirname, relative, isAbsolute } from 'node:path';
import { SCRIPT_TAG } from '#cli/config/repository/inventory.ts';
import { splitFileArguments } from '#cli/runs/command/batches.ts';
import { type SpawnResult } from '#cli/types/system/processes.ts';
import type { Session, PlannedCheck } from '#cli/types/planning.ts';
import { VALE_TOOL_FILE_PATH } from '#cli/config/system/locations.ts';
import { VALE_TOOL, VALE_ARGUMENTS } from '#cli/config/tools/vale.ts';
import { type TrackedFile } from '#cli/types/repository/inventory.ts';
import { extractExtension, convertToPosixPath } from '#cli/system/paths.ts';
import { PROSE_GRAMMARS, SCRIPT_GRAMMAR } from '#cli/config/generation/vale.ts';
import { type ValeAlert, type ProseRoute, type ProseRouteGroup } from '#cli/types/checks/prose.ts';

/**
 * Parses the Vale JSON output into alerts.
 *
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

// Vale runs with --no-exit, so alerts leave the exit code at 0. Any other code means Vale itself failed, which never counts as a pass.
function assertValeRan(result: SpawnResult): void {
    if (result.code === 0 && !result.missing) return;
    const lines = `${result.stderr}\n${result.stdout}`.split('\n').filter((line) => line.trim() !== '');
    const reason = lines.find((line) => VALE_ERROR_LINE.test(line)) ?? lines[0] ?? 'no output';
    throw new Error(`Vale did not run (exit ${String(result.code)}): ${reason.trim()}`);
}

function buildValeCommand(session: Session): string[] {
    return [VALE_TOOL, '--config', join(session.root, VALE_TOOL_FILE_PATH), ...VALE_ARGUMENTS];
}

async function runValeOnPaths(
    session: Session,
    planned: PlannedCheck,
    routes: ProseRoute[],
    folder: string,
): Promise<ValeAlert[]> {
    const base = buildValeCommand(session);
    const alerts: ValeAlert[] = [];
    for (const batch of splitFileArguments(
        routes.map((route) => join(session.root, route.path)),
        base,
        process.platform,
    )) {
        const result = await runCheckTool(session, planned, [...base, ...batch], {
            cwd: folder,
        });
        assertValeRan(result);
        alerts.push(...parseValeAlerts(result.stdout));
    }
    return alerts.map((alert) => ({
        ...alert,
        file: convertToPosixPath(
            relative(session.root, isAbsolute(alert.file) ? alert.file : join(folder, alert.file)),
        ),
    }));
}

async function runValeOnStdin(
    session: Session,
    planned: PlannedCheck,
    route: ProseRoute,
    folder: string,
): Promise<ValeAlert[]> {
    const text = readCachedText(session.reads, route.path);
    const result = await runCheckTool(
        session,
        planned,
        [
            ...buildValeCommand(session),
            `--ext=${route.extension}`,
            `--path=${join(session.root, route.path)}${route.extension}`,
        ],
        {
            cwd: folder,
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
 *
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
 *
 * @param files the scope sources.
 * @returns the groups, path-read first.
 */
function groupRoutes(files: TrackedFile[]): ProseRouteGroup[] {
    const routes = files.map((file) => selectRoute(file)).filter((route) => route !== undefined);
    const pathRoutes = routes.filter((entry) => entry.mode === 'path');
    // Map.groupBy creates a group only when its first route exists.
    const byExtension = [...Map.groupBy(pathRoutes, (route) => route.extension).values()].map(
        (group) => group as ProseRouteGroup,
    );
    return [
        ...byExtension,
        ...routes.filter((entry) => entry.mode === 'stdin').map((route): ProseRouteGroup => [route]),
    ];
}

/**
 * Runs Vale on the scope files, by path where Vale has a grammar and through stdin elsewhere.
 *
 * @param session the repository and its tools.
 * @param planned the scope to check.
 * @returns the findings.
 */
export async function checkVale(session: Session, planned: PlannedCheck): Promise<Finding[]> {
    if (!hasValePackages(session.installedRoot, session.settingsFile.settings.level))
        throw new GspotError('tool', 'The Vale packages are not installed. Run: gspot install');
    const folder = dirname(join(session.root, VALE_TOOL_FILE_PATH));
    const groups = groupRoutes(planned.files.filter((file) => file.kind === 'source'));
    const findings: Finding[] = [];
    for (const group of groups) {
        const [first] = group;
        const alerts =
            first.mode === 'path'
                ? await runValeOnPaths(session, planned, group, folder)
                : await runValeOnStdin(session, planned, first, folder);
        findings.push(
            ...alerts.map((alert) =>
                buildFinding(
                    planned,
                    { file: alert.file, line: alert.line, column: alert.column },
                    alert.check,
                    alert.message,
                ),
            ),
        );
    }
    return findings;
}
