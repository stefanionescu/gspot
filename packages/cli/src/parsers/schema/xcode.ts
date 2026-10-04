import { z } from 'zod';

const itemSchema = z.object({
    isa: z.string(),
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
});

export const pbxprojSchema = z.object({ rootObject: z.string(), objects: z.record(z.string(), itemSchema) });

/** The test target membership consumed from an Xcode test plan. */
export const testPlanSchema = z.object({
    testTargets: z
        .array(
            z.object({
                target: z.object({ name: z.string().optional() }).optional(),
                skippedTests: z.array(z.string()).optional(),
            }),
        )
        .optional(),
});

/** String catalog metadata and translation records. */
export const stringsFileSchema = z.object({
    sourceLanguage: z.string().optional(),
    strings: z
        .record(
            z.string(),
            z.object({
                shouldTranslate: z.boolean().optional(),
                localizations: z.record(z.string(), z.unknown()).optional(),
            }),
        )
        .optional(),
});

/** Image file references consumed from asset catalog contents. */
export const assetContentsSchema = z.object({
    images: z.array(z.object({ filename: z.string().optional() })).optional(),
});
