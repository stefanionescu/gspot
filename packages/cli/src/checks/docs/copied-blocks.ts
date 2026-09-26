import { z } from 'zod';
import { tmpdir } from 'node:os';
import { toPosix } from '#cli/platform/paths.ts';
import { readSource } from '#cli/repository/tracked.ts';
import type { CloneReport } from '#cli/types/checks/docs.ts';
import { openConfinedRoot } from '#cli/platform/filesystem.ts';
import { FULL_PERCENTAGE } from '#cli/constants/checks/jest.ts';
import { runCheckCommand } from '#cli/execution/tool-runner.ts';
import { mkdtempSync, rmSync, writeFileSync, statSync } from 'node:fs';
import type { EngineInput, Finding } from '#cli/types/checks/checks.ts';
import { isAbsolute, join, relative, toNamespacedPath } from 'node:path';
import { DEFAULT_CEILING, JSCPD_TOOL } from '#cli/constants/checks/docs.ts';

const clonePlaceSchema = z.object({
    name: z.string().min(1),
    start: z.number().int().positive(),
    end: z.number().int().positive(),
});
function relativePlace(root: string, place: z.infer<typeof clonePlaceSchema>): string {
    return toPosix(
        isAbsolute(place.name) ? relative(toNamespacedPath(root), toNamespacedPath(place.name)) : place.name,
    );
}

export const cloneReportSchema = z.object({
    statistics: z.object({ total: z.object({ percentage: z.number().min(0).max(FULL_PERCENTAGE) }) }),
    duplicates: z.array(
        z.object({ lines: z.number().int().positive(), firstFile: clonePlaceSchema, secondFile: clonePlaceSchema }),
    ),
});

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
    const share = report.statistics.total.percentage;
    if (share <= shape.ceiling) return [];
    return report.duplicates.flatMap((clone): Finding[] => {
        const file = relativePlace(shape.root, clone.secondFile);
        if (!shape.claimed.has(file)) return [];
        const other = `${relativePlace(shape.root, clone.firstFile)}:${String(clone.firstFile.start)}`;
        return [
            {
                check: shape.check,
                file,
                line: clone.secondFile.start,
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
    const work = mkdtempSync(join(tmpdir(), 'gspot-jscpd-'));
    try {
        const claimed = input.files.filter((file) => file.nature === 'source').map((file) => file.path);
        const files = openConfinedRoot(input.root);
        let content: Buffer;
        try {
            const config = files.read('.gspot/config/jscpd.json');
            if (config === undefined) throw new Error('Missing .gspot/jscpd.json. Run: gspot apply');
            content = config.bytes;
        } finally {
            files.close();
        }
        const shipped = JSON.parse(content.toString('utf8')) as Record<string, unknown>;
        // The file list goes into a configuration of its own: a long list overflows a command line, and jscpd reads paths from its configuration.
        const config = join(work, 'jscpd.json');
        writeFileSync(config, JSON.stringify({ ...shipped, path: claimed.map((path) => join(input.root, path)) }));
        const argv = [JSCPD_TOOL, '--config', config, '--reporters', 'json', '--output', work, '--silent'];
        const result = await runCheckCommand(input, argv, { cwd: input.root });
        if (result.code !== 0)
            throw new Error(`The jscpd command failed: ${result.stderr.trim().split('\n').at(-1) ?? ''}`);
        const path = join(work, 'jscpd-report.json');
        if (statSync(path, { throwIfNoEntry: false }) === undefined)
            throw new Error(`The jscpd command wrote no report: ${result.stderr.trim().split('\n').at(-1) ?? ''}`);
        const named = input.view.settings['limits.duplication.threshold_percent'];
        return cloneFindings(
            cloneReportSchema.parse(JSON.parse(readSource(work, 'jscpd-report.json').toString('utf8'))),
            {
                check: input.spec.name,
                root: input.root,
                ceiling: typeof named === 'number' ? named : DEFAULT_CEILING,
                claimed: new Set(claimed),
            },
        );
    } finally {
        rmSync(work, { recursive: true, force: true });
    }
}
