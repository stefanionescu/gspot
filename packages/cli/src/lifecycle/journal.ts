import { z } from 'zod';
import { isDeepStrictEqual } from 'node:util';
import { mutationPath, mutationTarget } from '#cli/platform/filesystem.ts';

const hashSchema = z.string().regex(/^[a-f0-9]{64}$/u);
const modeSchema = z.number().int().min(0).max(0o7777);
export const identitySchema = z.strictObject({
    hash: hashSchema,
    mode: modeSchema,
    isLink: z.literal(true).optional(),
});
export const originalSchema = identitySchema.extend({
    backup: z
        .string()
        .superRefine((value, context) => {
            try {
                mutationPath(value);
            } catch (error) {
                context.addIssue({ code: 'custom', message: String(error) });
            }
        })
        .regex(/^(?:[^/]+\/)*\.gspot\/state\/recovery\/[a-f0-9-]{36}\/[a-f0-9-]{36}\.original$/u),
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
export const configurationFieldsSchema = z.array(configurationFieldSchema).superRefine((fields, context) => {
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

export const entrySchema = z.strictObject({
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

export type OwnershipState = z.infer<typeof ownershipSchema>;

export type OwnershipEntry = OwnershipState['files'][number];
