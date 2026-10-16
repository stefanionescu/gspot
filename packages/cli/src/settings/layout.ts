import { GspotError } from '#cli/system/errors.ts';
import { isRecord, isRecordArray } from '#cli/system/values.ts';
import { stringify, parseDocument } from '@decimalturn/toml-patch';
import type { KeyPath } from '#cli/types/parsers/editable-file.ts';
import type { TomlTable, LayoutSection } from '#cli/types/settings/file.ts';
import { TOML_HEADER_FORMAT, TOML_ASSIGNMENT_FORMAT } from '#cli/config/settings/file.ts';
import type { TomlBlock, TomlValue, TomlComments, TomlKeyValue, TomlCommentNode } from '#cli/types/parsers/toml.ts';

import {
    isKeyValue,
    getTomlRange,
    isInlineArray,
    isInlineTable,
    insertTomlComments,
} from '#cli/parsers/toml/comments.ts';

function tomlAssignment(key: string, value: unknown, dotted = false): { text: string; pair: TomlKeyValue } {
    const assignment = stringify({ [key]: value }, TOML_ASSIGNMENT_FORMAT);
    const text = dotted ? assignment.replace(JSON.stringify(key), key) : assignment;
    const pair = parseDocument(text).cst.find(isKeyValue) as TomlKeyValue;
    return { text, pair };
}

function tomlHeader(path: KeyPath, array: boolean): string {
    const keys = path.filter((key): key is string => typeof key === 'string');
    let value: TomlTable = { value: true };
    for (const key of keys.toReversed()) value = { [key]: value };
    const text = stringify(value, TOML_HEADER_FORMAT);
    const section = parseDocument(text).cst.find(
        (node) => 'items' in node && JSON.stringify(node.key.item.value) === JSON.stringify(keys),
    ) as Exclude<TomlBlock, TomlKeyValue | TomlCommentNode>;
    const header = text.slice(...getTomlRange(section.key));
    return array ? `[${header}]` : header;
}

function encodeValue(node: TomlValue, text: string, path: KeyPath, comments: TomlComments, indent: string): string {
    if (isInlineArray(node)) {
        const items = node.items.map(({ item }, index) => {
            const keys = [...path, index];
            const notes = [...comments.values()]
                .filter(({ path: note }) => path.toReversed()[1] === 'rules' && keys.every((key, i) => note[i] === key))
                .map(({ path: field }) => insertTomlComments(comments, 'key', field, ''))
                .filter(Boolean);
            return insertTomlComments(
                comments,
                'item',
                keys,
                insertTomlComments(
                    comments,
                    'header',
                    keys,
                    [...notes, encodeValue(item as TomlValue, text, keys, comments, indent)].join('\n'),
                ),
            );
        });
        return items.some((item) => item.includes('\n'))
            ? `[\n${items
                  .map((item) =>
                      `${item},`
                          .split('\n')
                          .map((line) => `${indent}${line}`)
                          .join('\n'),
                  )
                  .join('\n')}\n]`
            : `[${items.join(', ')}]`;
    }
    if (isInlineTable(node))
        return `{ ${node.items.map(({ item }) => text.slice(getTomlRange(item.key)[0], getTomlRange(item.value)[0]) + encodeValue(item.value, text, [...path, ...item.key.value], comments, indent)).join(', ')} }`;
    return text.slice(...getTomlRange(node));
}

function sectionEntries(
    value: TomlTable,
    path: KeyPath,
    comments: TomlComments,
): { assignments: [string, unknown][]; children: LayoutSection[] } {
    const isScope = path[0] === 'scope' && typeof path[1] === 'number';
    const isToolRule = (path[0] === 'tools' || path[2] === 'tools') && path.at(-1) === 'rules';
    const entries = Object.entries(value).map(([key, child]) => {
        const isTable = isRecord(child);
        const isEnvelope = isTable && Object.hasOwn(child, 'value');
        const childPath = [...path, key];
        const hasComments = [...comments.values()].some(({ path: note }) =>
            childPath.every((part, index) => note[index] === part),
        );
        const entry = { key, child, isTable, childPath };
        return {
            ...entry,
            isScopeTable: isScope && isTable,
            isRecordList: isRecordArray(child) && !isToolRule,
            isInline: isEnvelope || key === 'output',
            isCommentedEnvelope: isEnvelope && hasComments,
        };
    });
    const scopeAssignments = new Map(
        entries
            .filter(({ isScopeTable }) => isScopeTable)
            .map(({ key, child }) => {
                const assignments: [string, unknown][] = [];
                const pending: (readonly [string, unknown])[] = [[key, child]];
                while (pending.length > 0) {
                    const [name, item] = pending.shift() as [string, unknown];
                    if (isRecord(item) && !Object.hasOwn(item, 'value')) {
                        const nested = Object.entries(item).map(([key, value]) => [`${name}.${key}`, value] as const);
                        pending.unshift(...nested);
                    } else assignments.push([name, item]);
                }
                return [key, assignments] as const;
            }),
    );
    const sections = entries.map(
        ({ key, child, isTable, isScopeTable, isRecordList, isInline, isCommentedEnvelope, childPath }) => {
            const assignments: [string, unknown][] = [];
            const children: LayoutSection[] = [];
            if (isScopeTable) return { assignments: scopeAssignments.get(key) as [string, unknown][], children };
            if (isTable && isInline && !isCommentedEnvelope) assignments.push([key, child]);
            else if (isTable) children.push({ path: childPath, table: child as TomlTable });
            else if (isRecordList)
                children.push(
                    ...(child as TomlTable[]).map((table, index) => ({ path: [...path, key, index], table })),
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
 * Write ordered tables and retained comments around TOML values.
 * @param target the ordered written values.
 * @param indent indentation resolved by the settings emitter.
 * @param comments comments retained on their keys and headers.
 * @returns the formatted TOML text.
 */
export function layOutSettings(target: TomlTable, indent: string, comments: TomlComments): string {
    const blocks: string[] = [];
    const root: string[] = [];
    function table(value: TomlTable, path: KeyPath): void {
        const { assignments, children } = sectionEntries(value, path, comments);
        const lines = assignments.map(([key, child]) => {
            const { text, pair } = tomlAssignment(key, child, path[0] === 'scope' && key.includes('.'));
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
            blocks.push(
                [
                    insertTomlComments(comments, 'header', path, tomlHeader(path, typeof path.at(-1) === 'number')),
                    ...lines,
                ].join('\n'),
            );
        for (const child of children) {
            table(child.table, child.path);
        }
    }
    table(target, []);
    const metadata = insertTomlComments(comments, 'provenance', [], '');
    const output =
        [metadata, insertTomlComments(comments, 'preamble', [], ''), root.join('\n'), ...blocks]
            .filter((block) => block !== '')
            .join('\n\n') + '\n';
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
