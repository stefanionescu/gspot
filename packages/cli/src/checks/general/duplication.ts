import { z } from 'zod';
import { statSync, writeFileSync } from 'node:fs';
import { parseJsonFile } from '#cli/parsers/json.ts';
import { buildFinding } from '#cli/checks/finding.ts';
import { openFiles } from '#cli/system/files/open.ts';
import { readBytes } from '#cli/system/files/reads.ts';
import type { SchemaShape } from '#cli/types/shapes.ts';
import { parseReport } from '#cli/parsers/output/json.ts';
import { convertToPosixPath } from '#cli/system/paths.ts';
import { runCheckTool } from '#cli/checks/run/command/tool.ts';
import { listCoveredFiles } from '#cli/repository/coverage.ts';
import { createScratchFolder } from '#cli/system/files/folders.ts';
import { TOOL_FILES_FOLDER } from '#cli/config/system/locations.ts';
import { formatOutputTail } from '#cli/checks/run/command/output.ts';
import { join, relative, isAbsolute, toNamespacedPath } from 'node:path';
import { filterSourceConfigurations } from '#cli/configurations/select.ts';
import { type Finding, type CheckInput } from '#cli/types/checks/run/check.ts';
import { JSCPD, JSCPD_ARGUMENTS, JSCPD_TOOL_FILE, JSCPD_REPORT_FILE } from '#cli/config/checks/general/duplication.ts';

const clonePlaceSchema = z.object({
    name: z.string().min(1),
    start: z.number().int().positive(),
    end: z.number().int().positive(),
} satisfies SchemaShape<{ name: string; start: number; end: number }>);

const cloneReportSchema = z.object({
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
    duplicates: {
        lines: number;
        firstFile: { name: string; start: number; end: number };
        secondFile: { name: string; start: number; end: number };
    }[];
}>);

/**
 * Runs jscpd over the scope and reports the clones.
 * @param input the scope whose source files to compare.
 * @returns the findings.
 */
export async function checkJscpd(input: CheckInput): Promise<Finding[]> {
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
    const generated = files.read(`${TOOL_FILES_FOLDER}/${JSCPD_TOOL_FILE}`);
    if (generated === undefined) throw new Error(`Missing ${TOOL_FILES_FOLDER}/${JSCPD_TOOL_FILE}. Run gspot apply.`);
    const shipped = parseJsonFile(`${TOOL_FILES_FOLDER}/${JSCPD_TOOL_FILE}`, generated.bytes.toString('utf8'));
    // A long file list overflows a command line, so the paths go into a tool file of their own.
    const toolFile = join(work, JSCPD_TOOL_FILE);
    writeFileSync(toolFile, JSON.stringify({ ...shipped, path: owned.map((path) => join(input.root, path)) }));
    const commandArguments = [JSCPD, '--config', toolFile, ...JSCPD_ARGUMENTS, '--output', work];
    const result = await runCheckTool(input, commandArguments, { cwd: input.root });
    if (result.code !== 0) throw new Error(`The jscpd command failed: ${formatOutputTail(result)}`);
    const path = join(work, JSCPD_REPORT_FILE);
    if (statSync(path, { throwIfNoEntry: false }) === undefined)
        throw new Error(`The jscpd command wrote no report: ${formatOutputTail(result)}`);
    const report = parseReport('jscpd', readBytes(work, JSCPD_REPORT_FILE).toString('utf8'), cloneReportSchema);
    const normalizeClonePath = (name: string): string =>
        convertToPosixPath(isAbsolute(name) ? relative(toNamespacedPath(input.root), toNamespacedPath(name)) : name);
    return report.duplicates.flatMap((clone): Finding[] => {
        const file = normalizeClonePath(clone.secondFile.name);
        if (!owned.includes(file)) return [];
        const first = normalizeClonePath(clone.firstFile.name);
        const other = `${first}:${String(clone.firstFile.start)}`;
        return [
            buildFinding(
                input,
                { file, line: clone.secondFile.start },
                'clone',
                `${String(clone.lines)} lines repeat ${other}.`,
            ),
        ];
    });
}
