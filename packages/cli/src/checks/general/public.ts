import { statSync, writeFileSync } from 'node:fs';
import { findingAt } from '#cli/checks/finding.ts';
import { parseJsonRecord } from '#cli/parsers/public.ts';
import { scratchFolder } from '#cli/platform/scratch.ts';
import { ownedBy } from '#cli/repository/selection/public.ts';
import { parseAlerts } from '#cli/parsers/output/contracts.ts';
import { runCheckTool } from '#cli/execution/command/public.ts';
import type { CheckInput } from '#cli/types/execution/check.ts';
import { SCRIPT_TAG } from '#cli/config/checks/language/bash.ts';
import { PROSE_GRAMMARS } from '#cli/config/generation/prose.ts';
import { targetInScope } from '#cli/configurations/contracts.ts';
import { JSCPD } from '#cli/config/checks/general/duplication.ts';
import { toPosix, extensionOf } from '#cli/platform/contracts.ts';
import type { SpawnResult } from '#cli/types/platform/runtime.ts';
import { openRoot, readSource } from '#cli/platform/root/public.ts';
import { SCRIPT_GRAMMAR } from '#cli/config/checks/general/prose.ts';
import { sourceConfigurations } from '#cli/configurations/public.ts';
import { hasValePackages } from '#cli/lifecycle/install/contracts.ts';
import type { TrackedFile } from '#cli/types/repository/inventory.ts';
import { toolOutputDetail } from '#cli/execution/command/contracts.ts';
import { cloneReportSchema } from '#cli/parsers/schema/duplication.ts';
import type { Finding, ValeAlert } from '#cli/types/parsers/output.ts';
import { join, relative, isAbsolute, toNamespacedPath } from 'node:path';
import { fileBatches } from '#cli/execution/command/arguments/contracts.ts';
import type { ProseRoute, ProseRouteGroup } from '#cli/types/checks/general/prose.ts';
import type { CloneScope, CloneReport } from '#cli/types/checks/general/duplication.ts';
import { VALE_CONFIG, CONFIGURATION_DIRECTORY } from '#cli/config/platform/locations.ts';

// Vale runs with --no-exit, so alerts leave the exit code at 0. Any other code means Vale itself failed, and that is never a pass.
function assertValeRan(result: SpawnResult): void {
    if (result.code === 0 && !result.missing) return;
    const lines = `${result.stderr}\n${result.stdout}`.split('\n').filter((line) => line.trim() !== '');
    const reason = lines.find((line) => /(?:^E\d+)|(?:not found)|(?:error)/iu.test(line)) ?? lines[0] ?? 'no output';
    throw new Error(`Vale did not run (exit ${String(result.code)}): ${reason.trim()}`);
}

function valeCommand(input: CheckInput): string[] {
    let configuration = VALE_CONFIG;
    if (input.scope !== '') {
        const declaration = input.selection.selected
            .find((manifest) => manifest.configuration.name === 'prose')
            ?.toolFiles.find((file) => file.source === 'vale.ini.eta' && file.per_scope);
        if (declaration === undefined) throw new Error('The prose configuration has no scoped Vale tool file.');
        configuration = targetInScope(input.scope, declaration);
    }
    return ['vale', '--config', join(input.root, configuration), '--output', 'JSON', '--no-exit'];
}

async function pathAlerts(input: CheckInput, routes: ProseRoute[]): Promise<ValeAlert[]> {
    const base = valeCommand(input);
    const alerts: ValeAlert[] = [];
    for (const batch of fileBatches(
        routes.map((route) => route.path),
        base,
        process.platform,
    )) {
        const result = await runCheckTool(input, [...base, ...batch], { cwd: input.root });
        assertValeRan(result);
        alerts.push(...parseAlerts(result.stdout));
    }
    return alerts.map((alert) => ({
        ...alert,
        file: toPosix(isAbsolute(alert.file) ? relative(input.root, alert.file) : alert.file),
    }));
}

async function stdinAlerts(input: CheckInput, route: ProseRoute): Promise<ValeAlert[]> {
    const text = readSource(input.root, route.path, input.reads).toString('utf8');
    const result = await runCheckTool(
        input,
        [...valeCommand(input), `--ext=${route.extension}`, `--path=${route.path}${route.extension}`],
        {
            cwd: input.root,
            stdin: text,
        },
    );
    assertValeRan(result);
    return parseAlerts(result.stdout).map((alert) => ({
        ...alert,
        file: route.path,
    }));
}

/**
 * Runs Vale over the scope's files, by path where Vale has a grammar and through stdin elsewhere. Every alert is a finding.
 * @param input the check input
 * @returns the findings
 */
export async function vale(input: CheckInput): Promise<Finding[]> {
    if (!hasValePackages(input.installedRoot ?? input.root, input.policyFiles.policy.level))
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

/**
 * The findings of a jscpd report: none while the duplicated share is at or under the ceiling, then one for each clone in a checked file.
 * @param report the parsed report.
 * @param context the check id, the repository root, the ceiling out of 100, and the owned paths.
 * @param context.check the check id.
 * @param context.root the repository root.
 * @param context.ceiling the largest duplicated share accepted, out of 100.
 * @param context.owned the paths the check owns.
 * @returns the findings.
 */
export function cloneFindings(report: CloneReport, context: CloneScope): Finding[] {
    const share = report.statistics.total.percentage;
    if (share <= context.ceiling) return [];

    const repositoryPath = (name: string): string =>
        toPosix(isAbsolute(name) ? relative(toNamespacedPath(context.root), toNamespacedPath(name)) : name);
    return report.duplicates.flatMap((clone): Finding[] => {
        const file = repositoryPath(clone.secondFile.name);
        if (!context.owned.has(file)) return [];
        const first = repositoryPath(clone.firstFile.name);
        const other = `${first}:${String(clone.firstFile.start)}`;
        return [
            {
                check: context.check,
                file,
                line: clone.secondFile.start,
                rule: 'clone',
                message: `${String(clone.lines)} lines repeat ${other}. The duplicated share is ${share.toFixed(1)} of 100, over the ceiling of ${String(context.ceiling)}.`,
                fixable: false,
            },
        ];
    });
}

/**
 * Runs jscpd over the scope and reports the clones.
 * @param input the check input
 * @returns the findings
 */
export async function jscpd(input: CheckInput): Promise<Finding[]> {
    using workFolder = scratchFolder('gspot-jscpd-');
    const work = workFolder.path;
    const owned = [
        ...new Set(
            sourceConfigurations(input.selection.selected).flatMap((manifest) =>
                ownedBy(manifest.files, input.selection.selected, input.files, input.scope, input.view.test_files)
                    .filter((file) => file.kind === 'source')
                    .map((file) => file.path),
            ),
        ),
    ];
    using files = openRoot(input.root);
    const generated = files.read(`${CONFIGURATION_DIRECTORY}/jscpd.json`);
    if (generated === undefined) throw new Error(`Missing ${CONFIGURATION_DIRECTORY}/jscpd.json. Run gspot apply.`);
    const shipped = parseJsonRecord(generated.bytes.toString('utf8'));
    // The file list goes into a configuration of its own: a long list overflows a command line, and jscpd reads paths from its configuration.
    const config = join(work, 'jscpd.json');
    writeFileSync(config, JSON.stringify({ ...shipped, path: owned.map((path) => join(input.root, path)) }));
    const argv = [JSCPD, '--config', config, '--reporters', 'json', '--output', work, '--silent'];
    const result = await runCheckTool(input, argv, { cwd: input.root });
    if (result.code !== 0)
        throw new Error(`The jscpd command failed: ${toolOutputDetail(result, 'The tool printed no diagnostic.')}`);
    const path = join(work, 'jscpd-report.json');
    if (statSync(path, { throwIfNoEntry: false }) === undefined)
        throw new Error(
            `The jscpd command wrote no report: ${toolOutputDetail(result, 'The tool printed no diagnostic.')}`,
        );
    const ceiling = input.view.settings['limits.duplication.percent'] as number;
    return cloneFindings(cloneReportSchema.parse(JSON.parse(readSource(work, 'jscpd-report.json').toString('utf8'))), {
        check: input.check.name,
        root: input.root,
        ceiling,
        owned: new Set(owned),
    });
}
