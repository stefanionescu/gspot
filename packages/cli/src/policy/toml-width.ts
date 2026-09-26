// Keeping every line of gspot.toml readable: an array that runs past the width goes one item per line.
import { parseDocument } from '@decimalturn/toml-patch';
import type { TomlTable } from '#cli/types/repository/repository.ts';
import type { Edit, KeyValue, TomlBlock, Value } from '#cli/types/policy/policy.ts';

const DEFAULT_INDENT_WIDTH = 4;

function isValue(node: { type: string }): node is Value {
    return ['String', 'Integer', 'Float', 'Boolean', 'DateTime', 'InlineArray', 'InlineTable'].includes(node.type);
}

function keyValues(blocks: TomlBlock[]): KeyValue[] {
    return blocks.flatMap((block) => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison -- toml-patch does not export its node kinds
        if (block.type === 'KeyValue') return [block];
        // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison -- toml-patch does not export its node kinds
        if (block.type === 'Comment') return [];
        // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison -- toml-patch does not export its node kinds
        return block.items.filter((entry): entry is KeyValue => entry.type === 'KeyValue');
    });
}

function wrapped(text: string, pair: KeyValue, lines: string[], indent: string, width: number): Edit | undefined {
    const { value } = pair;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison -- toml-patch does not export its node kinds
    if (value.type !== 'InlineArray' || value.range === undefined) return undefined;
    if ((lines[pair.loc.start.line - 1] ?? '').length <= width) return undefined;
    const items = value.items.map((entry) => entry.item);
    const ranges = items.flatMap((item) => (item.range === undefined || !isValue(item) ? [] : [item.range]));
    if (items.length === 0 || ranges.length !== items.length) return undefined;
    const pad = ' '.repeat(pair.loc.start.column);
    const body = ranges.map(([start, end]) => `${pad}${indent}${text.slice(start, end)},`).join('\n');
    return { start: value.range[0], end: value.range[1], replacement: `[\n${body}\n${pad}]` };
}

/** The most characters one line of gspot.toml holds. */
export const POLICY_LINE_WIDTH = 120;

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
    const lines = text.split('\n');
    const edits = keyValues(parseDocument(text).cst)
        .map((pair) => wrapped(text, pair, lines, indent, width))
        .filter((edit) => edit !== undefined)
        .toSorted((left, right) => right.start - left.start);
    let out = text;
    for (const edit of edits) out = `${out.slice(0, edit.start)}${edit.replacement}${out.slice(edit.end)}`;
    return out;
}

/**
 * The indentation the policy's own format settings ask for, so the TOML formatter agrees with what was written.
 * @param raw the parsed document
 * @returns the indentation of one nested item
 */
export function policyIndent(raw: TomlTable): string {
    const format = raw['format'];
    if (typeof format !== 'object' || format === null || Array.isArray(format)) return ' '.repeat(DEFAULT_INDENT_WIDTH);
    const table = format as TomlTable;
    if (table['indent_style'] === 'tab') return '\t';
    const width = table['indent_width'];
    return ' '.repeat(typeof width === 'number' && Number.isInteger(width) && width > 0 ? width : DEFAULT_INDENT_WIDTH);
}
