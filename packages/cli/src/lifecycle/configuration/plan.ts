// Planning the keys gspot owns in a shared configuration file the developer keeps, and the containers it created.
import { z } from 'zod';
import { isDeepStrictEqual } from 'node:util';
import { OWNER_WRITABLE_FILE } from '#cli/config/platform.ts';
import { configurationFieldsSchema } from '#cli/lifecycle/log.ts';
import { configurationDocument } from '#cli/lifecycle/configuration/document.ts';

import type {
    Field,
    KeyPath,
    KitPlan,
    KitDocument,
    ConfigurationOwnership,
    ConfigurationWriteRequest,
} from '#cli/types/lifecycle/lifecycle.ts';

// Whether a value is an empty plain object or array, which an owner may remove when it created it.
function isEmptyContainer(value: unknown): boolean {
    if (value === null || typeof value !== 'object') return false;
    const prototype: unknown = Object.getPrototypeOf(value);
    if (!Array.isArray(value) && prototype !== Object.prototype && prototype !== null) return false;
    return Object.keys(value).length === 0;
}

// The file text, which must be UTF-8, or the empty document of the format for a file that does not exist.
function sourceText(request: ConfigurationWriteRequest): string {
    const { current, format, path } = request;
    const text = current?.bytes.toString('utf8') ?? (format === 'toml' ? '' : '{}\n');
    if (current !== undefined && !Buffer.from(text).equals(current.bytes))
        throw new Error(`Shared configuration is not UTF-8 text: ${path}`);
    return text;
}

// Whether the recorded ownership rules out a plan: another format, or an edited file with no recorded fields.
function isUnplannable(request: ConfigurationWriteRequest): boolean {
    const { existing, format, current, matchesInstalled } = request;
    if (existing?.configuration !== undefined && existing.configuration.format !== format) return true;
    return existing !== undefined && existing.configuration === undefined && current !== undefined && !matchesInstalled;
}

// Puts back the original value of each unrequested key, as long as the developer left it as installed.
function retireFields(document: KitDocument, recorded: Field[], requested: Field[]): Field[] | undefined {
    const retired = recorded.filter(
        (previous) => !requested.some((field) => isDeepStrictEqual(field.path, previous.path)),
    );
    for (const previous of retired) {
        if (!isDeepStrictEqual(document.value(previous.path), previous.installed)) return undefined;
        document.set(previous.path, previous.original);
    }
    return recorded.filter((previous) => !retired.includes(previous));
}

// The field as it will be recorded, or undefined when the developer's value stands in the way of installing it.
function plannedField(
    document: KitDocument,
    request: ConfigurationWriteRequest,
    field: Field,
    previous: Field | undefined,
): Field | undefined {
    const value = document.value(field.path);
    if (previous !== undefined) {
        if (!isDeepStrictEqual(value, previous.installed)) return undefined;
        return { ...field, ...(previous.original === undefined ? {} : { original: previous.original }) };
    }
    if (request.current !== undefined && !request.replace && !isDeepStrictEqual(value, field.installed))
        return undefined;
    return { ...field, ...(value === undefined ? {} : { original: z.json().parse(value) }) };
}

// Records the containers above a key that do not exist yet, which this owner is about to create.
function recordParents(document: KitDocument, path: KeyPath, parents: KeyPath[]): void {
    for (let length = 1; length < path.length; length++) {
        const parent = path.slice(0, length);
        if (document.value(parent) === undefined && !parents.some((known) => isDeepStrictEqual(known, parent)))
            parents.push(parent);
    }
}

// Installs every requested field, returning the recorded fields, or undefined when one cannot be installed.
function installFields(
    document: KitDocument,
    request: ConfigurationWriteRequest,
    recorded: Field[],
    requested: Field[],
    parents: KeyPath[],
): Field[] | undefined {
    const fields = retireFields(document, recorded, requested);
    if (fields === undefined) return undefined;
    for (const field of requested) {
        const index = fields.findIndex((entry) => isDeepStrictEqual(entry.path, field.path));
        const entry = plannedField(document, request, field, fields[index]);
        if (entry === undefined) return undefined;
        if (index === -1) fields.push(entry);
        else fields[index] = entry;
        recordParents(document, field.path, parents);
        document.set(field.path, field.installed);
    }
    return fields;
}

// The ownership record of a plan that changed the fields or the text.
function nextRecord(
    request: ConfigurationWriteRequest,
    recorded: ConfigurationOwnership | undefined,
    fields: Field[],
    parents: KeyPath[],
): ConfigurationOwnership {
    const { existing, current, matchesInstalled } = request;
    const edited = recorded?.edited === true || (existing !== undefined && current !== undefined && !matchesInstalled);
    return {
        format: request.format,
        fields,
        ...(parents.length === 0 ? {} : { parents }),
        edited,
        created: recorded?.created ?? request.current === undefined,
    };
}

// The ownership to record after the plan: unchanged when the fields and the text are what was recorded.
function planned(
    request: ConfigurationWriteRequest,
    text: string,
    nextText: string,
    fields: Field[],
    parents: KeyPath[],
): KitPlan {
    const next = { bytes: Buffer.from(nextText), mode: request.current?.mode ?? OWNER_WRITABLE_FILE };
    const recorded = request.existing?.configuration;
    const status = nextText === text ? 'unchanged' : 'changed';
    const isRecorded = recorded !== undefined && isDeepStrictEqual(fields, recorded.fields) && status === 'unchanged';
    if (isRecorded) return { next, configuration: recorded, status };
    return { next, status, configuration: nextRecord(request, recorded, fields, parents) };
}

/**
 * Remove empty containers only when this owner created them for managed fields.
 * @param document the parsed document
 * @param parents the container paths this owner created, deepest last
 * @param protectedFields the key paths whose containers stay whatever they hold
 * @returns the created containers that still exist
 */
export function pruneConfigurationParents(
    document: KitDocument,
    parents: KeyPath[],
    protectedFields: KeyPath[] = [],
): KeyPath[] {
    for (const parent of parents.toSorted((left, right) => right.length - left.length)) {
        if (
            protectedFields.some(
                (field) => field.length <= parent.length && field.every((part, index) => part === parent[index]),
            )
        )
            continue;
        if (isEmptyContainer(document.value(parent))) document.set(parent, undefined);
    }
    return parents.filter((parent) => document.value(parent) !== undefined);
}

/**
 * Plans the merge of owned keys into a shared configuration file the developer keeps.
 * @param request the destination, requested fields, and observed ownership
 * @returns the next snapshot with its ownership, or undefined when the recorded format differs
 */
export function planConfiguration(request: ConfigurationWriteRequest): KitPlan | undefined {
    const { format, changes, current, existing } = request;
    const text = sourceText(request);
    const document = configurationDocument(text, format, current === undefined);
    if (isUnplannable(request)) return undefined;
    const requested = configurationFieldsSchema.parse(
        changes.map((change) => ({ path: change.path, installed: z.json().parse(change.value) })),
    );
    const recorded = existing?.configuration;
    const parents = [...(recorded?.parents ?? [])];
    const fields = installFields(document, request, recorded?.fields ?? [], requested, parents);
    if (fields === undefined) return undefined;
    const remaining = pruneConfigurationParents(
        document,
        parents,
        requested.map((field) => field.path),
    );
    return planned(request, text, document.text(), fields, remaining);
}
