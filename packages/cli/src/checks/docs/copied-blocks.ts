import { z } from 'zod';
import { tmpdir } from 'node:os';
import { toPosix } from '#cli/platform/paths.ts';
import { openRoot } from '#cli/platform/filesystem.ts';
import { readSource } from '#cli/repository/tracked.ts';
import { runCheckCommand } from '#cli/execution/tool/runner.ts';
import { FULL_PERCENTAGE } from '#cli/config/checks/typescript.ts';
import { rmSync, statSync, mkdtempSync, writeFileSync } from 'node:fs';
import { JSCPD_TOOL, DEFAULT_CEILING } from '#cli/config/checks/docs.ts';
import { join, relative, isAbsolute, toNamespacedPath } from 'node:path';
import type { Finding, CloneReport, EngineInput } from '#cli/types/checks.ts';

const clonePlaceSchema = z.object({
    name: z.string().min(1),
    start: z.number().int().positive(),
    end: z.number().int().positive(),
});
export const cloneReportSchema = z.object({
    statistics: z.object({ total: z.object({ percentage: z.number().min(0).max(FULL_PERCENTAGE) }) }),
    duplicates: z.array(
        z.object({ lines: z.number().int().positive(), firstFile: clonePlaceSchema, secondFile: clonePlaceSchema }),
    ),
});

/**
 * The findings of a jscpd report: none while the duplicated share is at or under the ceiling, then one for each clone in a owned file.
 * @param report the parsed report.
 * @param shape the check id, the repository root, the ceiling out of 100, and the owned paths.
 * @param shape.check the check id.
 * @param shape.root the repository root.
 * @param shape.ceiling the largest duplicated share accepted, out of 100.
 * @param shape.owned the paths the check owners.
 * @returns the findings.
 */
export function cloneFindings(
    report: CloneReport,
    shape: { check: string; root: string; ceiling: number; owned: Set<string> },
): Finding[] {
    const share = report.statistics.total.percentage;
    if (share <= shape.ceiling) return [];
    return report.duplicates.flatMap((clone): Finding[] => {
        const file = toPosix(
            isAbsolute(clone.secondFile.name)
                ? relative(toNamespacedPath(shape.root), toNamespacedPath(clone.secondFile.name))
                : clone.secondFile.name,
        );
        if (!shape.owned.has(file)) return [];
        const first = toPosix(
            isAbsolute(clone.firstFile.name)
                ? relative(toNamespacedPath(shape.root), toNamespacedPath(clone.firstFile.name))
                : clone.firstFile.name,
        );
        const other = `${first}:${String(clone.firstFile.start)}`;
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
        const owned = input.files.filter((file) => file.kind === 'source').map((file) => file.path);
        const files = openRoot(input.root);
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
        writeFileSync(config, JSON.stringify({ ...shipped, path: owned.map((path) => join(input.root, path)) }));
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
                owned: new Set(owned),
            },
        );
    } finally {
        rmSync(work, { recursive: true, force: true });
    }
}
