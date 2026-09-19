// Copied blocks through jscpd: every clone is a finding that names both places, once the duplicated share passes the ceiling.
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { run } from '#cli/platform/spawn.ts';
import type { EngineInput } from '#types/run.ts';
import type { Finding } from '#types/finding.ts';
import { locateTool } from '#cli/platform/tool-probe.ts';
import type { ClonePlace, CloneReport } from '#types/integrity.ts';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';

const TOOL = 'jscpd';
const SCAN_TIMEOUT_MS = 600_000;
const DEFAULT_CEILING = 4;

function relative(root: string, place: ClonePlace): string {
    return place.name.startsWith(`${root}/`) ? place.name.slice(root.length + 1) : place.name;
}

/**
 * The findings of a jscpd report: none while the duplicated share is at or under the ceiling, then one for each clone in a claimed file.
 * @param report the parsed report
 * @param shape the check id, the repository root, the ceiling out of 100, and the claimed paths
 * @param shape.check the check id
 * @param shape.root the repository root
 * @param shape.ceiling the largest duplicated share accepted, out of 100
 * @param shape.claimed the paths the check claims
 * @returns the findings
 */
export function cloneFindings(
    report: CloneReport,
    shape: { check: string; root: string; ceiling: number; claimed: Set<string> },
): Finding[] {
    const share = report.statistics?.total?.percentage ?? 0;
    if (share <= shape.ceiling) return [];
    return (report.duplicates ?? []).flatMap((clone): Finding[] => {
        const file = relative(shape.root, clone.firstFile);
        if (!shape.claimed.has(file)) return [];
        const other = `${relative(shape.root, clone.secondFile)}:${String(clone.secondFile.start)}`;
        return [
            {
                check: shape.check,
                file,
                line: clone.firstFile.start,
                rule: 'copied-block',
                message: `${String(clone.lines)} lines repeat ${other}. The duplicated share is ${share.toFixed(1)} of 100, over the ceiling of ${String(shape.ceiling)}.`,
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
export async function copiedBlocks(input: EngineInput): Promise<Finding[]> {
    const binary = locateTool(input.root, TOOL);
    if (binary === undefined) throw new Error('The jscpd command is not installed.');
    const work = mkdtempSync(join(tmpdir(), 'gspot-jscpd-'));
    try {
        const claimed = input.files.filter((file) => file.nature === 'source').map((file) => file.path);
        const shipped = JSON.parse(readFileSync(join(input.root, '.gspot/jscpd.json'), 'utf8')) as Record<
            string,
            unknown
        >;
        // The file list goes into a configuration of its own: a long list overflows a command line, and jscpd reads paths from its configuration.
        const config = join(work, 'jscpd.json');
        writeFileSync(config, JSON.stringify({ ...shipped, path: claimed.map((path) => join(input.root, path)) }));
        const argv = [binary, '--config', config, '--reporters', 'json', '--output', work, '--silent'];
        const result = await run(argv, { cwd: input.root, timeoutMs: SCAN_TIMEOUT_MS });
        const path = join(work, 'jscpd-report.json');
        if (!existsSync(path))
            throw new Error(`The jscpd command wrote no report: ${result.stderr.trim().split('\n').at(-1) ?? ''}`);
        const named = input.view.settings['limits.duplication.threshold_percent'];
        return cloneFindings(JSON.parse(readFileSync(path, 'utf8')) as CloneReport, {
            check: input.spec.id,
            root: input.root,
            ceiling: typeof named === 'number' ? named : DEFAULT_CEILING,
            claimed: new Set(claimed),
        });
    } finally {
        rmSync(work, { recursive: true, force: true });
    }
}
