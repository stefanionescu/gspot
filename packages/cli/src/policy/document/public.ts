import { isDeepStrictEqual } from 'node:util';
import { GspotError } from '#cli/platform/public.ts';
import { policyLayout } from '#cli/policy/layout.ts';
import { policyComments } from '#cli/policy/comments.ts';
import { readSource } from '#cli/platform/root/public.ts';
import { tomlSyntax } from '#cli/parsers/toml/contracts.ts';
import { policySchema } from '#cli/policy/schema/public.ts';
import { omitPolicyDefaults } from '#cli/policy/defaults.ts';
import { POLICY_FILE } from '#cli/config/platform/locations.ts';
import { isRecord, decodeUtf8 } from '#cli/platform/contracts.ts';
import { OWNER_WRITABLE_FILE } from '#cli/config/platform/modes.ts';
import type { PolicyWriteRequest } from '#cli/types/policy/file.ts';
import { calendarDateSchema } from '#cli/policy/schema/contracts.ts';
import { parse, LocalDate, stringify } from '@decimalturn/toml-patch';
import { configurationManifests } from '#cli/configurations/public.ts';
import type { TomlTable, PolicyEdit } from '#cli/types/policy/settings.ts';

import {
    POLICY_TAIL,
    POLICY_SECTIONS,
    POLICY_ROOT_KEYS,
    POLICY_EMIT_FORMAT,
    POLICY_PARSE_CONTEXT_LINES,
} from '#cli/config/policy/file.ts';

function sortTable(table: TomlTable): TomlTable {
    const order = [
        ...POLICY_ROOT_KEYS,
        ...POLICY_SECTIONS,
        ...Object.keys(table)
            .filter((key) => ![...POLICY_ROOT_KEYS, ...POLICY_SECTIONS, ...POLICY_TAIL].includes(key))
            .toSorted((left, right) => left.localeCompare(right)),
        ...POLICY_TAIL,
    ];
    return Object.fromEntries(
        order.filter((key) => Object.hasOwn(table, key)).map((key) => [key, sortValue(table[key])]),
    );
}

function sortValue(value: unknown): unknown {
    if (Array.isArray(value)) return value.map((entry: unknown) => sortValue(entry));
    return isRecord(value)
        ? Object.fromEntries(
              Object.keys(value)
                  .toSorted(
                      (left, right) =>
                          Number(isRecord(value[left])) - Number(isRecord(value[right])) || left.localeCompare(right),
                  )
                  .map((key) => [key, sortValue(value[key])]),
          )
        : value;
}

function ignoreOrder(ignore: TomlTable): string[] {
    const paths: unknown = ignore['paths'];
    return [ignore['check'], ignore['rule'], Array.isArray(paths) ? paths[0] : undefined].map((value) =>
        typeof value === 'string' ? value : '',
    );
}

function compareIgnores(left: TomlTable, right: TomlTable): number {
    const rightParts = ignoreOrder(right);
    for (const [index, part] of ignoreOrder(left).entries()) {
        const other = rightParts[index];
        const order = part.localeCompare(other ?? '');
        if (order !== 0) return order;
    }
    return 0;
}

function mergeIgnores(ignores: TomlTable[]): TomlTable[] {
    const merged: TomlTable[] = [];
    for (const ignore of ignores) mergeIgnore(merged, ignore);
    return merged.toSorted(compareIgnores);
}

const formatManifest = configurationManifests().get('format');

if (formatManifest === undefined) throw new Error('The shipped format configuration is missing.');

const formatDefaults = policySchema.shape.format
    .unwrap()
    .required({ indent_style: true, indent_width: true })
    .parse(
        Object.fromEntries(
            formatManifest.settings
                .filter((setting) => setting.name.startsWith('format.'))
                .map((setting) => [setting.name.slice('format.'.length), setting.default]),
        ),
    );

/**
 * Merge an authored ignore into its matching identity while retaining scope-wide entries.
 * @param ignores the mutable authored entries
 * @param ignore the entry whose paths join its existing identity
 * @returns the saved entry, including the merged paths
 */
export function mergeIgnore(ignores: TomlTable[], ignore: TomlTable): TomlTable {
    const { paths: authoredPaths, ...identity } = ignore;
    const existing = ignores.find(({ paths: _previousPaths, ...previous }) => isDeepStrictEqual(previous, identity));
    if (existing === undefined) {
        const saved = { ...ignore };
        ignores.push(saved);
        return saved;
    }
    const previous: unknown = existing['paths'];
    if (Array.isArray(authoredPaths) && Array.isArray(previous)) {
        const paths: readonly unknown[] = authoredPaths;
        const previousPaths: readonly unknown[] = previous;
        existing['paths'] = [...new Set([...previousPaths, ...paths])];
    } else Reflect.deleteProperty(existing, 'paths');
    return existing;
}

/**
 * Read authored policy or template values while retaining native date kinds and source locations.
 * @param text the authored TOML
 * @param path the source file or URL
 * @param kind the document whose error is reported
 * @returns the native parsed table without execution defaults
 */
export function parseTomlText(text: string, path: string, kind: 'policy' | 'template'): TomlTable {
    try {
        const value: unknown = parse(text);
        if (!isRecord(value)) throw new Error('The TOML parser did not return a document table.');
        return value;
    } catch (error) {
        if (!(error instanceof Error) || !('line' in error) || !('column' in error)) throw error;
        const { line, column } = error;
        if (typeof line !== 'number' || typeof column !== 'number') throw error;
        const detail = error.message.split('\n').slice(POLICY_PARSE_CONTEXT_LINES).join('\n');
        throw new GspotError(kind, [`${path}:${String(line)}:${String(column + 1)} is not valid TOML: ${detail}`]);
    }
}

/**
 * Encode authored values in a stable key order without adding or omitting defaults.
 * @param table the native authored table
 * @returns native TOML that retains dates, number kinds, and array order
 */
export function policyValues(table: TomlTable): string {
    return stringify(sortTable(table));
}

/**
 * Parse one native edit while retaining its original text and value identity.
 * @param text the authored policy text
 * @returns the table to mutate and its original native value snapshot
 */
export function parsePolicyEdit(text: string): PolicyEdit {
    const table = parseTomlText(text, POLICY_FILE, 'policy');
    return { text, table, values: policyValues(table) };
}

/**
 * Validate a CLI expiry argument before creating its native authored value.
 * @param text the date supplied to --until
 * @returns the same calendar date as a native TOML value
 */
export function parseExpiryDate(text: string): LocalDate {
    const result = calendarDateSchema.safeParse(text);
    if (!result.success) throw new GspotError('policy', ['until must be a valid calendar date in YYYY-MM-DD form.']);
    return new LocalDate(result.data);
}

/**
 * Write one canonical policy while retaining authored comments and template provenance.
 * @param previousText the original authored document, or empty text for initialization
 * @param policy the authored values, before execution defaults
 * @returns canonical TOML 1.0 with native value encoding
 */
export function emitPolicy(previousText: string, policy: TomlTable): string {
    const ordered = sortTable(policy);
    let target = policy['template'] === undefined ? omitPolicyDefaults(ordered) : ordered;
    if (target['ignore'] !== undefined)
        target['ignore'] = mergeIgnores(policySchema.shape.ignore.unwrap().parse(target['ignore']));
    const format = Object.assign({ ...formatDefaults }, policySchema.shape.format.parse(target['format']));
    const indent = format.indent_style === 'tab' ? '\t' : ' '.repeat(format.indent_width);
    const syntax = tomlSyntax(previousText, parseTomlText(previousText, POLICY_FILE, 'policy'));
    const comments = policyComments(syntax, target, policy);
    target = sortTable(target);
    const layout = policyLayout(syntax, target, indent, comments);
    const { document } = syntax;
    if (layout.noncontiguous) {
        document.overwrite(layout.text);
        return document.toTomlString;
    }
    try {
        document.patch(target, POLICY_EMIT_FORMAT);
    } catch (error) {
        if (!(error instanceof Error) || !layout.missingArrays.has(error.message)) throw error;
        document.overwrite(layout.text);
        return document.toTomlString;
    }
    document.update(layout.text);
    return document.toTomlString;
}

/**
 * Read authored policy text, following only links contained by the repository.
 * @param root the repository root
 * @returns the UTF-8 policy text
 */
export function readPolicyFile(root: string): string {
    let bytes: Buffer;
    try {
        bytes = readSource(root, POLICY_FILE);
    } catch (error) {
        if (!(error instanceof Error) || !('code' in error) || error.code !== 'ENOENT') throw error;
        throw new GspotError('policy', ['There is no gspot.toml here. Run `gspot init` to create one.']);
    }
    return decodePolicyText(bytes);
}

/**
 * Decode policy bytes captured at the file boundary.
 * @param bytes the captured policy bytes
 * @returns the UTF-8 policy text
 */
export function decodePolicyText(bytes: Buffer): string {
    const text = decodeUtf8(bytes);
    if (text === undefined) throw new GspotError('policy', ['gspot.toml must contain valid UTF-8 text.']);
    return text;
}

/**
 * Publish native policy bytes only while the captured file identity is unchanged.
 * @param request the captured input, text, and ownership publication
 */
export function writePolicyFile(request: PolicyWriteRequest): void {
    const { text, original, publish } = request;
    const next = { bytes: Buffer.from(text), mode: original?.mode ?? OWNER_WRITABLE_FILE };
    if (!isDeepStrictEqual(next, original)) publish(next, original);
}
