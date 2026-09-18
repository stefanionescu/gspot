// Findings from a tool that prints JSON: the manifest names where the list is and which field holds what.
import type { Finding } from '#types/finding.ts';
import type { OutputFormat } from '#types/manifest.ts';

const UNPARSED_LIMIT = 400;

function at(value: unknown, path: string | undefined): unknown {
    if (path === undefined || path === '') return value;
    let current = value;
    for (const key of path.split('.')) {
        if (current === null || typeof current !== 'object') return undefined;
        current = (current as Record<string, unknown>)[key];
    }
    return current;
}

function listAt(value: unknown, path: string | undefined): unknown[] {
    const found = at(value, path);
    return Array.isArray(found) ? found : [];
}

function text(value: unknown): string | undefined {
    return typeof value === 'string' || typeof value === 'number' ? String(value) : undefined;
}

function firstLinePosition(finding: Finding, line: string | undefined, column: string | undefined): void {
    if (line !== undefined && Number(line) > 0) finding.line = Number(line);
    if (column !== undefined && Number(column) > 0) finding.column = Number(column);
}

function jsonFinding(
    check: string,
    help: string,
    fields: Record<string, string | undefined>,
    sources: unknown[],
): Finding {
    const read = (name: string): string | undefined => {
        const path = fields[name];
        if (path === undefined) return undefined;
        return sources.map((source) => text(at(source, path))).find((found) => found !== undefined);
    };
    const finding: Finding = { check, file: read('file') ?? '', message: read('message') ?? '', help, fixable: false };
    firstLinePosition(finding, read('line'), read('column'));
    const rule = read('rule');
    if (rule !== undefined) finding.rule = rule;
    return finding;
}

/**
 * Findings from JSON output. items is the dotted path to the list; children, when set, is the list inside each item, and a field missing there is read from the item.
 * @param check the check id
 * @param output the output table of the manifest
 * @param stdout what the tool printed
 * @param help the fix text of the check
 * @returns the findings, or one finding that holds the text when it is not JSON
 */
export function parseJson(check: string, output: OutputFormat, stdout: string, help: string): Finding[] {
    const start = stdout.search(/[[{]/u);
    if (start === -1) return [];
    let parsed: unknown;
    try {
        parsed = JSON.parse(stdout.slice(start));
    } catch {
        return [{ check, file: '', message: stdout.trim().slice(0, UNPARSED_LIMIT), help, fixable: false }];
    }
    const fields = output.fields ?? {};
    return listAt(parsed, output.items).flatMap((item) =>
        output.children === undefined
            ? [jsonFinding(check, help, fields, [item])]
            : listAt(item, output.children).map((child) => jsonFinding(check, help, fields, [child, item])),
    );
}
