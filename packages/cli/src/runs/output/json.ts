import { GspotError } from '#cli/system/errors.ts';
import { getValueAt } from '#cli/system/tables.ts';
import { parseToolReport } from '#cli/parsers/json.ts';
import { JSON_START } from '#cli/config/runs/output.ts';
import type { Finding } from '#cli/types/runs/check.ts';
import type { ToolOutput } from '#cli/types/runs/output.ts';

// The manifest names where the list of findings sits and the field of each value.
function listAt(value: unknown, path: string | undefined): unknown[] {
    const found = path === undefined || path === '' ? value : getValueAt(value, path.split('.'));
    if (!Array.isArray(found))
        throw new GspotError('output', `Required JSON report array ${path ?? '<root>'} is missing or invalid.`);
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

function buildJsonFinding(output: ToolOutput, sources: unknown[]): Finding {
    const { check, help, output: format } = output;
    if (sources.some((source) => source === null || typeof source !== 'object' || Array.isArray(source)))
        throw new GspotError('output', 'The JSON report contains an invalid finding object.');
    const fields: Record<string, string | undefined> | undefined = format.fields;
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
    if (message === undefined)
        throw new GspotError('output', 'The JSON report contains a finding without its mapped message.');
    const file = getField('file') ?? '';
    const finding: Finding = {
        check,
        file,
        message,
        help,
        fixable: getFieldValues('fixable').some((entries) => entries.some((value) => value !== undefined)),
    };
    setPosition(finding, format.line_base ?? 1, getField('line'), getField('column'));
    const rule = getField('rule');
    if (rule !== undefined) finding.rule = rule;
    return finding;
}

/**
 * Read JSON findings from the dotted `items` path. Each `children` key goes one list deeper. A leaf without a field
 * takes it from its parent nodes.
 *
 * @param output the tool output to read.
 * @returns the findings from a valid report.
 */
export function parseJsonFindings(output: ToolOutput): Finding[] {
    const { output: format, stdout } = output;
    const start = stdout.search(JSON_START);
    if (start === -1) throw new GspotError('output', 'JSON returned no structured findings.');
    const parsed = parseToolReport('JSON', stdout.slice(start));
    const keys = format.children === undefined ? [] : format.children.split('.');
    return listAt(parsed, format.items).flatMap((item) =>
        listChains([item], keys).map((chain) => buildJsonFinding(output, chain)),
    );
}
