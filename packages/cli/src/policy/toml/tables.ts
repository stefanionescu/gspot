import { parseDocument } from '@decimalturn/toml-patch';
import type { Edit, Value, KeyValue, TomlBlock } from '#cli/types/policy/toml.ts';
import { isValue, isKeyValue, isInlineArray, isInlineTable } from '#cli/policy/toml/nodes.ts';

function getInlineTables(value: Value): Extract<Value, { type: 'InlineTable' }>[] {
    if (!isInlineArray(value)) return [];
    const items = value.items.map(({ item }) => item);
    const tables = items.filter(isValue).filter(isInlineTable);
    return tables.length === items.length ? tables : [];
}

function isTooWide(value: Value, width: number): boolean {
    if (isInlineTable(value)) return value.items.some(({ item }) => isTooWide(item.value, width));
    return getInlineTables(value).some((item) => item.loc.end.column - item.loc.start.column > width);
}

function getRange(node: { range?: readonly [number, number] }): readonly [number, number] {
    if (node.range === undefined) throw new Error('A parsed TOML node has no source range.');
    return node.range;
}

function flatten(pair: KeyValue, prefix: string): { key: string; value: Value }[] {
    const key = `${prefix}${pair.key.raw}`;
    if (isInlineTable(pair.value) && pair.value.items.length > 0)
        return pair.value.items.flatMap(({ item }) => flatten(item, `${key}.`));
    return [{ key, value: pair.value }];
}

function getComments(text: string): string {
    return text
        .split('\n')
        .flatMap((line) => {
            const content = line.trim().replace(/^,/u, '').trimStart();
            return content.startsWith('#') ? [content] : [];
        })
        .join('\n');
}

function buildBlocks(text: string, key: string, value: Value, pad: string): string {
    const tables = getInlineTables(value);
    let previous = getRange(value)[0];
    const output = tables.map((table) => {
        const start = getRange(table)[0];
        const leading = getComments(text.slice(previous + 1, start));
        previous = getRange(table)[1];
        const assignments = table.items.flatMap(({ item }) => flatten(item, ''));
        const ordinary = assignments.filter((entry) => getInlineTables(entry.value).length === 0);
        const nested = assignments.filter((entry) => getInlineTables(entry.value).length > 0);
        return [
            leading,
            `${pad}[[${key}]]`,
            ...ordinary.map((entry) => `${pad}${entry.key} = ${text.slice(...getRange(entry.value))}`),
            ...nested.map((entry) => buildBlocks(text, `${key}.${entry.key}`, entry.value, pad)),
        ]
            .filter((line) => line !== '')
            .join('\n');
    });
    const trailing = getComments(text.slice(previous, getRange(value)[1]));
    if (trailing !== '') output.push(trailing);
    return output.join('\n\n');
}

function sectionEdits(text: string, rows: TomlBlock[], prefix: string, end: number, width: number): Edit[] {
    const edits: Edit[] = [];
    const additions: string[] = [];
    for (const pair of rows) {
        if (!isKeyValue(pair) || !isTooWide(pair.value, width)) continue;
        const [start, stop] = getRange(pair);
        const pad = text.slice(text.lastIndexOf('\n', start - 1) + 1, start);
        const assignments = flatten(pair, '');
        const ordinary = assignments.filter((entry) => !isTooWide(entry.value, width));
        for (const entry of assignments.filter((entry) => isTooWide(entry.value, width)))
            additions.push(buildBlocks(text, `${prefix}${entry.key}`, entry.value, pad));
        edits.push({
            start,
            end: stop,
            replacement: ordinary
                .map((entry) => `${entry.key} = ${text.slice(...getRange(entry.value))}`)
                .join(`\n${pad}`),
        });
    }
    if (additions.length > 0) edits.push({ start: end, end, replacement: `\n${additions.join('\n\n')}\n` });
    return edits;
}

/**
 * Expands oversized inline-table lists before the next table changes their scope.
 * @param text the original TOML document.
 * @param width the maximum inline-table width.
 * @returns TOML retaining values, comments, and array-table ownership.
 */
export function expandLongTables(text: string, width: number): string {
    const nodes = parseDocument(text).cst;
    const edits: Edit[] = [];
    let rows: TomlBlock[] = [];
    let prefix = '';
    for (const node of nodes) {
        if ('items' in node) {
            edits.push(...sectionEdits(text, rows, prefix, getRange(node)[0], width));
            rows = node.items;
            prefix = `${node.key.item.raw}.`;
        } else rows.push(node);
    }
    edits.push(...sectionEdits(text, rows, prefix, text.length, width));
    let output = text;
    for (const edit of edits.toSorted((left, right) => right.start - left.start || right.end - left.end))
        output = `${output.slice(0, edit.start)}${edit.replacement}${output.slice(edit.end)}`;
    return output;
}
