import { toPosix } from '#cli/platform/paths.ts';
import { statSync, writeFileSync } from 'node:fs';
import { readSource } from '#cli/platform/source.ts';
import { openRoot } from '#cli/platform/root/open.ts';
import { parseJsonRecord } from '#cli/parsers/json.ts';
import { scratchFolder } from '#cli/platform/scratch.ts';
import { runEngineTool } from '#cli/execution/command/runner.ts';
import { JSCPD } from '#cli/config/checks/general/duplication.ts';
import { toolOutputDetail } from '#cli/execution/command/failures.ts';
import { cloneReportSchema } from '#cli/parsers/schema/duplication.ts';
import { join, relative, isAbsolute, toNamespacedPath } from 'node:path';
import type { Finding, EngineInput } from '#cli/types/execution/runtime.ts';
import { CONFIGURATION_DIRECTORY } from '#cli/config/platform/locations.ts';
import type { CloneScope, CloneReport } from '#cli/types/checks/general/duplication.ts';

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
 * @param input the engine input
 * @returns the findings
 */
export async function jscpd(input: EngineInput): Promise<Finding[]> {
    using workFolder = scratchFolder('gspot-jscpd-');
    const work = workFolder.path;
    const owned = input.files.filter((file) => file.kind === 'source').map((file) => file.path);
    using files = openRoot(input.root);
    const generated = files.read(`${CONFIGURATION_DIRECTORY}/jscpd.json`);
    if (generated === undefined) throw new Error(`Missing ${CONFIGURATION_DIRECTORY}/jscpd.json. Run gspot apply.`);
    const shipped = parseJsonRecord(generated.bytes.toString('utf8'));
    // The file list goes into a configuration of its own: a long list overflows a command line, and jscpd reads paths from its configuration.
    const config = join(work, 'jscpd.json');
    writeFileSync(config, JSON.stringify({ ...shipped, path: owned.map((path) => join(input.root, path)) }));
    const argv = [JSCPD, '--config', config, '--reporters', 'json', '--output', work, '--silent'];
    const result = await runEngineTool(input, argv, { cwd: input.root });
    if (result.code !== 0)
        throw new Error(`The jscpd command failed: ${toolOutputDetail(result, 'The tool printed no diagnostic.')}`);
    const path = join(work, 'jscpd-report.json');
    if (statSync(path, { throwIfNoEntry: false }) === undefined)
        throw new Error(
            `The jscpd command wrote no report: ${toolOutputDetail(result, 'The tool printed no diagnostic.')}`,
        );
    const ceiling = input.view.settings['limits.duplication.percent'] as number;
    return cloneFindings(cloneReportSchema.parse(JSON.parse(readSource(work, 'jscpd-report.json').toString('utf8'))), {
        check: input.spec.name,
        root: input.root,
        ceiling,
        owned: new Set(owned),
    });
}
