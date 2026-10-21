// Read Static Analysis Results Interchange Format (SARIF) reports.
import { sep, relative } from 'node:path';
import { isInside } from '#cli/system/paths.ts';
import { parseReport } from '#cli/parsers/json.ts';
import { GspotError } from '#cli/system/errors.ts';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { SARIF_SOURCE_ROOT } from '#cli/config/runs/output.ts';
import { sarifLogSchema } from '#cli/schemas/runs/output/sarif.ts';
import type { Finding, FindingPlace } from '#cli/types/runs/check.ts';

import {
    type SarifRun,
    type ReportInput,
    type SarifPhysicalLocation,
    type SarifArtifactLocation,
} from '#cli/types/runs/output.ts';

function getArtifactLocation(artifact: SarifArtifactLocation, run: SarifRun): SarifArtifactLocation {
    if (artifact.uri !== undefined || artifact.index === undefined) return artifact;
    const location = run.artifacts?.[artifact.index]?.location;
    if (location?.uri === undefined) throw new GspotError('output', 'SARIF reported a missing artifact location.');
    return location;
}

// Source URIs must resolve inside the source folder before path exceptions can apply.
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
    const file = relative(source, fileURLToPath(uri));
    if (!isInside(file))
        throw new GspotError('output', 'SARIF reported a source location outside its selected source copy.');
    return fileURLToPath(uri);
}

/**
 * Resolve a validated SARIF physical location into a source path and coordinates.
 *
 * @param location the first physical place of the result.
 * @param run its source metadata.
 * @param source the folder that the report paths start from.
 * @returns the repository-relative location.
 */
function buildFindingPlace(location: SarifPhysicalLocation, run: SarifRun, source: string): FindingPlace {
    if (location === undefined) return { file: '' };
    const { artifactLocation: reference = {}, region } = location;
    const artifact = getArtifactLocation(reference, run);
    return {
        file: convertArtifactUri(artifact, run, source),
        ...(region?.startLine === undefined ? {} : { line: region.startLine }),
        ...(region?.startColumn === undefined ? {} : { column: region.startColumn }),
    };
}

function assertSuccessfulRun(run: SarifRun): void {
    const unsuccessful =
        run.invocations?.filter(
            (invocation) =>
                invocation.executionSuccessful === false ||
                invocation.toolExecutionNotifications?.some((notification) => notification.level === 'error') === true,
        ) ?? [];
    if (unsuccessful.length > 0) {
        const notifications = unsuccessful.flatMap((invocation) =>
            (invocation.toolExecutionNotifications ?? []).filter((notification) => notification.level === 'error'),
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
}

/**
 * Read a SARIF report and validate its source locations.
 *
 * @param input the tool output to read.
 * @returns the report findings.
 */
export function parseSarifFindings(input: ReportInput): Finding[] {
    const { stdout, check, help, root: source } = input;
    const parsed = parseReport('SARIF', stdout, sarifLogSchema);
    return parsed.runs.flatMap((run) => {
        assertSuccessfulRun(run);
        return run.results.map((result) => ({
            check,
            ...buildFindingPlace(result.locations?.[0]?.physicalLocation, run, source),
            ...(result.ruleId === undefined ? {} : { rule: result.ruleId }),
            help,
            message: result.message?.text ?? 'SARIF reports a result here.',
            fixable: false,
        }));
    });
}
