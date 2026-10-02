import { z } from 'zod';
import { isDeepStrictEqual } from 'node:util';
import { MODE_BITS } from '#cli/config/platform/root.ts';
import { mutationTarget } from '#cli/platform/safe-paths.ts';
import { OWNED_KINDS } from '#cli/config/lifecycle/ownership.ts';

const hashSchema = z.string().regex(/^[a-f0-9]{64}$/u);
const modeSchema = z.number().int().min(0).max(MODE_BITS);
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
export const identitySchema = z.strictObject({
    hash: hashSchema,
    mode: modeSchema,
    isLink: z.literal(true).optional(),
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
    kind: z.enum(OWNED_KINDS),
    installed: identitySchema.optional(),
    // The file already held the exact bytes when gspot first wrote it, so a prune leaves it in place.
    adopted: z.literal(true).optional(),
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
            // Whether the block created its file, which removing the block then deletes.
            created: z.boolean(),
        })
        .optional(),
});

export const ownershipSchema = z
    .strictObject({
        version: z.literal(1),
        files: z.array(entrySchema),
        installations: z.array(z.enum(['npm', 'python'])).optional(),
        // The private tool folders gspot installed whole, by kind.
        installs: z.array(z.enum(['npm', 'python'])).optional(),
        pending: z
            .array(
                z
                    .strictObject({
                        path: pathSchema,
                        before: identitySchema.optional(),
                        after: identitySchema.optional(),
                        entry: entrySchema.optional(),
                    })
                    .superRefine((pending, context) => {
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
            const key = pending.path.normalize('NFC').toLowerCase();
            if (pendingPaths.has(key))
                context.addIssue({ code: 'custom', message: `Duplicate pending path: ${pending.path}` });
            pendingPaths.add(key);
        }
    });
