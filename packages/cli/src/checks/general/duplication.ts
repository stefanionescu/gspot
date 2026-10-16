import { z } from 'zod';
import { statSync, writeFileSync } from 'node:fs';
import { findingAt } from '#cli/checks/finding.ts';
import { parseJsonFile } from '#cli/parsers/json.ts';
import { openFiles } from '#cli/system/files/open.ts';
import { FULL_PERCENTAGE } from '#cli/config/units.ts';
import { readBytes } from '#cli/system/files/reads.ts';
import type { SchemaShape } from '#cli/types/objects.ts';
import { convertToPosixPath } from '#cli/system/paths.ts';
import { runCheckTool } from '#cli/execution/command/tool.ts';
import { listCoveredFiles } from '#cli/repository/coverage.ts';
import { createScratchFolder } from '#cli/system/files/folders.ts';
import { toolOutputDetail } from '#cli/execution/command/output.ts';
import { TOOL_FILE_DIRECTORY } from '#cli/config/system/locations.ts';
import { join, relative, isAbsolute, toNamespacedPath } from 'node:path';
import { filterSourceConfigurations } from '#cli/configurations/select.ts';
import { type Finding, type CheckInput } from '#cli/types/execution/check.ts';

import {
    JSCPD,
    JSCPD_ARGUMENTS,
    JSCPD_CONFIG_FILE,
    JSCPD_REPORT_FILE,
} from '#cli/config/checks/general/duplication.ts';

const clonePlaceSchema = z.object({
    name: z.string().min(1),
    start: z.number().int().positive(),
    end: z.number().int().positive(),
} satisfies SchemaShape<{ name: string; start: number; end: number }>);

const cloneReportSchema = z.object({
    statistics: z.object({
        total: z.object({ percentage: z.number().min(0).max(FULL_PERCENTAGE) } satisfies SchemaShape<{
            percentage: number;
        }>),
    } satisfies SchemaShape<{ total: { percentage: number } }>),
    duplicates: z.array(
        z.object({
            lines: z.number().int().positive(),
            firstFile: clonePlaceSchema,
            secondFile: clonePlaceSchema,
        } satisfies SchemaShape<{
            lines: number;
            firstFile: { name: string; start: number; end: number };
            secondFile: { name: string; start: number; end: number };
        }>),
    ),
} satisfies SchemaShape<{
    statistics: { total: { percentage: number } };
    duplicates: {
        lines: number;
        firstFile: { name: string; start: number; end: number };
        secondFile: { name: string; start: number; end: number };
    }[];
}>);

/**
 * Runs jscpd over the scope and reports the clones.
 * @param input the check input.
 * @returns the findings.
 */
export async function jscpd(input: CheckInput): Promise<Finding[]> {
    using workFolder = createScratchFolder();
    const work = workFolder.path;
    const owned = [
        ...new Set(
            filterSourceConfigurations(input.selection.selected).flatMap((manifest) =>
                listCoveredFiles(manifest.files, input.files, {
                    selected: input.selection.selected,
                    scope: input.selection.scope.path,
                    view: input.selection.view,
                })
                    .filter((file) => file.kind === 'source')
                    .map((file) => file.path),
            ),
        ),
    ];
    using files = openFiles(input.root);
    const generated = files.read(`${TOOL_FILE_DIRECTORY}/${JSCPD_CONFIG_FILE}`);
    if (generated === undefined)
        throw new Error(`Missing ${TOOL_FILE_DIRECTORY}/${JSCPD_CONFIG_FILE}. Run gspot apply.`);
    const shipped = parseJsonFile(`${TOOL_FILE_DIRECTORY}/${JSCPD_CONFIG_FILE}`, generated.bytes.toString('utf8'));
    // The file list goes into a configuration of its own: a long list overflows a command line, and jscpd reads paths from its configuration.
    const config = join(work, JSCPD_CONFIG_FILE);
    writeFileSync(config, JSON.stringify({ ...shipped, path: owned.map((path) => join(input.root, path)) }));
    const argv = [JSCPD, '--config', config, ...JSCPD_ARGUMENTS, '--output', work];
    const result = await runCheckTool(input, argv, { cwd: input.root });
    if (result.code !== 0) throw new Error(`The jscpd command failed: ${toolOutputDetail(result)}`);
    const path = join(work, JSCPD_REPORT_FILE);
    if (statSync(path, { throwIfNoEntry: false }) === undefined)
        throw new Error(`The jscpd command wrote no report: ${toolOutputDetail(result)}`);
    const limit = input.selection.view.options('limits').duplicate_percent;
    const report = cloneReportSchema.parse(JSON.parse(readBytes(work, JSCPD_REPORT_FILE).toString('utf8')));
    const share = report.statistics.total.percentage;
    if (share <= limit) return [];
    const repositoryPath = (name: string): string =>
        convertToPosixPath(isAbsolute(name) ? relative(toNamespacedPath(input.root), toNamespacedPath(name)) : name);
    return report.duplicates.flatMap((clone): Finding[] => {
        const file = repositoryPath(clone.secondFile.name);
        if (!owned.includes(file)) return [];
        const first = repositoryPath(clone.firstFile.name);
        const other = `${first}:${String(clone.firstFile.start)}`;
        return [
            findingAt(
                input,
                { file, line: clone.secondFile.start },
                'clone',
                `${String(clone.lines)} lines repeat ${other}. The duplicated share is ${share.toFixed(1)} of 100, over the limit of ${String(limit)}.`,
            ),
        ];
    });
}
