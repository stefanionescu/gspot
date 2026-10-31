import { isDeepStrictEqual } from 'node:util';
import { compareText } from '#cli/system/text.ts';
import { isReasonedValue } from '#cli/settings/file.ts';
import { settingsSchema } from '#cli/schemas/settings/file.ts';
import { RECORD_FIELDS } from '#cli/settings/schema/lookup.ts';
import { stringify, parseDocument } from '@decimalturn/toml-patch';
import { isTable, findValueAt, normalizeTables } from '#cli/system/tables.ts';
import type { TomlTable, TaploLayout } from '#cli/types/settings/settings.ts';
import type { TomlBlock, TomlValue, TomlSyntax } from '#cli/types/parsers/formats.ts';
import { ROOT_KEYS, TOML_FORMAT, LAST_TABLES, FIRST_TABLES, SETTINGS_FILE } from '#cli/config/settings/settings.ts';

import {
    isTomlKind,
    getTomlRange,
    parseTomlFile,
    parseTomlSyntax,
    buildPatchedToml,
} from '#cli/parsers/formats/toml.ts';

function sortTable(table: TomlTable): TomlTable {
    const order = [
        ...ROOT_KEYS,
        ...FIRST_TABLES,
        ...Object.keys(table)
            .filter((key) => !([...ROOT_KEYS, ...FIRST_TABLES, ...LAST_TABLES] as readonly string[]).includes(key))
            .toSorted((left, right) => compareText(left, right)),
        ...LAST_TABLES,
    ];
    return Object.fromEntries(
        order.filter((key) => Object.hasOwn(table, key)).map((key) => [key, sortValue(table[key], [key])]),
    );
}

function sortValue(value: unknown, keys: string[]): unknown {
    if (Array.isArray(value)) return value.map((element: unknown) => sortValue(element, keys));
    if (!isTable(value)) return value;
    const fields: Readonly<Record<string, readonly string[]>> = RECORD_FIELDS;
    const recordOrder: readonly string[] | undefined = isReasonedValue(value)
        ? ['value', 'reason']
        : fields[keys.join('.')];
    const names = Object.keys(value);
    let order = names;
    if (recordOrder !== undefined)
        order = [
            ...recordOrder.filter((key) => Object.hasOwn(value, key)),
            ...names.filter((key) => !recordOrder.includes(key)),
        ];
    else if (keys[0] === 'tools' && keys.at(-1) === 'rules')
        order = names.toSorted((left, right) => compareText(left, right));
    return Object.fromEntries(order.map((key) => [key, sortValue(value[key], [...keys, key])]));
}

function readTaploLayout(written: TomlTable): TaploLayout {
    const schema = settingsSchema.shape.format;
    const format = schema.safeParse(written['format']).data ?? schema.parse({});
    return {
        width: format.print_width,
        indent: format.indent_style === 'tab' ? '\t' : ' '.repeat(format.indent_width),
    };
}

function findLineStart(text: string, blocks: TomlBlock[], block: TomlBlock): number {
    let index = blocks.indexOf(block);
    let previous = blocks[index - 1];
    while (
        previous !== undefined &&
        isTomlKind(previous, 'Comment') &&
        previous.loc.end.line === (blocks[index] as TomlBlock).loc.start.line - 1
    ) {
        index -= 1;
        previous = blocks[index - 1];
    }
    const start = getTomlRange(blocks[index] as TomlBlock)[0];
    return text.lastIndexOf('\n', start - 1) + 1;
}

function insertSection(
    text: string,
    written: string,
    place: { blocks: TomlBlock[]; next: TomlBlock | undefined },
): string {
    if (place.next === undefined) return text.trim() === '' ? `${written}\n` : `${text.trimEnd()}\n\n${written}\n`;
    const position = findLineStart(text, place.blocks, place.next);
    const before = text.slice(0, position);
    const separator = position === 0 || before.endsWith('\n\n') ? '' : '\n';
    return `${before}${separator}${written}\n\n${text.slice(position)}`;
}

function insertAfterLine(text: string, written: string, block: TomlBlock): string {
    const lineEnd = text.indexOf('\n', getTomlRange(block)[1]);
    const position = lineEnd === -1 ? text.length : lineEnd + 1;
    const head = text.slice(0, position);
    return `${head}${head.endsWith('\n') ? '' : '\n'}${written}\n${text.slice(position)}`;
}

function insertRootKey(
    text: string,
    written: string,
    place: { blocks: TomlBlock[]; next: TomlBlock | undefined; last: TomlBlock | undefined },
): string {
    const { blocks, next, last } = place;
    if (last !== undefined && (next === undefined || !isTomlKind(next, 'KeyValue')))
        return insertAfterLine(text, written, last);
    if (next === undefined) return text.trim() === '' ? `${written}\n` : `${text.trimEnd()}\n\n${written}\n`;
    const position = findLineStart(text, blocks, next);
    const gap = isTomlKind(next, 'KeyValue') ? '\n' : '\n\n';
    return `${text.slice(0, position)}${written}${gap}${text.slice(position)}`;
}

function insertTopLevelSetting(
    text: string,
    setting: { key: string; value: unknown },
    order: readonly string[],
): string {
    const written = stringify({ [setting.key]: setting.value }, TOML_FORMAT).trimEnd();
    const blocks = parseDocument(text).cst;
    const rank = order.indexOf(setting.key);
    const ranked = blocks.flatMap((block) => {
        if (isTomlKind(block, 'Comment')) return [];
        const keys = isTomlKind(block, 'KeyValue') ? block.key.value : block.key.item.value;
        return [{ block, isKey: isTomlKind(block, 'KeyValue'), rank: order.indexOf(String(keys[0])) }];
    });
    if (!isTomlKind(parseDocument(written).cst[0] as TomlBlock, 'KeyValue'))
        return insertSection(text, written, {
            blocks,
            next: ranked.find((each) => !each.isKey && each.rank > rank)?.block,
        });
    const next = ranked.find((each) => !each.isKey || each.rank > rank);
    const last = ranked.findLast(
        (each) => each.isKey && (next === undefined || each.block.loc.start.line < next.block.loc.start.line),
    );
    return insertRootKey(text, written, { blocks, next: next?.block, last: last?.block });
}

function formatTaploValue(node: TomlValue, text: string): string {
    if (isTomlKind(node, 'InlineArray'))
        return `[${node.items.map(({ item: element }) => formatTaploValue(element as TomlValue, text)).join(', ')}]`;
    if (isTomlKind(node, 'InlineTable'))
        return node.items.length === 0
            ? '{}'
            : `{ ${node.items.map(({ item: pair }) => pair.key.raw + ' = ' + formatTaploValue(pair.value, text)).join(', ')} }`;
    const [start, end] = getTomlRange(node);
    return text.slice(start, end);
}

function formatTaploRow(text: string, value: TomlValue, layout: TaploLayout): string {
    const [start] = getTomlRange(value);
    const lineStart = text.lastIndexOf('\n', start - 1) + 1;
    const inline = formatTaploValue(value, text);
    if (
        !isTomlKind(value, 'InlineArray') ||
        value.items.length === 0 ||
        start - lineStart + inline.length <= layout.width
    )
        return inline;
    const margin = /^[\t ]*/u.exec(text.slice(lineStart))?.[0] ?? '';
    const lines = value.items.map(
        ({ item: element }) => `${margin}${layout.indent}${formatTaploValue(element as TomlValue, text)},`,
    );
    return `[\n${lines.join('\n')}\n${margin}]`;
}

function formatTaploValues(text: string, previous: Record<string, unknown>, layout: TaploLayout): string {
    const edited = parseTomlFile(SETTINGS_FILE, text);
    const syntax = parseTomlSyntax(text, edited);
    const rows = new Set(
        syntax.document.cst.flatMap((block) => {
            if (isTomlKind(block, 'KeyValue')) return [block];
            return isTomlKind(block, 'Comment') ? [] : block.items.filter((row) => isTomlKind(row, 'KeyValue'));
        }),
    );
    const replacements = syntax.pathNodes.flatMap((pathNode) => {
        if (pathNode.kind !== 'key' || !rows.has(pathNode.node)) return [];
        const { value } = pathNode.node;
        const [start, end] = getTomlRange(value);
        const isList = isTomlKind(value, 'InlineArray') || isTomlKind(value, 'InlineTable');
        const isWritten = !isDeepStrictEqual(findValueAt(previous, pathNode.path), findValueAt(edited, pathNode.path));
        return isList && isWritten && !text.slice(start, end).includes('\n')
            ? [{ start, end, text: formatTaploRow(text, value, layout) }]
            : [];
    });
    return replacements
        .toSorted((left, right) => right.start - left.start)
        .reduce(
            (written, { start, end, text: replacement }) => written.slice(0, start) + replacement + written.slice(end),
            text,
        );
}

/**
Write settings over the syntax of a gspot.toml text. Init and every edit command write gspot.toml this way. The entries of
the text keep their order and layout. Each new top-level key or table goes where init places it, before the first later entry of
the text. Each written list and inline table takes the Taplo layout, and a list longer than format.print_width puts one
item on each line.

@param previous the parsed text that the settings replace.
@param written the settings to write.
@returns the TOML text.
*/
export function buildSettingsToml(previous: TomlSyntax, written: TomlTable): string {
    const sorted = sortTable(written);
    const order = Object.keys(sorted);
    const added = order.filter((key) => !Object.hasOwn(previous.value, key));
    const kept = Object.fromEntries(Object.entries(sorted).filter(([key]) => !added.includes(key)));
    let text = buildPatchedToml(previous, kept, TOML_FORMAT);
    for (const key of added) text = insertTopLevelSetting(text, { key, value: sorted[key] }, order);
    return formatTaploValues(text, previous.value, readTaploLayout(written));
}

/**
Add an ignore to the list, or merge its paths into the record with the same check, rule, and reason.
When either record has no paths, the merged record has none. Changes ignores in place.

@param ignores the written [[ignore]] records.
@param ignore the record to add.
*/
export function mergeIgnore(ignores: TomlTable[], ignore: TomlTable): TomlTable {
    const { paths: writtenPaths, ...identity } = ignore;
    const matching = ignores.find(({ paths: _previousPaths, ...previous }) => isDeepStrictEqual(previous, identity));
    if (matching === undefined) {
        const saved = { ...ignore };
        ignores.push(saved);
        return saved;
    }
    const previous: unknown = matching['paths'];
    if (Array.isArray(writtenPaths) && Array.isArray(previous)) {
        const paths: readonly unknown[] = writtenPaths;
        const previousPaths: readonly unknown[] = previous;
        matching['paths'] = [...new Set([...previousPaths, ...paths])];
    } else delete matching['paths'];
    return matching;
}

/**
Build the text of a new gspot.toml: the preface and the settings written over the template, whose comments stay.

@param preface the comment lines at the top.
@param template the gspot.toml text that init copies with --from, or an empty text.
@param written the values to write, before defaults.
@returns the TOML 1.0 text.
*/
export function buildSettingsText(preface: string, template: string, written: TomlTable): string {
    const syntax = parseTomlSyntax(template, parseTomlFile(SETTINGS_FILE, template));
    const opening = preface === '' ? '' : preface.trimEnd() + '\n';
    const body = isDeepStrictEqual(normalizeTables(written), normalizeTables(syntax.value))
        ? template
        : buildSettingsToml(syntax, written);
    return `${opening}${body}`;
}
