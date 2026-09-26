import { parseDocument } from '@decimalturn/toml-patch';
import type { PathSegment } from '#cli/policy/problems.ts';

type Block = ReturnType<typeof parseDocument>['cst'][number];
type KeyValue = Extract<Block, { type: 'KeyValue' }>;
type Value = KeyValue['value'];
type Position = Value['loc']['start'];

function isValue(node: { type: string; loc: Value['loc'] }): node is Value {
    return ['String', 'Integer', 'Float', 'Boolean', 'DateTime', 'InlineArray', 'InlineTable'].includes(node.type);
}

function valueLocations(value: Value, path: PathSegment[], locations: Map<string, Position>): void {
    locations.set(JSON.stringify(path), value.loc.start);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison -- toml-patch does not export its node kinds
    if (value.type === 'InlineTable') {
        for (const entry of value.items) keyLocations(entry.item, path, locations);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison -- toml-patch does not export its node kinds
    } else if (value.type === 'InlineArray') {
        let index = 0;
        for (const entry of value.items) {
            if (!isValue(entry.item)) continue;
            valueLocations(entry.item, [...path, index], locations);
            index += 1;
        }
    }
}

function keyLocations(node: KeyValue, parent: PathSegment[], locations: Map<string, Position>): void {
    const path = [...parent, ...node.key.value];
    valueLocations(node.value, path, locations);
}

function expandedTable(parts: string[], arrays: Map<string, number>): PathSegment[] {
    const path: PathSegment[] = [];
    for (const part of parts) {
        path.push(part);
        const index = arrays.get(JSON.stringify(path));
        if (index !== undefined) path.push(index);
    }
    return path;
}

/**
 * Map policy paths to authored values, including repeated and nested TOML tables.
 * @param text the policy text
 * @returns the position of every key path, the root at line 1
 */
export function sourceLocations(text: string): Map<string, Position> {
    const locations = new Map<string, Position>([['[]', { line: 1, column: 0 }]]);
    const arrays = new Map<string, number>();
    for (const block of parseDocument(text).cst) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison -- toml-patch does not export its node kinds
        if (block.type === 'Comment') continue;
        // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison -- toml-patch does not export its node kinds
        if (block.type === 'KeyValue') {
            keyLocations(block, [], locations);
            continue;
        }
        const parts = block.key.item.value;
        let path: PathSegment[];
        // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison -- toml-patch does not export its node kinds
        if (block.type === 'TableArray') {
            const parent = expandedTable(parts.slice(0, -1), arrays);
            const target = [...parent, ...parts.slice(-1)];
            const key = JSON.stringify(target);
            const index = (arrays.get(key) ?? -1) + 1;
            arrays.set(key, index);
            path = [...target, index];
        } else path = expandedTable(parts, arrays);
        locations.set(JSON.stringify(path), block.key.loc.start);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison -- toml-patch does not export its node kinds
        for (const entry of block.items) if (entry.type === 'KeyValue') keyLocations(entry, path, locations);
    }
    return locations;
}

/**
 * Locate a value or, for an absent required value, its nearest authored container.
 * @param locations the positions of every key path
 * @param path the key path
 * @returns the position as line:column
 */
export function policyLocation(locations: Map<string, Position>, path: PathSegment[]): string {
    const { line, column } = policyPosition(locations, path);
    return `${String(line)}:${String(column)}`;
}

/**
 * The line and one-based column of a value or, for an absent required value, of its nearest authored container.
 * @param locations the authored locations of a policy text
 * @param path the policy path
 * @returns the position
 */
export function policyPosition(
    locations: Map<string, Position>,
    path: PathSegment[],
): { line: number; column: number } {
    const remaining = [...path];
    for (;;) {
        const position = locations.get(JSON.stringify(remaining));
        if (position !== undefined) return { line: position.line, column: position.column + 1 };
        remaining.pop();
    }
}
