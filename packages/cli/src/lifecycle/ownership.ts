import { applyBlock, blockSpan } from '#cli/emit/managed-blocks.ts';
import type { GeneratedFile } from '#cli/emit/types.ts';
import { configurationDocument } from '#cli/lifecycle/configuration-document.ts';
import { fileMode, mutationTarget, openConfinedRoot } from '#cli/lifecycle/confined.ts';
import type {
    FileProposal,
    FileSnapshot,
    LifecycleOwner,
    OwnershipEntry,
    OwnershipState,
} from '#cli/lifecycle/types.ts';
import { AsyncLocalStorage } from 'node:async_hooks';
import { createHash, randomUUID } from 'node:crypto';
import { realpathSync } from 'node:fs';
import { isDeepStrictEqual } from 'node:util';
import { z } from 'zod';

const RECORD = '.gspot/ownership.json';
const RECOVERY = '.gspot/recovery';
const LOCK = '.gspot/writer.lock';
const hashSchema = z.string().regex(/^[a-f0-9]{64}$/u);
const modeSchema = z.number().int().min(0).max(0o7777);
const identitySchema = z.strictObject({ hash: hashSchema, mode: modeSchema, isLink: z.literal(true).optional() });
const originalSchema = identitySchema.extend({
    backup: z.string().regex(/^\.gspot\/recovery\/[a-f0-9-]{36}\/[a-f0-9-]{36}\.original$/u),
});
const pathSchema = z.string().superRefine((path, context) => {
    try {
        mutationTarget(path);
    } catch (error) {
        context.addIssue({ code: 'custom', message: String(error) });
    }
});
const configurationPathSchema = z.array(z.union([z.string().min(1), z.number().int().nonnegative()])).min(1);
const configurationFieldSchema = z.strictObject({
    path: configurationPathSchema,
    installed: z.json(),
    original: z.json().optional(),
});
const configurationFieldsSchema = z.array(configurationFieldSchema).superRefine((fields, context) => {
    for (const [index, field] of fields.entries()) {
        for (const other of fields.slice(index + 1)) {
            const length = Math.min(field.path.length, other.path.length);
            if (field.path.slice(0, length).every((part, position) => part === other.path[position]))
                context.addIssue({
                    code: 'custom',
                    message: `Configuration fields overlap: ${field.path.join('.')} and ${other.path.join('.')}`,
                });
        }
    }
});

const entrySchema = z.strictObject({
    path: pathSchema,
    kind: z.enum(['config', 'block', 'merge', 'policy', 'pin', 'hook', 'lock', 'dependency', 'runtime', 'export']),
    installed: identitySchema.optional(),
    original: originalSchema.optional(),
    configuration: z
        .strictObject({
            format: z.enum(['json', 'yaml', 'toml']),
            fields: configurationFieldsSchema,
            parents: z.array(configurationPathSchema).optional(),
            edited: z.boolean(),
            created: z.boolean(),
        })
        .optional(),
    block: z
        .strictObject({
            style: z.enum(['markdown', 'hash']),
            installed: z.string().min(1),
            original: z.string(),
            prefix: z.string(),
        })
        .optional(),
});

export const ownershipSchema = z
    .strictObject({
        version: z.literal(1),
        files: z.array(entrySchema),
        installations: z.array(z.enum(['npm', 'python'])).optional(),
        pending: z
            .array(
                z.strictObject({
                    path: pathSchema,
                    before: identitySchema.optional(),
                    beforeBackup: originalSchema.optional(),
                    after: identitySchema.optional(),
                    entry: entrySchema.optional(),
                }),
            )
            .min(1)
            .optional(),
    })
    .superRefine((state, context) => {
        const paths = new Set<string>();
        for (const entry of state.files) {
            const key = entry.path.normalize('NFC').toLowerCase();
            if (paths.has(key))
                context.addIssue({ code: 'custom', message: `Duplicate ownership path: ${entry.path}` });
            paths.add(key);
        }
        const pendingPaths = new Set<string>();
        for (const pending of state.pending ?? []) {
            if (
                pending.beforeBackup !== undefined &&
                !isDeepStrictEqual(
                    {
                        hash: pending.beforeBackup.hash,
                        mode: pending.beforeBackup.mode,
                        ...(pending.beforeBackup.isLink ? { isLink: true } : {}),
                    },
                    pending.before,
                )
            )
                context.addIssue({ code: 'custom', message: 'Interrupted backup has a different previous identity.' });
            const key = pending.path.normalize('NFC').toLowerCase();
            if (pendingPaths.has(key))
                context.addIssue({ code: 'custom', message: `Duplicate pending path: ${pending.path}` });
            pendingPaths.add(key);
            if (pending.entry !== undefined && !isDeepStrictEqual(pending.entry.installed, pending.after))
                context.addIssue({
                    code: 'custom',
                    message: 'Interrupted ownership entry has a different installed identity.',
                });
            if (pending.entry !== undefined && pending.entry.path !== pending.path)
                context.addIssue({
                    code: 'custom',
                    message: 'Interrupted ownership entry has a different destination.',
                });
        }
    });

/** Preserve Git's writable checkout mode when exact generated bytes reproduce a read-only proposal. */
export function generatedSnapshot(file: GeneratedFile, current: FileSnapshot | undefined): FileSnapshot {
    const bytes = Buffer.from(file.content);
    const mode = fileMode({ mode: file.executable === true ? 0o755 : file.readOnly ? 0o444 : 0o644 });
    const checkout =
        mode === 0o444 &&
        current?.mode === fileMode({ mode: 0o644 }) &&
        current.isLink !== true &&
        current.bytes.equals(bytes);
    return { bytes, mode: checkout ? current.mode : mode };
}

function identity(file: FileSnapshot): z.infer<typeof identitySchema> {
    return {
        hash: createHash('sha256').update(file.bytes).digest('hex'),
        mode: fileMode(file),
        ...(file.isLink ? { isLink: true as const } : {}),
    };
}

function matches(file: FileSnapshot | undefined, expected: z.infer<typeof identitySchema> | undefined): boolean {
    if (file === undefined) return expected === undefined;
    if (expected === undefined) return false;
    const actual = identity(file);
    return actual.hash === expected.hash && actual.mode === expected.mode && actual.isLink === expected.isLink;
}

/** Remove empty containers only when this owner created them for managed fields. */
function pruneConfigurationParents(
    document: ReturnType<typeof configurationDocument>,
    parents: (string | number)[][],
    protectedFields: (string | number)[][] = [],
): (string | number)[][] {
    for (const parent of parents.toSorted((left, right) => right.length - left.length)) {
        if (
            protectedFields.some(
                (field) => field.length <= parent.length && field.every((part, index) => part === parent[index]),
            )
        )
            continue;
        const value = document.value(parent);
        if (value === null || typeof value !== 'object') continue;
        if (
            !Array.isArray(value) &&
            Object.getPrototypeOf(value) !== Object.prototype &&
            Object.getPrototypeOf(value) !== null
        )
            continue;
        if (Object.keys(value).length === 0) document.set(parent, undefined);
    }
    return parents.filter((parent) => document.value(parent) !== undefined);
}

/** Serialize local lifecycle writers and recover their durable ownership journal before mutation. */
export function openLifecycleOwner(root: string): LifecycleOwner {
    const confined = openConfinedRoot(root);
    try {
        confined.lock(LOCK);
        let recorded = confined.read(RECORD);
        const state: OwnershipState =
            recorded === undefined
                ? { version: 1, files: [] }
                : ownershipSchema.parse(JSON.parse(recorded.bytes.toString('utf8')));
        const entries = new Map(state.files.map((entry) => [entry.path.normalize('NFC').toLowerCase(), entry]));
        const save = (): void => {
            state.files = [...entries.values()];
            ownershipSchema.parse(state);
            const next = { bytes: Buffer.from(`${JSON.stringify(state, null, 2)}\n`), mode: 0o600 };
            confined.write(RECORD, next, recorded);
            recorded = next;
        };
        const accept = (pending: NonNullable<OwnershipState['pending']>[number]): void => {
            const key = pending.path.normalize('NFC').toLowerCase();
            if (pending.entry === undefined) entries.delete(key);
            else entries.set(key, pending.entry);
        };
        const finish = (): void => {
            for (const pending of state.pending!) accept(pending);
            delete state.pending;
            save();
        };
        if (state.pending !== undefined) {
            for (const pending of state.pending.toSorted(
                (left, right) => Number(left.before?.isLink === true) - Number(right.before?.isLink === true),
            )) {
                const current =
                    pending.before?.isLink || pending.after?.isLink
                        ? confined.readEntry(pending.path)
                        : confined.read(pending.path);
                if (matches(current, pending.after)) accept(pending);
                else if (current === undefined && pending.beforeBackup !== undefined) {
                    const saved = confined.read(pending.beforeBackup.backup);
                    if (saved === undefined || identity(saved).hash !== pending.beforeBackup.hash)
                        throw new Error(`Interrupted replacement backup is missing or changed: ${pending.path}`);
                    confined.write(
                        pending.path,
                        {
                            bytes: saved.bytes,
                            mode: pending.beforeBackup.mode,
                            ...(pending.beforeBackup.isLink ? { isLink: true } : {}),
                        },
                        undefined,
                    );
                } else if (!matches(current, pending.before))
                    throw new Error(
                        `Interrupted lifecycle operation conflicts with edited ${pending.path}. Preserve ${RECOVERY} and resolve that file before retrying.`,
                    );
            }
            delete state.pending;
            save();
        }
        const operation = `${RECOVERY}/${randomUUID()}`;
        let isRecoveryReady = false;
        const backup = (path: string, file: FileSnapshot): z.infer<typeof originalSchema> => {
            if (!isRecoveryReady) {
                confined.mkdir(RECOVERY, 0o700);
                confined.mkdir(operation, 0o700);
                isRecoveryReady = true;
            }
            const destination = `${operation}/${randomUUID()}.original`;
            confined.write(destination, { bytes: file.bytes, mode: 0o600 }, undefined);
            const details = { path, backup: destination, ...identity(file) };
            confined.write(
                `${destination}.json`,
                { bytes: Buffer.from(`${JSON.stringify(details)}\n`), mode: 0o600 },
                undefined,
            );
            return { backup: destination, ...identity(file) };
        };
        const find = (path: string): OwnershipEntry | undefined => {
            if (state.pending !== undefined)
                throw new Error(
                    'An interrupted mutation must be recovered before another operation. Reopen the lifecycle owner.',
                );
            mutationTarget(path);
            const folded = path.normalize('NFC').toLowerCase();
            const entry = entries.get(folded);
            if (entry !== undefined && entry.path !== path)
                throw new Error(`Lifecycle path aliases recorded ${entry.path}: ${path}`);
            return entry;
        };
        const proposeReplacement: LifecycleOwner['proposeReplacement'] = (
            path,
            next,
            kind,
            takeover = false,
            expected,
            proposed,
        ) => {
            const existing = find(path);
            confined.validate(path, next, proposed);
            const current =
                next.isLink || existing?.installed?.isLink || existing?.original?.isLink
                    ? confined.readEntry(path)
                    : confined.read(path);
            if (expected !== undefined && !isDeepStrictEqual(current, expected))
                throw new Error(`Configuration changed after takeover was planned: ${path}. Retry the command.`);
            const installed = identity(next);
            if (
                existing !== undefined &&
                !matches(current, existing.installed) &&
                current !== undefined &&
                kind !== 'policy' &&
                !(kind === 'lock' && takeover && expected !== undefined)
            )
                return { path, current, previous: existing, status: 'preserved' };
            if (existing === undefined && current !== undefined && !matches(current, installed) && !takeover)
                return { path, current, previous: existing, status: 'preserved' };
            if (existing !== undefined && matches(current, installed))
                return { path, current, previous: existing, status: 'unchanged' };
            const entry: OwnershipEntry = {
                path,
                kind,
                installed,
                ...(existing?.original === undefined ? {} : { original: existing.original }),
            };
            return {
                path,
                current,
                previous: existing,
                next,
                entry,
                saveOriginal: existing === undefined && current !== undefined,
                status: matches(current, installed) ? 'unchanged' : 'changed',
            };
        };
        const proposeBlock: LifecycleOwner['proposeBlock'] = (path, body, style) => {
            const existing = find(path);
            const current = confined.read(path);
            const text = current?.bytes.toString('utf8') ?? '';
            if (current !== undefined && !Buffer.from(text).equals(current.bytes))
                throw new Error(`Managed block destination is not UTF-8 text: ${path}`);
            const span = blockSpan(text, style);
            const recordedBlock = existing?.block;
            let nextText: string;
            let block: NonNullable<OwnershipEntry['block']>;
            if (recordedBlock !== undefined && current !== undefined) {
                if (recordedBlock.style !== style || span === undefined)
                    return { path, current, previous: existing, status: 'preserved' };
                const start = span.start - recordedBlock.prefix.length;
                if (start < 0 || text.slice(start, span.end) !== recordedBlock.installed)
                    return { path, current, previous: existing, status: 'preserved' };
                const installed = recordedBlock.prefix + applyBlock('', body, style);
                nextText = text.slice(0, start) + installed + text.slice(span.end);
                block = { ...recordedBlock, installed };
            } else {
                if (existing !== undefined && current !== undefined && !matches(current, existing.installed))
                    return { path, current, previous: existing, status: 'preserved' };
                nextText = applyBlock(text, body, style);
                const prefix = span !== undefined || text === '' ? '' : text.endsWith('\n') ? '\n' : '\n\n';
                block = {
                    style,
                    installed: prefix + applyBlock('', body, style),
                    original: span === undefined ? '' : text.slice(span.start, span.end),
                    prefix,
                };
            }
            const next = { bytes: Buffer.from(nextText), mode: current?.mode ?? 0o644 };
            if (existing?.block !== undefined && matches(current, identity(next)))
                return { path, current, previous: existing, status: 'unchanged' };
            const entry: OwnershipEntry = {
                path,
                kind: 'block',
                installed: identity(next),
                block,
                ...(existing?.original === undefined ? {} : { original: existing.original }),
            };
            return {
                path,
                current,
                previous: existing,
                next,
                entry,
                saveOriginal: existing === undefined && current !== undefined,
                status: nextText === text ? 'unchanged' : 'changed',
            };
        };
        const proposeRestoration: LifecycleOwner['proposeRestoration'] = (path, original) => {
            const existing = find(path);
            const current =
                existing?.installed?.isLink || existing?.original?.isLink
                    ? confined.readEntry(path)
                    : confined.read(path);
            const preserved = (): FileProposal => ({ path, current, previous: existing, status: 'preserved' });
            const restoredProposal = (next?: FileSnapshot): FileProposal => ({
                path,
                current,
                previous: existing,
                ...(next === undefined ? {} : { next }),
                status: 'changed',
            });
            if (existing === undefined) return preserved();
            if (
                current !== undefined &&
                existing.configuration !== undefined &&
                (existing.configuration.edited ||
                    !matches(current, existing.installed) ||
                    (existing.original === undefined && !existing.configuration.created))
            ) {
                const text = current.bytes.toString('utf8');
                if (!Buffer.from(text).equals(current.bytes)) return preserved();
                const document = configurationDocument(text, existing.configuration.format);
                for (const field of existing.configuration.fields) {
                    if (!isDeepStrictEqual(document.value(field.path), field.installed)) return preserved();
                }
                for (const field of existing.configuration.fields) document.set(field.path, field.original);
                pruneConfigurationParents(document, existing.configuration.parents ?? []);
                return restoredProposal({ bytes: Buffer.from(document.text()), mode: current.mode });
            }
            if (current !== undefined && existing.block !== undefined) {
                const text = current.bytes.toString('utf8');
                if (!Buffer.from(text).equals(current.bytes)) return preserved();
                const span = blockSpan(text, existing.block.style);
                if (span === undefined) return preserved();
                const start = span.start - existing.block.prefix.length;
                if (start < 0 || text.slice(start, span.end) !== existing.block.installed) return preserved();
                const next = text.slice(0, start) + existing.block.original + text.slice(span.end);
                return restoredProposal(
                    next === '' && existing.original === undefined
                        ? undefined
                        : { bytes: Buffer.from(next), mode: current.mode },
                );
            }
            if (current !== undefined && !matches(current, existing.installed)) return preserved();
            let restored: FileSnapshot | undefined;
            if (existing.original !== undefined) {
                const saved = confined.read(existing.original.backup);
                if (saved === undefined || identity(saved).hash !== existing.original.hash)
                    throw new Error(
                        `Original recovery bytes are missing or changed for ${path}: ${existing.original.backup}`,
                    );
                restored = {
                    bytes: saved.bytes,
                    mode: existing.original.mode,
                    ...(existing.original.isLink ? { isLink: true } : {}),
                };
            }
            return restoredProposal(original ?? restored);
        };

        const applyProposals: LifecycleOwner['applyProposals'] = (proposals) => {
            const destinations = new Set<string>();
            const proposed = new Map(
                proposals.map(({ path, next, current, status }) => [
                    path,
                    status === 'preserved' || (status === 'unchanged' && next === undefined) ? current : next,
                ]),
            );
            for (const proposal of proposals) {
                const { path, current, previous, next } = proposal;
                const key = path.normalize('NFC').toLowerCase();
                if (destinations.has(key)) throw new Error(`Duplicate proposal destination: ${path}`);
                destinations.add(key);
                const existing = find(path);
                if (next !== undefined) confined.validate(path, next, proposed);
                const actual = current?.isLink || next?.isLink ? confined.readEntry(path) : confined.read(path);
                if (!isDeepStrictEqual(existing, previous) || !isDeepStrictEqual(actual, current))
                    throw new Error(`File changed after its proposal: ${path}`);
            }
            const statuses = proposals.map((proposal) => proposal.status);
            const conflict = proposals.find((proposal) => proposal.status === 'preserved');
            if (conflict !== undefined)
                throw new Error(`Preserved edited or unowned ${conflict.path}. Review that file before applying.`);
            const prepared = proposals.flatMap((proposal) => {
                const { path, current, next, entry } = proposal;
                if (entry === undefined && proposal.status !== 'changed') return [];
                const recovery =
                    current !== undefined &&
                    (proposal.saveOriginal || next === undefined || !matches(current, identity(next)))
                        ? backup(path, current)
                        : undefined;
                const original = proposal.saveOriginal ? recovery : entry?.original;
                const recordedEntry =
                    entry === undefined ? undefined : { ...entry, ...(original === undefined ? {} : { original }) };
                return [{ path, current, next, entry: recordedEntry, recovery }];
            });
            if (prepared.length === 0) return statuses;
            state.pending = prepared.map(({ path, current, next, entry, recovery }) => ({
                path,
                ...(current === undefined ? {} : { before: identity(current) }),
                ...(recovery === undefined ? {} : { beforeBackup: recovery }),
                ...(next === undefined ? {} : { after: identity(next) }),
                ...(entry === undefined ? {} : { entry }),
            }));
            save();
            // Publish regular targets before links, including original targets restored in this batch.
            for (const { path, current, next } of prepared.toSorted(
                (left, right) => Number(left.next?.isLink === true) - Number(right.next?.isLink === true),
            )) {
                if (next === undefined) {
                    if (current !== undefined) confined.remove(path, current);
                } else if (!matches(current, identity(next))) confined.write(path, next, current);
            }
            finish();
            return statuses;
        };
        const applyProposal: LifecycleOwner['applyProposal'] = (proposal) =>
            proposal.status === 'preserved' ? 'preserved' : applyProposals([proposal])[0]!;

        return {
            beginInstallation(kind) {
                state.installations = [...new Set([...(state.installations ?? []), kind])];
                save();
            },
            finishInstallation(kind) {
                if (!state.installations?.includes(kind))
                    throw new Error('Installation recovery state changed. Retry gspot install.');
                state.installations = state.installations.filter((entry) => entry !== kind);
                if (state.installations.length === 0) delete state.installations;
                save();
            },
            proposeConfiguration(path, format, changes, takeover = false) {
                const existing = find(path);
                const current = confined.read(path);
                const text = current?.bytes.toString('utf8') ?? (format === 'toml' ? '' : '{}\n');
                if (current !== undefined && !Buffer.from(text).equals(current.bytes))
                    throw new Error(`Shared configuration is not UTF-8 text: ${path}`);
                const document = configurationDocument(text, format, current === undefined);
                if (existing?.configuration !== undefined && existing.configuration.format !== format)
                    return { path, current, previous: existing, status: 'preserved' };
                const requested = changes.map((change) => ({
                    path: change.path,
                    installed: z.json().parse(change.value),
                }));
                configurationFieldsSchema.parse(requested);
                const fields = [...(existing?.configuration?.fields ?? [])];
                let parents = [...(existing?.configuration?.parents ?? [])];
                if (
                    existing !== undefined &&
                    existing.configuration === undefined &&
                    current !== undefined &&
                    !matches(current, existing.installed)
                )
                    return { path, current, previous: existing, status: 'preserved' };
                for (const previous of [...fields]) {
                    if (requested.some((field) => isDeepStrictEqual(field.path, previous.path))) continue;
                    if (!isDeepStrictEqual(document.value(previous.path), previous.installed))
                        return { path, current, previous: existing, status: 'preserved' };
                    document.set(previous.path, previous.original);
                    fields.splice(fields.indexOf(previous), 1);
                }
                for (const field of requested) {
                    const value = document.value(field.path);
                    const previous = fields.find((entry) => isDeepStrictEqual(entry.path, field.path));
                    if (previous !== undefined && !isDeepStrictEqual(value, previous.installed))
                        return { path, current, previous: existing, status: 'preserved' };
                    if (
                        previous === undefined &&
                        current !== undefined &&
                        !takeover &&
                        !isDeepStrictEqual(value, field.installed)
                    )
                        return { path, current, previous: existing, status: 'preserved' };
                    const original =
                        previous !== undefined
                            ? previous.original
                            : value !== undefined
                              ? z.json().parse(value)
                              : undefined;
                    const entry = { ...field, ...(original === undefined ? {} : { original }) };
                    const index = fields.findIndex((entry) => isDeepStrictEqual(entry.path, field.path));
                    if (index === -1) fields.push(entry);
                    else fields[index] = entry;
                    for (let length = 1; length < field.path.length; length++) {
                        const parent = field.path.slice(0, length);
                        if (
                            document.value(parent) === undefined &&
                            !parents.some((path) => isDeepStrictEqual(path, parent))
                        )
                            parents.push(parent);
                    }
                    document.set(field.path, field.installed);
                }
                parents = pruneConfigurationParents(
                    document,
                    parents,
                    requested.map((field) => field.path),
                );
                const nextText = document.text();
                const next = { bytes: Buffer.from(nextText), mode: current?.mode ?? 0o644 };
                const edited =
                    existing?.configuration?.edited === true ||
                    (existing !== undefined && current !== undefined && !matches(current, existing.installed));
                if (
                    existing?.configuration !== undefined &&
                    isDeepStrictEqual(fields, existing.configuration.fields) &&
                    nextText === text
                )
                    return { path, current, previous: existing, status: 'unchanged' };
                const original = existing?.original;
                const saveOriginal = existing === undefined && current !== undefined;
                const entry: OwnershipEntry = {
                    path,
                    kind: 'merge',
                    installed: identity(next),
                    configuration: {
                        format,
                        fields,
                        ...(parents.length === 0 ? {} : { parents }),
                        edited,
                        created: existing?.configuration?.created ?? current === undefined,
                    },
                    ...(original === undefined ? {} : { original }),
                };
                return {
                    path,
                    current,
                    previous: existing,
                    next,
                    entry,
                    saveOriginal,
                    status: nextText === text ? 'unchanged' : 'changed',
                };
            },
            applyProposal,
            applyProposals,
            proposeBlock,
            replaceBlock(path, body, style) {
                return applyProposal(proposeBlock(path, body, style));
            },
            read(path) {
                mutationTarget(path);
                return confined.read(path);
            },
            paths() {
                return state.files.map((entry) => entry.path);
            },
            proposeReplacement,
            replace(path, next, kind, takeover = false, expected) {
                return applyProposal(proposeReplacement(path, next, kind, takeover, expected));
            },
            installedPaths() {
                return state.files.filter((entry) => entry.installed !== undefined).map((entry) => entry.path);
            },
            proposeRetirement(path, expected) {
                const existing = find(path);
                const current = confined.read(path);
                if (!isDeepStrictEqual(current, expected))
                    throw new Error(`Configuration changed after takeover was planned: ${path}. Retry the command.`);
                if (current === undefined) return { path, current, previous: existing, status: 'unchanged' };
                if (existing !== undefined && !matches(current, existing.installed))
                    return { path, current, previous: existing, status: 'preserved' };
                const original = existing?.original;
                const entry: OwnershipEntry = {
                    path,
                    kind: existing?.kind ?? 'config',
                    ...(original === undefined ? {} : { original }),
                };
                return {
                    path,
                    current,
                    previous: existing,
                    entry,
                    saveOriginal: existing === undefined,
                    status: 'changed',
                };
            },
            proposeRestoration,
            restore(path, original) {
                const proposal = proposeRestoration(path, original);
                if (proposal.status === 'preserved') return 'preserved';
                applyProposals([proposal]);
                return 'changed';
            },
            close() {
                confined.close();
            },
        };
    } catch (error) {
        confined.close();
        throw error;
    }
}

const activeMutation = new AsyncLocalStorage<Map<string, LifecycleOwner>>();

/** Reuse active mutation owners and serialize each repository or Git-resolved root. */
export function withLifecycleOwner<Result>(root: string, action: (owner: LifecycleOwner) => Result): Result {
    const canonical = realpathSync(root);
    const active = activeMutation.getStore();
    const existing = active?.get(canonical);
    if (existing !== undefined) return action(existing);
    const owner = openLifecycleOwner(canonical);
    try {
        const result = activeMutation.run(new Map([...(active ?? []), [canonical, owner]]), () => action(owner));
        if (result instanceof Promise) return result.finally(() => owner.close()) as Result;
        owner.close();
        return result;
    } catch (error) {
        owner.close();
        throw error;
    }
}

/** Read ownership for a preview without creating a lock, directory, or journal. */
export function readOwnership(root: string): OwnershipState {
    const files = openConfinedRoot(root);
    try {
        const record = files.read(RECORD);
        return record === undefined
            ? { version: 1, files: [] }
            : ownershipSchema.parse(JSON.parse(record.bytes.toString('utf8')));
    } finally {
        files.close();
    }
}
