import { read } from '#cli/system/files/reads.ts';
import { CONFIG_FLAG } from '#cli/config/flags.ts';
import { GspotError } from '#cli/system/errors.ts';
import { GSPOT_PATHS } from '#cli/config/files/gspot.ts';
import { runCheckTool } from '#cli/runs/command/tool.ts';
import { hasValePackages } from '#cli/installers/vale.ts';
import type { CheckSession } from '#cli/types/session.ts';
import type { PlannedCheck } from '#cli/types/planning.ts';
import type { CheckFinding } from '#cli/types/runs/check.ts';
import { parseToolOutput } from '#cli/parsers/formats/json.ts';
import { join, dirname, relative, isAbsolute } from 'node:path';
import { VALE_TOOL, PROSE_GRAMMARS } from '#cli/config/prose.ts';
import { splitFileArguments } from '#cli/runs/command/batches.ts';
import type { TrackedFile } from '#cli/types/repository/files.ts';
import type { SpawnResult } from '#cli/types/system/processes.ts';
import { SCRIPT_TAG } from '#cli/config/repository/files/classify.ts';
import { valeOutputSchema } from '#cli/schemas/checks/general/prose.ts';
import { extractExtension, convertToPosixPath } from '#cli/system/paths.ts';
import type { ValeAlert, ProseRoute, ProseRouteBatch } from '#cli/types/checks/general/prose.ts';

import {
    VALE_NAME,
    NO_OUTPUT,
    SCRIPT_GRAMMAR,
    VALE_ARGUMENTS,
    VALE_ERROR_LINE,
    VALE_PACKAGES_MESSAGE,
} from '#cli/config/checks/general/prose.ts';

function parseValeAlerts(stdout: string): ValeAlert[] {
    return Object.entries(parseToolOutput(VALE_NAME, stdout, valeOutputSchema)).flatMap(([file, alerts]) =>
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
    const reason = lines.find((line) => VALE_ERROR_LINE.test(line)) ?? lines[0] ?? NO_OUTPUT;
    throw new GspotError('check', `Vale did not run (exit ${String(result.code)}): ${reason.trim()}`);
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
    const text = read(session.cache, route.path);
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

function listRouteBatches(files: TrackedFile[]): ProseRouteBatch[] {
    const routes = files.map((file) => selectRoute(file)).filter((route) => route !== undefined);
    const pathRoutes = routes.filter((each) => each.mode === 'path');
    const byExtension = Map.groupBy(pathRoutes, (route) => route.extension)
        .values()
        .map((group) => group as ProseRouteBatch)
        .toArray();
    return [...byExtension, ...routes.filter((each) => each.mode === 'stdin').map((route): ProseRouteBatch => [route])];
}

/**
Runs Vale on the scope files, by path where Vale has a grammar and through stdin elsewhere.

@param session the repository and its tools.
@param planned the scope to check.
*/
export async function checkVale(session: CheckSession, planned: PlannedCheck): Promise<CheckFinding[]> {
    if (!hasValePackages(session.toolsRoot, session.settings.level))
        throw new GspotError('tool', VALE_PACKAGES_MESSAGE);
    const command = [VALE_TOOL, CONFIG_FLAG, join(session.root, GSPOT_PATHS.valeConfigFile), ...VALE_ARGUMENTS];
    const folder = dirname(join(session.root, GSPOT_PATHS.valeConfigFile));
    const groups = listRouteBatches(
        planned.files.filter(
            (file) => file.kind === 'source' && (session.settings.level === 'all' || file.tags.includes('markdown')),
        ),
    );
    const batches: Promise<ValeAlert[]>[] = [];
    for (const group of groups) {
        const [first] = group;
        if (first.mode === 'path')
            batches.push(Promise.resolve(await runValeOnPaths(session, planned, group, command, folder)));
        else batches.push(runValeOnStdin(session, planned, first, command, folder));
    }
    const results = await Promise.all(batches);
    return results.flatMap((alerts) =>
        alerts.map((alert) => ({
            file: alert.file,
            line: alert.line,
            column: alert.column,
            rule: alert.check,
            message: alert.message,
        })),
    );
}
