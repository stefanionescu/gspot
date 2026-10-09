import { GspotError } from '#cli/platform/public.ts';
import { sep, relative, isAbsolute } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import type { SemgrepReport } from '#cli/types/parsers/semgrep.ts';
import { knipReportSchema } from '#cli/parsers/schema/contracts.ts';
import { toPosix, valueAt, isInside, toolPath } from '#cli/platform/contracts.ts';
import { SEMGREP_PARSE_EXIT, KNIP_ISSUE_MESSAGES } from '#cli/config/parsers/output.ts';
import { sarifLogSchema, semgrepReportSchema } from '#cli/parsers/output/structured/contracts.ts';
import type { SarifRun, SarifArtifactLocation, SarifPhysicalLocation } from '#cli/types/parsers/sarif.ts';
import type { Finding, KnipReport, OutputSpec, FindingPlace, JsonFindingSpec } from '#cli/types/parsers/output.ts';

function indexedArtifact(artifact: SarifArtifactLocation, run: SarifRun): SarifArtifactLocation {
    if (artifact.uri !== undefined || artifact.index === undefined) return artifact;
    const location = run.artifacts?.[artifact.index]?.location;
    if (location?.uri === undefined) throw new Error('SARIF reported a missing artifact location.');
    return location;
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

// Findings from a tool that prints JSON: the manifest names where the list is and which field holds what.

function listAt(value: unknown, path: string | undefined): unknown[] {
    const found = path === undefined || path === '' ? value : valueAt(value, path.split('.'));
    if (!Array.isArray(found)) throw new Error(`Required JSON report array ${path ?? '<root>'} is missing or invalid.`);
    return found;
}

// Every chain of nodes under one node, nearest first: each key of the path names a list one level further down.
function chainsUnder(chain: unknown[], keys: string[]): unknown[][] {
    const [key, ...rest] = keys;
    if (key === undefined) return [chain];
    return listAt(chain[0], key).flatMap((child) => chainsUnder([child, ...chain], rest));
}

// A tool that counts from zero names its base, and the finding counts from one.
function setPosition(finding: Finding, base: number, line: string | undefined, column: string | undefined): void {
    if (line !== undefined && Number(line) >= base) finding.line = Number(line) - base + 1;
    if (column !== undefined && Number(column) >= base) finding.column = Number(column) - base + 1;
}

function jsonFinding(shape: JsonFindingSpec, sources: unknown[]): Finding {
    const { check, help, output } = shape;
    if (sources.some((source) => source === null || typeof source !== 'object' || Array.isArray(source)))
        throw new Error('The JSON report contains an invalid finding object.');
    const fields: Record<string, string | undefined> | undefined = output.fields;
    // A field may name several paths with spaces between them; the values join in that order.
    const values = (name: string) =>
        (fields?.[name] ?? '')
            .split(' ')
            .filter((path) => path !== '')
            .map((path) => sources.map((source) => valueAt(source, path.split('.'))));
    const read = (name: string): string | undefined => {
        const joined = values(name)
            .map(
                (entries) =>
                    entries
                        .map((value) =>
                            typeof value === 'string' || typeof value === 'number' ? String(value) : undefined,
                        )
                        .find((value) => value !== undefined) ?? '',
            )
            .filter((part) => part !== '')
            .join(' ');
        return joined === '' ? undefined : joined;
    };
    const diagnostic = read('message');
    if (diagnostic === undefined) throw new Error('The JSON report contains a finding without its mapped message.');
    const file = read('file') ?? '';
    const finding: Finding = {
        check,
        file: isAbsolute(file) ? toPosix(file) : toolPath(file),
        message: diagnostic,
        help,
        fixable: values('fixable').some((entries) => entries.some((value) => value !== undefined)),
    };
    setPosition(finding, output.line_base ?? 1, read('line'), read('column'));
    const rule = read('rule');
    if (rule !== undefined) finding.rule = rule;
    return finding;
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

/**
 * Read Knip's JSON categories without losing grouped symbols or source positions.
 * @param check the check ID
 * @param text the native JSON report
 * @param help the check help text
 * @returns categorized findings, including each positioned member of a grouped issue
 */
export function knipFindings(check: string, text: string, help: string): Finding[] {
    let report: KnipReport;
    try {
        report = knipReportSchema.parse(JSON.parse(text));
    } catch (error) {
        throw new GspotError('output', 'Knip returned invalid structured findings.', { cause: error });
    }
    const categories = Object.keys(KNIP_ISSUE_MESSAGES) as (keyof typeof KNIP_ISSUE_MESSAGES)[];
    const findings: Finding[] = [];
    for (const row of report.issues) {
        for (const category of categories) {
            findings.push(
                ...(row[category] ?? []).flatMap((issue) => {
                    const symbols = Array.isArray(issue) ? issue : [issue];
                    const names = symbols.map(({ name }) => name).join(', ');
                    return symbols.map((symbol) => {
                        const namespace = symbol.namespace === undefined ? '' : ` (${symbol.namespace})`;
                        return {
                            check,
                            file: row.file,
                            rule: category,
                            message: `${KNIP_ISSUE_MESSAGES[category]}: ${names}${namespace}`,
                            help,
                            fixable: false,
                            ...(symbol.line === undefined ? {} : { line: symbol.line }),
                            ...(symbol.col === undefined ? {} : { column: symbol.col }),
                        };
                    });
                }),
            );
        }
    }
    return findings;
}

/**
 * Read Semgrep rule findings and source parsing errors without accepting scanner or rule failures.
 * @param check the check ID
 * @param text the native JSON report
 * @param help the check's correction guidance
 * @returns positioned diagnostics from a validated native report
 */
export function semgrepFindings(check: string, text: string, help: string): Finding[] {
    let report: SemgrepReport;
    try {
        report = semgrepReportSchema.parse(JSON.parse(text));
    } catch (error) {
        throw new GspotError('output', 'Semgrep returned invalid structured findings.', { cause: error });
    }
    const findings: Finding[] = report.results.map((entry) => ({
        check,
        help,
        file: entry.path,
        line: entry.start.line,
        column: entry.start.col,
        rule: entry.check_id,
        message: entry.extra.message,
        fixable: false,
    }));
    for (const error of report.errors) {
        const type = typeof error.type === 'string' ? error.type : error.type[0];
        const span = error.spans?.find((entry) => entry.file === error.path);
        if (error.code !== SEMGREP_PARSE_EXIT || !['ParseError', 'PartialParsing'].includes(type) || span === undefined)
            throw new GspotError('output', `Semgrep could not complete the scan: ${error.message}`);
        findings.push({
            check,
            help,
            file: span.file,
            line: span.start.line,
            column: span.start.col,
            rule: 'parse-error',
            message: error.message,
            fixable: false,
        });
    }
    return findings;
}

/**
 * Reads JSON findings from the dotted `items` path. Each `children` key descends into another nested list. Missing leaf fields inherit from ancestor nodes.
 *
 * @param check the check id.
 * @param output the output table of the manifest.
 * @param stdout what the tool printed.
 * @param help the fix text of the check.
 * @returns the findings from a valid report.
 */
export function parseJson(check: string, output: OutputSpec, stdout: string, help: string): Finding[] {
    const start = stdout.search(/[[{]/u);
    if (start === -1) throw new Error('The tool returned no JSON report.');
    const parsed: unknown = JSON.parse(stdout.slice(start));
    const shape = { check, help, output };
    const keys = output.children === undefined ? [] : output.children.split('.');
    return listAt(parsed, output.items).flatMap((item) =>
        chainsUnder([item], keys).map((chain) => jsonFinding(shape, chain)),
    );
}
