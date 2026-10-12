import { z } from 'zod';
import type { SchemaShape } from '#cli/types/objects.ts';
import { TOOL_FOLDER_KINDS } from '#cli/config/system/locations.ts';
import { BLOCK_STYLES } from '#cli/config/system/managed-blocks.ts';
import { assertWritablePath } from '#cli/system/safe-folder/names.ts';
import { SHA256_HEX, OWNED_KINDS, MANAGED_KEYS_FORMATS, OWNERSHIP_LOG_VERSION } from '#cli/config/ownership.ts';

import type {
    Identity,
    OwnedFile,
    ManagedKey,
    OwnedBlock,
    ManagedKeys,
    PendingWrite,
    OwnershipState,
    CapturedLintRules,
} from '#cli/types/ownership.ts';

const hashSchema = z.string().regex(SHA256_HEX);

const pathSchema = z.string().superRefine((path, context) => {
    try {
        assertWritablePath(path);
    } catch (error) {
        context.addIssue({ code: 'custom', message: String(error) });
    }
});

const keyPathSchema = z.array(z.union([z.string().min(1), z.number().int().nonnegative()])).min(1);

const managedKeySchema = z.strictObject({
    path: keyPathSchema,
    installed: z.json(),
    original: z.json().optional(),
} satisfies SchemaShape<ManagedKey>);

const identitySchema = z.strictObject({
    hash: hashSchema,
    isLink: z.literal(true).optional(),
} satisfies SchemaShape<Identity>);

const ownedFileSchema = z.strictObject({
    path: pathSchema,
    kind: z.enum(OWNED_KINDS),
    written: identitySchema.optional(),
    // The file already held the exact bytes when gspot first wrote it, so a prune leaves it in place.
    adopted: z.literal(true).optional(),
    keys: z
        .strictObject({
            format: z.enum(MANAGED_KEYS_FORMATS),
            fields: z.array(managedKeySchema),
            parents: z.array(keyPathSchema).optional(),
            edited: z.boolean(),
            created: z.boolean(),
        } satisfies SchemaShape<ManagedKeys>)
        .optional(),
    block: z
        .strictObject({
            style: z.enum(BLOCK_STYLES),
            installed: z.string().min(1),
            original: z.string(),
            prefix: z.string(),
            // Whether the block created its file, which removing the block then deletes.
            created: z.boolean(),
        } satisfies SchemaShape<OwnedBlock>)
        .optional(),
} satisfies SchemaShape<OwnedFile>);

export const capturedLintRulesSchema = z.record(
    z.string(),
    z.record(z.string(), z.json()),
) satisfies z.ZodType<CapturedLintRules>;

export const ownershipStateSchema = z.strictObject({
    version: z.literal(OWNERSHIP_LOG_VERSION),
    files: z.array(ownedFileSchema),
    // Rule values from the last apply that completed every managed write.
    lintRules: z.record(pathSchema, capturedLintRulesSchema).optional(),
    // The tool-project folders gspot installed whole, by kind.
    installed: z.array(z.enum(TOOL_FOLDER_KINDS)).optional(),
    pending: z
        .array(
            z.strictObject({
                path: pathSchema,
                before: identitySchema.optional(),
                after: identitySchema.optional(),
                entry: ownedFileSchema.optional(),
            } satisfies SchemaShape<PendingWrite>),
        )
        .min(1)
        .optional(),
} satisfies SchemaShape<OwnershipState>);
