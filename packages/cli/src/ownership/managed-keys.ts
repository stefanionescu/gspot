import { z } from 'zod';
import { decodeUtf8 } from '#cli/text.ts';
import { isDeepStrictEqual } from 'node:util';
import { normalizeTables } from '#cli/objects.ts';
import { openJsonFile } from '#cli/parsers/json.ts';
import type { ManagedKeys } from '#cli/types/apply.ts';
import { openTomlFile } from '#cli/parsers/toml/document.ts';
import { openSafeFolder } from '#cli/system/safe-folder/open.ts';
import type { FileCopy } from '#cli/types/system/safe-folder.ts';
import { OWNER_WRITABLE_FILE } from '#cli/config/system/modes.ts';
import type { KeyPath, EditableFile } from '#cli/types/parsers/editable-file.ts';
import { TOML_EXTENSION, EMPTY_JSON_TEXT, JSON_EDIT_EXTENSIONS } from '#cli/config/ownership.ts';
import type { FileEdit, ManagedKey, KeyChangePlan, KeyChangeRequest, KeyChangeContents } from '#cli/types/ownership.ts';

// Identify empty arrays or plain objects that gspot created and can remove.
function isEmptyContainer(value: unknown): boolean {
    if (value === null || typeof value !== 'object') return false;
    const prototype: unknown = Object.getPrototypeOf(value);
    if (!Array.isArray(value) && prototype !== Object.prototype && prototype !== null) return false;
    return Object.keys(value).length === 0;
}

// Refuse merges of edited files without recorded fields.
function hasUnrecordedEdits(request: KeyChangeRequest): boolean {
    const { existing, current, matchesInstalled } = request;
    if (existing === undefined || current === undefined) return false;
    return existing.keys === undefined && !matchesInstalled;
}

// Puts back the original value of each unrequested key, as long as the developer left it as installed.
function restoreUnrequestedKeys(
    document: EditableFile,
    recorded: ManagedKey[],
    requested: ManagedKey[],
): ManagedKey[] | undefined {
    const retired = recorded.filter(
        (previous) => !requested.some((field) => isDeepStrictEqual(field.path, previous.path)),
    );
    for (const previous of retired) {
        if (!isDeepStrictEqual(document.value(previous.path), normalizeTables(previous.installed))) return undefined;
        document.set(previous.path, previous.original);
    }
    return recorded.filter((previous) => !retired.includes(previous));
}

// Record a managed field, or preserve a conflicting authored value.
function planKey(
    document: EditableFile,
    request: KeyChangeRequest,
    field: ManagedKey,
    previous: ManagedKey | undefined,
): ManagedKey | undefined {
    const value = document.value(field.path);
    if (previous !== undefined) {
        if (!isDeepStrictEqual(value, normalizeTables(previous.installed))) return undefined;
        return { ...field, ...(previous.original === undefined ? {} : { original: previous.original }) };
    }
    if (
        request.current !== undefined &&
        !request.canReplace &&
        !isDeepStrictEqual(value, normalizeTables(field.installed))
    )
        return undefined;
    return { ...field, ...(value === undefined ? {} : { original: z.json().parse(value) }) };
}

// Record missing parent containers before creating them for a managed key.
function recordParents(document: EditableFile, path: KeyPath, parents: KeyPath[]): void {
    for (let length = 1; length < path.length; length++) {
        const parent = path.slice(0, length);
        if (document.value(parent) === undefined && !parents.some((known) => isDeepStrictEqual(known, parent)))
            parents.push(parent);
    }
}

// Installs every requested field, returning the recorded fields, or undefined for a conflicting field.
function setKeys(
    document: EditableFile,
    request: KeyChangeRequest,
    recorded: ManagedKey[],
    requested: ManagedKey[],
    parents: KeyPath[],
): ManagedKey[] | undefined {
    const fields = restoreUnrequestedKeys(document, recorded, requested);
    if (fields === undefined) return undefined;
    for (const field of requested) {
        const index = fields.findIndex((entry) => isDeepStrictEqual(entry.path, field.path));
        const entry = planKey(document, request, field, fields[index]);
        if (entry === undefined) return undefined;
        if (index === -1) fields.push(entry);
        else fields[index] = entry;
        recordParents(document, field.path, parents);
        document.set(field.path, field.installed);
    }
    return fields;
}

// The ownership record of a plan that changed the fields or the text.
function keysRecord(
    request: KeyChangeRequest,
    recorded: ManagedKeys | undefined,
    contents: KeyChangeContents,
): ManagedKeys {
    const { fields, parents } = contents;
    const { existing, current, matchesInstalled } = request;
    const edited = recorded?.edited === true || (existing !== undefined && current !== undefined && !matchesInstalled);
    return {
        format: contents.format,
        fields,
        ...(parents.length === 0 ? {} : { parents }),
        edited,
        created: recorded?.created ?? request.current === undefined,
    };
}

// The ownership to record after the plan: unchanged when fields and text match the saved record.
function keyChangePlan(request: KeyChangeRequest, contents: KeyChangeContents): KeyChangePlan {
    const { text, nextText, fields } = contents;
    const next = { bytes: Buffer.from(nextText), mode: request.current?.mode ?? OWNER_WRITABLE_FILE };
    const recorded = request.existing?.keys;
    const status = nextText === text ? 'unchanged' : 'changed';
    const isRecorded = recorded !== undefined && isDeepStrictEqual(fields, recorded.fields) && status === 'unchanged';
    if (isRecorded) return { next, keys: recorded, status };
    return { next, status, keys: keysRecord(request, recorded, contents) };
}

/**
 * Remove empty containers only when this owner created them for managed fields.
 *
 * @param document the parsed document.
 * @param parents the container paths this owner created, deepest last.
 * @param keptPaths the key paths whose containers stay whatever they hold.
 *
 * @returns the created containers that still exist.
 */
export function pruneParents(document: EditableFile, parents: KeyPath[], keptPaths: KeyPath[] = []): KeyPath[] {
    for (const parent of parents.toSorted((left, right) => right.length - left.length)) {
        if (
            keptPaths.some(
                (field) => field.length <= parent.length && field.every((part, index) => part === parent[index]),
            )
        )
            continue;
        if (isEmptyContainer(document.value(parent))) document.set(parent, undefined);
    }
    return parents.filter((parent) => document.value(parent) !== undefined);
}

/**
 * Plans the merge of owned keys into an authored tool file.
 *
 * @param request the destination, requested fields, and read ownership.
 *
 * @returns the next copy with its ownership, or undefined for a preserved file.
 */
export function planKeyChanges(request: KeyChangeRequest): KeyChangePlan | undefined {
    const { changes, current, existing } = request;
    const recorded = existing?.keys ?? { parents: [], fields: [] };
    const document = openKeysDocument(request.path, current);
    const text = current === undefined ? '' : document.text();
    if (hasUnrecordedEdits(request)) return undefined;
    const requested = changes.map((change) => ({ path: change.path, installed: change.value }));
    const parents = [...(recorded.parents ?? [])];
    const fields = setKeys(document, request, recorded.fields, requested, parents);
    if (fields === undefined) return undefined;
    const remaining = pruneParents(
        document,
        parents,
        requested.map((field) => field.path),
    );
    return keyChangePlan(request, {
        text,
        nextText: document.text(),
        fields,
        parents: remaining,
        format: document.format,
    });
}

/**
 * Opens managed keys after checking the file encoding and selecting its parser.
 *
 * @param path the destination used for format selection and errors.
 * @param current the existing file, or undefined when generation creates it.
 *
 * @returns the document used by merge, inspection, and restoration.
 */
export function openKeysDocument(path: string, current: FileCopy | undefined): EditableFile {
    const text = current === undefined ? undefined : decodeUtf8(current.bytes);
    if (current !== undefined && text === undefined) throw new Error(`${path} is not UTF-8 text`);
    if (path.endsWith(TOML_EXTENSION)) return openTomlFile({ path, source: text ?? '' });
    if (JSON_EDIT_EXTENSIONS.some((extension) => path.endsWith(extension)))
        return openJsonFile(path, text ?? EMPTY_JSON_TEXT);
    throw new Error(`${path} has no supported shared configuration format.`);
}

/**
 * Inspect managed keys through the same parser used by ownership plans.
 *
 * @param root the repository root.
 * @param output the file gspot writes managed keys into.
 * @param output.path the file path.
 * @param output.changes the keys and the values they must hold.
 *
 * @returns whether the file exists and holds every installed value.
 */
export function hasManagedKeys(root: string, output: FileEdit): boolean {
    using files = openSafeFolder(root);
    const current = files.read(output.path);
    if (current === undefined) return false;
    const document = openKeysDocument(output.path, current);
    return output.changes.every((field) => isDeepStrictEqual(document.value(field.path), normalizeTables(field.value)));
}
