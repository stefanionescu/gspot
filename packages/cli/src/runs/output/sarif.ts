import { sep, relative } from 'node:path';
import { isInside } from '#cli/system/paths.ts';
import { GspotError } from '#cli/system/errors.ts';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { sarifLogSchema } from '#cli/schemas/runs/sarif.ts';
import type { ToolOutput } from '#cli/types/runs/output.ts';
import { parseToolReport } from '#cli/parsers/formats/json.ts';
import { SARIF_SOURCE_ROOT } from '#cli/config/runs/output/sarif.ts';
import type { Finding, FindingPlace } from '#cli/types/runs/check.ts';
import type { SarifRun, SarifPhysicalLocation, SarifArtifactLocation } from '#cli/types/runs/tool-reports.ts';

function getArtifactLocation(artifact: SarifArtifactLocation, run: SarifRun): SarifArtifactLocation {
    if (artifact.uri !== undefined || artifact.index === undefined) return artifact;
    const location = run.artifacts?.[artifact.index]?.location;
    if (location?.uri === undefined) throw new GspotError('output', 'SARIF reported a missing artifact location.');
    return location;
}

function convertArtifactUri(artifact: SarifArtifactLocation, run: SarifRun, source: string): string {
    if (artifact.uri === undefined) return '';
    const root = pathToFileURL(`${source}${sep}`);
    const buildBaseUrl = (id: string, seen = new Set<string>()): URL => {
        if (seen.has(id)) throw new GspotError('output', 'SARIF reported a cyclic source location.');
        seen.add(id);
        const base = run.originalUriBaseIds?.[id];
        if (base === undefined) {
            if (id === SARIF_SOURCE_ROOT) return root;
            throw new GspotError('output', `SARIF reported an unknown source location: ${id}.`);
        }
        return new URL(base.uri ?? '', base.uriBaseId === undefined ? root : buildBaseUrl(base.uriBaseId, seen));
    };
    const uri = new URL(artifact.uri, artifact.uriBaseId === undefined ? root : buildBaseUrl(artifact.uriBaseId));
    if (uri.protocol !== 'file:')
        throw new GspotError('output', 'SARIF reported a source location that is not a file.');
    const file = fileURLToPath(uri);
    if (!isInside(relative(source, file)))
        throw new GspotError('output', 'SARIF reported a source location outside the copy of the source.');
    return file;
}

function buildFindingPlace(location: SarifPhysicalLocation, run: SarifRun, source: string): FindingPlace {
    if (location === undefined) return { file: '' };
    const { artifactLocation: reference = {}, region } = location;
    const artifact = getArtifactLocation(reference, run);
    return {
        file: convertArtifactUri(artifact, run, source),
        ...(region?.startLine !== undefined && { line: region.startLine }),
        ...(region?.startColumn !== undefined && { column: region.startColumn }),
    };
}

function assertSuccessfulRun(run: SarifRun): void {
    const unsuccessful =
        run.invocations?.filter(
            (analysis) =>
                analysis.executionSuccessful === false ||
                analysis.toolExecutionNotifications?.some((notification) => notification.level === 'error') === true,
        ) ?? [];
    if (unsuccessful.length === 0) return;
    const notifications = unsuccessful.flatMap((analysis) =>
        (analysis.toolExecutionNotifications ?? []).filter((notification) => notification.level === 'error'),
    );
    const detail = notifications
        .map((notification) => notification.message?.text)
        .filter((text) => text !== undefined)
        .join('\n');
    const message =
        detail === ''
            ? 'SARIF reported an unsuccessful analysis.'
            : `SARIF reported an unsuccessful analysis: ${detail}`;
    throw new GspotError('output', message);
}

/**
Read the report and validate its source locations.

@param output the tool output to read.
@returns the report findings.
*/
export function parseSarifFindings(output: ToolOutput): Finding[] {
    const { stdout, check, help, root: source } = output;
    const parsed = parseToolReport('SARIF', stdout, sarifLogSchema);
    return parsed.runs.flatMap((run) => {
        assertSuccessfulRun(run);
        return run.results.map((result) => ({
            check,
            ...buildFindingPlace(result.locations?.[0]?.physicalLocation, run, source),
            ...(result.ruleId !== undefined && { rule: result.ruleId }),
            help,
            message: result.message?.text ?? 'SARIF reports a result here.',
            fixable: false,
        }));
    });
}
