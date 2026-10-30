import { z } from 'zod';

const buildSettingsSchema = z.object({
    SDKROOT: z.string().optional(),
    SWIFT_VERSION: z.string().optional(),
});

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
});

export const pbxprojSchema = z.object({
    rootObject: z.string(),
    objects: z.record(z.string(), pbxRecordSchema),
});
