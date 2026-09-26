// Keeping every line of gspot.toml readable: an array that runs past the width goes one item per line.
import type { TomlTable } from '#cli/repository/configuration-section.ts';
import { parseDocument } from '@decimalturn/toml-patch';

/** The most characters one line of gspot.toml holds. */
export const POLICY_LINE_WIDTH = 120;

const DEFAULT_INDENT_WIDTH = 4;

type Block = ReturnType<typeof parseDocument>['cst'][number];
type KeyValue = Extract<Block, { type: 'KeyValue' }>;
type Value = KeyValue['value'];
type Edit = { start: number; end: number; replacement: string };

function isValue(node: { type: string }): node is Value {
    return ['String', 'Integer', 'Float', 'Boolean', 'DateTime', 'InlineArray', 'InlineTable'].includes(node.type);
}

function keyValues(blocks: Block[]): KeyValue[] {
    return blocks.flatMap((block) => {
        if (block.type === 'KeyValue') return [block];
        if (block.type === 'Comment') return [];
        return block.items.filter((entry): entry is KeyValue => entry.type === 'KeyValue');
    });
}

function wrapped(text: string, pair: KeyValue, lines: string[], indent: string, width: number): Edit | undefined {
    const { value } = pair;
    if (value.type !== 'InlineArray' || value.range === undefined) return undefined;
    if ((lines[pair.loc.start.line - 1] ?? '').length <= width) return undefined;
    const items = value.items.map((entry) => entry.item);
    if (items.length === 0 || items.some((item) => item.range === undefined || !isValue(item))) return undefined;
    const pad = ' '.repeat(pair.loc.start.column);
    const body = items.map((item) => `${pad}${indent}${text.slice(item.range![0], item.range![1])},`).join('\n');
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
