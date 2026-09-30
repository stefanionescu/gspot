import { parseDocument } from '@decimalturn/toml-patch';
import type { Value, KeyValue, Position, PathSegment } from '#cli/types/policy/policy.ts';

import {
    isComment,
    isKeyValue,
    isTomlValue,
    isTableArray,
    isInlineArray,
    isInlineTable,
} from '#cli/policy/toml/nodes.ts';

function valueLocations(value: Value, path: PathSegment[], locations: Map<string, Position>): void {
    locations.set(JSON.stringify(path), value.loc.start);
    if (isInlineTable(value)) {
        for (const entry of value.items) keyLocations(entry.item, path, locations);
        return;
    }
    if (!isInlineArray(value)) return;
    const items = value.items.map((entry) => entry.item).filter(isTomlValue);
    for (const [index, item] of items.entries()) valueLocations(item, [...path, index], locations);
}

// eslint-disable-next-line gspot/no-trivial-functions -- reason: Three walkers descend through a key; it and valueLocations call each other.
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
 * Map policy paths to authored values in ordinary, repeated, and nested TOML tables.
 * @param text the policy text
 * @returns the position of every key path, the root at line 1
 */
export function sourceLocations(text: string): Map<string, Position> {
    const locations = new Map<string, Position>([['[]', { line: 1, column: 0 }]]);
    const arrays = new Map<string, number>();
    const blocks = parseDocument(text).cst.filter((block) => !isComment(block));
    for (const block of blocks) {
        if (isKeyValue(block)) {
            keyLocations(block, [], locations);
            continue;
        }
        const parts = block.key.item.value;
        let path: PathSegment[];
        if (isTableArray(block)) {
            const parent = expandedTable(parts.slice(0, -1), arrays);
            const target = [...parent, ...parts.slice(-1)];
            const key = JSON.stringify(target);
            const index = (arrays.get(key) ?? -1) + 1;
            arrays.set(key, index);
            path = [...target, index];
        } else path = expandedTable(parts, arrays);
        locations.set(JSON.stringify(path), block.key.loc.start);
        const entries = block.items.filter((entry) => isKeyValue(entry));
        for (const entry of entries) keyLocations(entry, path, locations);
    }
    return locations;
}

/**
 * Locate a value or, for an absent required value, its nearest authored container.
 * @param locations the positions of every key path
 * @param path the key path
 * @returns the position as line:column
 */
// eslint-disable-next-line gspot/no-trivial-functions -- reason: Every policy problem line prints its position as line:column through this.
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
