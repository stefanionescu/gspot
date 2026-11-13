import { dirname, join } from 'node:path';

import {
    AMBIGUOUS_DATE,
    DATE_RULE,
    NO_OUTPUT,
    PROSE_GRAMMARS,
    SCRIPT_GRAMMAR,
    VALE_ARGUMENTS,
    VALE_ERROR_LINE,
    VALE_MESSAGE_RULES,
} from '#cli/config/configurations/prose.ts';
import { GSPOT_PATHS } from '#cli/config/manifests.ts';
import { SCRIPT_TAG } from '#cli/config/parsers/code.ts';
import { CONFIG_FLAG } from '#cli/config/tools/installers.ts';
import { VALE_PACKAGES_MESSAGE, VALE_TOOL } from '#cli/config/tools/vale.ts';
import { readCommitMessage } from '#cli/configurations/general/commits/checks.ts';
import { parseOutput } from '#cli/engine/outputs/formats.ts';
import { splitFileArguments } from '#cli/engine/run/tool-runs/batches.ts';
import { runCheckTool } from '#cli/engine/run/tool-runs/tool.ts';
import { parseComments } from '#cli/parsers/code/comments.ts';
import { listMarkdownTexts } from '#cli/parsers/formats/markdown.ts';
import { CheckStop } from '#cli/system/errors.ts';
import { readText } from '#cli/system/files/reads.ts';
import { extractExtension } from '#cli/system/paths.ts';
import { hasValePackages } from '#cli/tools/installers/vale.ts';
import type { ProseRoute, ProseRouteBatch } from '#cli/types/configurations/general.ts';
import type { PlannedCheck } from '#cli/types/engine/plan.ts';
import type { CheckCode, CheckFinding, CheckSession } from '#cli/types/engine/run.ts';
import type { TrackedFile } from '#cli/types/repository.ts';
import type { SpawnResult } from '#cli/types/system.ts';

function assertValeRan(result: SpawnResult): void {
    if (result.code === 0 && result.end !== 'missing') return;
    const lines = `${result.stderr}\n${result.stdout}`.split('\n').filter((line) => line.trim() !== '');
    const reason = lines.find((line) => VALE_ERROR_LINE.test(line)) ?? lines[0] ?? NO_OUTPUT;
    throw new CheckStop('error', `Vale did not run (exit ${String(result.code)}): ${reason.trim()}`);
}

async function runVale(
    session: CheckSession,
    planned: PlannedCheck,
    args: string[],
    run: { cwd: string; stdin?: string },
): Promise<CheckFinding[]> {
    const result = await runCheckTool(session, planned, args, run);
    assertValeRan(result);
    return parseOutput(planned.check, result.stdout, result.stderr, { root: session.root, cwd: run.cwd });
}

async function runValeOnPaths(
    session: CheckSession,
    planned: PlannedCheck,
    { routes, command, folder }: { routes: ProseRoute[]; command: string[]; folder: string },
): Promise<CheckFinding[]> {
    const batches = splitFileArguments(
        routes.map((route) => join(session.root, route.path)),
        command,
        process.platform,
    );
    const findings = await Promise.all(
        batches.map((batch) => runVale(session, planned, [...command, ...batch], { cwd: folder })),
    );
    return findings.flat();
}

async function runValeOnStdin(
    session: CheckSession,
    planned: PlannedCheck,
    { route, command, folder }: { route: ProseRoute; command: string[]; folder: string },
): Promise<CheckFinding[]> {
    const findings = await runVale(
        session,
        planned,
        [...command, `--ext=${route.extension}`, `--path=${join(session.root, route.path)}${route.extension}`],
        { cwd: folder, stdin: readText(session.cache, route.path) },
    );
    return findings.map((finding) => ({ ...finding, file: route.path }));
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

async function listFileDates(session: CheckSession, file: TrackedFile): Promise<CheckFinding[]> {
    const source = readText(session.cache, file.path);
    const texts = file.tags.includes('markdown')
        ? listMarkdownTexts(source)
        : await parseComments(file.path, source, file.tags, session);
    return texts.flatMap(({ line, text }) =>
        text
            .matchAll(AMBIGUOUS_DATE)
            .map((match) => ({
                file: file.path,
                line: line + text.slice(0, match.index).split('\n').length - 1,
                rule: DATE_RULE,
                message: `Ambiguous date ${match[0]}. Write an ISO date, such as 2026-09-17, or the month name.`,
            }))
            .toArray(),
    );
}

/**
Runs Vale on the scope files, by path where Vale has a grammar and through stdin elsewhere. Every batch starts at
once, and the process limit of the session bounds how many run.
*/
async function checkVale(session: CheckSession, planned: PlannedCheck): Promise<CheckFinding[]> {
    if (!hasValePackages(session.toolsRoot)) throw new CheckStop('missing', VALE_PACKAGES_MESSAGE);
    const command = [VALE_TOOL, CONFIG_FLAG, join(session.root, GSPOT_PATHS.valeConfig), ...VALE_ARGUMENTS];
    const folder = dirname(join(session.root, GSPOT_PATHS.valeConfig));
    const groups = listRouteBatches(planned.files.filter((file) => file.kind === 'source'));
    const results = await Promise.all(
        groups.map((group) =>
            group[0].mode === 'path'
                ? runValeOnPaths(session, planned, { routes: group, command, folder })
                : runValeOnStdin(session, planned, { route: group[0], command, folder }),
        ),
    );
    return results.flat();
}

async function checkCommitMessage(session: CheckSession, planned: PlannedCheck): Promise<CheckFinding[]> {
    const messageFile = session.selection?.messageFile;
    if (messageFile === undefined) return [];
    const { text, prefix } = await readCommitMessage(session, messageFile);
    const lines = text.split('\n').map((line) => (line.startsWith(prefix) ? '' : line));
    const folder = dirname(join(session.root, GSPOT_PATHS.valeMessageConfig));
    const findings = await runVale(
        session,
        planned,
        [
            VALE_TOOL,
            CONFIG_FLAG,
            join(session.root, GSPOT_PATHS.valeMessageConfig),
            ...VALE_ARGUMENTS,
            '--ext=.md',
            `--filter=.Name in ${JSON.stringify(VALE_MESSAGE_RULES)}`,
        ],
        { cwd: folder, stdin: lines.join('\n') },
    );
    return findings.map(({ line, column: _column, message, ...finding }) => ({
        ...finding,
        file: '',
        message: `Line ${String(line)}: ${message}`,
    }));
}

async function checkDates(session: CheckSession, planned: PlannedCheck): Promise<CheckFinding[]> {
    const files = planned.files.filter((file) => file.kind === 'source');
    const findings = await Promise.all(files.map((file) => listFileDates(session, file)));
    return findings.flat();
}

export const PROSE_CHECKS: Readonly<Record<string, CheckCode>> = {
    'prose/commit-message': { check: checkCommitMessage },
    'prose/dates': { check: checkDates },
    'prose/vale': { check: checkVale },
};
