// Reads findings from declared JSON fields.
import { z } from 'zod';
import { GspotError } from '#cli/system/errors.ts';
import { getValueAt } from '#cli/system/values.ts';
import { JSON_START } from '#cli/config/runs/output.ts';
import type { Finding } from '#cli/types/runs/check.ts';
import { type ReportInput, type JsonFindingSpec } from '#cli/types/runs/output.ts';

// Findings from a tool that prints JSON: the manifest names the list location and the field for each value.

function listAt(value: unknown, path: string | undefined): unknown[] {
    const found = path === undefined || path === '' ? value : getValueAt(value, path.split('.'));
    if (!Array.isArray(found)) throw new Error(`Required JSON report array ${path ?? '<root>'} is missing or invalid.`);
    return found;
}

// List every chain of nodes under one node, nearest first: each key of the path names a list one level further down.
function listChains(chain: unknown[], keys: string[]): unknown[][] {
    const [key, ...rest] = keys;
    if (key === undefined) return [chain];
    return listAt(chain[0], key).flatMap((child) => listChains([child, ...chain], rest));
}

// A tool that counts from zero names its base, and the finding counts from one.
function setPosition(finding: Finding, base: number, line: string | undefined, column: string | undefined): void {
    if (line !== undefined && Number(line) >= base) finding.line = Number(line) - base + 1;
    if (column !== undefined && Number(column) >= base) finding.column = Number(column) - base + 1;
}

function buildFinding(shape: JsonFindingSpec, sources: unknown[]): Finding {
    const { check, help, output } = shape;
    if (sources.some((source) => source === null || typeof source !== 'object' || Array.isArray(source)))
        throw new Error('The JSON report contains an invalid finding object.');
    const fields: Record<string, string | undefined> | undefined = output.fields;
    // A field may name several paths with spaces between them; the values join in that order.
    const getFieldValues = (name: string) =>
        (fields?.[name] ?? '')
            .split(' ')
            .filter((path) => path !== '')
            .map((path) => sources.map((source) => getValueAt(source, path.split('.'))));
    const getField = (name: string): string | undefined => {
        const joined = getFieldValues(name)
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
    const message = getField('message');
    if (message === undefined) throw new Error('The JSON report contains a finding without its mapped message.');
    const file = getField('file') ?? '';
    const finding: Finding = {
        check,
        file,
        message: message,
        help,
        fixable: getFieldValues('fixable').some((entries) => entries.some((value) => value !== undefined)),
    };
    setPosition(finding, output.line_base ?? 1, getField('line'), getField('column'));
    const rule = getField('rule');
    if (rule !== undefined) finding.rule = rule;
    return finding;
}

/**
 * Read JSON findings from the dotted `items` path. Each `children` key goes one list deeper. A leaf without a field
 * takes it from its parent nodes.
 *
 * @param input the tool output to read.
 * @returns the findings from a valid report.
 */
export function parseJsonFindings(input: ReportInput): Finding[] {
    const { check, output, stdout, help } = input;
    const start = stdout.search(JSON_START);
    const schema = z.unknown().transform((parsed) => {
        const shape = { check, help, output };
        const keys = output.children === undefined ? [] : output.children.split('.');
        return listAt(parsed, output.items).flatMap((item) =>
            listChains([item], keys).map((chain) => buildFinding(shape, chain)),
        );
    }) satisfies z.ZodType<Finding[]>;
    return parseReport('JSON', stdout.slice(start), schema);
}

/**
 * Parse and validate a report, and keep its untrusted contents out of errors.
 * @param tool the program that printed the report.
 * @param text the JSON report.
 * @param schema the shape that the report must have.
 * @returns the validated report.
 */
export function parseReport<Value>(tool: string, text: string, schema: z.ZodType<Value>): Value {
    try {
        return schema.parse(JSON.parse(text));
    } catch {
        throw new GspotError('output', `${tool} returned invalid structured findings.`);
    }
}
