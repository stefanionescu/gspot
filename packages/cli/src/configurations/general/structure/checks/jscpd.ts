import { writeFileSync } from 'node:fs';
import { isAbsolute, join, relative, toNamespacedPath } from 'node:path';

import {
    CLONE_RULE,
    JSCPD_ARGUMENTS,
    JSCPD_CONFIG_FILE,
    JSCPD_IMPORT_PATTERNS,
    JSCPD_REPORT_FILE,
    JSCPD_TOOL,
    OUTPUT_FLAG,
} from '#cli/config/configurations/structure.ts';
import { CONFIG_FLAG } from '#cli/config/tools/installers.ts';
import { buildMissingFileStop } from '#cli/engine/run/tool-runs/check.ts';
import { getConfigPath } from '#cli/engine/run/tool-runs/configs.ts';
import { formatOutputTail } from '#cli/engine/run/tool-runs/failures.ts';
import { runCheckTool } from '#cli/engine/run/tool-runs/tool.ts';
import { listSourceConfigurations } from '#cli/manifests/select.ts';
import { parseJsonFile } from '#cli/parsers/formats/json.ts';
import { parseToolOutput } from '#cli/parsers/formats/tool-output.ts';
import { listCoveredFiles } from '#cli/repository/files/selection.ts';
import { jscpdOutputSchema } from '#cli/schemas/configurations.ts';
import { getTable } from '#cli/settings/tables.ts';
import { CheckStop, hasErrorCode } from '#cli/system/errors.ts';
import { openFiles } from '#cli/system/files/open.ts';
import { readBytes, readText } from '#cli/system/files/reads.ts';
import { createTemporaryFolder } from '#cli/system/files/temporary.ts';
import { convertToPosixPath } from '#cli/system/paths.ts';
import type { PlannedCheck } from '#cli/types/engine/plan.ts';
import type { CheckCode, CheckFinding, CheckSession } from '#cli/types/engine/run.ts';

/**
Count the lines of a clone that the import patterns cover. jscpd drops the tokens of an import and still counts
its lines, so a few shared lines on both sides of two import blocks look like one long clone. A blank line between two
imports belongs to the imports.
*/
function countImportLines(source: string, clone: { start: number; lines: number }): number {
    const matches = JSCPD_IMPORT_PATTERNS.flatMap((pattern) => source.matchAll(new RegExp(pattern, 'gu')).toArray());
    const imported = new Set(
        matches.flatMap(({ 0: text, index }) => {
            const opening = index + text.length - text.trimStart().length;
            const first = source.slice(0, opening).split('\n').length - 1;
            return text
                .trim()
                .split('\n')
                .map((_line, offset) => first + offset);
        }),
    );
    const lines = source.split('\n');
    const written = lines.flatMap((text, index) => (text.trim() === '' ? [] : [index]));
    return lines.slice(clone.start - 1, clone.start - 1 + clone.lines).filter((text, offset) => {
        const index = clone.start - 1 + offset;
        if (text.trim() !== '') return imported.has(index);
        const before = written.findLast((other) => other < index);
        const after = written.find((other) => other > index);
        return before !== undefined && after !== undefined && imported.has(before) && imported.has(after);
    }).length;
}

async function checkJscpd(session: CheckSession, planned: PlannedCheck): Promise<CheckFinding[]> {
    using workFolder = createTemporaryFolder();
    const owned = new Set(
        listSourceConfigurations(planned.scope.configurations).flatMap((configuration) =>
            listCoveredFiles(configuration.files, planned.files, planned.scope)
                .filter((file) => file.kind === 'source')
                .map((file) => file.path),
        ),
    );
    const files = openFiles(session.root);
    const generatedPath = getConfigPath(session, planned, JSCPD_TOOL);
    const generated = files.read(generatedPath);
    if (generated === undefined) throw buildMissingFileStop(generatedPath);
    const shipped = parseJsonFile(generatedPath, generated.bytes.toString('utf8'));
    const config = join(workFolder.path, JSCPD_CONFIG_FILE);
    writeFileSync(config, JSON.stringify({ ...shipped, path: [...owned].map((path) => join(session.root, path)) }));
    const commandArguments = [JSCPD_TOOL, CONFIG_FLAG, config, ...JSCPD_ARGUMENTS, OUTPUT_FLAG, workFolder.path];
    const result = await runCheckTool(session, planned, commandArguments, { cwd: session.root, exitCodes: [] });
    let bytes: Buffer;
    try {
        bytes = readBytes(workFolder.path, JSCPD_REPORT_FILE);
    } catch (error) {
        if (!hasErrorCode(error, 'ENOENT')) throw error;
        throw new CheckStop('error', `The jscpd command wrote no report: ${formatOutputTail(result)}`, {
            cause: error,
        });
    }
    const report = parseToolOutput(JSCPD_TOOL, bytes.toString('utf8'), jscpdOutputSchema);

    const minimum = getTable(planned.scope.settings, 'structure').min_duplicate_lines;
    return report.duplicates.flatMap((clone): CheckFinding[] => {
        const [file, first] = [clone.secondFile.name, clone.firstFile.name].map((name) =>
            convertToPosixPath(
                isAbsolute(name) ? relative(toNamespacedPath(session.root), toNamespacedPath(name)) : name,
            ),
        ) as [string, string];
        if (!owned.has(file)) return [];
        const other = `${first}:${String(clone.firstFile.start)}`;
        const source = readText(session.cache, file);
        const repeated = clone.lines - countImportLines(source, { start: clone.secondFile.start, lines: clone.lines });
        if (repeated < minimum) return [];
        return [
            {
                file,
                line: clone.secondFile.start,
                rule: CLONE_RULE,
                message: `${String(repeated)} lines repeat ${other}.`,
            },
        ];
    });
}

export const STRUCTURE_JSCPD_CHECKS: Readonly<Record<string, CheckCode>> = {
    'structure/jscpd': { check: checkJscpd },
};
