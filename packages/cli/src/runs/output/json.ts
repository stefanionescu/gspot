import { GspotError } from '#cli/system/errors.ts';
import { getValueAt } from '#cli/system/tables.ts';
import type { Finding } from '#cli/types/runs/check.ts';
import { parseToolReport } from '#cli/parsers/formats/json.ts';
import type { ToolOutput } from '#cli/types/runs/output/formats.ts';
import { JSON_START, JSON_PREVIEW_LENGTH } from '#cli/config/runs/output/json.ts';

function buildJsonSyntaxError(stdout: string): GspotError {
    const first = stdout
        .split(/\r?\n/u)
        .find((line) => line.trim() !== '')
        ?.trim()
        .slice(0, JSON_PREVIEW_LENGTH);
    const message =
        first === undefined
            ? 'The command printed nothing; it should print a JSON report.'
            : `The output is not JSON. It starts with: ${first}`;
    return new GspotError('output', message);
}

function listAt(value: unknown, path: string | undefined): unknown[] {
    const found = path === undefined || path === '' ? value : getValueAt(value, path.split('.'));
    if (!Array.isArray(found))
        throw new GspotError('output', `Required JSON report array ${path ?? '<root>'} is missing or invalid.`);
    return found;
}

function listChains(chain: unknown[], keys: string[]): unknown[][] {
    const [key, ...rest] = keys;
    if (key === undefined) return [chain];
    const children = getValueAt(chain[0], key.split('.')) === undefined ? [] : listAt(chain[0], key);
    return children.flatMap((child) => listChains([child, ...chain], rest));
}

function setPosition(finding: Finding, base: number, line: string | undefined, column: string | undefined): void {
    if (line !== undefined && Number(line) >= base) finding.line = Number(line) - base + 1;
    if (column !== undefined && Number(column) >= base) finding.column = Number(column) - base + 1;
}

function buildJsonFinding(output: ToolOutput, sources: unknown[]): Finding {
    const { check, help, output: format } = output;
    if (sources.some((source) => source === null || typeof source !== 'object' || Array.isArray(source)))
        throw new GspotError('output', 'The JSON report contains an invalid finding object.');
    const fields: Record<string, string | undefined> | undefined = format.fields;
    const getFieldValues = (name: string) =>
        (fields?.[name] ?? '')
            .split(' ')
            .filter((path) => path !== '')
            .map((path) => sources.map((source) => getValueAt(source, path.split('.'))));
    const getField = (name: string): string | undefined => {
        const joined = getFieldValues(name)
            .map(
                (values) =>
                    values
                        .map((value) =>
                            typeof value === 'string' || typeof value === 'number' ? String(value) : undefined,
                        )
                        .find((value) => value !== undefined) ?? '',
            )
            .filter((text) => text !== '')
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
        fixable: getFieldValues('fixable').some((values) => values.some((value) => value !== undefined)),
    };
    setPosition(finding, format.line_base ?? 1, getField('line'), getField('column'));
    const rule = getField('rule');
    if (rule !== undefined) finding.rule = rule;
    return finding;
}

/**
Read JSON findings from the dotted `list` path. Each `children` key goes one list deeper. A leaf without a field
takes it from its parent nodes.

@param output the tool output to read.
@returns the findings from a valid report.
*/
export function parseJsonFindings(output: ToolOutput): Finding[] {
    const { output: format, stdout } = output;
    const start = stdout.search(JSON_START);
    if (start === -1) throw buildJsonSyntaxError(stdout);
    let parsed: unknown;
    try {
        parsed = parseToolReport('JSON', stdout.slice(start));
    } catch (error) {
        if (!(error instanceof GspotError)) throw error;
        throw buildJsonSyntaxError(stdout);
    }
    const keys = format.children === undefined ? [] : format.children.split('.');
    return listAt(parsed, format.list).flatMap((element) =>
        listChains([element], keys).map((chain) => buildJsonFinding(output, chain)),
    );
}
