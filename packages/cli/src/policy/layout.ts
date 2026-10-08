import { GspotError } from '#cli/platform/errors.ts';
import type { KeyPath } from '#cli/types/parsers/document.ts';
import type { TomlTable } from '#cli/types/policy/settings.ts';
import { POLICY_EMIT_FORMAT } from '#cli/config/policy/file.ts';
import { emitTomlComments } from '#cli/parsers/toml/comments.ts';
import { stringify, parseDocument } from '@decimalturn/toml-patch';
import { valueAt, isRecord, isRecordArray } from '#cli/platform/objects.ts';
import type { PolicyLayout, PolicySection } from '#cli/types/policy/layout.ts';
import type { Value, KeyValue, TomlSyntax, TomlComments } from '#cli/types/parsers/toml.ts';
import { isValue, tomlRange, isKeyValue, isInlineArray, isInlineTable } from '#cli/parsers/toml/nodes.ts';

function noncontiguous(syntax: TomlSyntax): boolean {
    const closed = new Set<string>();
    let previous: string[] = [];
    for (const entry of syntax.entries.filter(({ kind }) => kind === 'header')) {
        const path = entry.path.filter((part): part is string => typeof part === 'string');
        const different = path.findIndex((key, index) => previous[index] !== key);
        const shared = different === -1 ? path.length : different;
        for (const name of previous
            .slice(shared)
            .map((_, index) => JSON.stringify(previous.slice(0, shared + index + 1))))
            closed.add(name);
        if (path.slice(shared).some((_, index) => closed.has(JSON.stringify(path.slice(0, shared + index + 1)))))
            return true;
        previous = path;
    }
    return false;
}

function nativeAssignment(key: string, value: unknown): { text: string; pair: KeyValue } {
    const text = stringify({ [key]: value }, POLICY_EMIT_FORMAT);
    const pair = parseDocument(text).cst.find(isKeyValue);
    if (pair === undefined) throw new Error('The native writer omitted an assignment value.');
    return { text, pair };
}

function nativeHeader(path: KeyPath, array: boolean): string {
    const keys = path.filter((key): key is string => typeof key === 'string');
    let value: TomlTable = { value: true };
    for (const key of keys.toReversed()) value = { [key]: value };
    const text = stringify(value, { ...POLICY_EMIT_FORMAT, inlineTableStart: Number.MAX_SAFE_INTEGER });
    const section = parseDocument(text).cst.find(
        (node) => 'items' in node && JSON.stringify(node.key.item.value) === JSON.stringify(keys),
    );
    if (section === undefined || !('items' in section)) throw new Error('The native writer omitted a table header.');
    const header = text.slice(...tomlRange(section.key));
    return array ? `[${header}]` : header;
}

function encodeValue(node: Value, text: string, path: KeyPath, comments: TomlComments, indent: string): string {
    if (isInlineArray(node)) {
        const items = node.items.map(({ item }, index) => {
            if (!isValue(item)) throw new Error('The native writer emitted a non-value array item.');
            return emitTomlComments(
                comments,
                'item',
                [...path, index],
                encodeValue(item, text, [...path, index], comments, indent),
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
        return `{ ${node.items.map(({ item }) => text.slice(tomlRange(item.key)[0], tomlRange(item.value)[0]) + encodeValue(item.value, text, [...path, ...item.key.value], comments, indent)).join(', ')} }`;
    return text.slice(...tomlRange(node));
}

function sectionEntries(
    value: TomlTable,
    path: KeyPath,
): { assignments: [string, unknown][]; children: PolicySection[] } {
    const assignments: [string, unknown][] = [];
    const children: PolicySection[] = [];
    for (const [key, child] of Object.entries(value)) {
        if (isRecord(child)) children.push({ path: [...path, key], table: child });
        else if (isRecordArray(child))
            children.push(...child.map((table, index) => ({ path: [...path, key, index], table })));
        else assignments.push([key, child]);
    }
    return { assignments, children };
}

/**
 * Lay out canonical sections and owned comments around the prescribed native value writer.
 * @param syntax the original native syntax and parsed values.
 * @param target the ordered authored target.
 * @param indent indentation resolved by the policy emitter.
 * @param comments semantic blocks retained on canonical keys and headers.
 * @returns canonical concrete syntax and exact native patch limitations.
 */
export function policyLayout(
    syntax: TomlSyntax,
    target: TomlTable,
    indent: string,
    comments: TomlComments,
): PolicyLayout {
    const blocks: string[] = [];
    const root: string[] = [];
    const missingArrays = new Set<string>();
    function table(value: TomlTable, path: KeyPath): void {
        const { assignments, children } = sectionEntries(value, path);
        const lines = assignments.map(([key, child]) => {
            const { text, pair } = nativeAssignment(key, child);
            return emitTomlComments(
                comments,
                'key',
                [...path, key],
                text.slice(tomlRange(pair.key)[0], tomlRange(pair.value)[0]) +
                    encodeValue(pair.value, text, [...path, key], comments, indent),
            );
        });
        if (path.length === 0) root.push(...lines);
        else if (lines.length > 0 || children.length === 0 || comments.has(JSON.stringify(['header', ...path])))
            blocks.push(
                [
                    emitTomlComments(comments, 'header', path, nativeHeader(path, typeof path.at(-1) === 'number')),
                    ...lines,
                ].join('\n'),
            );
        for (const child of children) {
            const parent = child.path.slice(0, -1);
            if (typeof child.path.at(-1) === 'number' && valueAt(syntax.value, parent) === undefined)
                missingArrays.add(`Node not found at ${parent.join('.')}`);
            table(child.table, child.path);
        }
    }
    table(target, []);
    const metadata = ['schema', 'provenance']
        .map((kind) => emitTomlComments(comments, kind, [], ''))
        .filter(Boolean)
        .join('\n');
    const output =
        [metadata, emitTomlComments(comments, 'preamble', [], ''), root.join('\n'), ...blocks]
            .filter((block) => block !== '')
            .join('\n\n') + '\n';
    if (comments.size > 0)
        throw new GspotError(
            'policy',
            [...comments.values()].map(
                ({ path }) =>
                    `The comment for ${path.map(String).join('.')} cannot be represented in TOML 1.0. Move that field out of its inline table before writing the policy.`,
            ),
        );
    return { text: output, noncontiguous: noncontiguous(syntax), missingArrays };
}
