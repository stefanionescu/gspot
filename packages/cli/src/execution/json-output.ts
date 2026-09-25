// Findings from a tool that prints JSON: the manifest names where the list is and which field holds what.
import type { Finding } from '#cli/checks/result.ts';
import type { OutputFormat } from '#cli/configurations/output-format.ts';

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
    if (!Array.isArray(found)) throw new Error(`Required JSON report array ${path ?? '<root>'} is missing or invalid.`);
    return found;
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
    if (sources.some((source) => source === null || typeof source !== 'object' || Array.isArray(source)))
        throw new Error('The JSON report contains an invalid finding object.');
    const fields: Record<string, string | undefined> = output.fields ?? {};
    const one = (path: string): string | undefined =>
        sources.map((source) => text(at(source, path))).find((found) => found !== undefined);
    // A field may name several paths with spaces between them; the values join in that order.
    const read = (name: string): string | undefined => {
        const found = (fields[name] ?? '').split(' ').flatMap((path) => (path === '' ? [] : [one(path) ?? '']));
        const joined = found.filter((part) => part !== '').join(' ');
        return joined === '' ? undefined : joined;
    };
    const message = read('message');
    if (message === undefined) throw new Error('The JSON report contains a finding without its mapped message.');
    const finding: Finding = { check, file: read('file') ?? '', message, help, fixable: false };
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
 * @returns the findings from a valid report
 */
export function parseJson(check: string, output: OutputFormat, stdout: string, help: string): Finding[] {
    const start = stdout.search(/[[{]/u);
    if (start === -1) throw new Error('The tool returned no JSON report.');
    const parsed: unknown = JSON.parse(stdout.slice(start));
    const shape = { check, help, output };
    const keys = output.children === undefined ? [] : output.children.split('.');
    return listAt(parsed, output.items).flatMap((item) =>
        chainsUnder([item], keys).map((chain) => jsonFinding(shape, chain)),
    );
}
