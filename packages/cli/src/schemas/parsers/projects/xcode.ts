import { z } from 'zod';
import type { SchemaShape } from '#cli/types/shapes.ts';
import type { PbxElement } from '#cli/types/parsers/projects/xcode.ts';

const itemSchema = z.object({
    isa: z.string(),
    buildSettings: z
        .object({
            SDKROOT: z.string().optional(),
            SWIFT_VERSION: (
                (z.union([z.string(), z.number()]) satisfies z.ZodType<string | number>).transform(
                    String,
                ) satisfies z.ZodType<string, string | number>
            ).optional(),
        } satisfies SchemaShape<NonNullable<PbxElement['buildSettings']>>)
        .optional(),
    name: z.string().optional(),
    path: z.string().optional(),
    sourceTree: z.string().optional(),
    children: z.array(z.string()).optional(),
    fileRef: z.string().optional(),
    files: z.array(z.string()).optional(),
    buildPhases: z.array(z.string()).optional(),
    fileSystemSynchronizedGroups: z.array(z.string()).optional(),
    exceptions: z.array(z.string()).optional(),
    membershipExceptions: z.array(z.string()).optional(),
    target: z.string().optional(),
    productType: z.string().optional(),
    mainGroup: z.string().optional(),
    targets: z.array(z.string()).optional(),
    projectDirPath: z.string().optional(),
} satisfies SchemaShape<PbxElement>);

export const pbxprojSchema = z.object({
    rootObject: z.string(),
    objects: z.record(z.string(), itemSchema),
} satisfies SchemaShape<{ rootObject: string; objects: Record<string, PbxElement> }>);
