// Findings from a tool that prints JSON: the manifest names where the list is and which field holds what.
import type { Finding } from '#types/finding.ts';
import { UNPARSED_LIMIT } from '#config/markers.ts';
import type { OutputFormat } from '#types/manifest.ts';

const JSON_INDENT = 2;

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

// Every chain of nodes under one node, nearest first: each key of the path names a list one level further down.
function chainsUnder(chain: unknown[], keys: string[]): unknown[][] {
    const [key, ...rest] = keys;
    if (key === undefined) return [chain];
    return listAt(chain[0], key).flatMap((child) => chainsUnder([child, ...chain], rest));
}

function text(value: unknown): string | undefined {
    return typeof value === 'string' || typeof value === 'number' ? String(value) : undefined;
}

// A tool that counts from zero names its base, and the finding counts from one.
function firstLinePosition(finding: Finding, base: number, line: string | undefined, column: string | undefined): void {
    if (line !== undefined && Number(line) >= base) finding.line = Number(line) - base + 1;
    if (column !== undefined && Number(column) >= base) finding.column = Number(column) - base + 1;
}

function jsonFinding(shape: { check: string; help: string; output: OutputFormat }, sources: unknown[]): Finding {
    const { check, help, output } = shape;
    const fields: Record<string, string | undefined> = output.fields ?? {};
    const one = (path: string): string | undefined =>
        sources.map((source) => text(at(source, path))).find((found) => found !== undefined);
    // A field may name several paths with spaces between them; the values join in that order.
    const read = (name: string): string | undefined => {
        const found = (fields[name] ?? '').split(' ').flatMap((path) => (path === '' ? [] : [one(path) ?? '']));
        const joined = found.filter((part) => part !== '').join(' ');
        return joined === '' ? undefined : joined;
    };
    const finding: Finding = { check, file: read('file') ?? '', message: read('message') ?? '', help, fixable: false };
    firstLinePosition(finding, output.line_base ?? 1, read('line'), read('column'));
    const rule = read('rule');
    if (rule !== undefined) finding.rule = rule;
    return finding;
}

/**
 * Findings from JSON output. items is the dotted path to the list. children, when set, names the list inside each item, and each further key a list one level down; a field missing at the deepest node is read from the nodes above it.
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
    const shape = { check, help, output };
    const keys = output.children === undefined ? [] : output.children.split('.');
    return listAt(parsed, output.items).flatMap((item) =>
        chainsUnder([item], keys).map((chain) => jsonFinding(shape, chain)),
    );
}

/**
 * Prints one object as JSON on stdout.
 * @param value the documented object of the command
 */
export function printJson(value: unknown): void {
    process.stdout.write(`${JSON.stringify(value, null, JSON_INDENT)}\n`);
}
