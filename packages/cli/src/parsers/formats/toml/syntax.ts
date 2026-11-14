import { parseDocument } from '@decimalturn/toml-patch';
import { isTable, findValueAt } from '#cli/system/tables.ts';
import { MISSING_RANGE_MESSAGE } from '#cli/config/parsers/formats.ts';

import type {
    KeyPath,
    TomlBlock,
    TomlValue,
    TomlSyntax,
    SourceRange,
    TomlDocument,
    TomlKeyValue,
    TomlLocation,
    TomlCommentNode,
    TomlTablePositions,
} from '#cli/types/parsers.ts';

function addTomlRanges(node: unknown, lineStarts: readonly number[]): void {
    if (Array.isArray(node)) {
        for (const child of node) addTomlRanges(child, lineStarts);
        return;
    }
    if (!isTable(node) || node['loc'] === undefined) return;
    const { start, end } = node['loc'] as TomlLocation;
    const range = [start, end].map(({ line, column }) => (lineStarts[line - 1] ?? 0) + column);
    Object.defineProperty(node, 'range', { value: range });
    for (const child of Object.values(node)) addTomlRanges(child, lineStarts);
}

function buildTablePath(
    node: Exclude<TomlBlock, TomlKeyValue | TomlCommentNode>,
    positions: TomlTablePositions,
): KeyPath {
    const path: Array<KeyPath[number]> = [];
    for (const [index, key] of node.key.item.value.entries()) {
        path.push(key);
        if (!Array.isArray(findValueAt(positions.value, path))) continue;
        const name = JSON.stringify(node.key.item.value.slice(0, index + 1));
        let position = positions.active.get(name) ?? 0;
        if (isTomlKind(node, 'TableArray') && index === node.key.item.value.length - 1) {
            position = positions.counts.get(name) ?? 0;
            positions.counts.set(name, position + 1);
            positions.active.set(name, position);
        }
        path.push(position);
    }
    return path;
}

function listNestedNodes(node: TomlValue, keys: KeyPath): TomlSyntax['pathNodes'] {
    if (isTomlKind(node, 'InlineArray'))
        return node.items.flatMap(({ item }, index): TomlSyntax['pathNodes'] => {
            const value = item as TomlValue;
            const child = [...keys, index];
            return [{ kind: 'item', path: child, node: value }, ...listNestedNodes(value, child)];
        });
    if (isTomlKind(node, 'InlineTable'))
        return node.items.flatMap(({ item }): TomlSyntax['pathNodes'] => {
            const child = [...keys, ...item.key.value];
            return [{ kind: 'key', path: child, node: item }, ...listNestedNodes(item.value, child)];
        });
    return [];
}

export function isTomlKind<Kind extends string>(
    node: { type: unknown },
    kind: Kind,
): node is Extract<TomlBlock | TomlValue, { type: Kind }> {
    return String(node.type) === kind;
}

export function parseTomlDocument(source: string): TomlDocument {
    const document = parseDocument(source);
    const lineStarts = [0];
    for (let index = source.indexOf('\n'); index !== -1; index = source.indexOf('\n', index + 1))
        lineStarts.push(index + 1);
    addTomlRanges(document.cst, lineStarts);
    return document;
}

export function parseTomlSyntax(source: string, parsed: Record<string, unknown>): TomlSyntax {
    const document = parseTomlDocument(source);
    const comments: TomlSyntax['comments'] = [];
    const positions = { value: parsed, counts: new Map<string, number>(), active: new Map<string, number>() };
    const pathNodes = document.cst.flatMap((node): TomlSyntax['pathNodes'] => {
        if (isTomlKind(node, 'Comment')) {
            comments.push(node);
            return [];
        }
        if (isTomlKind(node, 'KeyValue'))
            return [{ kind: 'key', path: node.key.value, node }, ...listNestedNodes(node.value, node.key.value)];
        const path = buildTablePath(node, positions);
        const children = node.items.flatMap((child): TomlSyntax['pathNodes'] => {
            if (isTomlKind(child, 'Comment')) {
                comments.push(child);
                return [];
            }
            return [
                {
                    kind: 'key',
                    path: [...path, ...child.key.value],
                    node: child,
                },
                ...listNestedNodes(child.value, [...path, ...child.key.value]),
            ];
        });
        return [{ kind: 'header', path, node: node.key }, ...children];
    });
    return {
        document,
        value: parsed,
        pathNodes,
        comments: comments.toSorted((left, right) => getTomlRange(left)[0] - getTomlRange(right)[0]),
    };
}

export function getTomlRange(node: SourceRange): readonly [number, number] {
    if (node.range === undefined) throw new Error(MISSING_RANGE_MESSAGE);
    return node.range;
}
