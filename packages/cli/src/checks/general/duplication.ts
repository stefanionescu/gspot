import { writeFileSync } from 'node:fs';
import { CONFIG_FLAG } from '#cli/config/flags.ts';
import { openFiles } from '#cli/system/files/open.ts';
import { readBytes } from '#cli/system/files/reads.ts';
import { runCheckTool } from '#cli/runs/command/tool.ts';
import { convertToPosixPath } from '#cli/system/paths.ts';
import type { CheckSession } from '#cli/types/session.ts';
import type { PlannedCheck } from '#cli/types/planning.ts';
import type { CheckFinding } from '#cli/types/runs/check.ts';
import { formatOutputTail } from '#cli/runs/command/output.ts';
import { GspotError, hasErrorCode } from '#cli/system/errors.ts';
import { jscpdOutputSchema } from '#cli/schemas/checks/general.ts';
import { listSourceConfigurations } from '#cli/manifests/select.ts';
import { createTemporaryFolder } from '#cli/system/files/folders.ts';
import { listCoveredFiles } from '#cli/repository/files/selection.ts';
import { getConfigFilePath } from '#cli/runs/command/placeholders.ts';
import { join, relative, isAbsolute, toNamespacedPath } from 'node:path';
import { parseJsonFile, parseToolOutput } from '#cli/parsers/formats/json.ts';

import {
    CLONE_RULE,
    JSCPD_TOOL,
    OUTPUT_FLAG,
    JSCPD_ARGUMENTS,
    JSCPD_CONFIG_FILE,
    JSCPD_REPORT_FILE,
} from '#cli/config/checks/general/general.ts';

/**
Runs jscpd over the scope and reports the clones.

@param session the repository and its tools.
@param planned the scope whose source files to compare.
*/
export async function checkJscpd(session: CheckSession, planned: PlannedCheck): Promise<CheckFinding[]> {
    using workFolder = createTemporaryFolder();
    const owned = new Set(
        listSourceConfigurations(planned.scope.configurations).flatMap((configuration) =>
            listCoveredFiles(configuration.files, planned.files, {
                configurations: planned.scope.configurations,
                scopePath: planned.scope.path,
                settings: planned.scope.settings,
            })
                .filter((file) => file.kind === 'source')
                .map((file) => file.path),
        ),
    );
    const files = openFiles(session.root);
    const generatedPath = getConfigFilePath(session, planned, JSCPD_TOOL);
    const generated = files.read(generatedPath);
    if (generated === undefined)
        throw new GspotError('tool', `The generated file ${generatedPath} is missing. Run gspot apply.`);
    const shipped = parseJsonFile(generatedPath, generated.bytes.toString('utf8'));
    const configFile = join(workFolder.path, JSCPD_CONFIG_FILE);
    writeFileSync(configFile, JSON.stringify({ ...shipped, path: [...owned].map((path) => join(session.root, path)) }));
    const commandArguments = [JSCPD_TOOL, CONFIG_FLAG, configFile, ...JSCPD_ARGUMENTS, OUTPUT_FLAG, workFolder.path];
    const result = await runCheckTool(session, planned, commandArguments, { cwd: session.root });
    if (result.code !== 0) throw new GspotError('check', `The jscpd command failed: ${formatOutputTail(result)}`);
    let bytes: Buffer;
    try {
        bytes = readBytes(workFolder.path, JSCPD_REPORT_FILE);
    } catch (error) {
        if (!hasErrorCode(error, 'ENOENT')) throw error;
        throw new GspotError('check', `The jscpd command wrote no report: ${formatOutputTail(result)}`, {
            cause: error,
        });
    }
    const report = parseToolOutput(JSCPD_TOOL, bytes.toString('utf8'), jscpdOutputSchema);

    return report.duplicates.flatMap((clone): CheckFinding[] => {
        const secondName = clone.secondFile.name;
        const file = convertToPosixPath(
            isAbsolute(secondName)
                ? relative(toNamespacedPath(session.root), toNamespacedPath(secondName))
                : secondName,
        );
        if (!owned.has(file)) return [];
        const firstName = clone.firstFile.name;
        const first = convertToPosixPath(
            isAbsolute(firstName) ? relative(toNamespacedPath(session.root), toNamespacedPath(firstName)) : firstName,
        );
        const other = `${first}:${String(clone.firstFile.start)}`;
        return [
            {
                file,
                line: clone.secondFile.start,
                rule: CLONE_RULE,
                message: `${String(clone.lines)} lines repeat ${other}.`,
            },
        ];
    });
}
