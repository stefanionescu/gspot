// Findings from a tool that prints JSON: the manifest names where the list is and which field holds what.
import { isAbsolute } from 'node:path';
import { valueAt } from '#cli/platform/objects.ts';
import { toPosix, toolPath } from '#cli/platform/paths.ts';
import type { Finding, OutputSpec, JsonFindingSpec } from '#cli/types/parsers/output.ts';

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
