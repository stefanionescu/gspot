import { isDeepStrictEqual } from 'node:util';
import { GspotError } from '#cli/system/errors.ts';
import { isReasonedValue } from '#cli/settings/file.ts';
import { encodeValue } from '#cli/settings/write/values.ts';
import { type TomlTable } from '#cli/types/settings/file.ts';
import { type LayoutSection } from '#cli/types/settings/edits.ts';
import { stringify, parseDocument } from '@decimalturn/toml-patch';
import { type KeyPath } from '#cli/types/parsers/editable-file.ts';
import { isRecord, getValueAt, createTable, normalizeTables } from '#cli/system/values.ts';
import { TOML_HEADER_FORMAT, TOML_ASSIGNMENT_FORMAT, IGNORE_IDENTITY_FIELDS } from '#cli/config/settings/file.ts';

import {
    isTomlKind,
    getTomlRange,
    addTomlComment,
    insertTomlComments,
    listAnchoredComments,
} from '#cli/parsers/toml/comments.ts';
import {
    type TomlBlock,
    type TomlSyntax,
    type TomlComments,
    type TomlKeyValue,
    type TomlCommentNode,
    type TomlCommentAnchor,
    type TomlAnchoredComment,
    type TomlCommentPlacement,
} from '#cli/types/parsers/toml.ts';

function encodeAssignment(key: string, value: unknown, path: KeyPath): { text: string; pair: TomlKeyValue } {
    const assignment = stringify({ [key]: value }, TOML_ASSIGNMENT_FORMAT);
    const text = path[0] === 'scope' && key.includes('.') ? assignment.replace(JSON.stringify(key), key) : assignment;
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
        const [name, item] = pending.shift() as [string, unknown];
        if (isRecord(item) && !isReasonedValue(item)) {
            const nested = Object.entries(item).map(([key, value]) => [`${name}.${key}`, value] as const);
            pending.unshift(...nested);
        } else assignments.push([name, item]);
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
    const entries = Object.entries(value).map(([key, child]) => {
        const isTable = isRecord(child);
        const reasonedValue = isReasonedValue(child);
        const childPath = [...path, key];
        const hasComments = [...comments.values()].some(({ path: note }) =>
            childPath.every((part, index) => note[index] === part),
        );
        const entry = { key, child, isTable, childPath };
        return {
            ...entry,
            isScopeTable: isScope && isTable,
            isRecordList: isRecordArray(child) && !isToolRule,
            isInline: reasonedValue || key === 'output',
            isCommentedReasonedValue: reasonedValue && hasComments,
        };
    });
    const scopeAssignments = new Map(
        entries
            .filter(({ isScopeTable }) => isScopeTable)
            .map(({ key, child }) => [key, listScopeAssignments(key, child)] as const),
    );
    const sections = entries.map(
        ({ key, child, isTable, isScopeTable, isRecordList, isInline, isCommentedReasonedValue, childPath }) => {
            const assignments: [string, unknown][] = [];
            const children: LayoutSection[] = [];
            if (isScopeTable) return { assignments: scopeAssignments.get(key) as [string, unknown][], children };
            if (isTable && isInline && !isCommentedReasonedValue) assignments.push([key, child]);
            else if (isTable) children.push({ path: childPath, table: child as TomlTable });
            else if (isRecordList)
                children.push(
                    ...(child as TomlTable[]).map((encodeTable, index) => ({
                        path: [...path, key, index],
                        table: encodeTable,
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
 * Write the ordered tables, with the kept comments around TOML values.
 *
 * @param target the ordered written values.
 * @param indent the whitespace for one level.
 * @param comments the kept `#` lines on their keys and headers.
 * @returns the formatted TOML text.
 */
function encodeSettings(target: TomlTable, indent: string, comments: TomlComments): string {
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
    encodeTable(target, []);
    const first = root.length > 0 ? root.join('\n') : (blocks.shift() ?? '');
    const output =
        [insertTomlComments(comments, 'preamble', [], first), ...blocks].filter((block) => block !== '').join('\n\n') +
        '\n';
    if (comments.size > 0)
        throw new GspotError(
            'settings',
            [...comments.values()]
                .map(
                    ({ path }) =>
                        `The comment for ${path.map(String).join('.')} cannot be represented in TOML 1.0. Move that field out of its inline table before writing the settings.`,
                )
                .join('\n'),
        );
    return output;
}

function isSameValue(left: unknown, right: unknown): boolean {
    return isDeepStrictEqual(normalizeTables(left), normalizeTables(right));
}

function listMatchingPositions(
    original: readonly unknown[],
    values: readonly unknown[],
    position: number,
    path: KeyPath,
): number[] {
    const source = original[position];
    if (!isRecord(source)) {
        const matches = values.flatMap((value, index) => (isSameValue(value, source) ? [index] : []));
        const occurrence = original.slice(0, position).filter((value) => isSameValue(value, source)).length;
        const index = matches[occurrence] ?? matches[0];
        return index === undefined ? [] : [index];
    }
    const matches = values.flatMap((value, index) => {
        if (!isRecord(value)) return [];
        if (path[0] === 'ignore')
            return IGNORE_IDENTITY_FIELDS.every((key) => isSameValue(source[key], value[key])) ? [index] : [];
        if (source['name'] !== undefined) return isSameValue(source['name'], value['name']) ? [index] : [];
        return isSameValue(source, value) ? [index] : [];
    });
    if (matches.length === 0) return path[0] === 'ignore' || position >= values.length ? [] : [position];
    return matches.toSorted(
        (left, right) =>
            Number(!isSameValue(source['until'], getValueAt(values[left], ['until']))) -
            Number(!isSameValue(source['until'], getValueAt(values[right], ['until']))),
    );
}

function listDestinationPaths(syntax: TomlSyntax, target: TomlTable, path: KeyPath): KeyPath[] {
    let mapped: KeyPath[] = [[]];
    for (const [index, key] of path.entries()) {
        if (typeof key === 'string') {
            mapped = mapped.map((candidate) => [...candidate, key]);
            continue;
        }
        const prior: unknown = getValueAt(syntax.value, path.slice(0, index));
        if (!Array.isArray(prior)) return [];
        const original: readonly unknown[] = prior;
        mapped = mapped.flatMap((candidate) => {
            const next: unknown = getValueAt(target, candidate);
            if (!Array.isArray(next)) return [];
            const values: readonly unknown[] = next;
            return listMatchingPositions(original, values, key, path).map((position) => [...candidate, position]);
        });
    }
    return mapped.filter((candidate) => getValueAt(target, candidate) !== undefined);
}

function findCommentTarget(syntax: TomlSyntax, target: TomlTable, written: TomlTable, owner: TomlCommentAnchor) {
    const path = listDestinationPaths(syntax, target, owner.path)[0];
    if (path === undefined) {
        if (owner.kind === 'item' || getValueAt(written, owner.path) === undefined) return { kind: owner.kind, path };
        const [header] = [
            syntax.pathNodes.findLast(
                (entry) => entry.kind === 'header' && entry.path.every((key, index) => owner.path[index] === key),
            ),
        ].flatMap((entry) => (entry?.path.every((key) => typeof key === 'string') === true ? [entry.path] : []));
        if (header === undefined) return { kind: 'preamble', path: [] };
        createTable(target, header);
        return { kind: 'header', path: header };
    }
    if (owner.kind !== 'key') return { kind: owner.kind, path };
    const value: unknown = getValueAt(target, path);
    if (isRecord(value)) return { kind: 'header', path };
    if (isRecordArray(value)) return { kind: 'header', path: [...path, 0] };
    return { kind: owner.kind, path };
}

function findKeptCommentPlacement(
    syntax: TomlSyntax,
    target: TomlTable,
    written: TomlTable,
    { comment, anchor: owner }: TomlAnchoredComment,
): TomlCommentPlacement {
    const isOpening =
        owner === undefined &&
        syntax.pathNodes.every((entry) => getTomlRange(comment)[1] < getTomlRange(entry.node)[0]);
    if (isOpening) return { kind: 'preamble', path: [], comment, placement: 'free' };
    if (owner !== undefined) {
        const mapped = findCommentTarget(syntax, target, written, owner);
        return { ...mapped, comment, placement: mapped.kind === 'preamble' ? 'free' : 'owned' };
    }
    const next = syntax.pathNodes.find(
        (entry) =>
            getTomlRange(entry.node)[0] > getTomlRange(comment)[1] &&
            listDestinationPaths(syntax, target, entry.path).length > 0,
    );
    const anchor = findCommentTarget(syntax, target, written, next ?? { kind: 'preamble', path: [] });
    return { ...anchor, comment, placement: 'free' };
}

/**
 * Keep each comment on the key that still owns it before records merge or move.
 * An unclear split gives its general comments to the first row; path comments follow their own values.
 *
 * @param syntax the original keys, headers, and parsed values.
 * @param target the ordered written values.
 * @param written the draft before tool defaults drop out.
 * @returns the comment blocks in source order, and the free comments apart.
 */
function collectKeptComments(syntax: TomlSyntax, target: TomlTable, written: TomlTable): TomlComments {
    const comments: TomlComments = new Map();
    for (const entry of listAnchoredComments(syntax)) {
        addTomlComment(comments, findKeptCommentPlacement(syntax, target, written, entry));
    }
    return comments;
}

/**
 * Identify nonempty arrays of parsed tables for section layout.
 *
 * @param value the parsed input.
 *
 * @returns whether every array item holds a plain table.
 */
function isRecordArray(value: unknown): value is Record<string, unknown>[] {
    return Array.isArray(value) && value.length > 0 && value.every(isRecord);
}

export { encodeSettings, collectKeptComments };
