import { isDeepStrictEqual } from 'node:util';
import { GspotError } from '#cli/system/errors.ts';
import { isReasonedValue } from '#cli/settings/file.ts';
import { type TomlTable } from '#cli/types/settings/file.ts';
import { encodeValue } from '#cli/settings/text/inline-values.ts';
import { stringify, parseDocument } from '@decimalturn/toml-patch';
import { type KeyPath } from '#cli/types/parsers/editable-file.ts';
import { type LayoutSection, type TomlCommentAnchor } from '#cli/types/settings/text.ts';
import { isTable, getValueAt, createTable, normalizeTables } from '#cli/system/tables.ts';

import {
    TOML_HEADER_FORMAT,
    IGNORE_IDENTITY_FIELDS,
    TOML_ASSIGNMENT_FORMAT,
} from '#cli/config/settings/text/layout.ts';
import {
    isTomlKind,
    getTomlRange,
    addTomlComment,
    insertTomlComments,
    listAnchoredComments,
} from '#cli/parsers/formats/toml/syntax.ts';
import {
    type TomlBlock,
    type TomlSyntax,
    type TomlComments,
    type TomlKeyValue,
    type TomlCommentNode,
    type TomlAnchoredComment,
    type TomlCommentPlacement,
} from '#cli/types/parsers/formats/toml.ts';

function encodeAssignment(key: string, value: unknown, path: KeyPath): { text: string; pair: TomlKeyValue } {
    const assignment = stringify({ [key]: value }, TOML_ASSIGNMENT_FORMAT);
    const text =
        path[0] === 'scope' && key.includes('.') ? assignment.replace(JSON.stringify(key), () => key) : assignment;
    const pair = parseDocument(text).cst.find((node) => isTomlKind(node, 'KeyValue')) as TomlKeyValue;
    return { text, pair };
}

function encodeHeader(path: KeyPath): string {
    const keys = path.filter((key): key is string => typeof key === 'string');
    let value: TomlTable = { value: true };
    for (const key of keys.toReversed()) value = { [key]: value };
    const text = stringify(value, TOML_HEADER_FORMAT);
    const section = parseDocument(text).cst.find(
        (node) => 'items' in node && JSON.stringify(node.key.item.value) === JSON.stringify(keys),
    ) as Exclude<TomlBlock, TomlKeyValue | TomlCommentNode>;
    const header = text.slice(...getTomlRange(section.key));
    return typeof path.at(-1) === 'number' ? `[${header}]` : header;
}

function listScopeAssignments(key: string, value: unknown): [string, unknown][] {
    const assignments: [string, unknown][] = [];
    const pending: (readonly [string, unknown])[] = [[key, value]];
    while (pending.length > 0) {
        const [name, pendingValue] = pending.shift() as [string, unknown];
        if (isTable(pendingValue) && !isReasonedValue(pendingValue)) {
            const nested = Object.entries(pendingValue).map(([key, value]) => [`${name}.${key}`, value] as const);
            pending.unshift(...nested);
        } else assignments.push([name, pendingValue]);
    }
    return assignments;
}

function splitSection(
    value: TomlTable,
    path: KeyPath,
    comments: TomlComments,
): { assignments: [string, unknown][]; children: LayoutSection[] } {
    const isScope = path[0] === 'scope' && typeof path[1] === 'number';
    const isToolRule = (path[0] === 'tools' || path[2] === 'tools') && path.at(-1) === 'rules';
    const childRows = Object.entries(value).map(([key, child]) => {
        const isChildTable = isTable(child);
        const hasReason = isReasonedValue(child);
        const childPath = [...path, key];
        const hasComments = comments
            .values()
            .some(({ path: note }) => childPath.every((segment, index) => note[index] === segment));
        const row = { key, child, isTable: isChildTable, childPath };
        return {
            ...row,
            isScopeTable: isScope && isChildTable,
            isRecordList: isRecordArray(child) && !isToolRule,
            isInline: hasReason || key === 'output',
            isCommentedReasonedValue: hasReason && hasComments,
        };
    });
    const scopeAssignments = new Map(
        childRows
            .filter(({ isScopeTable }) => isScopeTable)
            .map(({ key, child }) => [key, listScopeAssignments(key, child)] as const),
    );
    const sections = childRows.map(
        ({ key, child, isTable, isScopeTable, isRecordList, isInline, isCommentedReasonedValue, childPath }) => {
            const assignments: [string, unknown][] = [];
            const children: LayoutSection[] = [];
            if (isScopeTable) return { assignments: scopeAssignments.get(key) as [string, unknown][], children };
            if (isTable && isInline && !isCommentedReasonedValue) assignments.push([key, child]);
            else if (isTable) children.push({ path: childPath, table: child as TomlTable });
            else if (isRecordList)
                children.push(
                    ...(child as TomlTable[]).map((record, index) => ({
                        path: [...path, key, index],
                        table: record,
                    })),
                );
            else assignments.push([key, child]);
            return { assignments, children };
        },
    );
    return {
        assignments: sections.flatMap((section) => section.assignments),
        children: sections.flatMap((section) => section.children),
    };
}

/**
Build the TOML text of the ordered tables, with the kept comments around TOML values.

@param table the ordered written values.
@param indent the whitespace for one level.
@param comments the kept `#` lines on their keys and headers.
@returns the formatted TOML text.
*/
export function encodeSettings(table: TomlTable, indent: string, comments: TomlComments): string {
    const blocks: string[] = [];
    const root: string[] = [];
    function encodeTable(value: TomlTable, path: KeyPath): void {
        const { assignments, children } = splitSection(value, path, comments);
        const lines = assignments.map(([key, child]) => {
            const { text, pair } = encodeAssignment(key, child, path);
            return insertTomlComments(
                comments,
                'key',
                [...path, key],
                text.slice(getTomlRange(pair.key)[0], getTomlRange(pair.value)[0]) +
                    encodeValue(pair.value, text, [...path, key], comments, indent),
            );
        });
        if (path.length === 0) root.push(...lines);
        else if (lines.length > 0 || children.length === 0 || comments.has(JSON.stringify(['header', ...path])))
            blocks.push([insertTomlComments(comments, 'header', path, encodeHeader(path)), ...lines].join('\n'));
        for (const child of children) {
            encodeTable(child.table, child.path);
        }
    }
    encodeTable(table, []);
    const first = root.length > 0 ? root.join('\n') : (blocks.shift() ?? '');
    const output =
        [insertTomlComments(comments, 'preamble', [], first), ...blocks].filter((block) => block !== '').join('\n\n') +
        '\n';
    if (comments.size > 0)
        throw new GspotError(
            'settings',
            comments
                .values()
                .map(
                    ({ path }) =>
                        `The comment for ${path.map(String).join('.')} cannot be represented in TOML 1.0. Move that field out of its inline table before writing the settings.`,
                )
                .toArray()
                .join('\n'),
        );
    return output;
}

function isMatchingRecord(source: TomlTable, value: unknown, path: KeyPath): boolean {
    if (!isTable(value)) return false;
    if (path[0] === 'ignore')
        return IGNORE_IDENTITY_FIELDS.every((key) =>
            isDeepStrictEqual(normalizeTables(source[key]), normalizeTables(value[key])),
        );
    const name = source['name'];
    return name === undefined
        ? isDeepStrictEqual(normalizeTables(source), normalizeTables(value))
        : isDeepStrictEqual(normalizeTables(name), normalizeTables(value['name']));
}

function listMatchingPositions(
    original: readonly unknown[],
    values: readonly unknown[],
    position: number,
    path: KeyPath,
): number[] {
    const source = original[position];
    if (!isTable(source)) {
        const matches = values.flatMap((value, index) =>
            isDeepStrictEqual(normalizeTables(value), normalizeTables(source)) ? [index] : [],
        );
        const occurrence = original
            .slice(0, position)
            .filter((value) => isDeepStrictEqual(normalizeTables(value), normalizeTables(source))).length;
        const index = matches[occurrence] ?? matches[0];
        return index === undefined ? [] : [index];
    }
    const matches = values.flatMap((value, index) => (isMatchingRecord(source, value, path) ? index : []));
    if (matches.length === 0) return path[0] === 'ignore' || position >= values.length ? [] : [position];
    const until = normalizeTables(source['until']);
    return matches.toSorted((left, right) => {
        const leftUntil = normalizeTables(getValueAt(values[left], ['until']));
        const rightUntil = normalizeTables(getValueAt(values[right], ['until']));
        return Number(!isDeepStrictEqual(until, leftUntil)) - Number(!isDeepStrictEqual(until, rightUntil));
    });
}

function listDestinationPaths(syntax: TomlSyntax, destination: TomlTable, path: KeyPath): KeyPath[] {
    let mapped: KeyPath[] = [[]];
    for (const [index, key] of path.entries()) {
        if (typeof key === 'string') {
            mapped = mapped.map((keyPath) => [...keyPath, key]);
            continue;
        }
        const prior: unknown = getValueAt(syntax.value, path.slice(0, index));
        if (!Array.isArray(prior)) return [];
        const original: readonly unknown[] = prior;
        mapped = mapped.flatMap((keyPath) => {
            const next: unknown = getValueAt(destination, keyPath);
            if (!Array.isArray(next)) return [];
            const values: readonly unknown[] = next;
            return listMatchingPositions(original, values, key, path).map((position) => [...keyPath, position]);
        });
    }
    return mapped.filter((keyPath) => getValueAt(destination, keyPath) !== undefined);
}

function findCommentPlace(syntax: TomlSyntax, destination: TomlTable, owner: TomlCommentAnchor) {
    const path = listDestinationPaths(syntax, destination, owner.path)[0];
    if (path === undefined) {
        if (owner.kind === 'item' || getValueAt(destination, owner.path) === undefined)
            return { kind: owner.kind, path };
        const [header] = [
            syntax.pathNodes.findLast(
                (pathNode) =>
                    pathNode.kind === 'header' && pathNode.path.every((key, index) => owner.path[index] === key),
            ),
        ].flatMap((table) => (table?.path.every((key) => typeof key === 'string') === true ? [table.path] : []));
        if (header === undefined) return { kind: 'preamble', path: [] };
        createTable(destination, header);
        return { kind: 'header', path: header };
    }
    if (owner.kind !== 'key') return { kind: owner.kind, path };
    const value: unknown = getValueAt(destination, path);
    if (isTable(value)) return { kind: 'header', path };
    return isRecordArray(value) ? { kind: 'header', path: [...path, 0] } : { kind: owner.kind, path };
}

function findKeptCommentPlacement(
    syntax: TomlSyntax,
    destination: TomlTable,
    { comment, anchor: owner }: TomlAnchoredComment,
): TomlCommentPlacement {
    const isOpening =
        owner === undefined &&
        syntax.pathNodes.every((pathNode) => getTomlRange(comment)[1] < getTomlRange(pathNode.node)[0]);
    if (isOpening) return { kind: 'preamble', path: [], comment, placement: 'free' };
    if (owner !== undefined) {
        const mapped = findCommentPlace(syntax, destination, owner);
        return { ...mapped, comment, placement: mapped.kind === 'preamble' ? 'free' : 'owned' };
    }
    const next = syntax.pathNodes.find(
        (pathNode) =>
            getTomlRange(pathNode.node)[0] > getTomlRange(comment)[1] &&
            listDestinationPaths(syntax, destination, pathNode.path).length > 0,
    );
    const anchor = findCommentPlace(syntax, destination, next ?? { kind: 'preamble', path: [] });
    return { ...anchor, comment, placement: 'free' };
}

/**
Keep each comment on the key that still owns it before records merge or move.
An unclear split gives its general comments to the first row; path comments follow their own values.

@param syntax the original keys, headers, and parsed values.
@param destination the ordered written values.
@returns the comment blocks in source order, and the free comments apart.
*/
export function listKeptComments(syntax: TomlSyntax, destination: TomlTable): TomlComments {
    const comments: TomlComments = new Map();
    for (const anchoredComment of listAnchoredComments(syntax)) {
        addTomlComment(comments, findKeptCommentPlacement(syntax, destination, anchoredComment));
    }
    return comments;
}

// eslint-disable-next-line gspot/no-trivial-functions -- reason: Callers narrow the type through it.
function isRecordArray(value: unknown): value is Record<string, unknown>[] {
    return Array.isArray(value) && value.length > 0 && value.every(isTable);
}
