import { writeFileSync } from 'node:fs';
import { buildFinding } from '#cli/runs/finding.ts';
import type { Session } from '#cli/types/session.ts';
import { openFiles } from '#cli/system/files/open.ts';
import { readBytes } from '#cli/system/files/reads.ts';
import type { Finding } from '#cli/types/runs/check.ts';
import { runCheckTool } from '#cli/runs/command/tool.ts';
import { convertToPosixPath } from '#cli/system/paths.ts';
import type { PlannedCheck } from '#cli/types/planning.ts';
import { formatOutputTail } from '#cli/runs/command/output.ts';
import { getToolFile } from '#cli/runs/command/placeholders.ts';
import { GspotError, hasErrorCode } from '#cli/system/errors.ts';
import { getToolFiles } from '#cli/generation/settings/generate.ts';
import { listCoveredFiles } from '#cli/repository/covered-files.ts';
import { createTemporaryFolder } from '#cli/system/files/folders.ts';
import { parseJsonFile, parseToolReport } from '#cli/parsers/json.ts';
import { getToolFileTarget } from '#cli/generation/settings/needed.ts';
import { cloneReportSchema } from '#cli/schemas/checks/duplication.ts';
import { join, relative, isAbsolute, toNamespacedPath } from 'node:path';
import { filterSourceConfigurations } from '#cli/configurations/select.ts';
import { JSCPD, JSCPD_ARGUMENTS, JSCPD_TOOL_FILE, JSCPD_REPORT_FILE } from '#cli/config/checks/duplication.ts';

/**
 * Runs jscpd over the scope and reports the clones.
 *
 * @param session the repository and its tools.
 * @param planned the scope whose source files to compare.
 * @returns the findings.
 */
export async function checkDuplicationJscpd(session: Session, planned: PlannedCheck): Promise<Finding[]> {
    using workFolder = createTemporaryFolder();
    const work = workFolder.path;
    const owned = [
        ...new Set(
            filterSourceConfigurations(planned.scope.configurations).flatMap((configuration) =>
                listCoveredFiles(configuration.files, planned.files, {
                    configurations: planned.scope.configurations,
                    scopePath: planned.scope.folder.path,
                    settings: planned.scope.settings,
                })
                    .filter((file) => file.kind === 'source')
                    .map((file) => file.path),
            ),
        ),
    ];
    using files = openFiles(session.root);
    const generatedPath = getToolFileTarget(
        planned.scope.folder.path,
        getToolFile(session, planned, JSCPD),
        getToolFiles(session).targets,
    );
    const generated = files.read(generatedPath);
    if (generated === undefined) throw new GspotError('check', `Missing ${generatedPath}. Run gspot apply.`);
    const shipped = parseJsonFile(generatedPath, generated.bytes.toString('utf8'));
    // A long file list overflows a command line, so the paths go into a tool file of their own.
    const toolFile = join(work, JSCPD_TOOL_FILE);
    writeFileSync(toolFile, JSON.stringify({ ...shipped, path: owned.map((path) => join(session.root, path)) }));
    const commandArguments = [JSCPD, '--config', toolFile, ...JSCPD_ARGUMENTS, '--output', work];
    const result = await runCheckTool(session, planned, commandArguments, { cwd: session.root });
    if (result.code !== 0) throw new Error(`The jscpd command failed: ${formatOutputTail(result)}`);
    let bytes: Buffer;
    try {
        bytes = readBytes(work, JSCPD_REPORT_FILE);
    } catch (error) {
        if (!hasErrorCode(error, 'ENOENT')) throw error;
        throw new GspotError('check', `The jscpd command wrote no report: ${formatOutputTail(result)}`, {
            cause: error,
        });
    }
    const report = parseToolReport(JSCPD, bytes.toString('utf8'), cloneReportSchema);
    const normalizeClonePath = (name: string): string =>
        convertToPosixPath(isAbsolute(name) ? relative(toNamespacedPath(session.root), toNamespacedPath(name)) : name);
    return report.duplicates.flatMap((clone): Finding[] => {
        const file = normalizeClonePath(clone.secondFile.name);
        if (!owned.includes(file)) return [];
        const first = normalizeClonePath(clone.firstFile.name);
        const other = `${first}:${String(clone.firstFile.start)}`;
        return [
            buildFinding(
                planned,
                { file, line: clone.secondFile.start },
                'clone',
                `${String(clone.lines)} lines repeat ${other}.`,
            ),
        ];
    });
}
