import { z } from 'zod';
import type { SchemaShape } from '#cli/types/shapes.ts';
import type { PbxElement } from '#cli/types/parsers/projects/xcode.ts';

const buildSettingsSchema = z.object({
    SDKROOT: z.string().optional(),
    SWIFT_VERSION: (
        (z.union([z.string(), z.number()]) satisfies z.ZodType<string | number>).transform(String) satisfies z.ZodType<
            string,
            string | number
        >
    ).optional(),
} satisfies SchemaShape<NonNullable<PbxElement['buildSettings']>>);

const pbxRecordSchema = z.object({
    isa: z.string(),
    buildSettings: buildSettingsSchema.optional(),
    name: z.string().optional(),
    path: z.string().optional(),
    sourceTree: z.string().optional(),
    children: z.string().array().optional(),
    fileRef: z.string().optional(),
    files: z.string().array().optional(),
    buildPhases: z.string().array().optional(),
    fileSystemSynchronizedGroups: z.string().array().optional(),
    exceptions: z.string().array().optional(),
    membershipExceptions: z.string().array().optional(),
    target: z.string().optional(),
    mainGroup: z.string().optional(),
    targets: z.string().array().optional(),
    projectDirPath: z.string().optional(),
} satisfies SchemaShape<PbxElement>);

export const pbxprojSchema = z.object({
    rootObject: z.string(),
    objects: z.record(z.string(), pbxRecordSchema),
} satisfies SchemaShape<{ rootObject: string; objects: Record<string, PbxElement> }>);
