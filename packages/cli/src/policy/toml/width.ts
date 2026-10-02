// Keeping every line of gspot.toml readable: an array that runs past the width goes one item per line.
import { parseDocument } from '@decimalturn/toml-patch';
import type { TomlTable } from '#cli/types/policy/policy.ts';
import { expandLongTables } from '#cli/policy/toml/tables.ts';
import type { Edit, KeyValue, TomlBlock } from '#cli/types/policy/toml.ts';
import { POLICY_LINE_WIDTH, DEFAULT_INDENT_WIDTH } from '#cli/config/policy/toml.ts';
import { isValue, isComment, isKeyValue, isInlineArray } from '#cli/policy/toml/nodes.ts';

function getPairs(blocks: TomlBlock[]): KeyValue[] {
    return blocks.flatMap((block) => {
        if (isKeyValue(block)) return [block];
        if (isComment(block)) return [];
        return block.items.filter((entry) => isKeyValue(entry));
    });
}

function wrapped(text: string, pair: KeyValue, lines: string[], indent: string, width: number): Edit | undefined {
    const { value } = pair;
    if (!isInlineArray(value) || value.range === undefined) return undefined;
    if ((lines[pair.loc.start.line - 1] ?? '').length <= width) return undefined;
    const items = value.items.map((entry) => entry.item);
    const ranges = items.flatMap((item) => (item.range === undefined || !isValue(item) ? [] : [item.range]));
    if (items.length === 0 || ranges.length !== items.length) return undefined;
    const pad = ' '.repeat(pair.loc.start.column);
    const body = ranges.map(([start, end]) => `${pad}${indent}${text.slice(start, end)},`).join('\n');
    return { start: value.range[0], end: value.range[1], replacement: `[\n${body}\n${pad}]` };
}

/**
 * Rewrites every array whose line runs past the width as one item per line, each item as it was written.
 * @param text the TOML text
 * @param indent the indentation of one item
 * @param width the most characters a line may hold
 * @returns the text with those arrays wrapped
 */
export function wrapLongArrays(
    text: string,
    indent = ' '.repeat(DEFAULT_INDENT_WIDTH),
    width = POLICY_LINE_WIDTH,
): string {
    const expanded = expandLongTables(text, width);
    const lines = expanded.split('\n');
    const edits = getPairs(parseDocument(expanded).cst)
        .map((pair) => wrapped(expanded, pair, lines, indent, width))
        .filter((edit) => edit !== undefined)
        .toSorted((left, right) => right.start - left.start);
    let out = expanded;
    for (const edit of edits) out = `${out.slice(0, edit.start)}${edit.replacement}${out.slice(edit.end)}`;
    return out;
}

/**
 * The indentation the policy's own format settings ask for, so the TOML formatter agrees with what was written.
 * @param raw the parsed document
 * @returns the indentation of one nested item
 */
export function getIndent(raw: TomlTable): string {
    const format = raw['format'];
    if (typeof format !== 'object' || format === null || Array.isArray(format)) return ' '.repeat(DEFAULT_INDENT_WIDTH);
    const table = format as TomlTable;
    if (table['indent_style'] === 'tab') return '\t';
    const width = table['indent_width'];
    return ' '.repeat(typeof width === 'number' && Number.isInteger(width) && width > 0 ? width : DEFAULT_INDENT_WIDTH);
}
