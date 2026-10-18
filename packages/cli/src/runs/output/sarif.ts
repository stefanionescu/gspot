// Read Static Analysis Results Interchange Format (SARIF) reports.
import { z } from 'zod';
import { sep, relative } from 'node:path';
import { isInside } from '#cli/system/paths.ts';
import { parseReport } from '#cli/runs/output/json.ts';
import type { SchemaShape } from '#cli/types/shapes.ts';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { SARIF_SOURCE_ROOT } from '#cli/config/runs/output.ts';
import type { Finding, FindingPlace } from '#cli/types/runs/check.ts';

import {
    type SarifLog,
    type SarifRun,
    type ReportInput,
    type SarifPhysicalLocation,
    type SarifArtifactLocation,
} from '#cli/types/runs/output.ts';

function getArtifactLocation(artifact: SarifArtifactLocation, run: SarifRun): SarifArtifactLocation {
    if (artifact.uri !== undefined || artifact.index === undefined) return artifact;
    const location = run.artifacts?.[artifact.index]?.location;
    if (location?.uri === undefined) throw new Error('SARIF reported a missing artifact location.');
    return location;
}

// Source URIs must resolve inside the source folder before path exceptions can apply.
function convertArtifactUri(artifact: SarifArtifactLocation, run: SarifRun, source: string): string {
    if (artifact.uri === undefined) return '';
    const root = pathToFileURL(`${source}${sep}`);
    const buildBaseUrl = (id: string, seen = new Set<string>()): URL => {
        if (seen.has(id)) throw new Error('SARIF reported a cyclic source location.');
        seen.add(id);
        const base = run.originalUriBaseIds?.[id];
        if (base === undefined) {
            if (id === SARIF_SOURCE_ROOT) return root;
            throw new Error(`SARIF reported an unknown source location: ${id}.`);
        }
        return new URL(base.uri ?? '', base.uriBaseId === undefined ? root : buildBaseUrl(base.uriBaseId, seen));
    };
    const uri = new URL(artifact.uri, artifact.uriBaseId === undefined ? root : buildBaseUrl(artifact.uriBaseId));
    if (uri.protocol !== 'file:') throw new Error('SARIF reported a source location that is not a file.');
    const file = relative(source, fileURLToPath(uri));
    if (!isInside(file)) throw new Error('SARIF reported a source location outside its selected source copy.');
    return fileURLToPath(uri);
}

/**
 * Resolve a validated SARIF physical location into a source path and coordinates.
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

const locationSchema = z.object({
    uri: z.string().optional(),
    uriBaseId: z.string().optional(),
    index: z.number().int().nonnegative().optional(),
} satisfies SchemaShape<SarifArtifactLocation>);

const sarifResultSchema = z.object({
    ruleId: z.string().optional(),
    message: z
        .object({ text: z.string().optional() } satisfies SchemaShape<
            NonNullable<SarifRun['results'][number]['message']>
        >)
        .optional(),
    locations: z
        .array(
            z.object({
                physicalLocation: z
                    .object({
                        artifactLocation: locationSchema.optional(),
                        region: z
                            .object({
                                startLine: z.number().int().positive().optional(),
                                startColumn: z.number().int().positive().optional(),
                            } satisfies SchemaShape<
                                NonNullable<
                                    NonNullable<
                                        NonNullable<
                                            SarifRun['results'][number]['locations']
                                        >[number]['physicalLocation']
                                    >['region']
                                >
                            >)
                            .optional(),
                    } satisfies SchemaShape<
                        NonNullable<NonNullable<SarifRun['results'][number]['locations']>[number]['physicalLocation']>
                    >)
                    .optional(),
            } satisfies SchemaShape<NonNullable<SarifRun['results'][number]['locations']>[number]>),
        )
        .optional(),
} satisfies SchemaShape<SarifRun['results'][number]>);

const runSchema = z.object({
    results: z.array(sarifResultSchema),
    artifacts: z
        .array(
            z.object({ location: locationSchema.optional() } satisfies SchemaShape<
                NonNullable<SarifRun['artifacts']>[number]
            >),
        )
        .optional(),
    originalUriBaseIds: z.record(z.string(), locationSchema).optional(),
    invocations: z
        .array(
            z.object({
                executionSuccessful: z.boolean().optional(),
                toolExecutionNotifications: z
                    .array(
                        z.object({
                            level: z.string().optional(),
                            message: z
                                .object({ text: z.string().optional() } satisfies SchemaShape<
                                    NonNullable<
                                        NonNullable<
                                            NonNullable<SarifRun['invocations']>[number]['toolExecutionNotifications']
                                        >[number]['message']
                                    >
                                >)
                                .optional(),
                        } satisfies SchemaShape<
                            NonNullable<
                                NonNullable<SarifRun['invocations']>[number]['toolExecutionNotifications']
                            >[number]
                        >),
                    )
                    .optional(),
            } satisfies SchemaShape<NonNullable<SarifRun['invocations']>[number]>),
        )
        .optional(),
} satisfies SchemaShape<SarifRun>);

/** Validate SARIF version 2.1.0 and the source metadata needed for findings. */
const sarifLogSchema = z.object({
    version: z.literal('2.1.0'),
    runs: z.array(runSchema).min(1),
} satisfies SchemaShape<SarifLog>);

/**
 * Read a SARIF report and validate its source locations.
 * @param input the tool output to read.
 * @returns the report findings.
 */
export function parseSarifFindings(input: ReportInput): Finding[] {
    const { stdout, check, help, root: source } = input;
    const parsed = parseReport('SARIF', stdout, sarifLogSchema);
    return parsed.runs.flatMap((run) => {
        const unsuccessful =
            run.invocations?.filter(
                (invocation) =>
                    invocation.executionSuccessful === false ||
                    invocation.toolExecutionNotifications?.some((notification) => notification.level === 'error') ===
                        true,
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
            throw new Error(message);
        }
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
