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
import { GspotError, hasErrorCode } from '#cli/system/errors.ts';
import { getConfigFile } from '#cli/runs/command/placeholders.ts';
import { createTemporaryFolder } from '#cli/system/files/folders.ts';
import { listCoveredFiles } from '#cli/repository/files/selection.ts';
import { join, relative, isAbsolute, toNamespacedPath } from 'node:path';
import { getConfigFiles } from '#cli/generation/config-files/generate.ts';
import { filterSourceConfigurations } from '#cli/configurations/select.ts';
import { parseJsonFile, parseToolReport } from '#cli/parsers/formats/json.ts';
import { cloneReportSchema } from '#cli/schemas/checks/general/duplication.ts';
import { getConfigFileTarget } from '#cli/generation/config-files/selection.ts';

import {
    JSCPD,
    JSCPD_ARGUMENTS,
    JSCPD_CONFIG_FILE,
    JSCPD_REPORT_FILE,
} from '#cli/config/checks/general/duplication.ts';

/**
Runs jscpd over the scope and reports the clones.

@param session the repository and its tools.
@param planned the scope whose source files to compare.
@returns the findings.
*/
export async function checkDuplicationJscpd(session: Session, planned: PlannedCheck): Promise<Finding[]> {
    using workFolder = createTemporaryFolder();
    const work = workFolder.path;
    const owned = new Set(
        filterSourceConfigurations(planned.scope.configurations).flatMap((configuration) =>
            listCoveredFiles(configuration.files, planned.files, {
                configurations: planned.scope.configurations,
                scopePath: planned.scope.folder.path,
                settings: planned.scope.settings,
            })
                .filter((file) => file.kind === 'source')
                .map((file) => file.path),
        ),
    );
    using files = openFiles(session.root);
    const generatedPath = getConfigFileTarget(
        planned.scope.folder.path,
        getConfigFile(session, planned, JSCPD),
        getConfigFiles(session).targets,
    );
    const generated = files.read(generatedPath);
    if (generated === undefined) throw new GspotError('check', `Missing ${generatedPath}. Run gspot apply.`);
    const shipped = parseJsonFile(generatedPath, generated.bytes.toString('utf8'));
    const configFile = join(work, JSCPD_CONFIG_FILE);
    writeFileSync(configFile, JSON.stringify({ ...shipped, path: [...owned].map((path) => join(session.root, path)) }));
    const commandArguments = [JSCPD, '--config', configFile, ...JSCPD_ARGUMENTS, '--output', work];
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

    // eslint-disable-next-line gspot/no-trivial-functions -- reason: 2 calls in this file share it.
    const normalizeClonePath = (name: string): string =>
        convertToPosixPath(isAbsolute(name) ? relative(toNamespacedPath(session.root), toNamespacedPath(name)) : name);
    return report.duplicates.flatMap((clone): Finding[] => {
        const file = normalizeClonePath(clone.secondFile.name);
        if (!owned.has(file)) return [];
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
