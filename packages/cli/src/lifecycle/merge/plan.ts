// Planning the keys gspot owns in a shared configuration file the developer keeps, and the containers it created.
import { z } from 'zod';
import { isDeepStrictEqual } from 'node:util';
import { normalizeTables } from '#cli/platform/objects.ts';
import type { MergeRecord } from '#cli/types/lifecycle/output.ts';
import { fieldsSchema } from '#cli/lifecycle/ownership/schema.ts';
import { OWNER_WRITABLE_FILE } from '#cli/config/platform/modes.ts';
import { openMergedDocument } from '#cli/lifecycle/merge/document.ts';
import type { KeyPath, ConfigurationDocument } from '#cli/types/platform/document.ts';
import type { Field, MergePlan, MergeRequest, MergePlanContents } from '#cli/types/lifecycle/merge.ts';

// Whether a value is an empty plain object or array, which an owner may remove when it created it.
function isEmptyContainer(value: unknown): boolean {
    if (value === null || typeof value !== 'object') return false;
    const prototype: unknown = Object.getPrototypeOf(value);
    if (!Array.isArray(value) && prototype !== Object.prototype && prototype !== null) return false;
    return Object.keys(value).length === 0;
}

// An edited file with no recorded fields cannot be merged safely.
function hasUnrecordedEdits(request: MergeRequest): boolean {
    const { existing, current, matchesInstalled } = request;
    if (existing === undefined || current === undefined) return false;
    return existing.configuration === undefined && !matchesInstalled;
}

// Puts back the original value of each unrequested key, as long as the developer left it as installed.
function retireFields(document: ConfigurationDocument, recorded: Field[], requested: Field[]): Field[] | undefined {
    const retired = recorded.filter(
        (previous) => !requested.some((field) => isDeepStrictEqual(field.path, previous.path)),
    );
    for (const previous of retired) {
        if (!isDeepStrictEqual(document.value(previous.path), normalizeTables(previous.installed))) return undefined;
        document.set(previous.path, previous.original);
    }
    return recorded.filter((previous) => !retired.includes(previous));
}

// The field as it will be recorded, or undefined when the developer's value stands in the way of installing it.
function planField(
    document: ConfigurationDocument,
    request: MergeRequest,
    field: Field,
    previous: Field | undefined,
): Field | undefined {
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

// Records the containers above a key that do not exist yet, which this owner is about to create.
function recordParents(document: ConfigurationDocument, path: KeyPath, parents: KeyPath[]): void {
    for (let length = 1; length < path.length; length++) {
        const parent = path.slice(0, length);
        if (document.value(parent) === undefined && !parents.some((known) => isDeepStrictEqual(known, parent)))
            parents.push(parent);
    }
}

// Installs every requested field, returning the recorded fields, or undefined when one cannot be installed.
function installFields(
    document: ConfigurationDocument,
    request: MergeRequest,
    recorded: Field[],
    requested: Field[],
    parents: KeyPath[],
): Field[] | undefined {
    const fields = retireFields(document, recorded, requested);
    if (fields === undefined) return undefined;
    for (const field of requested) {
        const index = fields.findIndex((entry) => isDeepStrictEqual(entry.path, field.path));
        const entry = planField(document, request, field, fields[index]);
        if (entry === undefined) return undefined;
        if (index === -1) fields.push(entry);
        else fields[index] = entry;
        recordParents(document, field.path, parents);
        document.set(field.path, field.installed);
    }
    return fields;
}

// The ownership record of a plan that changed the fields or the text.
function buildRecord(
    request: MergeRequest,
    recorded: MergeRecord | undefined,
    contents: MergePlanContents,
): MergeRecord {
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

// The ownership to record after the plan: unchanged when the fields and the text are what was recorded.
function buildMergePlan(request: MergeRequest, contents: MergePlanContents): MergePlan {
    const { text, nextText, fields } = contents;
    const next = { bytes: Buffer.from(nextText), mode: request.current?.mode ?? OWNER_WRITABLE_FILE };
    const recorded = request.existing?.configuration;
    const status = nextText === text ? 'unchanged' : 'changed';
    const isRecorded = recorded !== undefined && isDeepStrictEqual(fields, recorded.fields) && status === 'unchanged';
    if (isRecorded) return { next, configuration: recorded, status };
    return { next, status, configuration: buildRecord(request, recorded, contents) };
}

/**
 * Remove empty containers only when this owner created them for managed fields.
 * @param document the parsed document
 * @param parents the container paths this owner created, deepest last
 * @param keptPaths the key paths whose containers stay whatever they hold
 * @returns the created containers that still exist
 */
export function pruneParents(
    document: ConfigurationDocument,
    parents: KeyPath[],
    keptPaths: KeyPath[] = [],
): KeyPath[] {
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
 * Plans the merge of owned keys into a shared configuration file the developer keeps.
 * @param request the destination, requested fields, and read ownership
 * @returns the next snapshot with its ownership, or undefined when the file must be preserved
 */
export function planMerge(request: MergeRequest): MergePlan | undefined {
    const { changes, current, existing } = request;
    const recorded = existing?.configuration ?? { format: undefined, parents: [], fields: [] };
    const document = openMergedDocument(request.path, current, recorded.format);
    const text = current === undefined ? '' : document.text();
    if (hasUnrecordedEdits(request)) return undefined;
    const requested = fieldsSchema.parse(
        changes.map((change) => ({ path: change.path, installed: z.json().parse(change.value) })),
    );
    const parents = [...(recorded.parents ?? [])];
    const fields = installFields(document, request, recorded.fields, requested, parents);
    if (fields === undefined) return undefined;
    const remaining = pruneParents(
        document,
        parents,
        requested.map((field) => field.path),
    );
    return buildMergePlan(request, {
        text,
        nextText: document.text(),
        fields,
        parents: remaining,
        format: document.format,
    });
}
