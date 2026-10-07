import { z } from 'zod';
import { isDeepStrictEqual } from 'node:util';
import { pathKey } from '#cli/platform/paths.ts';
import { MODE_BITS } from '#cli/config/platform/modes.ts';
import { ruleSettingsSchema } from '#cli/parsers/schema/rules.ts';
import { INSTALLATION_KINDS } from '#cli/config/configurations.ts';
import { assertMutationTarget } from '#cli/platform/root/rules.ts';
import { BLOCK_STYLES } from '#cli/config/platform/managed-blocks.ts';
import { OWNED_KINDS, MERGED_CONFIGURATION_FORMATS } from '#cli/config/lifecycle/ownership.ts';

const hashSchema = z.string().regex(/^[a-f0-9]{64}$/u);
const modeSchema = z.number().int().min(0).max(MODE_BITS);
const pathSchema = z.string().superRefine((path, context) => {
    try {
        assertMutationTarget(path);
    } catch (error) {
        context.addIssue({ code: 'custom', message: String(error) });
    }
});
const keyPathSchema = z.array(z.union([z.string().min(1), z.number().int().nonnegative()])).min(1);
const configurationFieldSchema = z.strictObject({
    path: keyPathSchema,
    installed: z.json(),
    original: z.json().optional(),
});
const identitySchema = z.strictObject({
    hash: hashSchema,
    mode: modeSchema,
    isLink: z.literal(true).optional(),
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

const fileSchema = z.strictObject({
    path: pathSchema,
    kind: z.enum(OWNED_KINDS),
    installed: identitySchema.optional(),
    // The file already held the exact bytes when gspot first wrote it, so a prune leaves it in place.
    adopted: z.literal(true).optional(),
    configuration: z
        .strictObject({
            format: z.enum(MERGED_CONFIGURATION_FORMATS),
            fields: configurationFieldsSchema,
            parents: z.array(keyPathSchema).optional(),
            edited: z.boolean(),
            created: z.boolean(),
        })
        .optional(),
    block: z
        .strictObject({
            style: z.enum(BLOCK_STYLES),
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
        files: z.array(fileSchema),
        // Rule values from the last apply that completed every managed write.
        rules: z.record(pathSchema, ruleSettingsSchema).optional(),
        // Language and framework overrides against the last applied selection, by scope.
        selections: z
            .record(
                z.union([z.literal(''), pathSchema]),
                z.strictObject({
                    configurations: z.array(z.string()),
                    added: z.array(z.string()),
                    removed: z.array(z.string()),
                }),
            )
            .optional(),
        installing: z.array(z.enum(INSTALLATION_KINDS)).optional(),
        // The private tool folders gspot installed whole, by kind.
        installed: z.array(z.enum(INSTALLATION_KINDS)).optional(),
        pending: z
            .array(
                z
                    .strictObject({
                        path: pathSchema,
                        before: identitySchema.optional(),
                        after: identitySchema.optional(),
                        entry: fileSchema.optional(),
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
            const key = pathKey(entry.path);
            if (paths.has(key))
                context.addIssue({ code: 'custom', message: `Duplicate ownership path: ${entry.path}` });
            paths.add(key);
        }
        const pendingPaths = new Set<string>();
        for (const pending of state.pending ?? []) {
            const key = pathKey(pending.path);
            if (pendingPaths.has(key))
                context.addIssue({ code: 'custom', message: `Duplicate pending path: ${pending.path}` });
            pendingPaths.add(key);
        }
    });

export const fieldsSchema = fileSchema.shape.configuration.unwrap().shape.fields;
