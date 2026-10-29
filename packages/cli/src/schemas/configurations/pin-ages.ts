import { z } from 'zod';
import type { SchemaShape } from '#cli/types/shapes.ts';
import type { MiseVersion, NpmPackageTimes, PypiReleaseFiles } from '#cli/types/pin-ages.ts';

export const miseVersionsSchema = z
    .looseObject({
        version: z.string(),
        created_at: z.string().optional(),
    } satisfies SchemaShape<MiseVersion>)
    .array();

export const npmPackageTimesSchema = z.looseObject({
    time: z.record(z.string(), z.string()),
} satisfies SchemaShape<NpmPackageTimes>);

export const pypiReleaseFilesSchema = z.looseObject({
    urls: z
        .looseObject({
            upload_time_iso_8601: z.string(),
        } satisfies SchemaShape<PypiReleaseFiles['urls'][number]>)
        .array(),
} satisfies SchemaShape<PypiReleaseFiles>);
