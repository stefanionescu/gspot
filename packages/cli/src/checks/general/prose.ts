import { GspotError } from '#cli/system/errors.ts';
import { buildFinding } from '#cli/checks/finding.ts';
import type { Finding } from '#cli/types/runs/check.ts';
import { runCheckTool } from '#cli/runs/command/tool.ts';
import { GSPOT_PATHS } from '#cli/config/gspot-folder.ts';
import { hasValePackages } from '#cli/installers/vale.ts';
import type { CheckSession } from '#cli/types/session.ts';
import type { PlannedCheck } from '#cli/types/planning.ts';
import { readCachedText } from '#cli/system/files/reads.ts';
import { parseToolReport } from '#cli/parsers/formats/json.ts';
import { join, dirname, relative, isAbsolute } from 'node:path';
import { VALE_TOOL, PROSE_GRAMMARS } from '#cli/config/prose.ts';
import { splitFileArguments } from '#cli/runs/command/batches.ts';
import type { TrackedFile } from '#cli/types/repository/files.ts';
import type { SpawnResult } from '#cli/types/system/processes.ts';
import { SCRIPT_TAG } from '#cli/config/repository/files/classify.ts';
import { valeReportSchema } from '#cli/schemas/checks/general/prose.ts';
import { extractExtension, convertToPosixPath } from '#cli/system/paths.ts';
import type { ValeAlert, ProseRoute, ProseRouteGroup } from '#cli/types/checks/general/prose.ts';
import { SCRIPT_GRAMMAR, VALE_ARGUMENTS, VALE_ERROR_LINE } from '#cli/config/checks/general/prose.ts';

function parseValeAlerts(stdout: string): ValeAlert[] {
    return Object.entries(parseToolReport('Vale', stdout, valeReportSchema)).flatMap(([file, alerts]) =>
        alerts.map((alert) => ({
            file: convertToPosixPath(file),
            line: alert.Line,
            column: alert.Span[0],
            check: alert.Check,
            message: alert.Message,
        })),
    );
}

function assertValeRan(result: SpawnResult): void {
    if (result.code === 0 && !result.missing) return;
    const lines = `${result.stderr}\n${result.stdout}`.split('\n').filter((line) => line.trim() !== '');
    const reason = lines.find((line) => VALE_ERROR_LINE.test(line)) ?? lines[0] ?? 'no output';
    throw new Error(`Vale did not run (exit ${String(result.code)}): ${reason.trim()}`);
}

async function runValeOnPaths(
    session: CheckSession,
    planned: PlannedCheck,
    routes: ProseRoute[],
    command: string[],
    folder: string,
): Promise<ValeAlert[]> {
    const alerts: ValeAlert[] = [];
    const batches = splitFileArguments(
        routes.map((route) => join(session.root, route.path)),
        command,
        process.platform,
    );
    for (const batch of batches) {
        const result = await runCheckTool(session, planned, [...command, ...batch], {
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
    session: CheckSession,
    planned: PlannedCheck,
    route: ProseRoute,
    command: string[],
    folder: string,
): Promise<ValeAlert[]> {
    const text = readCachedText(session.reads, route.path);
    const result = await runCheckTool(
        session,
        planned,
        [...command, `--ext=${route.extension}`, `--path=${join(session.root, route.path)}${route.extension}`],
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

function selectRoute(file: TrackedFile): ProseRoute | undefined {
    const extension = extractExtension(file.path);
    const grammar =
        PROSE_GRAMMARS[extension] ?? (extension === '' && file.tags.includes(SCRIPT_TAG) ? SCRIPT_GRAMMAR : undefined);
    return grammar === undefined ? undefined : { path: file.path, mode: grammar.mode, extension: grammar.extension };
}

function groupRoutes(files: TrackedFile[]): ProseRouteGroup[] {
    const routes = files.map((file) => selectRoute(file)).filter((route) => route !== undefined);
    const pathRoutes = routes.filter((each) => each.mode === 'path');
    const byExtension = Map.groupBy(pathRoutes, (route) => route.extension)
        .values()
        .map((group) => group as ProseRouteGroup)
        .toArray();
    return [...byExtension, ...routes.filter((each) => each.mode === 'stdin').map((route): ProseRouteGroup => [route])];
}

/**
Runs Vale on the scope files, by path where Vale has a grammar and through stdin elsewhere.

@param session the repository and its tools.
@param planned the scope to check.
@returns the findings.
*/
export async function checkProseVale(session: CheckSession, planned: PlannedCheck): Promise<Finding[]> {
    if (!hasValePackages(session.toolsRoot, session.settingsFile.settings.level))
        throw new GspotError('tool', 'The Vale packages are not installed. Run gspot install.');
    const command = [VALE_TOOL, '--config', join(session.root, GSPOT_PATHS.valeConfigFile), ...VALE_ARGUMENTS];
    const folder = dirname(join(session.root, GSPOT_PATHS.valeConfigFile));
    const groups = groupRoutes(planned.files.filter((file) => file.kind === 'source'));
    const findings: Finding[] = [];
    for (const group of groups) {
        const [first] = group;
        const alerts =
            first.mode === 'path'
                ? await runValeOnPaths(session, planned, group, command, folder)
                : await runValeOnStdin(session, planned, first, command, folder);
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
