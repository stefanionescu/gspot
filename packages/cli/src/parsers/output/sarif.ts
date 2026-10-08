import { sep, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { toPosix, isInside } from '#cli/platform/paths.ts';
import { sarifLogSchema } from '#cli/parsers/schema/sarif.ts';
import type { Finding, FindingPlace } from '#cli/types/parsers/output.ts';
import type { SarifRun, SarifArtifactLocation, SarifPhysicalLocation } from '#cli/types/parsers/sarif.ts';

function indexedArtifact(artifact: SarifArtifactLocation, run: SarifRun): SarifArtifactLocation {
    if (artifact.uri !== undefined || artifact.index === undefined) return artifact;
    const resolved = run.artifacts?.[artifact.index]?.location;
    if (resolved?.uri === undefined) throw new Error('SARIF reported a missing artifact location.');
    return resolved;
}

// Source URIs must resolve inside the selected copy before path-specific exceptions can apply.
function sourceFile(artifact: SarifArtifactLocation, run: SarifRun, source: string): string {
    if (artifact.uri === undefined) return '';
    const root = pathToFileURL(`${source}${sep}`);
    const baseOf = (id: string, seen = new Set<string>()): URL => {
        if (seen.has(id)) throw new Error('SARIF reported a cyclic source location.');
        seen.add(id);
        const base = run.originalUriBaseIds?.[id];
        if (base === undefined) {
            if (id === '%SRCROOT%') return root;
            throw new Error(`SARIF reported an unknown source location: ${id}.`);
        }
        return new URL(base.uri ?? '', base.uriBaseId === undefined ? root : baseOf(base.uriBaseId, seen));
    };
    const uri = new URL(artifact.uri, artifact.uriBaseId === undefined ? root : baseOf(artifact.uriBaseId));
    if (uri.protocol !== 'file:') throw new Error('SARIF reported a source location that is not a file.');
    const file = relative(source, fileURLToPath(uri));
    if (!isInside(file)) throw new Error('SARIF reported a source location outside its selected source copy.');
    return toPosix(file);
}

/**
 * Resolve a validated SARIF physical location into a source path and coordinates.
 * @param location the first result location, when present
 * @param run its source metadata
 * @param source the selected source copy
 * @returns the repository-relative location
 */
function placeOf(location: SarifPhysicalLocation, run: SarifRun, source: string): FindingPlace {
    if (location === undefined) return { file: '' };
    const { artifactLocation: reference = {}, region } = location;
    const artifact = indexedArtifact(reference, run);
    return {
        file: sourceFile(artifact, run, source),
        ...(region?.startLine === undefined ? {} : { line: region.startLine }),
        ...(region?.startColumn === undefined ? {} : { column: region.startColumn }),
    };
}

/**
 * Validate native SARIF results and resolve their repository-relative source locations.
 * @param log the parsed SARIF log.
 * @param check the check ID the findings carry.
 * @param help the check help text.
 * @param source the copy of the repository the analysis ran in.
 * @returns validated findings without reading source file contents.
 */
export function sarifFindings(log: unknown, check: string, help: string, source: string): Finding[] {
    const parsed = sarifLogSchema.parse(log);
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
            const diagnostic =
                detail === ''
                    ? 'SARIF reported an unsuccessful analysis.'
                    : `SARIF reported an unsuccessful analysis: ${detail}`;
            throw new Error(diagnostic);
        }
        return run.results.map((result) => ({
            check,
            ...placeOf(result.locations?.[0]?.physicalLocation, run, source),
            ...(result.ruleId === undefined ? {} : { rule: result.ruleId }),
            help,
            message: result.message?.text ?? 'SARIF reports a result here.',
            fixable: false,
        }));
    });
}
